import { useQuery } from '@tanstack/react-query';

import { fetchClaudeSkills, fetchClaudeSkill, fetchClaudePlugins } from './api';
import { useServerUrlOptional } from '../contexts/ServerContext';

export function useClaudeSkills() {
  const serverUrl = useServerUrlOptional();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['claudeSkills', serverUrl],
    queryFn: async () => {
      const result = await fetchClaudeSkills(serverUrl);
      if (result.error) throw new Error(result.error);
      return result.skills;
    },
    enabled: serverUrl !== null,
    staleTime: 5_000,
  });

  return {
    skills: data ?? [],
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}

export function useClaudeSkillDetail(name: string | null, location?: 'global' | 'project') {
  const serverUrl = useServerUrlOptional();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['claudeSkill', serverUrl, name, location],
    queryFn: async () => {
      if (!name) return null;
      const result = await fetchClaudeSkill(name, location, serverUrl);
      if (result.error) throw new Error(result.error);
      return result.skill ?? null;
    },
    enabled: serverUrl !== null && name !== null,
    staleTime: 5_000,
  });

  return {
    skill: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    refetch,
  };
}

export function useClaudePlugins() {
  const serverUrl = useServerUrlOptional();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['claudePlugins', serverUrl],
    queryFn: () => fetchClaudePlugins(serverUrl),
    enabled: serverUrl !== null,
    staleTime: 30_000,
  });

  return {
    plugins: data?.plugins ?? [],
    isLoading,
    refetch,
  };
}
