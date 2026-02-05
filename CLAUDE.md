# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

wok3 is a CLI tool + web UI (with optional Electron app) for managing multiple git worktrees with automatic port offsetting and Jira/GitHub integrations. It solves port conflicts when running multiple dev server instances concurrently by monkey-patching Node.js `net.Server.listen` and `net.Socket.connect` at runtime via `--require`.

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

- `wok3` — Start the server and open UI (Electron app if available, otherwise browser)
- `wok3 init` — Interactive setup wizard to create `.wok3/config.json`
- `wok3 connect` — Connect to an existing wok3 server
- `wok3 mcp` — Start as an MCP server (for Claude Code integration)
- `wok3 task <TASK_ID>` — Create worktree from a Jira issue ID

## Architecture

**Dual build system**: tsup bundles the backend (CLI + Hono server) as ESM; Vite bundles the React UI as a SPA served from `dist/ui/`.

### Key Modules

**Backend:**
- **`src/cli/index.ts`** — CLI entry point. Routes subcommands, starts server, opens UI in Electron or browser.
- **`src/cli/config.ts`** — Loads `.wok3/config.json` (walks up directory tree to find it).
- **`src/cli/init.ts`** — Interactive setup wizard.
- **`src/server/index.ts`** — Hono HTTP server with REST API + WebSocket support for terminals. Routes organized in `src/server/routes/`.
- **`src/server/manager.ts`** — `WorktreeManager` class. Orchestrates git worktree operations, spawns/kills dev processes, captures logs, emits SSE events.
- **`src/server/port-manager.ts`** — `PortManager` class. Discovers ports via `lsof`, allocates/releases offsets, builds env vars for spawned processes.
- **`src/server/terminal-manager.ts`** — `TerminalManager` class. Manages PTY sessions for interactive terminals via WebSockets.
- **`src/runtime/port-hook.cjs`** — The core innovation. Pure CJS with zero dependencies. Patches `net.Server.prototype.listen` and `net.Socket.prototype.connect` to offset known ports.
- **`src/mcp.ts`** — MCP (Model Context Protocol) server for Claude Code integration.

**Integrations:**
- **`src/integrations/jira/`** — Jira Cloud API integration: OAuth authentication, issue fetching, ADF-to-Markdown conversion.
- **`src/integrations/github/`** — GitHub integration via `gh` CLI: PR creation, status checking.

**Frontend (React + Tailwind + React Query + Framer Motion):**
- **`src/ui/App.tsx`** — Main app with three views: workspace, configuration, integrations.
- **`src/ui/theme.ts`** — Centralized theme tokens. **All UI components must import from this file instead of hardcoding Tailwind color classes.**
- **`src/ui/components/`** — UI components:
  - `Header.tsx` — Top bar with project name, connection status, view navigation
  - `CreateForm.tsx` — Create worktree form with Branch/Issues tabs
  - `WorktreeList.tsx`, `WorktreeItem.tsx` — Worktree sidebar list
  - `IssueList.tsx`, `JiraIssueItem.tsx` — Jira issues sidebar list
  - `ConfigurationPanel.tsx` — Edit `.wok3/config.json` settings
  - `IntegrationsPanel.tsx` — Configure Jira/GitHub integrations
  - `MarkdownContent.tsx` — Renders Markdown with dark theme styling (used for Jira descriptions/comments)
- **`src/ui/components/detail/`** — Right panel components:
  - `DetailPanel.tsx` — Worktree detail view with logs, terminal, git actions
  - `JiraDetailPanel.tsx` — Jira issue detail view
  - `LogsViewer.tsx`, `TerminalView.tsx` — Process output viewers
  - `ActionToolbar.tsx`, `GitActionInputs.tsx` — Git operations (commit, push, PR)
- **`src/ui/hooks/`** — React hooks:
  - `useWorktrees.ts` — SSE connection for real-time worktree updates
  - `useJiraIssues.ts`, `useJiraIssueDetail.ts` — Jira data fetching with React Query
  - `useTerminal.ts` — WebSocket terminal connection
  - `useConfig.ts` — Configuration fetching
  - `api.ts` — API client functions

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

`.wok3/config.json` at project root defines: `projectDir`, `worktreesDir`, `startCommand`, `installCommand`, `baseBranch`, `serverPort`, discovered `ports` with `offsetStep`, `envMapping`, and integration settings.
