import { useEffect, useRef, useState } from 'react';

import type { WorktreeInfo } from '../hooks/useWorktrees';
import {
  commitChanges,
  createPullRequest,
  pushChanges,
  removeWorktree,
  renameWorktree,
  startWorktree,
  stopWorktree,
} from '../hooks/useWorktrees';
import { action, badge, border, errorBanner, input, status, surface, text } from '../theme';
import { ConfirmModal } from './ConfirmModal';

interface DetailPanelProps {
  worktree: WorktreeInfo | null;
  onUpdate: () => void;
  onDeleted: () => void;
}

export function DetailPanel({ worktree, onUpdate, onDeleted }: DetailPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [showCreatePrInput, setShowCreatePrInput] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLPreElement>(null);
  const userScrolledUp = useRef(false);

  // Reset state when worktree changes
  useEffect(() => {
    setError(null);
    setIsEditing(false);
    setShowCommitInput(false);
    setShowCreatePrInput(false);
    setCommitMessage('');
    setPrTitle('');
    userScrolledUp.current = false;
  }, [worktree?.id]);

  // Auto-scroll logs
  useEffect(() => {
    if (!worktree || userScrolledUp.current) return;
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [worktree?.logs, worktree]);

  const handleLogsScroll = () => {
    const el = logsContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledUp.current = !atBottom;
  };

  if (!worktree) {
    return (
      <div className={`flex-1 flex items-center justify-center ${text.dimmed} text-sm`}>
        Select a worktree or create a new one
      </div>
    );
  }

  const isRunning = worktree.status === 'running';
  const isCreating = worktree.status === 'creating';

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    const result = await startWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) setError(result.error || 'Failed to start');
    onUpdate();
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);
    const result = await stopWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) setError(result.error || 'Failed to stop');
    onUpdate();
  };

  const handleRemove = () => setShowRemoveModal(true);

  const handleConfirmRemove = async () => {
    setShowRemoveModal(false);
    setIsDeleting(true);
    setError(null);
    const result = await removeWorktree(worktree.id);
    if (!result.success) {
      setIsDeleting(false);
      setError(result.error || 'Failed to remove');
    } else {
      onDeleted();
    }
    onUpdate();
  };

  const handleEditStart = () => {
    setEditName(worktree.id);
    setEditBranch(worktree.branch);
    setIsEditing(true);
    setError(null);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleEditSave = async () => {
    const changes: { name?: string; branch?: string } = {};
    if (editName.trim() !== worktree.id) changes.name = editName.trim();
    if (editBranch.trim() !== worktree.branch) changes.branch = editBranch.trim();

    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await renameWorktree(worktree.id, changes);
    setIsLoading(false);
    if (result.success) setIsEditing(false);
    else setError(result.error || 'Failed to rename');
    onUpdate();
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setIsGitLoading(true);
    setError(null);
    const result = await commitChanges(worktree.id, commitMessage.trim());
    setIsGitLoading(false);
    if (result.success) {
      setShowCommitInput(false);
      setCommitMessage('');
    } else {
      setError(result.error || 'Failed to commit');
    }
    onUpdate();
  };

  const handlePush = async () => {
    setIsGitLoading(true);
    setError(null);
    const result = await pushChanges(worktree.id);
    setIsGitLoading(false);
    if (!result.success) setError(result.error || 'Failed to push');
    onUpdate();
  };

  const handleCreatePr = async () => {
    if (!prTitle.trim()) return;
    setIsGitLoading(true);
    setError(null);
    const result = await createPullRequest(worktree.id, prTitle.trim());
    setIsGitLoading(false);
    if (result.success) {
      setShowCreatePrInput(false);
      setPrTitle('');
    } else {
      setError(result.error || 'Failed to create PR');
    }
    onUpdate();
  };

  if (isDeleting) {
    return (
      <div className={`flex-1 flex items-center justify-center ${text.muted} text-sm`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.deleting.dot} animate-pulse`} />
          Deleting {worktree.id}...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Detail Header */}
      <div className={`flex-shrink-0 px-5 py-3 border-b ${border.section}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {isEditing ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') handleEditCancel(); }}
                  className={`px-1 py-0.5 ${input.bgDetail} border ${border.modal} rounded ${text.primary} text-base font-semibold focus:outline-none focus:${border.focusPrimary} w-40`}
                  autoFocus
                />
                <input
                  type="text"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') handleEditCancel(); }}
                  className={`px-1 py-0.5 ${input.bgDetail} border ${border.modal} rounded ${text.secondary} text-xs focus:outline-none focus:${border.focusPrimary} w-48`}
                />
                <button type="button" onClick={handleEditSave} disabled={isLoading} className="px-2 py-0.5 text-[10px] font-medium text-blue-400 bg-blue-900/30 rounded hover:bg-blue-900/50 disabled:opacity-50 transition-colors">
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={handleEditCancel} className={`px-2 py-0.5 text-[10px] font-medium ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2
                  className={`text-base font-semibold ${text.primary} truncate ${!isRunning && !isCreating ? `cursor-text hover:${surface.editableHover} px-1 -mx-1 rounded transition-colors` : ''}`}
                  onClick={!isRunning && !isCreating ? handleEditStart : undefined}
                  title={!isRunning && !isCreating ? 'Click to edit' : undefined}
                >
                  {worktree.id}
                </h2>
                <span
                  className={`text-xs ${text.muted} truncate ${!isRunning && !isCreating ? `cursor-text hover:${text.secondary} transition-colors` : ''}`}
                  onClick={!isRunning && !isCreating ? handleEditStart : undefined}
                  title={!isRunning && !isCreating ? 'Click to edit' : undefined}
                >
                  {worktree.branch}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isCreating && (
              <span className={`px-2 py-0.5 text-[10px] font-medium ${status.creating.badge} rounded`}>
                Creating
              </span>
            )}
            {isRunning && (
              <span className={`px-2 py-0.5 text-[10px] font-medium ${status.running.badge} rounded`}>
                Running
              </span>
            )}
            {!isRunning && !isCreating && (
              <span className={`px-2 py-0.5 text-[10px] font-medium ${status.stopped.badge} rounded`}>
                Stopped
              </span>
            )}
            {worktree.ports.length > 0 && (
              <span className={`text-[10px] font-mono ${text.muted}`}>
                {worktree.ports.map((p) => `:${p}`).join(' ')}
              </span>
            )}
          </div>
        </div>

        {/* Integration badges */}
        {(worktree.jiraUrl || worktree.githubPrUrl) && (
          <div className="flex items-center gap-2 mt-2">
            {worktree.jiraUrl && (
              <a
                href={worktree.jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-[10px] ${badge.jira} ${badge.jiraHover} transition-colors`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                </svg>
                Jira
                {worktree.jiraStatus && (
                  <span className={`px-1 py-0.5 ${badge.jiraStatus} rounded text-[9px]`}>
                    {worktree.jiraStatus}
                  </span>
                )}
              </a>
            )}
            {worktree.githubPrUrl && (
              <a
                href={worktree.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                </svg>
                PR
                {worktree.githubPrState && (
                  <span className={`px-1 py-0.5 rounded text-[9px] ${
                    worktree.githubPrState === 'draft' ? badge.prDraft
                      : worktree.githubPrState === 'open' ? badge.prOpen
                        : worktree.githubPrState === 'merged' ? badge.prMerged
                          : badge.prClosed
                  }`}>
                    {worktree.githubPrState === 'draft' ? 'Draft' : worktree.githubPrState === 'open' ? 'Open' : worktree.githubPrState === 'merged' ? 'Merged' : 'Closed'}
                  </span>
                )}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      {!isCreating && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section} flex items-center justify-between`}>
          <div className="flex items-center gap-1.5">
            {isRunning ? (
              <button
                type="button"
                onClick={handleStop}
                disabled={isLoading}
                className={`px-2 py-1 text-[10px] font-medium ${action.stop.text} ${action.stop.hover} rounded disabled:opacity-50 transition-colors flex items-center gap-1`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm5-2.25A.75.75 0 0 1 7.75 7h4.5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.5Z" clipRule="evenodd" />
                </svg>
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={isLoading}
                className={`px-2 py-1 text-[10px] font-medium ${action.start.text} ${action.start.hover} rounded disabled:opacity-50 transition-colors flex items-center gap-1`}
              >
                {isLoading ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 animate-spin">
                    <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H4.598a.75.75 0 0 0-.75.75v3.634a.75.75 0 0 0 1.5 0v-2.033l.312.311a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.06-7.19a.75.75 0 0 0-1.5 0v2.033l-.312-.312a7 7 0 0 0-11.712 3.138.75.75 0 0 0 1.449.39 5.5 5.5 0 0 1 9.201-2.466l.312.312H11.58a.75.75 0 1 0 0 1.5h3.634a.75.75 0 0 0 .75-.75V4.234Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
                  </svg>
                )}
                Start
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              disabled={isLoading}
              className={`px-2 py-1 text-[10px] font-medium ${action.delete.text} ${action.delete.hover} rounded disabled:opacity-50 transition-colors`}
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {worktree.hasUncommitted && (
              <button
                type="button"
                onClick={() => { setShowCommitInput((v) => !v); setShowCreatePrInput(false); }}
                disabled={isGitLoading}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors flex items-center gap-1 ${
                  showCommitInput
                    ? `${action.commit.textActive} ${action.commit.bgActive}`
                    : `${action.commit.text} ${action.commit.hover}`
                } disabled:opacity-50`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25h5a.75.75 0 0 0 0-1.5h-5A2.75 2.75 0 0 0 2 5.75v8.5A2.75 2.75 0 0 0 4.75 17h8.5A2.75 2.75 0 0 0 16 14.25v-5a.75.75 0 0 0-1.5 0v5c0 .69-.56 1.25-1.25 1.25h-8.5c-.69 0-1.25-.56-1.25-1.25v-8.5Z" />
                </svg>
                Commit
              </button>
            )}
            {worktree.hasUnpushed && (
              <button
                type="button"
                onClick={handlePush}
                disabled={isGitLoading}
                className={`px-2 py-1 text-[10px] font-medium ${action.push.text} ${action.push.hover} rounded disabled:opacity-50 transition-colors flex items-center gap-1`}
                title={`Push ${worktree.commitsAhead || ''} commit(s)`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z" clipRule="evenodd" />
                </svg>
                Push{worktree.commitsAhead ? ` (${worktree.commitsAhead})` : ''}
              </button>
            )}
            {!worktree.githubPrUrl && !worktree.hasUnpushed && (
              <button
                type="button"
                onClick={() => { setShowCreatePrInput((v) => !v); setShowCommitInput(false); }}
                disabled={isGitLoading}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors flex items-center gap-1 ${
                  showCreatePrInput
                    ? `${action.pr.textActive} ${action.pr.bgActive}`
                    : `${action.pr.text} ${action.pr.hover}`
                } disabled:opacity-50`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                </svg>
                PR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inline inputs for commit / PR */}
      {showCommitInput && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section} flex items-center gap-2`}>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); if (e.key === 'Escape') setShowCommitInput(false); }}
            placeholder="Commit message..."
            className={`flex-1 px-2 py-1 ${input.bgDetail} border ${border.modal} rounded ${input.text} text-xs focus:outline-none focus:${border.focusCommit} focus-visible:ring-1 ${input.ringCommit}`}
            autoFocus
          />
          <button type="button" onClick={handleCommit} disabled={isGitLoading || !commitMessage.trim()} className={`px-3 py-1 text-xs font-medium ${action.commit.text} ${action.commit.bgSubmit} rounded ${action.commit.bgSubmitHover} disabled:opacity-50 transition-colors`}>
            {isGitLoading ? 'Committing...' : 'Commit'}
          </button>
          <button type="button" onClick={() => setShowCommitInput(false)} className={`px-2 py-1 text-xs ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
            Cancel
          </button>
        </div>
      )}

      {showCreatePrInput && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section} flex items-center gap-2`}>
          <input
            type="text"
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePr(); if (e.key === 'Escape') setShowCreatePrInput(false); }}
            placeholder="PR title..."
            className={`flex-1 px-2 py-1 ${input.bgDetail} border ${border.modal} rounded ${input.text} text-xs focus:outline-none focus:${border.focusPr} focus-visible:ring-1 ${input.ringPr}`}
            autoFocus
          />
          <button type="button" onClick={handleCreatePr} disabled={isGitLoading || !prTitle.trim()} className={`px-3 py-1 text-xs font-medium ${action.pr.text} ${action.pr.bgSubmit} rounded ${action.pr.bgSubmitHover} disabled:opacity-50 transition-colors`}>
            {isGitLoading ? 'Creating...' : 'Create PR'}
          </button>
          <button type="button" onClick={() => setShowCreatePrInput(false)} className={`px-2 py-1 text-xs ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
            Cancel
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className={`flex-shrink-0 px-5 py-2 ${errorBanner.panelBg} border-b ${errorBanner.border}`}>
          <p className={`${text.error} text-xs`}>{error}</p>
        </div>
      )}

      {/* Logs viewer */}
      {isRunning || isCreating ? (
        <pre
          ref={logsContainerRef}
          onScroll={handleLogsScroll}
          className={`flex-1 min-h-0 ${text.secondary} text-xs font-mono p-4 overflow-y-auto`}
        >
          {worktree.logs?.length ? worktree.logs.join('\n') : 'No logs yet.'}
          <div ref={logsEndRef} />
        </pre>
      ) : (
        <div className={`flex-1 flex items-center justify-center ${text.dimmed} text-xs`}>
          Start this worktree to see logs
        </div>
      )}

      {showRemoveModal && (
        <ConfirmModal
          title="Remove worktree"
          message={`Remove "${worktree.id}"? This will delete the worktree directory.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmRemove}
          onCancel={() => setShowRemoveModal(false)}
        />
      )}
    </div>
  );
}
