# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

wok3 is a CLI tool + web UI for managing multiple git worktrees with automatic port offsetting. It solves port conflicts when running multiple dev server instances concurrently by monkey-patching Node.js `net.Server.listen` and `net.Socket.connect` at runtime via `--require`.

## Build & Dev Commands

```bash
# Build everything (tsup for backend + vite for UI + copy port-hook.cjs)
npm run build

# Dev mode (concurrent watch for backend and frontend)
npm run dev

# Run the built CLI
npm run start

# Type checking
npm run check-types

# Lint
npm run check-lint
npm run format-lint   # auto-fix
```

There is no test runner configured. The `test-project/` directory is a manual integration test (two HTTP servers that validate port offsetting works).

## Architecture

**Dual build system**: tsup bundles the backend (CLI + Hono server) as ESM; Vite bundles the React UI as a SPA served from `dist/ui/`.

### Key Modules

- **`src/cli.ts`** — CLI entry point. Loads `.wok3/config.json` config (walks up directory tree), handles `init` subcommand (interactive setup wizard), starts the server.
- **`src/server/index.ts`** — Hono HTTP server with REST API (10 endpoints) + SSE stream (`/api/events`) for real-time UI updates. Serves static UI files.
- **`src/server/manager.ts`** — `WorktreeManager` class. Orchestrates git worktree operations (`add`, `remove`), spawns/kills dev processes, captures logs (max 100 lines), emits events for SSE subscribers.
- **`src/server/port-manager.ts`** — `PortManager` class. Discovers ports via `lsof`, allocates/releases integer offsets (1, 2, 3...), builds env vars (`NODE_OPTIONS`, `__WM_PORT_OFFSET__`, `__WM_KNOWN_PORTS__`) for spawned processes.
- **`src/runtime/port-hook.cjs`** — The core innovation. Pure CJS with zero dependencies (required by `--require`). Patches `net.Server.prototype.listen` and `net.Socket.prototype.connect` to offset known ports by the worktree's allocated offset. Handles three `connect()` calling conventions including Node.js internal array form.
- **`src/ui/`** — React + Tailwind UI. `useWorktrees` hook establishes SSE connection with auto-reconnect. Components: Header, CreateForm, WorktreeList, WorktreeItem.

### Data Flow

1. User creates a worktree via UI → API → `git worktree add` + configured install command
2. User starts it → `PortManager.allocateOffset()` → spawn with `--require port-hook.cjs` + offset env vars
3. `port-hook.cjs` intercepts `listen(4000)` → `listen(4001)`, `connect(4000)` → `connect(4001)`
4. SSE stream pushes status updates to UI in real-time

### Platform Constraints

- Unix/macOS only (depends on `lsof` and `pgrep`)
- Node.js processes only (the `--require` hook doesn't work with non-Node runtimes)
- ESLint extends `@repo/eslint-config/remix` (monorepo shared config)

### Configuration

`.wok3/config.json` at project root defines: `projectDir`, `worktreesDir`, `startCommand`, `installCommand`, `baseBranch`, `serverPort`, and discovered `ports` with `offsetStep`.

### TODOs

- **Worktree creation branch strategy**: The cascade of git worktree add fallbacks (`-b` → existing branch → `-B`) needs revisiting. Edge cases around existing local branches, branches checked out elsewhere, and detached HEAD states are not well handled. See the TODO in `src/server/manager.ts`.
