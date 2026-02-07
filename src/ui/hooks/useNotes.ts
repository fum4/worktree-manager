import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchNotes, updateNotes } from './api';
import type { IssueNotes } from './api';
import { useServerUrlOptional } from '../contexts/ServerContext';

export function useNotes(source: string, id: string | null) {
  const serverUrl = useServerUrlOptional();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery<IssueNotes>({
    queryKey: ['notes', source, id, serverUrl],
    queryFn: () => fetchNotes(source, id!, serverUrl),
    enabled: !!id && serverUrl !== null,
    staleTime: 10_000,
  });

  const updateSection = async (section: 'personal' | 'aiContext', content: string) => {
    if (!id) return;
    const result = await updateNotes(source, id, section, content, serverUrl);
    queryClient.setQueryData(['notes', source, id, serverUrl], result);
    return result;
  };

  return {
    notes: data ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    updateSection,
    refetch,
  };
}
