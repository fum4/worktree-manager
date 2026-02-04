import type { JiraIssueDetail, JiraIssueSummary } from '../types';

const API_BASE = '';

export async function createWorktree(
  branch: string,
  name?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: { branch: string; name?: string } = { branch };
    if (name) body.name = name;
    const res = await fetch(`${API_BASE}/api/worktrees`, {
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

export async function renameWorktree(
  id: string,
  request: { name?: string; branch?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}`,
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}/start`,
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}/stop`,
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}`,
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
): Promise<{
  success: boolean;
  task?: { key: string; summary: string; status: string; type: string; url: string };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/jira/task`, {
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}/commit`,
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}/push`,
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
): Promise<{ success: boolean; pr?: { url: string }; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(id)}/create-pr`,
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

export async function installGitHubCli(): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/github/install`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to install gh CLI',
    };
  }
}

export async function loginGitHub(): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/github/login`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to authenticate with GitHub',
    };
  }
}

export async function fetchJiraIssues(
  query?: string,
): Promise<{ issues: JiraIssueSummary[]; error?: string }> {
  try {
    const params = query ? `?query=${encodeURIComponent(query)}` : '';
    const res = await fetch(`${API_BASE}/api/jira/issues${params}`);
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
): Promise<{ issue?: JiraIssueDetail; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/jira/issues/${encodeURIComponent(key)}`);
    return await res.json();
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch issue detail',
    };
  }
}

export async function createTerminalSession(
  worktreeId: string,
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/worktrees/${encodeURIComponent(worktreeId)}/terminals`,
      { method: 'POST' },
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/api/terminals/${encodeURIComponent(sessionId)}`,
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

export function getTerminalWsUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/terminals/${encodeURIComponent(sessionId)}/ws`;
}

export async function discoverPorts(): Promise<{
  success: boolean;
  ports: number[];
  logs: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/discover`, {
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
