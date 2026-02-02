import { useCallback, useEffect, useState } from 'react';

export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  status: 'running' | 'stopped' | 'starting';
  ports: number[];
  offset: number | null;
  pid: number | null;
  lastActivity?: number;
  logs?: string[];
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
