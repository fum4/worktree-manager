import { createServer } from 'http';
import { execFile as execFileCb } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import path from 'path';

import { adfToMarkdown } from './adf-to-markdown';
import type {
  JiraCredentials,
  JiraOAuthCredentials,
  JiraProjectConfig,
  JiraTaskData,
  JiraComment,
  JiraAttachment,
} from './types';

const CREDENTIALS_FILE = 'credentials.json';
const CONFIG_FILE = 'config.json';

// -- Credential persistence --

export function loadJiraCredentials(configDir: string): JiraCredentials | null {
  const credPath = path.join(configDir, '.wok3', CREDENTIALS_FILE);
  if (!existsSync(credPath)) return null;
  try {
    const data = JSON.parse(readFileSync(credPath, 'utf-8'));
    return data.jira ?? null;
  } catch {
    return null;
  }
}

export function saveJiraCredentials(configDir: string, creds: JiraCredentials): void {
  const wok3Dir = path.join(configDir, '.wok3');
  const credPath = path.join(wok3Dir, CREDENTIALS_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(credPath)) {
    try {
      existing = JSON.parse(readFileSync(credPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  existing.jira = creds;
  writeFileSync(credPath, JSON.stringify(existing, null, 2) + '\n');
}

export function loadJiraProjectConfig(configDir: string): JiraProjectConfig {
  const configPath = path.join(configDir, '.wok3', CONFIG_FILE);
  if (!existsSync(configPath)) return {};
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    return data.jira ?? {};
  } catch {
    return {};
  }
}

export function saveJiraProjectConfig(configDir: string, config: JiraProjectConfig): void {
  const configPath = path.join(configDir, '.wok3', CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  existing.jira = config;
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
}

// -- Auth helpers --

export function getApiBase(creds: JiraCredentials): string {
  if (creds.authMethod === 'oauth') {
    return `https://api.atlassian.com/ex/jira/${creds.oauth.cloudId}/rest/api/3`;
  }
  const base = creds.apiToken.baseUrl.replace(/\/$/, '');
  return `${base}/rest/api/3`;
}

export async function getAuthHeaders(
  creds: JiraCredentials,
  configDir: string,
): Promise<Record<string, string>> {
  if (creds.authMethod === 'api-token') {
    const encoded = Buffer.from(`${creds.apiToken.email}:${creds.apiToken.token}`).toString('base64');
    return {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    };
  }

  // OAuth — check if token needs refresh
  if (Date.now() >= creds.oauth.expiresAt - 60_000) {
    await refreshOAuthToken(creds, configDir);
  }

  return {
    Authorization: `Bearer ${creds.oauth.accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function refreshOAuthToken(creds: JiraOAuthCredentials, configDir: string): Promise<void> {
  const resp = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: creds.oauth.clientId,
      client_secret: creds.oauth.clientSecret,
      refresh_token: creds.oauth.refreshToken,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Failed to refresh OAuth token: ${resp.status} ${body}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  creds.oauth.accessToken = data.access_token;
  creds.oauth.refreshToken = data.refresh_token;
  creds.oauth.expiresAt = Date.now() + data.expires_in * 1000;

  saveJiraCredentials(configDir, creds);
}

// -- OAuth 2.0 3LO flow --

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFileCb(cmd, [url], () => {
    // Ignore errors — user can copy the URL manually
  });
}

export async function runOAuthFlow(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error || !code) {
        res.writeHead(400);
        res.end('Authorization failed. You can close this tab.');
        server.close();
        reject(new Error(`OAuth error: ${error ?? 'no code received'}`));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Connected to Jira!</h2><p>You can close this tab and return to the terminal.</p></body></html>');

      // Exchange code for tokens
      const port = (server.address() as { port: number }).port;
      const redirectUri = `http://localhost:${port}/callback`;

      fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      })
        .then(async (tokenResp) => {
          if (!tokenResp.ok) {
            const body = await tokenResp.text();
            throw new Error(`Token exchange failed: ${tokenResp.status} ${body}`);
          }
          return tokenResp.json() as Promise<{
            access_token: string;
            refresh_token: string;
            expires_in: number;
          }>;
        })
        .then((tokenData) => {
          server.close();
          resolve({
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
          });
        })
        .catch((err) => {
          server.close();
          reject(err);
        });
    });

    server.listen(0, () => {
      const port = (server.address() as { port: number }).port;
      const redirectUri = `http://localhost:${port}/callback`;
      const scopes = 'read:jira-work offline_access';
      const authUrl =
        `https://auth.atlassian.com/authorize?audience=api.atlassian.com` +
        `&client_id=${clientId}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&prompt=consent`;

      console.log(`\n[wok3] Opening browser for Jira authorization...`);
      console.log(`[wok3] If the browser doesn't open, visit:\n  ${authUrl}\n`);
      openBrowser(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out (5 minutes)'));
    }, 5 * 60 * 1000);
  });
}

