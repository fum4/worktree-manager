# Port Mapping

work3 solves port conflicts when running multiple git worktrees concurrently. Each worktree gets an integer **offset** that shifts all known ports so instances don't collide.

## Overview

If your app listens on ports 3000 and 4000:

| Worktree | Offset | Ports        |
|----------|--------|--------------|
| main     | 0      | 3000, 4000   |
| feature-a| 1      | 3001, 4001   |
| feature-b| 2      | 3002, 4002   |

## How It Works

### 1. Port Discovery

During `work3 init`, `PortManager.discoverPorts()` runs your `startCommand` in the main project directory, waits 15 seconds for processes to stabilize, then uses `lsof -iTCP -sTCP:LISTEN` to find all listening TCP ports in the process tree. Discovered ports are saved to `.work3/config.json` under `ports.discovered`.

### 2. Offset Allocation

When a worktree is started, `PortManager.allocateOffset()` assigns the next available offset multiple. The `offsetStep` (from config) determines the gap between offsets. With `offsetStep: 1`, offsets are 1, 2, 3, etc. Offsets are released back to the pool when a worktree is stopped.

### 3. Runtime Port Hook (`port-hook.cjs`)

The hook is a pure CommonJS file with zero dependencies, injected into worktree processes via:

```
NODE_OPTIONS="--require /path/to/port-hook.cjs"
```

Two environment variables configure it:

- `__WM_PORT_OFFSET__` -- the integer offset for this worktree
- `__WM_KNOWN_PORTS__` -- JSON array of base ports to intercept (e.g. `[3000, 4000]`)

The hook monkey-patches two methods on Node.js `net` module:

**`net.Server.prototype.listen`** -- intercepts incoming port bindings. If the port is in the known set, it adds the offset. `listen(3000)` becomes `listen(3001)` for offset 1.

**`net.Socket.prototype.connect`** -- intercepts outgoing connections to localhost. Handles three calling conventions:
- `connect(port, host, cb)` -- port as a number
- `connect([{port, host}, cb])` -- Node.js HTTP agent internal array form
- `connect({port, host}, cb)` -- plain options object

Only connections to localhost addresses (`127.0.0.1`, `::1`, `localhost`, `0.0.0.0`) are offset. Remote connections are left untouched.

### 4. Env Var Mapping

After port discovery, `PortManager.detectEnvMapping()` scans all `.env*` files in the project for values containing discovered ports. It builds a template mapping stored in `config.envMapping`. For example, if `.env` contains:

```
API_URL=http://localhost:3000/api
```

The mapping becomes `{ "API_URL": "http://localhost:${3000}/api" }`. At spawn time, `${3000}` is replaced with `3000 + offset`, so the worktree process sees `API_URL=http://localhost:3001/api`.

## Limitations

- **Node.js only** -- the `--require` hook only works with Node.js processes.
- **macOS/Linux only** -- port discovery depends on `lsof` and `pgrep`.
- **Known ports only** -- only ports listed in `ports.discovered` are offset. Hardcoded ports that weren't running during discovery are not intercepted.
- **Localhost only** -- outgoing connections are only offset when targeting localhost addresses.
