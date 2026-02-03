# wok3

A dev tool that manages multiple git worktrees and automatically resolves port conflicts between them. When you run a dev command that binds multiple ports (Express, Vite HMR, etc.), running a second copy causes port conflicts. wok3 solves that by monkey-patching Node.js `net.Server.listen` and `net.Socket.connect` to transparently offset all known ports per worktree instance.

## Quick Start

```bash
# Install globally
npm link

# In your project
cd /path/to/your/project
wok3 init    # interactive setup
wok3         # start the manager UI
```

Then in the UI:
1. Click **Discover Ports** to auto-detect all ports your dev command binds
2. Create worktrees from branches and start them — ports are offset automatically

## How It Works

```
Main repo:    api:4000, web:4100  (no offset)
Worktree 1:   api:4001, web:4101  (offset=1)
Worktree 2:   api:4002, web:4102  (offset=2)
```

Inter-app communication also works — if `web-server` connects to `api-server` on port 4000, the hook redirects that connection to 4001 within worktree 1.

## Architecture

wok3 has four layers: a **CLI** that loads config, a **Hono HTTP server** with REST API + SSE, a **React UI** served as a static SPA, and a **runtime hook** injected into worktree processes.

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     wok3 Server (:3100)                         │
│                                                                 │
│  CLI (cli.ts)                                                   │
│   └─ loads .wok3/config.json, starts Hono server                │
│                                                                 │
│  Hono API (server/index.ts)                                     │
│   ├─ REST endpoints (CRUD worktrees, start/stop, discover)      │
│   ├─ SSE stream (/api/events) → pushes state to UI              │
│   └─ serves static React UI from dist/ui/                       │
│                                                                 │
│  WorktreeManager (server/manager.ts)                            │
│   ├─ git worktree add/remove                                    │
│   ├─ async creation with progress (SSE status updates)          │
│   ├─ spawn/kill dev processes                                   │
│   ├─ capture logs (last 100 lines per worktree)                 │
│   └─ copy .env* files recursively into new worktrees            │
│                                                                 │
│  PortManager (server/port-manager.ts)                           │
│   ├─ discoverPorts() — runs dev cmd, monitors with lsof         │
│   ├─ allocateOffset() — assigns 1, 2, 3... to worktrees        │
│   ├─ getEnvForOffset() — builds NODE_OPTIONS + env vars         │
│   └─ detectEnvMapping() — scans .env* files for port refs       │
└─────────────────────────────────────────────────────────────────┘
                              │
            spawn(startCommand, {
              cwd: worktree/projectDir,
              env: {
                NODE_OPTIONS: "--require port-hook.cjs",
                __WM_PORT_OFFSET__: "1",
                __WM_KNOWN_PORTS__: "[3000,24678]",
                PORT: "3001"           ← from envMapping
              }
            })
                              │
                              ▼
                ┌───────────────────────┐
                │  Worktree Process     │
                │  port-hook.cjs active │
                │                       │
                │  listen(3000) → 3001  │
                │  connect(3000)→ 3001  │
                └───────────────────────┘
