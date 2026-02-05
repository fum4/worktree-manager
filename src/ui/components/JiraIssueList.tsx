import type { JiraIssueSummary } from '../types';
import { border, input, text } from '../theme';
import { JiraIssueItem } from './JiraIssueItem';

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface JiraIssueListProps {
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

export function JiraIssueList({
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
}: JiraIssueListProps) {
  const showSpinner = isFetching && issues.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
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

      {isLoading && issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className={`${text.muted} text-xs`}>Loading issues...</p>
        </div>
      ) : error && issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className={`${text.error} text-xs text-center`}>{error}</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className={`${text.muted} text-xs`}>No issues found</p>
            <p className={`${text.dimmed} text-[11px] mt-1`}>
              {searchQuery ? 'Try a different search' : 'No issues assigned to you'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {issues.map((issue) => (
            <JiraIssueItem
              key={issue.key}
              issue={issue}
              isSelected={issue.key === selectedKey}
              onSelect={() => onSelect(issue.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
