import { useCallback, useEffect, useState } from 'react';

import { fetchJiraIssueDetail } from './api';
import type { JiraIssueDetail } from '../types';

export function useJiraIssueDetail(issueKey: string | null) {
  const [issue, setIssue] = useState<JiraIssueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);
    const result = await fetchJiraIssueDetail(key);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
      setIssue(null);
    } else if (result.issue) {
      setIssue(result.issue);
    }
  }, []);

  useEffect(() => {
    if (!issueKey) {
      setIssue(null);
      setError(null);
      return;
    }
    doFetch(issueKey);
  }, [issueKey, doFetch]);

  return { issue, isLoading, error };
}
