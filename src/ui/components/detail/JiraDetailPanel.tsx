import { useState } from 'react';

import { useJiraIssueDetail } from '../../hooks/useJiraIssueDetail';
import { createFromJira } from '../../hooks/api';
import { badge, border, button, jiraPriority, jiraType, text } from '../../theme';

interface JiraDetailPanelProps {
  issueKey: string;
  onCreateWorktree: (key: string) => void;
}

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JiraDetailPanel({ issueKey, onCreateWorktree }: JiraDetailPanelProps) {
  const { issue, isLoading, error } = useJiraIssueDetail(issueKey);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    const result = await createFromJira(issueKey);
    setIsCreating(false);
    if (result.success) {
      onCreateWorktree(issueKey);
    } else {
      setCreateError(result.error || 'Failed to create worktree');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
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

  const typeLower = issue.type.toLowerCase();
  const typeClasses = jiraType[typeLower] ?? 'text-gray-400 bg-gray-800';
  const priorityLower = issue.priority.toLowerCase();
  const priorityClass = jiraPriority[priorityLower] ?? text.secondary;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* Header */}
      <div className={`p-4 border-b ${border.subtle}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold ${badge.jira} ${badge.jiraHover}`}
              >
                {issue.key}
              </a>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeClasses}`}>
                {issue.type}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.jiraStatus}`}>
                {issue.status}
              </span>
              <span className={`text-[10px] ${priorityClass}`}>{issue.priority}</span>
            </div>
            <h2 className={`text-sm font-medium ${text.primary}`}>{issue.summary}</h2>
            <div className={`flex items-center gap-3 mt-1.5 text-[10px] ${text.muted}`}>
              {issue.assignee && <span>Assignee: {issue.assignee}</span>}
              {issue.reporter && <span>Reporter: {issue.reporter}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className={`px-3 py-1.5 text-xs font-medium ${button.primary} rounded flex-shrink-0 disabled:opacity-50`}
          >
            {isCreating ? 'Creating...' : 'Create Worktree'}
          </button>
        </div>
        {createError && (
          <p className={`${text.error} text-[10px] mt-2`}>{createError}</p>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Description */}
        {issue.description && (
          <section>
            <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${text.muted} mb-1.5`}>
              Description
            </h3>
            <pre className={`text-xs ${text.secondary} whitespace-pre-wrap font-sans leading-relaxed`}>
              {issue.description}
            </pre>
          </section>
        )}

        {/* Labels */}
        {issue.labels.length > 0 && (
          <section>
            <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${text.muted} mb-1.5`}>
              Labels
            </h3>
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <span
                  key={label}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${badge.jiraStatus}`}
                >
                  {label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Attachments */}
        {issue.attachments.length > 0 && (
          <section>
            <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${text.muted} mb-1.5`}>
              Attachments ({issue.attachments.length})
            </h3>
            <div className="space-y-1">
              {issue.attachments.map((att, i) => (
                <div key={i} className={`text-xs ${text.secondary} flex items-center gap-2`}>
                  <span className="truncate">{att.filename}</span>
                  <span className={`text-[10px] ${text.dimmed} flex-shrink-0`}>
                    {formatSize(att.size)} &middot; {att.mimeType}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comments */}
        {issue.comments.length > 0 && (
          <section>
            <h3 className={`text-[10px] font-semibold uppercase tracking-wider ${text.muted} mb-1.5`}>
              Comments ({issue.comments.length})
            </h3>
            <div className={`space-y-3`}>
              {issue.comments.map((comment, i) => (
                <div key={i}>
                  <div className={`flex items-center gap-2 text-[10px] ${text.muted} mb-0.5`}>
                    <span className="font-medium">{comment.author}</span>
                    <span>{formatDate(comment.created)}</span>
                  </div>
                  <pre className={`text-xs ${text.secondary} whitespace-pre-wrap font-sans leading-relaxed`}>
                    {comment.body}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Timestamps */}
        <section className={`text-[10px] ${text.dimmed} flex gap-4`}>
          <span>Created: {formatDate(issue.created)}</span>
          <span>Updated: {formatDate(issue.updated)}</span>
        </section>
      </div>
    </div>
  );
}
