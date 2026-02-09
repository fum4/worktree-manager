import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import net from 'net';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { CONFIG_DIR_NAME, DEFAULT_PORT } from '../constants';
import { log } from '../logger';
import { checkGhAuth } from '../integrations/github/gh-client';
import { testConnection as testJiraConnection } from '../integrations/jira/auth';
import { loadJiraCredentials } from '../integrations/jira/credentials';
import { testConnection as testLinearConnection } from '../integrations/linear/api';
import { loadLinearCredentials } from '../integrations/linear/credentials';
import { WorktreeManager } from './manager';
import { registerWorktreeRoutes } from './routes/worktrees';
import { registerConfigRoutes } from './routes/config';
import { registerGitHubRoutes } from './routes/github';
import { registerJiraRoutes } from './routes/jira';
import { registerLinearRoutes } from './routes/linear';
import { registerEventRoutes } from './routes/events';
import { registerMcpRoutes } from './routes/mcp';
import { registerMcpServerRoutes } from './routes/mcp-servers';
import { registerClaudeSkillRoutes } from './routes/claude-skills';
import { registerNotesRoutes } from './routes/notes';
import { registerTaskRoutes } from './routes/tasks';
import { registerTerminalRoutes } from './routes/terminal';
import { NotesManager } from './notes-manager';
import { TerminalManager } from './terminal-manager';
import type { WorktreeConfig } from './types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isDev = currentDir.includes('src/server');
const projectRoot = isDev
  ? path.resolve(currentDir, '..', '..')  // src/server -> root
  : path.resolve(currentDir, '..');       // dist -> root
// In dev (tsx): currentDir is src/server, UI is in dist/ui
// In prod (built): currentDir is dist/server, UI is in dist/ui
// In dev (tsx): currentDir is src/server, UI is in dist/ui
// In prod (built): currentDir is dist (tsup flattens), UI is in dist/ui
const uiDir = currentDir.includes('src/server')
  ? path.join(projectRoot, 'dist', 'ui')
  : path.join(currentDir, 'ui');

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      const server = net.createServer();
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port);
    };
    tryPort(startPort);
  });
}

export function createWorktreeServer(manager: WorktreeManager) {
  const app = new Hono();
  const terminalManager = new TerminalManager();
  const notesManager = new NotesManager(manager.getConfigDir());
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

  app.use('*', cors());
  app.onError((err, c) => {
    log.error(`${c.req.method} ${c.req.path} → ${err.message}`);
    if (process.env.DEBUG) log.debug(err.stack ?? '');
    return c.json({ error: err.message }, 500);
  });

  registerWorktreeRoutes(app, manager, terminalManager);
  registerConfigRoutes(app, manager);
  registerGitHubRoutes(app, manager);
  registerJiraRoutes(app, manager);
  registerLinearRoutes(app, manager);
  registerEventRoutes(app, manager);
  registerMcpRoutes(app, manager);
  registerMcpServerRoutes(app, manager);
  registerClaudeSkillRoutes(app, manager);
  registerTaskRoutes(app, manager, notesManager);
  registerNotesRoutes(app, manager, notesManager);
  registerTerminalRoutes(app, manager, terminalManager, upgradeWebSocket);

  // Background verification of all integration connections
  app.get('/api/integrations/verify', async (c) => {
    const configDir = manager.getConfigDir();

    const [github, jira, linear] = await Promise.all([
      // GitHub: re-check gh CLI auth
      (async () => {
        const ghManager = manager.getGitHubManager();
        if (!ghManager) return null;
        const status = ghManager.getStatus();
        if (!status.authenticated) return null;
        const ok = await checkGhAuth();
        return { ok };
      })(),
      // Jira: test API connection
      (async () => {
        const creds = loadJiraCredentials(configDir);
        if (!creds) return null;
        try {
          await testJiraConnection(creds, configDir);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      })(),
      // Linear: test GraphQL connection
      (async () => {
        const creds = loadLinearCredentials(configDir);
        if (!creds) return null;
        try {
          await testLinearConnection(creds);
          return { ok: true };
        } catch {
          return { ok: false };
        }
      })(),
    ]);

    return c.json({ github, jira, linear });
  });

  app.use('/*', serveStatic({ root: uiDir }));

  app.get('*', (c) => {
    const indexPath = path.join(currentDir, 'ui', 'index.html');
    try {
      const html = readFileSync(indexPath, 'utf-8');
      return c.html(html);
    } catch {
      return c.text('UI not built. Run build command', 404);
    }
  });

  return { app, injectWebSocket, terminalManager };
}

export async function startWorktreeServer(
  config: WorktreeConfig,
  configFilePath?: string | null,
  options?: { exitOnClose?: boolean; port?: number },
): Promise<{ manager: WorktreeManager; close: () => Promise<void>; port: number }> {
  const exitOnClose = options?.exitOnClose ?? true;
  const requestedPort = options?.port ?? DEFAULT_PORT;
  const manager = new WorktreeManager(config, configFilePath ?? null);
  await manager.initGitHub();
  const { app, injectWebSocket, terminalManager } =
    createWorktreeServer(manager);

  const actualPort = await findAvailablePort(requestedPort);

  const server = createAdaptorServer({
    fetch: app.fetch,
  });

  injectWebSocket(server);

  server.listen(actualPort, () => {
    log.success(`Server running at http://localhost:${actualPort}`);
  });

  // Write server.json for agent discovery
  const configDir = manager.getConfigDir();
  const serverJsonPath = configDir ? path.join(configDir, CONFIG_DIR_NAME, 'server.json') : null;
  if (serverJsonPath && existsSync(path.dirname(serverJsonPath))) {
    try {
      writeFileSync(serverJsonPath, JSON.stringify({ url: `http://localhost:${actualPort}`, pid: process.pid }, null, 2));
    } catch {
      // Non-critical
    }
  }

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    log.info('\nShutting down...');

    // Clean up server.json
    if (serverJsonPath) {
      try { unlinkSync(serverJsonPath); } catch { /* ignore */ }
    }

    terminalManager.destroyAll();
    await manager.stopAll();
    server.close();
    if (exitOnClose) {
      process.exit(0);
    }
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  return { manager, close, port: actualPort };
}

export { WorktreeManager } from './manager';
export { PortManager } from './port-manager';
export type {
  PortConfig,
  WorktreeConfig,
  WorktreeCreateRequest,
  WorktreeInfo,
  WorktreeListResponse,
  WorktreeRenameRequest,
  WorktreeResponse,
} from './types';
