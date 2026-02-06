import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { readFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { log } from '../logger';
import { WorktreeManager } from './manager';
import { registerWorktreeRoutes } from './routes/worktrees';
import { registerConfigRoutes } from './routes/config';
import { registerGitHubRoutes } from './routes/github';
import { registerJiraRoutes } from './routes/jira';
import { registerLinearRoutes } from './routes/linear';
import { registerEventRoutes } from './routes/events';
import { registerMcpRoutes } from './routes/mcp';
import { registerTaskRoutes } from './routes/tasks';
import { registerTerminalRoutes } from './routes/terminal';
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

export function createWorktreeServer(manager: WorktreeManager) {
  const app = new Hono();
  const terminalManager = new TerminalManager();
  const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

  app.use('*', cors());

  registerWorktreeRoutes(app, manager, terminalManager);
  registerConfigRoutes(app, manager);
  registerGitHubRoutes(app, manager);
  registerJiraRoutes(app, manager);
  registerLinearRoutes(app, manager);
  registerEventRoutes(app, manager);
  registerMcpRoutes(app, manager);
  registerTaskRoutes(app, manager);
  registerTerminalRoutes(app, terminalManager, manager, upgradeWebSocket);

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
  options?: { exitOnClose?: boolean },
): Promise<{ manager: WorktreeManager; close: () => Promise<void>; port: number }> {
  const exitOnClose = options?.exitOnClose ?? true;
  const manager = new WorktreeManager(config, configFilePath ?? null);
  await manager.initGitHub();
  const { app, injectWebSocket, terminalManager } =
    createWorktreeServer(manager);

  const server = createAdaptorServer({
    fetch: app.fetch,
  });

  injectWebSocket(server);

  server.listen(config.serverPort, () => {
    log.success(`Server running at http://localhost:${config.serverPort}`);
  });

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    log.info('\nShutting down...');
    terminalManager.destroyAll();
    await manager.stopAll();
    server.close();
    if (exitOnClose) {
      process.exit(0);
    }
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  return { manager, close, port: config.serverPort };
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
