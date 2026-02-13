# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Notes

- **No backwards compatibility needed.** There are no users — data gets deleted and recreated from scratch. Don't add migration code, backfill logic, or compatibility shims.
- **Never use native `title` attribute for tooltips.** Always use the `Tooltip` component (`src/ui/components/Tooltip.tsx`) instead.

## What This Is

work3 is a CLI tool + web UI (with optional Electron app) for managing multiple git worktrees with automatic port offsetting and Jira/Linear/GitHub integrations. It solves port conflicts when running multiple dev server instances concurrently by monkey-patching Node.js `net.Server.listen` and `net.Socket.connect` at runtime via `--require`.

## Build & Dev Commands

**Package manager**: pnpm

```bash
# Build everything (tsup for backend + vite for UI + copy port-hook.cjs)
pnpm build

# Dev mode (concurrent watch for backend and frontend)
pnpm dev

# Run the built CLI
pnpm start

# Type checking
pnpm check-types

# Lint
pnpm check-lint
pnpm format-lint   # auto-fix
```

There is no test runner configured.

## CLI Subcommands

- `work3` — Start the server and open UI (Electron app if available, otherwise browser)
- `work3 init` — Interactive setup wizard to create `.work3/config.json`
- `work3 connect` — Connect to an existing work3 server
- `work3 mcp` — Start as an MCP server (for AI coding agents)
- `work3 task <TASK_ID>` — Create worktree from an issue ID
- `work3 add [name]` — Set up an integration (github, linear, jira)

## Architecture

**Dual build system**: tsup bundles the backend (CLI + Hono server) as ESM; Vite bundles the React UI as a SPA served from `dist/ui/`.

### Key Modules

**Backend:**
- **`src/cli/index.ts`** — CLI entry point. Routes subcommands, starts server, opens UI in Electron or browser.
- **`src/cli/config.ts`** — Loads `.work3/config.json` (walks up directory tree to find it).
- **`src/cli/init.ts`** — Interactive setup wizard.
- **`src/server/index.ts`** — Hono HTTP server with REST API + WebSocket support for terminals. Routes organized in `src/server/routes/`.
- **`src/server/manager.ts`** — `WorktreeManager` class. Orchestrates git worktree operations, spawns/kills dev processes, captures logs, emits SSE events.
- **`src/server/port-manager.ts`** — `PortManager` class. Discovers ports via `lsof`, allocates/releases offsets, builds env vars for spawned processes.
- **`src/server/terminal-manager.ts`** — `TerminalManager` class. Manages PTY sessions for interactive terminals via WebSockets.
- **`src/server/notes-manager.ts`** — `NotesManager` class. Issue notes, AI context, and todo checklists.
- **`src/server/verification-manager.ts`** — `HooksManager` class. Hooks system (command steps + skill references with trigger types).
- **`src/runtime/port-hook.cjs`** — The core innovation. Pure CJS with zero dependencies. Patches `net.Server.prototype.listen` and `net.Socket.prototype.connect` to offset known ports.
- **`src/mcp.ts`** — MCP (Model Context Protocol) server for AI coding agent integration.
- **`src/actions.ts`** — All MCP tool definitions (20+ tools).

**Integrations:**
- **`src/integrations/jira/`** — Jira Cloud API integration: OAuth authentication, issue fetching, ADF-to-Markdown conversion.
- **`src/integrations/linear/`** — Linear integration: API key auth, GraphQL queries, issue fetching.
- **`src/integrations/github/`** — GitHub integration via `gh` CLI: PR creation, commit, push, status checking.

**Frontend (React + Tailwind + React Query + Framer Motion):**
- **`src/ui/App.tsx`** — Main app with views: workspace, agents, verification, configuration, integrations.
- **`src/ui/theme.ts`** — Centralized theme tokens. **All UI components must import from this file instead of hardcoding Tailwind color classes.**
- **`src/ui/components/`** — UI components (sidebar items, detail panels, modals, forms).
- **`src/ui/components/detail/`** — Right panel components (worktree, Jira, Linear, local issue detail views).
- **`src/ui/hooks/`** — React hooks (SSE, React Query, WebSocket, API client).

**Electron:**
- **`electron/main.ts`** — Electron main process with multi-project support, `work3://` protocol, window management.

### Data Flow

1. User creates a worktree via UI → API → `git worktree add` + configured install command
2. User starts it → `PortManager.allocateOffset()` → spawn with `--require port-hook.cjs` + offset env vars
3. `port-hook.cjs` intercepts `listen(4000)` → `listen(4001)`, `connect(4000)` → `connect(4001)`
4. SSE stream pushes status updates to UI in real-time
5. Terminal sessions use WebSockets for bidirectional PTY communication

### Platform Constraints

- Unix/macOS only (depends on `lsof` and `pgrep`)
- Node.js processes only (the `--require` hook doesn't work with non-Node runtimes)
- GitHub integration requires `gh` CLI installed and authenticated
- Jira integration requires OAuth setup via the Integrations panel

### Configuration

`.work3/config.json` at project root defines: `projectDir`, `startCommand`, `installCommand`, `baseBranch`, `serverPort`, discovered `ports` with `offsetStep`, `envMapping`, and integration settings. Worktrees are always stored in `.work3/worktrees`.

## Agent Tooling Principles

All agent-facing features must be:
1. **Agent-agnostic first** — exposed via MCP tools that any agent can use
2. **Enhanced for Claude** — when Claude is detected, nudge toward useful plugins (superpowers, Playwright MCP)
3. **Self-service** — plugins installed/configured through work3's UI and MCP tools, not manual setup
4. **Discoverable** — agents can query what's available and get recommendations

## Documentation

Comprehensive documentation lives in `/docs/`. **Read the relevant docs before working on unfamiliar areas** — they contain architectural context, component patterns, and API details that will help you make correct changes.

When making significant changes, **update the relevant docs** to keep them accurate. If a change introduces a new system or concept not covered by existing docs, **create a new doc file** in `/docs/` and add it to the table below and in `README.md`.

| Document | Covers | When to Update |
|----------|--------|----------------|
| [Architecture](docs/ARCHITECTURE.md) | System layers, components, data flow, build system | Structural or build changes |
| [CLI Reference](docs/CLI.md) | All CLI commands and options | New commands or options |
| [Configuration](docs/CONFIGURATION.md) | Config files, settings, data storage | New config fields or storage changes |
| [API Reference](docs/API.md) | REST API endpoints | New or modified endpoints |
| [MCP Tools](docs/MCP.md) | MCP integration and tool reference | New tools or changes to actions.ts |
| [Agents](docs/AGENTS.md) | Agent tooling, skills, plugins, git policy | Agent system changes |
| [Integrations](docs/INTEGRATIONS.md) | Jira, Linear, GitHub setup | Integration changes |
| [Port Mapping](docs/PORT-MAPPING.md) | Port discovery, offset algorithm, runtime hook | Port system changes |
| [Hooks](docs/HOOKS.md) | Hooks system (trigger types, commands, skills) | Hooks changes |
| [Electron](docs/ELECTRON.md) | Desktop app, deep linking, multi-project | Electron changes |
| [Frontend](docs/FRONTEND.md) | UI architecture, views, theme, components | UI changes |
| [Development](docs/DEVELOPMENT.md) | Build system, dev workflow, conventions | Dev workflow changes |
