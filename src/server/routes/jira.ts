import { existsSync, readFileSync, writeFileSync } from 'fs';
import { Hono } from 'hono';
import path from 'path';

import {
  loadJiraCredentials,
  loadJiraProjectConfig,
  saveJiraCredentials,
  saveJiraProjectConfig,
} from '../../integrations/jira/credentials';
import { getApiBase, getAuthHeaders, testConnection } from '../../integrations/jira/auth';
import { fetchIssue } from '../../integrations/jira/api';
import type { JiraCredentials } from '../../integrations/jira/types';
import type { WorktreeManager } from '../manager';

export function registerJiraRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/jira/status', (c) => {
    const configDir = manager.getConfigDir();
    const creds = loadJiraCredentials(configDir);
    const projectConfig = loadJiraProjectConfig(configDir);

    let email: string | null = null;
    let domain: string | null = null;

    if (creds) {
      if (creds.authMethod === 'api-token') {
        email = creds.apiToken.email;
        try {
          domain = new URL(creds.apiToken.baseUrl).hostname;
        } catch {
          domain = creds.apiToken.baseUrl;
        }
      } else if (creds.authMethod === 'oauth') {
        try {
          domain = new URL(creds.oauth.siteUrl).hostname;
        } catch {
          domain = creds.oauth.siteUrl;
        }
      }
    }

    return c.json({
      configured: creds !== null,
      defaultProjectKey: projectConfig.defaultProjectKey ?? null,
      refreshIntervalMinutes: projectConfig.refreshIntervalMinutes ?? 5,
      email,
      domain,
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
      const body = await c.req.json<{ defaultProjectKey?: string; refreshIntervalMinutes?: number }>();
      const configDir = manager.getConfigDir();
      const current = loadJiraProjectConfig(configDir);
      if (body.defaultProjectKey !== undefined) {
        current.defaultProjectKey = body.defaultProjectKey || undefined;
      }
      if (body.refreshIntervalMinutes !== undefined) {
        current.refreshIntervalMinutes = Math.max(1, Math.min(60, body.refreshIntervalMinutes));
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

  app.get('/api/jira/issues', async (c) => {
    try {
      const configDir = manager.getConfigDir();
      const creds = loadJiraCredentials(configDir);
      if (!creds) {
        return c.json({ issues: [], error: 'Jira not configured' }, 400);
      }

      const apiBase = getApiBase(creds);
      const headers = await getAuthHeaders(creds, configDir);
      const query = c.req.query('query');

      let jql = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
      if (query) {
        jql = `assignee = currentUser() AND resolution = Unresolved AND text ~ "${query}" ORDER BY updated DESC`;
      }

      const params = new URLSearchParams({
        jql,
        fields: 'summary,status,priority,issuetype,assignee,updated,labels',
        maxResults: '50',
      });

      const resp = await fetch(`${apiBase}/search/jql?${params}`, { headers });
      if (!resp.ok) {
        const body = await resp.text();
        return c.json({ issues: [], error: `Jira API error: ${resp.status} ${body}` }, 502);
      }

      const data = (await resp.json()) as {
        issues: Array<{
          key: string;
          fields: {
            summary: string;
            status: { name: string };
            priority: { name: string };
            issuetype: { name: string };
            assignee: { displayName: string } | null;
            updated: string;
            labels: string[];
          };
        }>;
      };

      // Build site URL
      let siteUrl: string;
      if (creds.authMethod === 'oauth') {
        siteUrl = creds.oauth.siteUrl;
      } else {
        siteUrl = creds.apiToken.baseUrl;
      }
      const baseUrl = siteUrl.replace(/\/$/, '');

      const issues = data.issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary ?? '',
        status: issue.fields.status?.name ?? 'Unknown',
        priority: issue.fields.priority?.name ?? 'None',
        type: issue.fields.issuetype?.name ?? 'Unknown',
        assignee: issue.fields.assignee?.displayName ?? null,
        updated: issue.fields.updated ?? '',
        labels: issue.fields.labels ?? [],
        url: `${baseUrl}/browse/${issue.key}`,
      }));

      return c.json({ issues });
    } catch (error) {
      return c.json(
        { issues: [], error: error instanceof Error ? error.message : 'Failed to fetch issues' },
        500,
      );
    }
  });

  app.get('/api/jira/issues/:key', async (c) => {
    try {
      const configDir = manager.getConfigDir();
      const creds = loadJiraCredentials(configDir);
      if (!creds) {
        return c.json({ error: 'Jira not configured' }, 400);
      }

      const key = c.req.param('key');
      const issue = await fetchIssue(key, creds, configDir);
      return c.json({ issue });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch issue' },
        error instanceof Error && error.message.includes('not found') ? 404 : 500,
      );
    }
  });

  app.get('/api/jira/attachment', async (c) => {
    try {
      const configDir = manager.getConfigDir();
      const creds = loadJiraCredentials(configDir);
      if (!creds) {
        return c.json({ error: 'Jira not configured' }, 400);
      }

      const url = c.req.query('url');
      if (!url) {
        return c.json({ error: 'url parameter is required' }, 400);
      }

      const headers = await getAuthHeaders(creds, configDir);
      const resp = await fetch(url, {
        headers: { Authorization: headers.Authorization },
      });

      if (!resp.ok) {
        return c.json({ error: `Failed to fetch attachment: ${resp.status}` }, resp.status as 400);
      }

      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const body = await resp.arrayBuffer();

      return new Response(body, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch attachment' },
        500,
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
