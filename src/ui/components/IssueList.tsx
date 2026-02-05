import { useState } from 'react';

import type { JiraIssueSummary } from '../types';
import { border, input, text } from '../theme';
import { JiraIssueList } from './JiraIssueList';

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
  issues: JiraIssueSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  dataUpdatedAt: number;
}

export function IssueList({
  issues,
  selectedKey,
  onSelect,
  isLoading,
  isFetching,
  error,
  searchQuery,
  onSearchChange,
  onRefresh,
  dataUpdatedAt,
}: IssueListProps) {
  const [jiraCollapsed, setJiraCollapsed] = useState(false);
  const showSpinner = isFetching && issues.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Shared search bar */}
      <div className={`px-3 py-2 border-b ${border.subtle}`}>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search issues..."
            className={`flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-accent/0 rounded-md ${input.text} placeholder-[#4b5563] text-xs focus:outline-none focus:bg-white/[0.06] focus:border-accent/30 transition-all duration-150`}
          />
          <button
            type="button"
            onClick={() => onRefresh()}
            title={dataUpdatedAt ? `Last refreshed: ${formatTimeAgo(dataUpdatedAt)}` : 'Refresh'}
            className={`flex-shrink-0 p-1.5 rounded-md ${text.muted} hover:${text.secondary} hover:bg-white/[0.06] transition-all duration-150`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`w-3.5 h-3.5 ${showSpinner ? 'animate-spin' : ''}`}
            >
              <path
                fillRule="evenodd"
                d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.341a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.024-.274Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable provider sections */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Jira section */}
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
            {!isLoading && issues.length > 0 && (
              <span className={`text-[10px] ${text.dimmed} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {issues.length}
              </span>
            )}
          </button>

          {!jiraCollapsed && (
            <JiraIssueList
              issues={issues}
              selectedKey={selectedKey}
              onSelect={onSelect}
              isLoading={isLoading}
              isFetching={isFetching}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
}
