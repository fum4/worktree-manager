import { useCallback, useEffect, useState } from 'react';

import { useServerUrlOptional } from '../contexts/ServerContext';
import {
  fetchHooksConfig as apiFetchConfig,
  fetchHookSkillResults as apiFetchSkillResults,
  saveHooksConfig as apiSaveConfig,
  type SkillHookResult,
  type HooksConfig,
} from './api';

export function useHooksConfig() {
  const serverUrl = useServerUrlOptional();
  const [config, setConfig] = useState<HooksConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    if (serverUrl === null) {
      setConfig(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await apiFetchConfig(serverUrl);
      setConfig(data);
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

  const saveConfig = useCallback(async (newConfig: HooksConfig) => {
    if (serverUrl === null) return;
    const result = await apiSaveConfig(newConfig, serverUrl);
    if (result.success && result.config) {
      setConfig(result.config);
    }
    return result;
  }, [serverUrl]);

  return { config, isLoading, refetch: fetchConfig, saveConfig };
}

export function useHookSkillResults(worktreeId: string | null) {
  const serverUrl = useServerUrlOptional();
  const [results, setResults] = useState<SkillHookResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    if (serverUrl === null || !worktreeId) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await apiFetchSkillResults(worktreeId, serverUrl);
      setResults(data.results);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, [serverUrl, worktreeId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  return { results, isLoading, refetch: fetchResults };
}
