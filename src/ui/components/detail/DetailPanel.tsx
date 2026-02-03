import { useEffect, useState } from 'react';

import type { WorktreeInfo } from '../../types';
import {
  commitChanges,
  createPullRequest,
  pushChanges,
  removeWorktree,
  renameWorktree,
  startWorktree,
  stopWorktree,
} from '../../hooks/api';
import { border, errorBanner, status, text } from '../../theme';
import { ConfirmModal } from '../ConfirmModal';
import { ActionToolbar } from './ActionToolbar';
import { DetailHeader } from './DetailHeader';
import { GitActionInputs } from './GitActionInputs';
import { LogsViewer } from './LogsViewer';

interface DetailPanelProps {
  worktree: WorktreeInfo | null;
  onUpdate: () => void;
  onDeleted: () => void;
  onNavigateToIntegrations?: () => void;
}

export function DetailPanel({ worktree, onUpdate, onDeleted, onNavigateToIntegrations }: DetailPanelProps) {
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

  // Reset state when worktree changes
  useEffect(() => {
    setError(null);
    setIsEditing(false);
    setShowCommitInput(false);
    setShowCreatePrInput(false);
    setCommitMessage('');
    setPrTitle('');
  }, [worktree?.id]);

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
      <DetailHeader
        worktree={worktree}
        isEditing={isEditing}
        editName={editName}
        editBranch={editBranch}
        isLoading={isLoading}
        isRunning={isRunning}
        isCreating={isCreating}
        onEditNameChange={setEditName}
        onEditBranchChange={setEditBranch}
        onEditStart={handleEditStart}
        onEditSave={handleEditSave}
        onEditCancel={handleEditCancel}
      />

      {!isCreating && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section}`}>
          <ActionToolbar
            worktree={worktree}
            isRunning={isRunning}
            isLoading={isLoading}
            isGitLoading={isGitLoading}
            showCommitInput={showCommitInput}
            showCreatePrInput={showCreatePrInput}
            onStart={handleStart}
            onStop={handleStop}
            onRemove={handleRemove}
            onToggleCommit={() => { setShowCommitInput((v) => !v); setShowCreatePrInput(false); }}
            onPush={handlePush}
            onTogglePr={() => { setShowCreatePrInput((v) => !v); setShowCommitInput(false); }}
          />
        </div>
      )}

      <GitActionInputs
        showCommitInput={showCommitInput}
        showCreatePrInput={showCreatePrInput}
        commitMessage={commitMessage}
        prTitle={prTitle}
        isGitLoading={isGitLoading}
        onCommitMessageChange={setCommitMessage}
        onPrTitleChange={setPrTitle}
        onCommit={handleCommit}
        onCreatePr={handleCreatePr}
        onHideCommit={() => setShowCommitInput(false)}
        onHidePr={() => setShowCreatePrInput(false)}
      />

      {error && (
        <div className={`flex-shrink-0 px-5 py-2 ${errorBanner.panelBg} border-b ${errorBanner.border} flex items-center justify-between`}>
          <p className={`${text.error} text-xs`}>{error}</p>
          {error.includes('integration not available') && onNavigateToIntegrations && (
            <button
              type="button"
              onClick={onNavigateToIntegrations}
              className="px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
            >
              Configure
            </button>
          )}
        </div>
      )}

      <LogsViewer worktree={worktree} isRunning={isRunning} isCreating={isCreating} />

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
