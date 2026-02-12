# Architecture Roadmap

## Server as Hub

The work3 server is the central hub. All clients (UI, CLI subcommands, MCP agents, Electron app) connect to it via HTTP/WebSocket. The server owns the single `WorktreeManager` instance and all state.

### Current State

- `work3` starts the Hono HTTP server, serves the React UI, and exposes REST + SSE + WebSocket APIs
- `work3 mcp` starts a **separate** stdio process with its own `WorktreeManager` (no shared state)
- `server.json` is written to `.work3/` on startup with the server URL and PID

### Target State

- `/mcp` endpoint on the HTTP server provides MCP via Streamable HTTP transport (done)
- MCP setup writes `{ "url": "http://localhost:PORT/mcp" }` instead of `{ "command": "work3", "args": ["mcp"] }` (done)
- All MCP clients share state with the UI (same `WorktreeManager`)
- `work3 mcp` (stdio) remains as a fallback for environments that don't support HTTP transport

## Both Entry Points

### CLI-first (current)

```
npm install -g work3   # or brew install work3
cd my-project
work3 init             # creates .work3/config.json
work3                  # starts server + opens browser
```

### App-first (future)

```
# User downloads Electron app (or installs via brew cask)
# App opens, user picks a project directory
# App calls work3 init internally, starts embedded server
# App installs CLI to PATH for terminal usage
```

Both entry points converge on the same server. The Electron app embeds the server; the CLI starts it as a daemon. Either way, `server.json` advertises the running instance.

## CLI Commands as Thin HTTP Clients

Future CLI subcommands should be thin clients that talk to the running server:

- `work3 list` — `GET /api/worktrees` and print table
- `work3 task PROJ-123` — `POST /api/worktrees/from-jira` and print result
- `work3 connect jira` — `POST /api/integrations/jira/...` (or open browser for OAuth)
- `work3 status` — `GET /api/integrations/verify` and print connection status

If the server isn't running, the CLI should either:
1. Auto-start it in the background (write PID to `server.json`)
2. Error with a helpful message ("run `work3` first")

## `server.json` as Discovery

All clients find the server via `.work3/server.json`:

```json
{
  "url": "http://localhost:6969",
  "pid": 12345
}
```

- CLI commands read this to know where to send HTTP requests
- MCP config points to `${url}/mcp`
- Electron app checks if a server is already running before starting its own
- Stale entries (dead PID) are detected and cleaned up

## Installation Flow

```
                    +-------------------+
                    |  npm install -g   |
                    |  work3             |
                    +---------+---------+
                              |
                    +---------v---------+
                    |  CLI available    |
                    |  in PATH          |
                    +---------+---------+
                              |
              +---------------+---------------+
              |                               |
    +---------v---------+           +---------v---------+
    |  work3 init        |           |  work3             |
    |  (setup project)  |           |  (start server)   |
    +-------------------+           +---------+---------+
                                              |
                                    +---------v---------+
                                    |  server.json      |
                                    |  written           |
                                    +---------+---------+
                                              |
                          +-------------------+-------------------+
                          |                   |                   |
                +---------v------+  +---------v------+  +---------v------+
                |  Browser UI    |  |  MCP clients   |  |  CLI commands  |
                |  (React SPA)   |  |  (Claude, etc) |  |  (work3 list)   |
                +----------------+  +----------------+  +----------------+
```