```

### The Port Hook (`src/runtime/port-hook.cjs`)

The core mechanism. A pure CommonJS file with zero dependencies, loaded via `NODE_OPTIONS="--require ..."`. It reads two env vars at startup:

- `__WM_PORT_OFFSET__` — numeric offset (e.g., `1`)
- `__WM_KNOWN_PORTS__` — JSON array of ports to intercept (e.g., `[3000,24678]`)

It patches two Node.js primitives:

1. **`net.Server.prototype.listen`** — if the port being bound is in the known set, adds the offset
2. **`net.Socket.prototype.connect`** — if an outgoing connection targets a known port on localhost, redirects to the offset port. Handles three calling conventions: `connect(port, host)`, `connect({port, host})`, and `connect([{port, host}, cb])` (Node.js HTTP agent internal form)

Since `NODE_OPTIONS` propagates to all child Node.js processes, the hook is automatically active in the entire process tree (turborepo, yarn, tsx, vite, etc.).

### Env Mapping

Some frameworks read port values from `.env` files and use them in ways the hook can't intercept (e.g., HMR WebSocket URLs baked into client bundles). wok3 handles this with **env mapping**:

1. `detectEnvMapping()` recursively scans all `.env*` files for values containing known ports
2. It saves templates like `PORT=${3000}` to `.wok3/config.json` under `envMapping`
3. At start time, `getEnvForOffset()` resolves templates with the offset (e.g., `PORT=3001`) and injects them as process environment variables
4. Process env takes priority over `.env` in most frameworks (dotenv, Vite, Next.js)

### Worktree Creation Flow

1. User submits branch name via UI → POST `/api/worktrees`
2. Server validates, creates a placeholder entry with `status: 'creating'`, returns immediately
3. Async background work begins, pushing SSE updates at each step:
   - **Fetching branch...** → `git fetch origin <branch>`
   - **Creating worktree...** → `git worktree add` (with fallback cascade)
   - **Installing dependencies...** → runs configured `installCommand`
4. `.env*` files are recursively copied from the main project into the worktree (gitignored files aren't included by `git worktree add`)
5. Placeholder is removed; the worktree appears as `stopped` from the filesystem scan

### What it catches vs. doesn't

| Works | Doesn't work |
|-------|-------------|
| Express, Hono, Fastify, Koa (any `server.listen()`) | Non-Node processes (Python, Go, Ruby) |
| Vite, Webpack dev server, Next.js | Docker port mappings |
| `http.request()`, `fetch()` (undici), WebSockets | |
| Child processes spawned by Node.js | |
| ESM projects (`"type": "module"`) | |

## Config (`.wok3/config.json`)

Generate one with `wok3 init`, or create manually:

```json
{
  "worktreesDir": ".wok3/worktrees",
  "startCommand": "yarn dev",
  "installCommand": "yarn install",
  "baseBranch": "origin/develop",
  "serverPort": 3100,
  "ports": {
    "discovered": [3000, 24678],
    "offsetStep": 1
  },
  "envMapping": {
    "PORT": "${3000}"
  }
}
```

| Field | Description |
|-------|-------------|
| `projectDir` | Subdirectory to `cd` into before running `startCommand` (relative to worktree root). Omit or `"."` for repo root |
| `worktreesDir` | Where worktrees are created (relative to repo root) |
| `startCommand` | The dev command to run in each worktree |
| `installCommand` | Command to install dependencies in new worktrees |
| `baseBranch` | Git ref to branch worktrees from. Auto-detected by `init` |
| `serverPort` | Port for the manager UI itself |
| `ports.discovered` | All ports the dev command binds (auto-detected or manual). Set to `[]` to use the UI discovery button |
| `ports.offsetStep` | How much to increment per instance (default: 1) |
| `envMapping` | Templates for env vars containing ports. `${3000}` gets replaced with `3000 + offset` at runtime |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/worktrees` | List all worktrees |
| POST | `/api/worktrees` | Create worktree `{branch, name?}` |
| PATCH | `/api/worktrees/:id` | Rename worktree `{name?, branch?}` |
| POST | `/api/worktrees/:id/start` | Start a worktree's dev server |
| POST | `/api/worktrees/:id/stop` | Stop a worktree's dev server |
| DELETE | `/api/worktrees/:id` | Remove worktree (stops first) |
| GET | `/api/worktrees/:id/logs` | Get process output (last 100 lines) |
| GET | `/api/config` | Get current config + project name |
| GET | `/api/ports` | Get discovered ports + offset step |
| POST | `/api/discover` | Run port discovery |
| POST | `/api/detect-env` | Scan .env files for port references |
| GET | `/api/events` | SSE stream — real-time worktree state updates |

## Repo Structure

```
├── src/
│   ├── cli.ts                    # CLI entry point, loads .wok3/config.json
│   ├── index.ts                  # Package exports
│   ├── server/
│   │   ├── types.ts              # All TypeScript interfaces
│   │   ├── manager.ts            # WorktreeManager — git ops, process spawn, .env copy
│   │   ├── port-manager.ts       # PortManager — discovery, offsets, env mapping
│   │   └── index.ts              # Hono server, API routes, SSE events
│   ├── runtime/
│   │   └── port-hook.cjs         # The net.Server/net.Socket monkey-patch (CJS, no deps)
│   └── ui/
│       ├── App.tsx               # React root
│       ├── main.tsx              # DOM mount
│       ├── index.html            # HTML shell
│       ├── hooks/
│       │   └── useWorktrees.ts   # SSE hook + all API client functions
│       └── components/
│           ├── Header.tsx        # Project name, connection status, port discovery
│           ├── CreateForm.tsx    # Branch name input + create button
│           ├── ConfirmModal.tsx  # Reusable confirmation dialog
│           ├── WorktreeList.tsx  # List container
│           └── WorktreeItem.tsx  # Worktree card (creating/deleting/running/stopped states)
├── test-project/                 # Minimal 2-server app for testing
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Platform Constraints

- **Unix/macOS only** — depends on `lsof` for port discovery and process group signals
- **Node.js processes only** — the `--require` hook doesn't work with non-Node runtimes
