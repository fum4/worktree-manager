import type { JiraIssueDetail, JiraIssueSummary, JiraStatus, GitHubStatus, LinearStatus, LinearIssueSummary, LinearIssueDetail } from '../types';

// API functions now accept an optional serverUrl parameter
// When null/undefined, they use relative URLs (for single-project web mode)
// When provided, they use the full URL (for multi-project Electron mode)

function getBaseUrl(serverUrl: string | null): string {
  return serverUrl ?? '';
}

export async function createWorktree(
  branch: string,
  name?: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string; code?: string; worktreeId?: string }> {
  try {
    const body: { branch: string; name?: string } = { branch };
    if (name) body.name = name;
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/worktrees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create worktree',
    };
  }
}

export async function recoverWorktree(
  id: string,
  action: 'reuse' | 'recreate',
  branch?: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, branch }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to recover worktree',
    };
  }
}

export async function renameWorktree(
  id: string,
  request: { name?: string; branch?: string },
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to rename worktree',
    };
  }
}

export async function startWorktree(
  id: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/start`,
      {
        method: 'POST',
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to start worktree',
    };
  }
}

export async function stopWorktree(
  id: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/stop`,
      {
        method: 'POST',
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to stop worktree',
    };
  }
}

export async function removeWorktree(
  id: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove worktree',
    };
  }
}

export async function createFromJira(
  issueKey: string,
  branch?: string,
  serverUrl: string | null = null,
): Promise<{
  success: boolean;
  task?: { key: string; summary: string; status: string; type: string; url: string };
  error?: string;
  code?: string;
  worktreeId?: string;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueKey, branch: branch || undefined }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create from Jira',
    };
  }
}

export async function commitChanges(
  id: string,
  message: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/commit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to commit',
    };
  }
}

export async function pushChanges(
  id: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/push`,
      {
        method: 'POST',
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to push',
    };
  }
}

export async function createPullRequest(
  id: string,
  title: string,
  body?: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; pr?: { url: string }; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(id)}/create-pr`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body }),
      },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create PR',
    };
  }
}

export async function installGitHubCli(
  serverUrl: string | null = null,
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/install`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to install gh CLI',
    };
  }
}

export async function loginGitHub(
  serverUrl: string | null = null,
): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/login`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to authenticate with GitHub',
    };
  }
}

export async function logoutGitHub(
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/logout`, { method: 'POST' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: `Something went wrong (${res.status}: ${text.slice(0, 50)})` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to logout from GitHub',
    };
  }
}

export async function createInitialCommit(
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/initial-commit`, { method: 'POST' });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: `Something went wrong (${res.status}: ${text.slice(0, 50)})` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create initial commit',
    };
  }
}

export async function createGitHubRepo(
  isPrivate: boolean,
  serverUrl: string | null = null,
): Promise<{ success: boolean; repo?: string; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/create-repo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private: isPrivate }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create GitHub repository',
    };
  }
}

export async function fetchJiraIssues(
  query?: string,
  serverUrl: string | null = null,
): Promise<{ issues: JiraIssueSummary[]; error?: string }> {
  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/issues${params}`);
    return await res.json();
  } catch (err) {
    return {
      issues: [],
      error: err instanceof Error ? err.message : 'Failed to fetch Jira issues',
    };
  }
}

export async function fetchJiraIssueDetail(
  key: string,
  serverUrl: string | null = null,
): Promise<{ issue?: JiraIssueDetail; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/issues/${encodeURIComponent(key)}`);
    return await res.json();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch issue detail',
    };
  }
}

export async function createTerminalSession(
  worktreeId: string,
  cols?: number,
  rows?: number,
  serverUrl: string | null = null,
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/worktrees/${encodeURIComponent(worktreeId)}/terminals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, error: text || `HTTP ${res.status}` };
      }
    }
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create terminal',
    };
  }
}

export async function destroyTerminalSession(
  sessionId: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${getBaseUrl(serverUrl)}/api/terminals/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    );
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to destroy terminal',
    };
  }
}

export function getTerminalWsUrl(sessionId: string, serverUrl: string | null = null): string {
  if (serverUrl) {
    // Convert http://localhost:6970 to ws://localhost:6970
    const wsUrl = serverUrl.replace(/^http/, 'ws');
    return `${wsUrl}/api/terminals/${encodeURIComponent(sessionId)}/ws`;
  }
  // Relative URL mode - use current window location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/terminals/${encodeURIComponent(sessionId)}/ws`;
}

export async function discoverPorts(
  serverUrl: string | null = null,
): Promise<{
  success: boolean;
  ports: number[];
  logs: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/discover`, {
      method: 'POST',
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      ports: [],
      logs: [],
      error: err instanceof Error ? err.message : 'Failed to discover ports',
    };
  }
}

// Config-related API functions
export async function fetchConfig(serverUrl: string | null = null): Promise<{
  config?: {
    projectDir: string;
    worktreesDir: string;
    startCommand: string;
    installCommand: string;
    baseBranch: string;
    ports: { discovered: number[]; offsetStep: number };
    envMapping?: Record<string, string>;
    serverPort: number;
  };
  projectName?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config`);
    if (!res.ok) throw new Error('Failed to fetch config');
    return await res.json();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch config',
    };
  }
}

