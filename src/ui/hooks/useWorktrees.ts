import { useCallback, useEffect, useState } from 'react';

import type { WorktreeInfo, PortsInfo, JiraStatus, GitHubStatus } from '../types';

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
