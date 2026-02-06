import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Hono } from 'hono';
import path from 'path';

import {
  loadLinearCredentials,
  loadLinearProjectConfig,
  saveLinearCredentials,
  saveLinearProjectConfig,
} from '../../integrations/linear/credentials';
import { testConnection, fetchIssues, fetchIssue } from '../../integrations/linear/api';
import type { WorktreeManager } from '../manager';

export function registerLinearRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/linear/status', async (c) => {
    const configDir = manager.getConfigDir();
    const creds = loadLinearCredentials(configDir);
    const projectConfig = loadLinearProjectConfig(configDir);

    let displayName: string | null = null;
    if (creds) {
      try {
        const viewer = await testConnection(creds);
        displayName = viewer.name;
      } catch {
        // Credentials may be invalid
      }
    }

    return c.json({
      configured: creds !== null,
      defaultTeamKey: projectConfig.defaultTeamKey ?? null,
      refreshIntervalMinutes: projectConfig.refreshIntervalMinutes ?? 5,
      displayName,
    });
  });

  app.post('/api/linear/setup', async (c) => {
    try {
      const body = await c.req.json<{ apiKey: string }>();
      if (!body.apiKey) {
        return c.json({ success: false, error: 'apiKey is required' }, 400);
      }

      const configDir = manager.getConfigDir();
      const creds = { apiKey: body.apiKey };

      // Validate by making a test API call
      try {
        await testConnection(creds);
      } catch (err) {
        return c.json({
          success: false,
          error: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }, 400);
      }

      saveLinearCredentials(configDir, creds);
      return c.json({ success: true });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.patch('/api/linear/config', async (c) => {
    try {
      const body = await c.req.json<{ defaultTeamKey?: string; refreshIntervalMinutes?: number }>();
      const configDir = manager.getConfigDir();
      const current = loadLinearProjectConfig(configDir);
      if (body.defaultTeamKey !== undefined) {
        current.defaultTeamKey = body.defaultTeamKey || undefined;
      }
      if (body.refreshIntervalMinutes !== undefined) {
        current.refreshIntervalMinutes = Math.max(1, Math.min(60, body.refreshIntervalMinutes));
      }
      saveLinearProjectConfig(configDir, current);
      return c.json({ success: true });
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.delete('/api/linear/credentials', (c) => {
    try {
      const configDir = manager.getConfigDir();
      const credPath = path.join(configDir, '.wok3', 'credentials.json');
      if (existsSync(credPath)) {
        const data = JSON.parse(readFileSync(credPath, 'utf-8'));
        delete data.linear;
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

  app.get('/api/linear/issues', async (c) => {
    try {
      const configDir = manager.getConfigDir();
      const creds = loadLinearCredentials(configDir);
      if (!creds) {
        return c.json({ issues: [], error: 'Linear not configured' }, 400);
      }

      const projectConfig = loadLinearProjectConfig(configDir);
      const query = c.req.query('query');
      const issues = await fetchIssues(creds, projectConfig.defaultTeamKey, query || undefined);
      return c.json({ issues });
    } catch (error) {
      return c.json(
        { issues: [], error: error instanceof Error ? error.message : 'Failed to fetch issues' },
        500,
      );
    }
  });

  app.get('/api/linear/issues/:identifier', async (c) => {
    try {
      const configDir = manager.getConfigDir();
      const creds = loadLinearCredentials(configDir);
      if (!creds) {
        return c.json({ error: 'Linear not configured' }, 400);
      }

      const identifier = c.req.param('identifier');
      const issue = await fetchIssue(identifier, creds);
      return c.json({ issue });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch issue' },
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
      );
    }
  });

  app.post('/api/linear/task', async (c) => {
    try {
      const body = await c.req.json<{ identifier: string; branch?: string }>();
      if (!body.identifier) {
        return c.json({ success: false, error: 'Identifier is required' }, 400);
      }
      const result = await manager.createWorktreeFromLinear(body.identifier, body.branch);
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
}
