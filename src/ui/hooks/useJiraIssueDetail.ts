import { useQuery } from '@tanstack/react-query';

import { fetchJiraIssueDetail } from './api';
import type { JiraIssueDetail } from '../types';

export function useJiraIssueDetail(issueKey: string | null, refreshIntervalMinutes = 5) {
  const staleTime = refreshIntervalMinutes * 60 * 1000;

  const { data, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery<JiraIssueDetail | null>({
    queryKey: ['jira-issue', issueKey],
    queryFn: async () => {
      const result = await fetchJiraIssueDetail(issueKey!);
      if (result.error) throw new Error(result.error);
      return result.issue ?? null;
    },
    enabled: !!issueKey,
    staleTime,
  });

  return {
    issue: data ?? null,
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : null,
    refetch,
    dataUpdatedAt,
  };
}
