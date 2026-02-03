# Worktree Manager

A dev tool that manages multiple git worktrees and automatically resolves port conflicts between them. When you run a dev command that binds multiple ports (Express, Vite HMR, etc.), running a second copy causes port conflicts. This tool solves that by monkey-patching Node.js `net.Server.listen` and `net.Socket.connect` to transparently offset all known ports per worktree instance.

## How It Works

1. **Port Discovery** — runs your dev command once, monitors with `lsof` to find all ports it binds to, saves them to config
2. **Port Hook** — a CJS file (`src/runtime/port-hook.cjs`) injected via `NODE_OPTIONS="--require ..."` into every worktree process. It patches `net.Server.prototype.listen` (incoming) and `net.Socket.prototype.connect` (outgoing) to add an offset to known ports
3. **Offset Allocation** — each worktree gets a unique offset (1, 2, 3...). Worktree 1 gets ports +1, worktree 2 gets +2, etc.

```
Main repo:    api:4000, web:4100  (no offset)
Worktree 1:   api:4001, web:4101  (offset=1)
Worktree 2:   api:4002, web:4102  (offset=2)
```

Inter-app communication also works — if `web-server` connects to `api-server` on port 4000, the hook redirects that connection to 4001 within worktree 1.

## Repo Structure

```
├── src/
│   ├── cli.ts                    # CLI entry point, loads config
│   ├── index.ts                  # Package exports
│   ├── server/
│   │   ├── types.ts              # All TypeScript interfaces
│   │   ├── manager.ts            # WorktreeManager — git worktree CRUD + process spawn
│   │   ├── port-manager.ts       # PortManager — discovery, offset allocation, env generation
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
│           ├── Header.tsx        # Title, connection status, port discovery button
│           ├── CreateForm.tsx    # Branch name input + create button
│           ├── WorktreeList.tsx  # List container
│           └── WorktreeItem.tsx  # Single worktree row (ports, start/stop/open/remove)
├── test-project/                 # Minimal 2-server app for testing
│   ├── package.json
│   ├── start-all.js              # Spawns api + web as child processes
│   ├── api-server.js             # HTTP server on port 4000
│   └── web-server.js             # HTTP server on port 4100, fetches from api:4000
├── .worktree-manager.json        # Config pointing to test-project
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## Config (`.worktree-manager.json`)

Generate one with `worktree-manager init`, or create manually:

```json
{
  "projectDir": "test-project",
  "worktreesDir": ".worktrees",
  "startCommand": "node start-all.js",
  "baseBranch": "origin/develop",
  "maxInstances": 5,
  "serverPort": 3100,
  "ports": {
    "discovered": [4000, 4100],
    "offsetStep": 1
  }
}
```

| Field | Description |
|-------|-------------|
| `projectDir` | Subdirectory to `cd` into before running `startCommand` (relative to worktree root) |
| `worktreesDir` | Where worktrees are created (relative to repo root) |
| `startCommand` | The dev command to run in each worktree |
| `baseBranch` | Git ref to branch worktrees from (e.g., `origin/develop`, `origin/main`). Auto-detected by `init` |
| `serverPort` | Port for the manager UI itself |
| `ports.discovered` | All ports the dev command binds (auto-detected or manual). Set to `[]` to use the UI discovery button |
| `ports.offsetStep` | How much to increment per instance (default: 1) |

## Setup & Testing

### Prerequisites

- Node.js v22+
- yarn

### 1. Install & Build

```bash
yarn install
yarn build
```

### 1b. Initialize (for new projects)

If you're setting up worktree-manager in a new repo (not the bundled test-project), run:

```bash
worktree-manager init
```

This will interactively ask for:
- **Base branch** — auto-detected from your remote (e.g., `origin/develop`, `origin/main`)
- **Project subdirectory** — where to `cd` before running the dev command (`.` for repo root)
- **Start command** — your dev command (e.g., `yarn dev`)
- **Manager UI port** — port for the worktree manager itself (default: 3100)
- **Max concurrent worktrees** — how many can run at once (default: 5)
- **Worktrees directory** — where git worktrees are stored (default: `.worktrees`)

It writes `.worktree-manager.json` with `ports.discovered: []` — you'll use the UI's "Discover Ports" button to auto-detect ports on first run.

### 2. Test the port hook in isolation

This verifies the core mechanism without the manager UI.

**Without hook** (baseline — original ports):
```bash
cd test-project
node start-all.js
# → api:4000, web:4100
# Ctrl+C to stop
```

**With hook** (offset=1):
```bash
cd test-project
NODE_OPTIONS="--require $(cd .. && pwd)/src/runtime/port-hook.cjs" \
  __WM_PORT_OFFSET__=1 \
  __WM_KNOWN_PORTS__='[4000,4100]' \
  node start-all.js
