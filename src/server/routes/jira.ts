import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Hono } from 'hono';
import path from 'path';

import {
  loadJiraCredentials,
  loadJiraProjectConfig,
  saveJiraCredentials,
  saveJiraProjectConfig,
} from '../../integrations/jira/credentials';
import { testConnection } from '../../integrations/jira/auth';
import type { JiraCredentials } from '../../integrations/jira/types';
import type { WorktreeManager } from '../manager';

export function registerJiraRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/jira/status', (c) => {
    const configDir = manager.getConfigDir();
    const creds = loadJiraCredentials(configDir);
    const projectConfig = loadJiraProjectConfig(configDir);
    return c.json({
      configured: creds !== null,
      defaultProjectKey: projectConfig.defaultProjectKey ?? null,
    });
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
}
