import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchJiraIssues } from './api';

export function useJiraIssues(enabled: boolean, refreshIntervalMinutes = 5) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const staleTime = refreshIntervalMinutes * 60 * 1000;

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['jira-issues', debouncedQuery],
    queryFn: async () => {
      const result = await fetchJiraIssues(debouncedQuery || undefined);
      if (result.error) throw new Error(result.error);
      return result.issues;
    },
    enabled,
    staleTime,
    refetchInterval: staleTime,
  });

  return {
    issues: data ?? [],
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : null,
    searchQuery,
    setSearchQuery,
    refetch,
    dataUpdatedAt,
  };
}
