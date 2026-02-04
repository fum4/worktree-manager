import type { Hono } from 'hono';

import type { WorktreeManager } from '../manager';
import type { TerminalManager } from '../terminal-manager';
import type { WorktreeCreateRequest, WorktreeRenameRequest } from '../types';

export function registerWorktreeRoutes(
  app: Hono,
  manager: WorktreeManager,
  terminalManager?: TerminalManager,
) {
  app.get('/api/worktrees', (c) => {
    const worktrees = manager.getWorktrees();
    return c.json({ worktrees });
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
    terminalManager?.destroyAllForWorktree(id);
    const result = await manager.removeWorktree(id);
    return c.json(result, result.success ? 200 : 400);
  });

  app.get('/api/worktrees/:id/logs', (c) => {
    const id = c.req.param('id');
    const logs = manager.getLogs(id);
    return c.json({ logs });
  });
}
