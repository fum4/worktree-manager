import type { JiraIssueSummary } from '../types';
import { border, input, text } from '../theme';
import { JiraIssueItem } from './JiraIssueItem';

interface JiraIssueListProps {
  issues: JiraIssueSummary[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function JiraIssueList({
  issues,
  selectedKey,
  onSelect,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
}: JiraIssueListProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`px-3 py-2 border-b ${border.subtle}`}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search issues..."
          className={`w-full px-2 py-1.5 ${input.bg} border ${border.input} rounded ${input.text} ${input.placeholder} text-xs focus:outline-none focus:${border.focusPrimary} focus-visible:ring-1 ${input.ring}`}
        />
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
            <p className={`${text.dimmed} text-[10px] mt-1`}>
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
