import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  loadJiraCredentials,
  loadJiraProjectConfig,
  saveJiraCredentials,
  saveJiraProjectConfig,
  testConnection,
} from '../jira/client';
import type { JiraCredentials } from '../jira/types';

import { WorktreeManager } from './manager';
import type {
  WorktreeConfig,
  WorktreeCreateRequest,
  WorktreeRenameRequest,
} from './types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..', '..');
// In dev (tsx): currentDir is src/server, UI is in dist/ui
// In prod (built): currentDir is dist, UI is in dist/ui
const uiDir = currentDir.includes('src/server')
  ? path.join(projectRoot, 'dist', 'ui')
  : path.join(currentDir, 'ui');

export function createWorktreeServer(manager: WorktreeManager) {
  const app = new Hono();

  app.use('*', cors());

  app.get('/api/worktrees', (c) => {
    const worktrees = manager.getWorktrees();
    return c.json({ worktrees });
  });

  app.get('/api/config', (c) => {
    const config = manager.getConfig();
    const projectName = manager.getProjectName();
    return c.json({ config, projectName });
  });

  app.get('/api/ports', (c) => {
    const portManager = manager.getPortManager();
    return c.json({
      discovered: portManager.getDiscoveredPorts(),
      offsetStep: portManager.getOffsetStep(),
    });
  });

  app.post('/api/discover', async (c) => {
    const portManager = manager.getPortManager();
    const logs: string[] = [];

    const result = await portManager.discoverPorts((message) => {
      logs.push(message);
    });

    return c.json({
      success: result.ports.length > 0,
      ports: result.ports,
      logs,
      error: result.error,
    });
  });

  app.post('/api/detect-env', (c) => {
    const portManager = manager.getPortManager();
    const mapping = portManager.detectEnvMapping(portManager.getProjectDir());
    if (Object.keys(mapping).length > 0) {
      portManager.persistEnvMapping(mapping);
    }

    return c.json({
      success: true,
      envMapping: mapping,
    });
  });

  app.post('/api/worktrees', async (c) => {
    try {
      const body = await c.req.json<WorktreeCreateRequest>();

      if (!body.branch) {
        return c.json(
          { success: false, error: 'Branch name is required' },
          400,
        );
      }

      const result = await manager.createWorktree(body);
      return c.json(result, result.success ? 201 : 400);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid request',
        },
        400,
      );
    }
  });

  app.post('/api/worktrees/:id/start', async (c) => {
    const id = c.req.param('id');
    const result = await manager.startWorktree(id);
    return c.json(result, result.success ? 200 : 400);
  });

  app.post('/api/worktrees/:id/stop', async (c) => {
    const id = c.req.param('id');
    const result = await manager.stopWorktree(id);
    return c.json(result, result.success ? 200 : 400);
  });

  app.patch('/api/worktrees/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json<WorktreeRenameRequest>();
      const result = await manager.renameWorktree(id, body);
      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid request',
        },
        400,
      );
    }
  });

  app.delete('/api/worktrees/:id', async (c) => {
    const id = c.req.param('id');
    const result = await manager.removeWorktree(id);
    return c.json(result, result.success ? 200 : 400);
  });

  app.get('/api/worktrees/:id/logs', (c) => {
    const id = c.req.param('id');
    const logs = manager.getLogs(id);
    return c.json({ logs });
  });

  app.get('/api/jira/status', (c) => {
    const configDir = manager.getConfigDir();
    const creds = loadJiraCredentials(configDir);
    const projectConfig = loadJiraProjectConfig(configDir);
    return c.json({
      configured: creds !== null,
      defaultProjectKey: projectConfig.defaultProjectKey ?? null,
    });
  });

  app.patch('/api/config', async (c) => {
    try {
      const body = await c.req.json();
      const result = manager.updateConfig(body);
      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.post('/api/jira/setup', async (c) => {
    try {
      const body = await c.req.json<{ baseUrl: string; email: string; token: string }>();
      if (!body.baseUrl || !body.email || !body.token) {
        return c.json({ success: false, error: 'baseUrl, email, and token are required' }, 400);
      }

      const configDir = manager.getConfigDir();
      const creds: JiraCredentials = {
        authMethod: 'api-token',
        apiToken: {
          baseUrl: body.baseUrl.replace(/\/$/, ''),
          email: body.email,
          token: body.token,
        },
      };

      // Validate by making a test API call
      try {
        await testConnection(creds, configDir);
      } catch (err) {
        return c.json({
          success: false,
          error: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }, 400);
      }

      saveJiraCredentials(configDir, creds);
      return c.json({ success: true });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.patch('/api/jira/config', async (c) => {
    try {
      const body = await c.req.json<{ defaultProjectKey?: string }>();
      const configDir = manager.getConfigDir();
      const current = loadJiraProjectConfig(configDir);
      if (body.defaultProjectKey !== undefined) {
        current.defaultProjectKey = body.defaultProjectKey || undefined;
      }
      saveJiraProjectConfig(configDir, current);
      return c.json({ success: true });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.delete('/api/jira/credentials', (c) => {
    try {
      const configDir = manager.getConfigDir();
      const credPath = path.join(configDir, '.wok3', 'credentials.json');
      if (existsSync(credPath)) {
        const data = JSON.parse(readFileSync(credPath, 'utf-8'));
        delete data.jira;
        writeFileSync(credPath, JSON.stringify(data, null, 2) + '\n');
      }
      return c.json({ success: true });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to disconnect' },
        400,
      );
    }
  });

  app.post('/api/jira/task', async (c) => {
    try {
      const body = await c.req.json<{ issueKey: string; branch?: string }>();
      if (!body.issueKey) {
        return c.json({ success: false, error: 'Issue key is required' }, 400);
      }
      const result = await manager.createWorktreeFromJira(body.issueKey, body.branch);
      return c.json(result, result.success ? 201 : 400);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid request',
        },
        400,
      );
    }
  });

  app.get('/api/github/status', (c) => {
    const ghManager = manager.getGitHubManager();
    if (!ghManager) {
      return c.json({ installed: false, authenticated: false, repo: null });
    }
    return c.json(ghManager.getStatus());
  });

  app.post('/api/worktrees/:id/commit', async (c) => {
    const ghManager = manager.getGitHubManager();
    if (!ghManager?.isAvailable()) {
      return c.json({ success: false, error: 'GitHub integration not available' }, 400);
    }
    try {
      const id = c.req.param('id');
      const body = await c.req.json<{ message: string }>();
      if (!body.message) {
        return c.json({ success: false, error: 'Commit message is required' }, 400);
      }
      const worktrees = manager.getWorktrees();
      const wt = worktrees.find((w) => w.id === id);
      if (!wt) {
        return c.json({ success: false, error: `Worktree "${id}" not found` }, 404);
      }
      const result = await ghManager.commitAll(wt.path, id, body.message);
      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Commit failed' },
        400,
      );
    }
  });

  app.post('/api/worktrees/:id/push', async (c) => {
    const ghManager = manager.getGitHubManager();
    if (!ghManager?.isAvailable()) {
      return c.json({ success: false, error: 'GitHub integration not available' }, 400);
    }
    const id = c.req.param('id');
    const worktrees = manager.getWorktrees();
    const wt = worktrees.find((w) => w.id === id);
    if (!wt) {
      return c.json({ success: false, error: `Worktree "${id}" not found` }, 404);
    }
    const result = await ghManager.pushBranch(wt.path, id);
    return c.json(result, result.success ? 200 : 400);
  });

  app.post('/api/worktrees/:id/create-pr', async (c) => {
    const ghManager = manager.getGitHubManager();
    if (!ghManager?.isAvailable()) {
      return c.json({ success: false, error: 'GitHub integration not available' }, 400);
    }
    try {
      const id = c.req.param('id');
      const body = await c.req.json<{ title: string; body?: string }>();
      if (!body.title) {
        return c.json({ success: false, error: 'PR title is required' }, 400);
      }
      const worktrees = manager.getWorktrees();
      const wt = worktrees.find((w) => w.id === id);
      if (!wt) {
        return c.json({ success: false, error: `Worktree "${id}" not found` }, 404);
      }
      const result = await ghManager.createPR(wt.path, id, body.title, body.body);
      return c.json(result, result.success ? 201 : 400);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to create PR' },
        400,
      );
    }
  });

  app.get('/api/events', (c) => {
    const stream = new ReadableStream({
      start(controller) {
        const worktrees = manager.getWorktrees();
        controller.enqueue(
          `data: ${JSON.stringify({ type: 'worktrees', worktrees })}\n\n`,
        );

        const unsubscribe = manager.subscribe((updatedWorktrees) => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'worktrees',
                worktrees: updatedWorktrees,
              })}\n\n`,
            );
          } catch {
            unsubscribe();
          }
        });

        c.req.raw.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
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

  return app;
}

export async function startWorktreeServer(
  config: WorktreeConfig,
  configFilePath?: string | null,
): Promise<{ manager: WorktreeManager; close: () => void }> {
  const manager = new WorktreeManager(config, configFilePath ?? null);
  await manager.initGitHub();
  const app = createWorktreeServer(manager);

  const server = serve({
    fetch: app.fetch,
    port: config.serverPort,
  });

  console.log(
    `[wok3] Server running at http://localhost:${config.serverPort}`,
  );

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    console.log('\n[wok3] Shutting down...');
    await manager.stopAll();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  return { manager, close };
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
