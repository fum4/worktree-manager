import { useState } from 'react';

import { useJiraIssueDetail } from '../../hooks/useJiraIssueDetail';
import { useApi } from '../../hooks/useApi';
import type { JiraIssueDetail } from '../../types';
import { badge, border, button, jiraPriority, jiraStatus, jiraType, surface, text } from '../../theme';
import { MarkdownContent } from '../MarkdownContent';
import { Spinner } from '../Spinner';
import { WorktreeExistsModal } from '../WorktreeExistsModal';

interface JiraDetailPanelProps {
  issueKey: string;
  linkedWorktreeId: string | null;
  onCreateWorktree: (key: string) => void;
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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function proxyUrl(url: string) {
  return `/api/jira/attachment?url=${encodeURIComponent(url)}`;
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={`text-[11px] font-medium ${text.muted} mb-3`}>
      {children}
    </h3>
  );
}

function ImageModal({ src, filename, onClose }: { src: string; filename: string; onClose: () => void }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${surface.overlay}`}
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full mb-2 px-1">
          <span className={`text-xs ${text.secondary} truncate`}>{filename}</span>
          <button
            type="button"
            onClick={onClose}
            className={`${text.muted} hover:${text.primary} transition-colors ml-3 flex-shrink-0`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <img
          src={src}
          alt={filename}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}

function AttachmentsSection({ attachments }: { attachments: JiraIssueDetail['attachments'] }) {
  const [modalImage, setModalImage] = useState<{ src: string; filename: string } | null>(null);
  const images = attachments.filter((a) => isImage(a.mimeType) && a.contentUrl);
  const files = attachments.filter((a) => !isImage(a.mimeType) || !a.contentUrl);

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((att, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setModalImage({ src: proxyUrl(att.contentUrl!), filename: att.filename })}
              className="group relative rounded-lg overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-colors bg-black/20"
            >
              <img
                src={proxyUrl(att.thumbnail || att.contentUrl!)}
                alt={att.filename}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                <span className={`text-[10px] ${text.primary} truncate block`}>{att.filename}</span>
                <span className={`text-[9px] ${text.dimmed}`}>{formatSize(att.size)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((att, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03]">
              <FileIcon mimeType={att.mimeType} />
              <span className={`text-xs ${text.secondary} truncate flex-1`}>{att.filename}</span>
              <span className={`text-[10px] ${text.dimmed} flex-shrink-0`}>{formatSize(att.size)}</span>
              {att.contentUrl && (
                <a
                  href={proxyUrl(att.contentUrl)}
                  download={att.filename}
                  className="text-[10px] text-accent hover:text-accent-muted flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {modalImage && (
        <ImageModal src={modalImage.src} filename={modalImage.filename} onClose={() => setModalImage(null)} />
      )}
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const color = mimeType.includes('pdf') ? 'text-red-400'
    : mimeType.includes('zip') || mimeType.includes('archive') ? 'text-yellow-400'
    : mimeType.includes('text') || mimeType.includes('json') ? 'text-green-400'
    : 'text-gray-400';
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-3.5 h-3.5 flex-shrink-0 ${color}`}>
      <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 8.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
    </svg>
  );
}

export function JiraDetailPanel({ issueKey, linkedWorktreeId, onCreateWorktree, onViewWorktree, refreshIntervalMinutes, onSetupNeeded }: JiraDetailPanelProps) {
  const api = useApi();
  const { issue, isLoading, isFetching, error, refetch, dataUpdatedAt } = useJiraIssueDetail(issueKey, refreshIntervalMinutes);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [existingWorktree, setExistingWorktree] = useState<{ id: string; branch: string } | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setCreateError(null);
    const result = await api.createFromJira(issueKey);
    console.log('createFromJira result:', result);
    setIsCreating(false);
    if (result.success) {
      onCreateWorktree(issueKey);
    } else if (result.code === 'WORKTREE_EXISTS' && result.worktreeId) {
      console.log('Showing WorktreeExistsModal for:', result.worktreeId);
      setExistingWorktree({ id: result.worktreeId, branch: issueKey });
    } else {
      const errorMsg = result.error || 'Failed to create worktree';
      // Check if error indicates repository setup is needed
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

  const statusLower = issue.status.toLowerCase();
  const statusClasses = jiraStatus[statusLower] ?? `${text.secondary} bg-white/[0.06]`;
  const typeLower = issue.type.toLowerCase();
  const typeClasses = jiraType[typeLower] ?? `${text.secondary} bg-white/[0.06]`;
  const priorityLower = issue.priority.toLowerCase();
  const priorityClass = jiraPriority[priorityLower] ?? text.secondary;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header — compact key + title + action */}
      <div className={`flex-shrink-0 px-5 py-4 border-b ${border.section}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Issue key + status + refresh on one line */}
            <div className="flex items-center gap-2 mb-2">
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-semibold ${badge.jira} ${badge.jiraHover} transition-colors`}
              >
                {issue.key}
              </a>
              <span className={`ml-2 text-[9px] font-medium px-1.5 py-0.5 rounded ${statusClasses}`}>
                {issue.status}
              </span>
              <span className={`text-[9px] ${text.dimmed}`}>·</span>
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${typeClasses}`}>
                {issue.type}
              </span>
              {issue.labels.map((label) => (
                <span key={label} className={`text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/[0.06] ${text.secondary}`}>
                  {label}
                </span>
              ))}
              <span className={`text-[9px] ${text.dimmed}`}>·</span>
              <span className={`text-[10px] ${priorityClass}`}>{issue.priority}</span>
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
                  <span className="text-[10px]">
                    {formatTimeAgo(dataUpdatedAt)}
                  </span>
                )}
              </button>
            </div>
            {/* Summary — largest text, clear anchor */}
            <h2 className={`text-[15px] font-semibold ${text.primary} leading-snug`}>{issue.summary}</h2>
          </div>
          <div className="flex-shrink-0 pt-1 flex items-center gap-2">
            <a
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1.5 text-xs font-medium ${button.secondary} rounded-lg transition-colors duration-150`}
            >
              View in Jira
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

      {/* Scrollable body — each section gets its own visual container */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {issue.description && (
          <section>
            <SectionLabel>Description</SectionLabel>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-3">
              <MarkdownContent content={issue.description} />
            </div>
          </section>
        )}

        {issue.attachments.length > 0 && (
          <section>
            <SectionLabel>Attachments ({issue.attachments.length})</SectionLabel>
            <AttachmentsSection attachments={issue.attachments} />
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
                    <span className={`text-[10px] ${text.dimmed}`}>{formatDate(comment.created)}</span>
                  </div>
                  <MarkdownContent content={comment.body} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className={`text-[10px] ${text.dimmed} flex flex-wrap gap-4 pt-2`}>
          {issue.reporter && <span>Reported by {issue.reporter}</span>}
          <span>Created {formatDate(issue.created)}</span>
          <span>Updated {formatDate(issue.updated)}</span>
        </div>
      </div>

      {existingWorktree && (
        <WorktreeExistsModal
          worktreeId={existingWorktree.id}
          branch={existingWorktree.branch}
          onResolved={() => {
            setExistingWorktree(null);
            onCreateWorktree(issueKey);
          }}
          onCancel={() => setExistingWorktree(null)}
        />
      )}
    </div>
  );
}
