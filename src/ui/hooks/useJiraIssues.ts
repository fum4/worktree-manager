import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchJiraIssues } from './api';
import type { JiraIssueSummary } from '../types';

export function useJiraIssues(enabled: boolean) {
  const [issues, setIssues] = useState<JiraIssueSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedRef = useRef(false);

  const doFetch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    const result = await fetchJiraIssues(query || undefined);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    }
    setIssues(result.issues);
  }, []);

  // Fetch on mount (when enabled) and when search query changes (debounced)
  useEffect(() => {
    if (!enabled) return;

    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      doFetch(searchQuery);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, searchQuery, doFetch]);

  // Reset when disabled
  useEffect(() => {
    if (!enabled) {
      hasFetchedRef.current = false;
    }
  }, [enabled]);

  const refetch = useCallback(() => doFetch(searchQuery), [doFetch, searchQuery]);

  return { issues, isLoading, error, searchQuery, setSearchQuery, refetch };
}
