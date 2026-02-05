import { useCallback, useEffect, useState } from 'react';

export interface WorktreeConfig {
  projectDir: string;
  worktreesDir: string;
  startCommand: string;
  installCommand: string;
  baseBranch: string;
  ports: {
    discovered: number[];
    offsetStep: number;
  };
  envMapping?: Record<string, string>;
  serverPort: number;
}

const API_BASE = '';

export function useConfig() {
  const [config, setConfig] = useState<WorktreeConfig | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (!res.ok) throw new Error('Failed to fetch config');
      const data = await res.json();
      setConfig(data.config);
      setProjectName(data.projectName);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, projectName, isLoading, refetch: fetchConfig };
}

export async function saveConfig(
  updates: Partial<WorktreeConfig>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/config`, {
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/jira/setup`, {
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
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: { defaultProjectKey: string; refreshIntervalMinutes?: number } = { defaultProjectKey };
    if (refreshIntervalMinutes !== undefined) body.refreshIntervalMinutes = refreshIntervalMinutes;
    const res = await fetch(`${API_BASE}/api/jira/config`, {
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

export async function disconnectJira(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/jira/credentials`, {
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