# → [worktree-manager] listen :4000 → :4001
# → [worktree-manager] listen :4100 → :4101
```

**Verify inter-app communication** (in another terminal while hook test runs):
```bash
curl http://localhost:4101
# → {"webPort":4101,"apiResponse":{"message":"hello from api","port":4001}}
```

This proves that web→api outgoing connections are also offset.

### 3. Test with the manager UI

```bash
yarn start
# → Open http://localhost:3100
```

The config already has `ports.discovered: [4000, 4100]`, so the manager knows which ports to offset.

**Workflow in the UI:**

1. **Create a worktree** — enter a branch name (e.g., `feature/test-1`), click Create. This runs `git worktree add` + `yarn install`.
2. **Start it** — click Start. The manager spawns `node start-all.js` with `NODE_OPTIONS` injecting the hook at offset=1. You'll see ports `:4001, :4101` next to the worktree name.
3. **Open it** — click Open to hit `http://localhost:4001` in your browser.
4. **Create + start a second worktree** — it gets offset=2, so ports `:4002, :4102`. No conflicts.
5. **Stop** — click Stop. The offset is released for reuse.
6. **Remove** — click × to delete the worktree directory.

### 4. Test port discovery (optional)

If you clear `ports.discovered` to `[]` in `.worktree-manager.json` and restart the manager, the UI will show a "Discover Ports" button. Clicking it:

1. Spawns `node start-all.js` in the main repo's `test-project/`
2. Waits ~15 seconds for processes to stabilize
3. Runs `lsof -P -n -iTCP -sTCP:LISTEN` filtered by the process tree
4. Extracts port numbers, saves to config file
5. Kills the discovery process

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/worktrees` | List all worktrees |
| POST | `/api/worktrees` | Create worktree `{branch, id?}` |
| POST | `/api/worktrees/:id/start` | Start a worktree's dev server |
| POST | `/api/worktrees/:id/stop` | Stop a worktree's dev server |
| DELETE | `/api/worktrees/:id` | Remove worktree (stops first) |
| GET | `/api/worktrees/:id/logs` | Get process output (last 100 lines) |
| GET | `/api/config` | Get current config |
| GET | `/api/ports` | Get discovered ports + offset step |
| POST | `/api/discover` | Run port discovery |
| GET | `/api/events` | SSE stream — real-time worktree state updates |

## How the Port Hook Works

`src/runtime/port-hook.cjs` is a CommonJS file loaded via `--require`. It reads three env vars:

- `__WM_PORT_OFFSET__` — numeric offset (e.g., `1`)
- `__WM_KNOWN_PORTS__` — JSON array of ports to intercept (e.g., `[4000,4100]`)

It patches two Node.js primitives:

1. **`net.Server.prototype.listen`** — if the port being bound is in the known set, add the offset
2. **`net.Socket.prototype.connect`** — if an outgoing connection targets a known port on localhost, redirect to the offset port. Handles three calling conventions: `connect(port, host)`, `connect({port, host})`, and `connect([{port, host}, cb])` (Node.js HTTP agent internal form discovered during testing)

Since `NODE_OPTIONS` propagates to all child Node.js processes, the hook is automatically active in the entire process tree (turborepo, yarn, tsx, vite, etc.).

### What it catches vs. doesn't

| Works | Doesn't work |
|-------|-------------|
| Express, Hono, Fastify, Koa (any `server.listen()`) | Non-Node processes (Python, Go, Ruby) |
| Vite, Webpack dev server, Next.js | Docker port mappings |
| `http.request()`, `fetch()` (undici), WebSockets | |
| Child processes spawned by Node.js | |
| ESM projects (`"type": "module"`) | |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Manager Server (:3100)                      │
│                                                               │
│  Hono API ──────► WorktreeManager                             │
│   /api/discover     │                                         │
│   /api/worktrees    ├── PortManager                           │
│   /api/events       │    ├── discoverPorts()    [lsof]        │
│                     │    ├── allocateOffset()   [1, 2, 3...]  │
│  React UI           │    └── getEnvForOffset()  [env vars]    │
│   (dist/ui)         │                                         │
│                     ▼                                         │
│          spawn("node start-all.js", {                         │
│            cwd: ".worktrees/feature-test/test-project",       │
│            env: {                                             │
│              NODE_OPTIONS: "--require /path/to/port-hook.cjs",│
│              __WM_PORT_OFFSET__: "1",                         │
│              __WM_KNOWN_PORTS__: "[4000,4100]"                │
│            }                                                  │
│          })                                                   │
│              │                                                │
│              ▼                                                │
│    ┌──────────────────────┐                                   │
│    │ api-server :4001     │  (was :4000, offset by hook)      │
│    │ web-server :4101     │  (was :4100, offset by hook)      │
│    │ web→api connect :4001│  (was :4000, offset by hook)      │
│    └──────────────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
```

## Using with a Real Project

To use this with an actual monorepo instead of test-project:

```bash
cd /path/to/your/monorepo
worktree-manager init
```

The init command will auto-detect your default branch and prompt for the rest. Then:

1. Run `wok3` to start the manager UI
2. Click "Discover Ports" — it'll auto-detect all ports your dev command binds
3. Create worktrees from branches and start them — ports are offset automatically
