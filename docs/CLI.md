# CLI Commands Reference

work3 is primarily a CLI tool. Running `work3` with no arguments starts the server and opens the web UI. All other functionality is accessed through subcommands.

```
work3 [command] [options]
```

---

## Commands

### `work3` (default)

Start the server and open the UI.

```bash
work3
work3 --no-open
work3 --auto-init
```

When run without a subcommand, work3 does the following:

1. Loads global preferences from `~/.work3/app-preferences.json`
2. Determines the server port (see [Port Selection](#port-selection))
3. If the Electron app is already running, opens the current project as a new tab in the existing window and exits
4. If no `.work3/config.json` is found:
   - With `--auto-init`: auto-initializes config using detected defaults (start command, install command, base branch)
   - In an interactive terminal: launches the setup wizard (`work3 init`)
   - Non-interactive (e.g., spawned by Electron): proceeds with defaults
5. Starts the Hono HTTP server
6. Writes `server.json` to `.work3/` for agent discovery (contains the server URL and PID)
7. Opens the UI in the Electron app (if installed) or falls back to the default browser

**Options:**

| Option | Environment Variable | Description |
|---|---|---|
| `--no-open` | `WORK3_NO_OPEN=1` | Start the server without opening the UI |
| `--auto-init` | `WORK3_AUTO_INIT=1` | Auto-initialize config if none is found (skips interactive prompts) |

On first run, work3 also installs itself into `~/.local/bin/` (as a shell wrapper) so the `work3` command is available system-wide. If `~/.local/bin` is not in your `PATH`, it will print a warning with instructions.

---

### `work3 init`

Interactive setup wizard to create `.work3/config.json`.

```bash
work3 init
```

Must be run inside a git repository. Exits with an error if a config file already exists.

The wizard prompts for:

| Prompt | Default | Description |
|---|---|---|
| Project directory | `.` (current directory) | Absolute or relative path to the project root |
| Base branch | Auto-detected (e.g., `origin/main`) | Branch that new worktrees are created from |
| Dev start command | Auto-detected from `package.json` scripts | Command to start the dev server in each worktree |
| Install command | Auto-detected (`pnpm install`, `yarn install`, etc.) | Command to install dependencies in each worktree |

After writing the config, `init` also:

- Creates a `.work3/.gitignore` with a whitelist approach (ignores everything except `config.json` and `.gitignore`)
- Stages both files with `git add` so they are ready to commit
- Detects environment variable mappings if ports are already configured
- Prints next steps for getting started

The generated config file (`.work3/config.json`) looks like:

```json
{
  "startCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "baseBranch": "origin/main",
  "ports": {
    "discovered": [],
    "offsetStep": 1
  }
}
```

---

### `work3 add [name]`

Set up an integration.

```bash
work3 add            # Interactive picker
work3 add github     # Set up GitHub directly
work3 add linear     # Set up Linear directly
work3 add jira       # Set up Jira directly
```

Requires an existing config (`work3 init` must have been run first). If no integration name is provided, an interactive picker is shown with the current status of each integration.

#### `work3 add github`

Checks for the GitHub CLI (`gh`) and verifies authentication. Does not store any credentials -- GitHub integration relies entirely on the `gh` CLI being installed and authenticated.

Prerequisites:
- Install `gh`: `brew install gh` (macOS) or see [GitHub CLI docs](https://github.com/cli/cli)
- Authenticate: `gh auth login`

Once set up, enables PR creation, commit, and push from the work3 UI.

#### `work3 add linear`

Connects to Linear for issue tracking.

Prompts for:
- **API Key** -- create one at https://linear.app/settings/account/security/api-keys/new
- **Default team key** (optional, e.g., `ENG`)

Tests the connection before saving. Credentials are stored in `.work3/integrations.json` (gitignored by default).

#### `work3 add jira`

Connects to Atlassian Jira for issue tracking. Offers two authentication methods:

**OAuth 2.0 (recommended):**
- Requires creating an OAuth app at https://developer.atlassian.com/console
- Prompts for Client ID and Client Secret
- Runs a browser-based OAuth authorization flow
- Auto-discovers the Jira Cloud ID and site URL

**API Token:**
- Simpler setup, no app registration needed
- Create a token at https://id.atlassian.com/manage-profile/security/api-tokens
- Prompts for site URL, email, and API token

Both methods prompt for an optional default project key (e.g., `PROJ`). Credentials are stored in `.work3/integrations.json`.

---

### `work3 mcp`

Start as an MCP (Model Context Protocol) server for AI coding agents.

```bash
work3 mcp
```

Uses stdio for JSON-RPC communication. All `console.log` output is redirected to stderr because stdout is reserved for JSON-RPC messages.

Operates in one of two modes:

- **Proxy mode**: If a work3 server is already running (detected via `.work3/server.json`), relays JSON-RPC messages between stdio and the HTTP server's `/mcp` endpoint. This gives the agent shared state with the UI.
- **Standalone mode**: If no server is running, creates its own `WorktreeManager` instance and operates independently.

Typical usage in a Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "work3": {
      "command": "work3",
      "args": ["mcp"]
    }
  }
}
```

---

### `work3 task <ID>`

Create a worktree from a Jira issue ID.

```bash
work3 task PROJ-123
work3 task 123        # Uses default project key from Jira config
```

Requires Jira to be connected (`work3 add jira`).

This command:

1. Resolves the task key (if a bare number is given, prepends the configured default project key)
2. Fetches issue details from Jira (summary, status, priority, type, assignee, labels)
3. Prints a summary of the issue
4. Saves task data to `.work3/tasks/<KEY>/task.json`
5. Downloads any attachments to `.work3/tasks/<KEY>/attachments/`
6. Prompts for an action:
   - **Create a worktree** -- creates a new git worktree with the issue key as the branch name, copies `.env` files, runs the install command
   - **Link to an existing worktree** -- associates the task with a worktree that already exists
   - **Just save the data** -- saves the task data without creating or linking a worktree

---

### `--help`, `-h`

Show the help message with a summary of all commands and options.

```bash
work3 --help
work3 -h
```

Output:

```
work3 -- git worktree manager with automatic port offsetting

Usage: work3 [command] [options]

Commands:
  (default)     Start the server and open the UI
  init          Interactive setup wizard to create .work3/config.json
  add [name]    Set up an integration (github, linear, jira)
  mcp           Start as an MCP server (for AI coding agents)
  task <ID>     Create a worktree from an issue ID (e.g., PROJ-123)

Options:
  --no-open     Start the server without opening the UI
  --auto-init   Auto-initialize config if none found
  --help, -h    Show this help message
  --version, -v Show version
```

---

### `--version`, `-v`

Show the current version.

```bash
work3 --version
work3 -v
```

---

## Configuration Discovery

When work3 starts, it searches for `.work3/config.json` by walking up the directory tree from the current working directory:

1. Check `$CWD/.work3/config.json`
2. Check `$CWD/../.work3/config.json`
3. Continue up to the filesystem root

Config files found inside worktree directories (paths containing `.work3/worktrees/`) are skipped. This ensures that when you `cd` into a worktree checkout, work3 still finds the main project's config rather than a config from the worktree's source tree.

Once found, work3 changes the working directory to the project root (the parent of `.work3/`).

If no config is found, work3 uses defaults:

| Setting | Default |
|---|---|
| `projectDir` | `.` |
| `startCommand` | `""` (empty) |
| `installCommand` | `""` (empty) |
| `baseBranch` | `origin/main` |
| `ports.discovered` | `[]` |
| `ports.offsetStep` | `1` |

---

## Port Selection

The server port is determined by the following priority (highest first):

1. **`WORK3_PORT` environment variable** -- e.g., `WORK3_PORT=7070 work3`
2. **Global preferences** -- `basePort` in `~/.work3/app-preferences.json` (configurable through the Electron app or API)
3. **Default** -- `6969`

If the chosen port is already in use, work3 automatically increments and tries the next port until it finds an available one.

---

## Environment Variables

| Variable | Description |
|---|---|
| `WORK3_PORT` | Override the server port (highest priority) |
| `WORK3_NO_OPEN` | Set to `1` to start the server without opening the UI (equivalent to `--no-open`) |
| `WORK3_AUTO_INIT` | Set to `1` to auto-initialize config if none found (equivalent to `--auto-init`) |

---

## Global Preferences

Stored at `~/.work3/app-preferences.json`. These preferences persist across all projects.

| Key | Type | Default | Description |
|---|---|---|---|
| `basePort` | `number` | `6969` | Default server port |
| `setupPreference` | `"auto" \| "manual" \| "ask"` | `"ask"` | How to handle missing config |
| `sidebarWidth` | `number` | `300` | UI sidebar width in pixels |
| `windowBounds` | `object \| null` | `null` | Electron window position and size |

---

## File Layout

After initialization, the `.work3/` directory contains:

```
.work3/
  config.json          # Project configuration (committed to git)
  .gitignore           # Whitelist gitignore (committed to git)
  server.json          # Running server info (auto-generated, gitignored)
  integrations.json    # Integration credentials (gitignored)
  worktrees/           # Git worktree checkouts
  tasks/               # Jira task data and attachments
  local-issues/        # Local issue storage
```

The global `~/.work3/` directory contains:

```
~/.work3/
  app-preferences.json # Global preferences
  electron.lock        # Electron process lock file
```