export async function saveConfig(
  updates: Record<string, unknown>,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save config',
    };
  }
}

export async function setupJira(
  baseUrl: string,
  email: string,
  token: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, email, token }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to setup Jira',
    };
  }
}

export async function updateJiraConfig(
  defaultProjectKey: string,
  refreshIntervalMinutes?: number,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: { defaultProjectKey: string; refreshIntervalMinutes?: number } = { defaultProjectKey };
    if (refreshIntervalMinutes !== undefined) body.refreshIntervalMinutes = refreshIntervalMinutes;
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update Jira config',
    };
  }
}

export async function disconnectJira(
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/credentials`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to disconnect Jira',
    };
  }
}

// -- Linear API functions --

export async function fetchLinearStatus(serverUrl: string | null = null): Promise<LinearStatus | null> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/status`);
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLinearIssues(
  query?: string,
  serverUrl: string | null = null,
): Promise<{ issues: LinearIssueSummary[]; error?: string }> {
  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/issues${params}`);
    return await res.json();
  } catch (err) {
    return {
      issues: [],
      error: err instanceof Error ? err.message : 'Failed to fetch Linear issues',
    };
  }
}

export async function fetchLinearIssueDetail(
  identifier: string,
  serverUrl: string | null = null,
): Promise<{ issue?: LinearIssueDetail; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/issues/${encodeURIComponent(identifier)}`);
    return await res.json();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch issue detail',
    };
  }
}

export async function createFromLinear(
  identifier: string,
  branch?: string,
  serverUrl: string | null = null,
): Promise<{
  success: boolean;
  task?: { identifier: string; title: string; status: string; url: string };
  error?: string;
  code?: string;
  worktreeId?: string;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, branch: branch || undefined }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create from Linear',
    };
  }
}

export async function setupLinear(
  apiKey: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to setup Linear',
    };
  }
}

export async function updateLinearConfig(
  defaultTeamKey: string,
  refreshIntervalMinutes?: number,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: { defaultTeamKey: string; refreshIntervalMinutes?: number } = { defaultTeamKey };
    if (refreshIntervalMinutes !== undefined) body.refreshIntervalMinutes = refreshIntervalMinutes;
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update Linear config',
    };
  }
}

export async function disconnectLinear(
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/linear/credentials`, {
      method: 'DELETE',
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to disconnect Linear',
    };
  }
}

// Fetch worktrees
export async function fetchWorktrees(serverUrl: string | null = null): Promise<{
  worktrees: unknown[];
  error?: string;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/worktrees`);
    if (!res.ok) throw new Error('Failed to fetch worktrees');
    const data = await res.json();
    return { worktrees: data.worktrees || [] };
  } catch (err) {
    return {
      worktrees: [],
      error: err instanceof Error ? err.message : 'Failed to fetch worktrees',
    };
  }
}

// Get SSE URL for events
export function getEventsUrl(serverUrl: string | null = null): string {
  return `${getBaseUrl(serverUrl)}/api/events`;
}

// Fetch ports info
export async function fetchPorts(serverUrl: string | null = null): Promise<{
  discovered: number[];
  offsetStep: number;
}> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/ports`);
    if (!res.ok) throw new Error('Failed to fetch ports');
    return await res.json();
  } catch {
    return { discovered: [], offsetStep: 1 };
  }
}

// Fetch Jira status
export async function fetchJiraStatus(serverUrl: string | null = null): Promise<JiraStatus | null> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/jira/status`);
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch GitHub status
export async function fetchGitHubStatus(serverUrl: string | null = null): Promise<GitHubStatus | null> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/github/status`);
    return await res.json();
  } catch {
    return null;
  }
}

// Check if wok3 config files need to be pushed
export async function fetchSetupStatus(
  serverUrl: string | null = null,
): Promise<{ needsPush: boolean; files: string[] }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config/setup-status`);
    return await res.json();
  } catch {
    return { needsPush: false, files: [] };
  }
}

// Commit wok3 config files
export async function commitSetup(
  message: string,
  serverUrl: string | null = null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config/commit-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to commit' };
  }
}

// Detect config values without creating config
export interface DetectedConfig {
  baseBranch: string;
  startCommand: string;
  installCommand: string;
  serverPort: number;
}

export async function detectConfig(
  serverUrl: string | null = null,
): Promise<{ success: boolean; config?: DetectedConfig; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config/detect`);
    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to detect config' };
  }
}

// Initialize config with provided values
export async function initConfig(
  config: Partial<DetectedConfig>,
  serverUrl: string | null = null,
): Promise<{ success: boolean; config?: DetectedConfig; error?: string }> {
  try {
    const res = await fetch(`${getBaseUrl(serverUrl)}/api/config/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return await res.json();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to initialize config' };
  }
}
