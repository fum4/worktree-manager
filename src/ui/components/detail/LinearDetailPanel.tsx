import { useState } from 'react';

import { useLinearIssueDetail } from '../../hooks/useLinearIssueDetail';
import { useApi } from '../../hooks/useApi';
import { badge, border, button, linearPriority, text } from '../../theme';
import { MarkdownContent } from '../MarkdownContent';
import { Spinner } from '../Spinner';
import { WorktreeExistsModal } from '../WorktreeExistsModal';

interface LinearDetailPanelProps {
  identifier: string;
  linkedWorktreeId: string | null;
  onCreateWorktree: (identifier: string) => void;
  onViewWorktree: (id: string) => void;
  refreshIntervalMinutes?: number;
  onSetupNeeded?: () => void;
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

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={`text-[11px] font-medium ${text.muted} mb-3`}>
      {children}
    </h3>
  );
}

export function LinearDetailPanel({ identifier, linkedWorktreeId, onCreateWorktree, onViewWorktree, refreshIntervalMinutes, onSetupNeeded }: LinearDetailPanelProps) {
  const api = useApi();
  const { issue, isLoading, isFetching, error, refetch, dataUpdatedAt } = useLinearIssueDetail(identifier, refreshIntervalMinutes);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [existingWorktree, setExistingWorktree] = useState<{ id: string; branch: string } | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    const result = await api.createFromLinear(identifier);
    setIsCreating(false);
    if (result.success) {
      onCreateWorktree(identifier);
    } else if (result.code === 'WORKTREE_EXISTS' && result.worktreeId) {
      setExistingWorktree({ id: result.worktreeId, branch: identifier });
    } else {
      const errorMsg = result.error || 'Failed to create worktree';
      if (errorMsg.includes('no commits') || errorMsg.includes('invalid reference')) {
        if (onSetupNeeded) {
          onSetupNeeded();
        } else {
          setCreateError(errorMsg);
        }
      } else {
        setCreateError(errorMsg);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <Spinner size="sm" className={text.muted} />
        <p className={`${text.muted} text-sm`}>Loading issue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`${text.error} text-sm`}>{error}</p>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`${text.muted} text-sm`}>Select an issue to view details</p>
      </div>
    );
  }

  const priorityInfo = linearPriority[issue.priority] ?? linearPriority[0];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className={`flex-shrink-0 px-5 py-4 border-b ${border.section}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold ${badge.linear} ${badge.linearHover} transition-colors`}
              >
                {issue.identifier}
              </a>
              <span
                className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded"
                style={{ backgroundColor: `${issue.state.color}20`, color: issue.state.color }}
              >
                {issue.state.name}
              </span>
              {issue.labels.length > 0 && (
                <span className={`text-[5px] ${text.dimmed}`}>●</span>
              )}
              {issue.labels.map((label) => (
                <span
                  key={label.name}
                  className="text-[11px] font-medium px-2 py-0.5 rounded"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
                >
                  {label.name}
                </span>
              ))}
              <span className={`text-[5px] ${text.dimmed}`}>●</span>
              <span className={`text-[11px] ${priorityInfo.color}`}>{priorityInfo.label}</span>
              <button
                type="button"
                onClick={() => refetch()}
                title={dataUpdatedAt ? `Last refreshed: ${formatTimeAgo(dataUpdatedAt)}` : 'Refresh'}
                className={`ml-2 p-0.5 rounded ${text.muted} hover:text-[#c0c5cc] transition-colors duration-150 flex items-center gap-1`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={`w-3 h-3 ${isFetching && !isLoading ? 'animate-spin' : ''}`}
                >
                  <path
                    fillRule="evenodd"
                    d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.341a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.024-.274Z"
                    clipRule="evenodd"
                  />
                </svg>
                {dataUpdatedAt > 0 && (
                  <span className="text-[11px]">
                    {formatTimeAgo(dataUpdatedAt)}
                  </span>
                )}
              </button>
            </div>
            <h2 className={`text-[15px] font-semibold ${text.primary} leading-snug`}>{issue.title}</h2>
          </div>
          <div className="flex-shrink-0 pt-1 flex items-center gap-2">
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 text-xs font-medium ${button.secondary} rounded-lg transition-colors duration-150`}
            >
              View in Linear
            </a>
            {linkedWorktreeId ? (
              <button
                type="button"
                onClick={() => onViewWorktree(linkedWorktreeId)}
                className={`px-3 py-1.5 text-xs font-medium ${button.secondary} rounded-lg transition-colors duration-150`}
              >
                View Worktree
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className={`px-3 py-1.5 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]`}
              >
                {isCreating ? 'Creating...' : 'Create Worktree'}
              </button>
            )}
          </div>
        </div>
        {createError && (
          <p className={`${text.error} text-[10px] mt-2`}>{createError}</p>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {issue.description && (
          <section>
            <SectionLabel>Description</SectionLabel>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-3">
              <MarkdownContent content={issue.description} />
            </div>
          </section>
        )}

        {issue.comments.length > 0 && (
          <section>
            <SectionLabel>Comments ({issue.comments.length})</SectionLabel>
            <div className="space-y-3">
              {issue.comments.map((comment, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] font-medium ${text.primary}`}>{comment.author}</span>
                    <span className={`text-[10px] ${text.dimmed}`}>{formatDate(comment.createdAt)}</span>
                  </div>
                  <MarkdownContent content={comment.body} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className={`text-[10px] ${text.dimmed} flex flex-wrap gap-4 pt-2`}>
          {issue.assignee && <span>Assigned to {issue.assignee}</span>}
          <span>Created {formatDate(issue.createdAt)}</span>
          <span>Updated {formatDate(issue.updatedAt)}</span>
        </div>
      </div>

      {existingWorktree && (
        <WorktreeExistsModal
          worktreeId={existingWorktree.id}
          branch={existingWorktree.branch}
          onResolved={() => {
            setExistingWorktree(null);
            onCreateWorktree(identifier);
          }}
          onCancel={() => setExistingWorktree(null)}
        />
      )}
    </div>
  );
}
