import { useMemo, useState } from 'react';

import type { JiraIssueSummary, LinearIssueSummary, WorktreeInfo } from '../types';
import { text } from '../theme';
import { JiraIssueList } from './JiraIssueList';
import { LinearIssueList } from './LinearIssueList';

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-3 h-3 ${text.muted} transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
    >
      <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

function RefreshIcon({ spinning, onClick, title }: { spinning: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className={`ml-auto p-0.5 rounded ${text.muted} hover:text-[#c0c5cc] transition-colors duration-150`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`w-3 h-3 ${spinning ? 'animate-spin' : ''}`}
      >
        <path
          fillRule="evenodd"
          d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.341a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.024-.274Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface IssueListProps {
  // Jira
  issues: JiraIssueSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  onRefreshJira: () => void;
  jiraUpdatedAt: number;
  // Linear
  linearIssues: LinearIssueSummary[];
  linearConfigured: boolean;
  linearLoading: boolean;
  linearFetching: boolean;
  linearError: string | null;
  selectedLinearIdentifier: string | null;
  onSelectLinear: (identifier: string) => void;
  onRefreshLinear: () => void;
  linearUpdatedAt: number;
  // Shared
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
  onRefreshJira,
  jiraUpdatedAt,
  linearIssues,
  linearConfigured,
  linearLoading,
  linearFetching,
  linearError,
  selectedLinearIdentifier,
  onSelectLinear,
  onRefreshLinear,
  linearUpdatedAt,
  worktrees,
  onViewWorktree,
}: IssueListProps) {
  const [linkedCollapsed, setLinkedCollapsed] = useState(false);
  const [jiraCollapsed, setJiraCollapsed] = useState(false);
  const [linearCollapsed, setLinearCollapsed] = useState(false);

  // Build map of issueKey -> worktreeId (Jira)
  const linkedJiraWorktrees = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of worktrees) {
      if (wt.jiraUrl) {
        const match = wt.jiraUrl.match(/\/browse\/([A-Z]+-\d+)/);
        if (match) map.set(match[1], wt.id);
      }
    }
    return map;
  }, [worktrees]);

  // Build map of identifier -> worktreeId (Linear)
  const linkedLinearWorktrees = useMemo(() => {
    const map = new Map<string, string>();
    for (const wt of worktrees) {
      if (wt.linearUrl) {
        // Linear URLs look like https://linear.app/team/issue/ENG-123
        const match = wt.linearUrl.match(/\/issue\/([A-Z]+-\d+)/);
        if (match) map.set(match[1], wt.id);
      }
    }
    return map;
  }, [worktrees]);

  // Split Jira issues into linked and unlinked
  const linkedJiraIssues = useMemo(
    () => issues.filter((i) => linkedJiraWorktrees.has(i.key)),
    [issues, linkedJiraWorktrees]
  );
  const unlinkedJiraIssues = useMemo(
    () => issues.filter((i) => !linkedJiraWorktrees.has(i.key)),
    [issues, linkedJiraWorktrees]
  );

  // Split Linear issues into linked and unlinked
  const linkedLinearIssues = useMemo(
    () => linearIssues.filter((i) => linkedLinearWorktrees.has(i.identifier)),
    [linearIssues, linkedLinearWorktrees]
  );
  const unlinkedLinearIssues = useMemo(
    () => linearIssues.filter((i) => !linkedLinearWorktrees.has(i.identifier)),
    [linearIssues, linkedLinearWorktrees]
  );

  const allLinkedCount = linkedJiraIssues.length + linkedLinearIssues.length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 space-y-3">
        {/* With Worktrees section */}
        {allLinkedCount > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setLinkedCollapsed(!linkedCollapsed)}
              className="w-full px-3 py-1.5 mb-px flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150"
            >
              <ChevronIcon collapsed={linkedCollapsed} />
              <span className={`text-[11px] font-medium ${text.secondary}`}>With Worktrees</span>
              <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {allLinkedCount}
              </span>
            </button>

            {!linkedCollapsed && (
              <>
                {linkedJiraIssues.length > 0 && (
                  <JiraIssueList
                    issues={linkedJiraIssues}
                    selectedKey={selectedKey}
                    onSelect={onSelect}
                    isLoading={false}
                    isFetching={false}
                    error={null}
                    linkedWorktrees={linkedJiraWorktrees}
                    onViewWorktree={onViewWorktree}
                  />
                )}
                {linkedLinearIssues.length > 0 && (
                  <LinearIssueList
                    issues={linkedLinearIssues}
                    selectedIdentifier={selectedLinearIdentifier}
                    onSelect={onSelectLinear}
                    isLoading={false}
                    isFetching={false}
                    error={null}
                    linkedWorktrees={linkedLinearWorktrees}
                    onViewWorktree={onViewWorktree}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Jira section */}
        {issues.length > 0 && (
          <div>
            <div
              className="w-full px-3 py-1.5 mb-px flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
              onClick={() => setJiraCollapsed(!jiraCollapsed)}
            >
              <ChevronIcon collapsed={jiraCollapsed} />
              <span className={`text-[11px] font-medium ${text.secondary}`}>Jira</span>
              {!isLoading && unlinkedJiraIssues.length > 0 && (
                <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                  {unlinkedJiraIssues.length}
                </span>
              )}
              <RefreshIcon
                spinning={isFetching && issues.length > 0}
                onClick={onRefreshJira}
                title={jiraUpdatedAt ? `Last refreshed: ${formatTimeAgo(jiraUpdatedAt)}` : 'Refresh'}
              />
            </div>

            {!jiraCollapsed && (
              <JiraIssueList
                issues={unlinkedJiraIssues}
                selectedKey={selectedKey}
                onSelect={onSelect}
                isLoading={isLoading}
                isFetching={isFetching}
                error={error}
                linkedWorktrees={linkedJiraWorktrees}
                onViewWorktree={onViewWorktree}
              />
            )}
          </div>
        )}

        {/* Show Jira loading/error states even when no issues yet */}
        {issues.length === 0 && (isLoading || error) && (
          <div>
            <div
              className="w-full px-3 py-1.5 mb-px flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
              onClick={() => setJiraCollapsed(!jiraCollapsed)}
            >
              <ChevronIcon collapsed={jiraCollapsed} />
              <span className={`text-[11px] font-medium ${text.secondary}`}>Jira</span>
              <RefreshIcon
                spinning={isFetching}
                onClick={onRefreshJira}
                title={jiraUpdatedAt ? `Last refreshed: ${formatTimeAgo(jiraUpdatedAt)}` : 'Refresh'}
              />
            </div>

            {!jiraCollapsed && (
              <JiraIssueList
                issues={[]}
                selectedKey={selectedKey}
                onSelect={onSelect}
                isLoading={isLoading}
                isFetching={isFetching}
                error={error}
                onViewWorktree={onViewWorktree}
              />
            )}
          </div>
        )}

        {/* Linear section */}
        {linearConfigured && (
          <div>
            <div
              className="w-full px-3 py-1.5 mb-px flex items-center gap-2 hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer"
              onClick={() => setLinearCollapsed(!linearCollapsed)}
            >
              <ChevronIcon collapsed={linearCollapsed} />
              <span className={`text-[11px] font-medium ${text.secondary}`}>Linear</span>
              {!linearLoading && unlinkedLinearIssues.length > 0 && (
                <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                  {unlinkedLinearIssues.length}
                </span>
              )}
              <RefreshIcon
                spinning={linearFetching && linearIssues.length > 0}
                onClick={onRefreshLinear}
                title={linearUpdatedAt ? `Last refreshed: ${formatTimeAgo(linearUpdatedAt)}` : 'Refresh'}
              />
            </div>

            {!linearCollapsed && (
              <LinearIssueList
                issues={unlinkedLinearIssues}
                selectedIdentifier={selectedLinearIdentifier}
                onSelect={onSelectLinear}
                isLoading={linearLoading}
                isFetching={linearFetching}
                error={linearError}
                linkedWorktrees={linkedLinearWorktrees}
                onViewWorktree={onViewWorktree}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
