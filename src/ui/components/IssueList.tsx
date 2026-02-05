import { useMemo, useState } from 'react';

import type { JiraIssueSummary, WorktreeInfo } from '../types';
import { text } from '../theme';
import { JiraIssueList } from './JiraIssueList';

interface IssueListProps {
  issues: JiraIssueSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  worktrees: WorktreeInfo[];
  onViewWorktree: (worktreeId: string) => void;
}

export function IssueList({
  issues,
  selectedKey,
  onSelect,
  isLoading,
  isFetching,
  error,
  worktrees,
  onViewWorktree,
}: IssueListProps) {
  const [linkedCollapsed, setLinkedCollapsed] = useState(false);
  const [jiraCollapsed, setJiraCollapsed] = useState(false);

  // Build map of issueKey -> worktreeId
  const linkedWorktrees = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of worktrees) {
      if (wt.jiraUrl) {
        const match = wt.jiraUrl.match(/\/browse\/([A-Z]+-\d+)/);
        if (match) map.set(match[1], wt.id);
      }
    }
    return map;
  }, [worktrees]);

  // Split issues into linked and unlinked
  const linkedIssues = useMemo(
    () => issues.filter((i) => linkedWorktrees.has(i.key)),
    [issues, linkedWorktrees]
  );
  const unlinkedIssues = useMemo(
    () => issues.filter((i) => !linkedWorktrees.has(i.key)),
    [issues, linkedWorktrees]
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrollable provider sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* With Worktrees section — only show if there are linked issues */}
        {linkedIssues.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setLinkedCollapsed(!linkedCollapsed)}
              className={`w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3 h-3 ${text.muted} transition-transform duration-150 ${linkedCollapsed ? '' : 'rotate-90'}`}
              >
                <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              <span className={`text-[11px] font-medium ${text.secondary}`}>With Worktrees</span>
              <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {linkedIssues.length}
              </span>
            </button>

            {!linkedCollapsed && (
              <JiraIssueList
                issues={linkedIssues}
                selectedKey={selectedKey}
                onSelect={onSelect}
                isLoading={false}
                isFetching={false}
                error={null}
                linkedWorktrees={linkedWorktrees}
                onViewWorktree={onViewWorktree}
              />
            )}
          </div>
        )}

        {/* Jira section — shows unlinked issues */}
        <div>
          <button
            type="button"
            onClick={() => setJiraCollapsed(!jiraCollapsed)}
            className={`w-full px-3 py-1.5 flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`w-3 h-3 ${text.muted} transition-transform duration-150 ${jiraCollapsed ? '' : 'rotate-90'}`}
            >
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
            <span className={`text-[11px] font-medium ${text.secondary}`}>Jira</span>
            {!isLoading && unlinkedIssues.length > 0 && (
              <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {unlinkedIssues.length}
              </span>
            )}
          </button>

          {!jiraCollapsed && (
            <JiraIssueList
              issues={unlinkedIssues}
              selectedKey={selectedKey}
              onSelect={onSelect}
              isLoading={isLoading}
              isFetching={isFetching}
              error={error}
              linkedWorktrees={linkedWorktrees}
              onViewWorktree={onViewWorktree}
            />
          )}
        </div>
      </div>
    </div>
  );
}
