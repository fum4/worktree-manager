import { execFile, spawn } from 'child_process';

import type { Hono } from 'hono';

import type { WorktreeManager } from '../manager';

function runExecFile(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function startGhAuthLogin(manager: WorktreeManager): Promise<{ code: string; url: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['auth', 'login', '--web', '-h', 'github.com', '-p', 'https'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';

    child.stderr.on('data', (data: Buffer) => { output += data.toString(); });
    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });

    // Wait briefly for gh to print the code and URL, then parse and open browser
    setTimeout(() => {
      const codeMatch = output.match(/one-time code:\s*(\S+)/);
      const urlMatch = output.match(/(https:\/\/github\.com\/login\/device\S*)/);
      if (urlMatch) {
        execFile('open', [urlMatch[1]]);
        resolve({
          code: codeMatch?.[1] ?? '',
          url: urlMatch[1],
        });
      } else {
        reject(new Error('Could not start GitHub login flow'));
        child.kill();
      }
    }, 2000);

    child.stdin.write('\n');
    child.stdin.end();

    child.on('close', async (exitCode) => {
      if (exitCode === 0) {
        await manager.initGitHub();
      }
    });
  });
}

export function registerGitHubRoutes(app: Hono, manager: WorktreeManager) {
  app.post('/api/github/install', async (c) => {
    try {
      await runExecFile('brew', ['install', 'gh']);
      await manager.initGitHub();
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to install gh' },
        400,
      );
    }
    try {
      const { code } = await startGhAuthLogin(manager);
      return c.json({ success: true, code });
    } catch {
      return c.json({ success: true, code: null });
    }
  });

  app.post('/api/github/login', async (c) => {
    try {
      const { code } = await startGhAuthLogin(manager);
      return c.json({ success: true, code });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to start login' },
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
}
