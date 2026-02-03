import { useCallback, useEffect, useState } from 'react';

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  status: 'running' | 'stopped' | 'starting' | 'creating';
  statusMessage?: string;
  ports: number[];
  offset: number | null;
  pid: number | null;
  lastActivity?: number;
  logs?: string[];
  jiraUrl?: string;
  jiraStatus?: string;
  githubPrUrl?: string;
  githubPrState?: string;
  hasUncommitted?: boolean;
  hasUnpushed?: boolean;
  commitsAhead?: number;
}

export interface PortsInfo {
  discovered: number[];
  offsetStep: number;
}

const API_BASE = '';

export function useWorktrees() {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorktrees = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/worktrees`);
      if (!res.ok) throw new Error('Failed to fetch worktrees');
      const data = await res.json();
      setWorktrees(data.worktrees || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch worktrees',
      );
    }
  }, []);

  useEffect(() => {
    fetchWorktrees();

    const eventSource = new EventSource(`${API_BASE}/api/events`);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'worktrees') {
          setWorktrees(data.worktrees || []);
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      setTimeout(() => {
        fetchWorktrees();
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchWorktrees]);

  return { worktrees, isConnected, error, refetch: fetchWorktrees };
}

export function useProjectName() {
  const [projectName, setProjectName] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((data) => {
        if (data.projectName) setProjectName(data.projectName);
      })
      .catch(() => {});
  }, []);

  return projectName;
}

export function usePorts() {
  const [ports, setPorts] = useState<PortsInfo>({
    discovered: [],
    offsetStep: 1,
  });

  const fetchPorts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ports`);
      if (!res.ok) throw new Error('Failed to fetch ports');
      const data = await res.json();
      setPorts(data);
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    fetchPorts();
  }, [fetchPorts]);

  return { ports, refetchPorts: fetchPorts };
}

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

export interface JiraStatus {
  configured: boolean;
  defaultProjectKey: string | null;
}

export function useJiraStatus() {
  const [jiraStatus, setJiraStatus] = useState<JiraStatus | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/jira/status`)
      .then((res) => res.json())
      .then((data) => setJiraStatus(data))
      .catch(() => {});
  }, []);

  return jiraStatus;
}

export async function createFromJira(
  issueKey: string,
): Promise<{
  success: boolean;
  task?: { key: string; summary: string; status: string; type: string; url: string };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/jira/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueKey }),
    });
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create from Jira',
    };
  }
}

export interface GitHubStatus {
  installed: boolean;
  authenticated: boolean;
  repo: string | null;
}

export function useGitHubStatus() {
  const [status, setStatus] = useState<GitHubStatus | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/github/status`)
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch(() => {});
  }, []);

  return status;
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