export async function discoverCloudId(
  accessToken: string,
): Promise<{ cloudId: string; siteUrl: string }> {
  const resp = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    throw new Error(`Failed to discover cloud resources: ${resp.status}`);
  }

  const resources = (await resp.json()) as Array<{ id: string; url: string; name: string }>;

  if (resources.length === 0) {
    throw new Error('No accessible Jira sites found for this account');
  }

  if (resources.length === 1) {
    return { cloudId: resources[0].id, siteUrl: resources[0].url };
  }

  // Multiple sites — list them and pick the first, user can reconfigure
  console.log('[wok3] Multiple Jira sites found:');
  resources.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} (${r.url})`));
  console.log(`[wok3] Using: ${resources[0].name}`);

  return { cloudId: resources[0].id, siteUrl: resources[0].url };
}

// -- Task fetching --

export function resolveTaskKey(taskId: string, projectConfig: JiraProjectConfig): string {
  // If already contains a dash, assume it's a full key like PROJ-123
  if (taskId.includes('-')) return taskId.toUpperCase();

  // Otherwise, prepend default project key
  if (!projectConfig.defaultProjectKey) {
    throw new Error(
      `Task ID "${taskId}" has no project prefix and no defaultProjectKey is configured.\n` +
        `Either use the full key (e.g. PROJ-${taskId}) or set defaultProjectKey via "wok3 connect jira".`,
    );
  }

  return `${projectConfig.defaultProjectKey}-${taskId}`;
}

export async function fetchIssue(
  key: string,
  creds: JiraCredentials,
  configDir: string,
): Promise<JiraTaskData> {
  const base = getApiBase(creds);
  const headers = await getAuthHeaders(creds, configDir);

  // Fetch issue with all fields
  const resp = await fetch(
    `${base}/issue/${encodeURIComponent(key)}?expand=renderedFields`,
    { headers },
  );

  if (!resp.ok) {
    const body = await resp.text();
    if (resp.status === 404) {
      throw new Error(`Issue ${key} not found`);
    }
    throw new Error(`Failed to fetch issue ${key}: ${resp.status} ${body}`);
  }

  const issue = (await resp.json()) as Record<string, unknown>;
  const fields = issue.fields as Record<string, unknown>;

  // Fetch comments separately for pagination control
  const commentsResp = await fetch(
    `${base}/issue/${encodeURIComponent(key)}/comment?orderBy=-created&maxResults=50`,
    { headers },
  );

  let comments: JiraComment[] = [];
  if (commentsResp.ok) {
    const commentsData = (await commentsResp.json()) as {
      comments: Array<{
        author: { displayName: string };
        body: unknown;
        created: string;
      }>;
    };

    comments = commentsData.comments.map((c) => ({
      author: c.author?.displayName ?? 'Unknown',
      body: adfToMarkdown(c.body),
      created: c.created,
    }));
  }

  // Build site URL for the issue
  let siteUrl: string;
  if (creds.authMethod === 'oauth') {
    siteUrl = creds.oauth.siteUrl;
  } else {
    siteUrl = creds.apiToken.baseUrl;
  }
  const issueUrl = `${siteUrl.replace(/\/$/, '')}/browse/${key}`;

  const rawAttachments = (fields.attachment ?? []) as Array<{
    filename: string;
    content: string;
    mimeType: string;
    size: number;
  }>;

  return {
    key,
    summary: (fields.summary as string) ?? '',
    description: adfToMarkdown(fields.description),
    status: ((fields.status as Record<string, unknown>)?.name as string) ?? 'Unknown',
    priority: ((fields.priority as Record<string, unknown>)?.name as string) ?? 'None',
    type: ((fields.issuetype as Record<string, unknown>)?.name as string) ?? 'Unknown',
    assignee: ((fields.assignee as Record<string, unknown>)?.displayName as string) ?? null,
    reporter: ((fields.reporter as Record<string, unknown>)?.displayName as string) ?? null,
    labels: (fields.labels as string[]) ?? [],
    created: (fields.created as string) ?? '',
    updated: (fields.updated as string) ?? '',
    comments,
    attachments: rawAttachments.map((a) => ({
      filename: a.filename,
      localPath: '', // filled in after download
      mimeType: a.mimeType,
      size: a.size,
    })),
    linkedWorktree: null,
    fetchedAt: new Date().toISOString(),
    url: issueUrl,
  };
}

export async function downloadAttachments(
  rawAttachments: Array<{
    filename: string;
    content: string;
    mimeType: string;
    size: number;
  }>,
  targetDir: string,
  creds: JiraCredentials,
  configDir: string,
): Promise<JiraAttachment[]> {
  if (rawAttachments.length === 0) return [];

  mkdirSync(targetDir, { recursive: true });
  const headers = await getAuthHeaders(creds, configDir);
  const results: JiraAttachment[] = [];
  const usedNames = new Set<string>();

  for (const att of rawAttachments) {
    let filename = att.filename;

    // Handle duplicate filenames
    if (usedNames.has(filename)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      let counter = 1;
      while (usedNames.has(`${base}_${counter}${ext}`)) counter++;
      filename = `${base}_${counter}${ext}`;
    }
    usedNames.add(filename);

    const localPath = path.join(targetDir, filename);

    try {
      const resp = await fetch(att.content, {
        headers: { Authorization: headers.Authorization },
      });

      if (!resp.ok || !resp.body) {
        console.log(`[wok3] Warning: failed to download ${att.filename}`);
        continue;
      }

      const writeStream = createWriteStream(localPath);
      await pipeline(Readable.fromWeb(resp.body as import('stream/web').ReadableStream), writeStream);

      results.push({
        filename,
        localPath,
        mimeType: att.mimeType,
        size: att.size,
      });
    } catch (err) {
      console.log(`[wok3] Warning: failed to download ${att.filename}: ${err}`);
    }
  }

  return results;
}

export function saveTaskData(taskData: JiraTaskData, tasksDir: string): void {
  const taskDir = path.join(tasksDir, taskData.key);
  mkdirSync(taskDir, { recursive: true });
  writeFileSync(path.join(taskDir, 'task.json'), JSON.stringify(taskData, null, 2) + '\n');
}

// -- Connection test --

export async function testConnection(
  creds: JiraCredentials,
  configDir: string,
): Promise<string> {
  const base = getApiBase(creds);
  const headers = await getAuthHeaders(creds, configDir);

  const resp = await fetch(`${base}/myself`, { headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Connection test failed: ${resp.status} ${body}`);
  }

  const user = (await resp.json()) as { displayName: string; emailAddress: string };
  return `${user.displayName} (${user.emailAddress})`;
}
