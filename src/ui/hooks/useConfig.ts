import { useCallback, useEffect, useState } from 'react';

import { useServerUrlOptional } from '../contexts/ServerContext';
import { fetchConfig as apiFetchConfig } from './api';

export interface WorktreeConfig {
  projectDir: string;
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

export function useConfig() {
  const serverUrl = useServerUrlOptional();
  const [config, setConfig] = useState<WorktreeConfig | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (serverUrl === null) {
      setConfig(null);
      setProjectName(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await apiFetchConfig(serverUrl);
      setConfig(data.config || null);
      setProjectName(data.projectName || null);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    setIsLoading(true);
    fetchConfig();
  }, [fetchConfig]);

  return { config, projectName, isLoading, refetch: fetchConfig };
}

// Re-export API functions that components use directly
export { saveConfig, setupJira, updateJiraConfig, disconnectJira } from './api';
