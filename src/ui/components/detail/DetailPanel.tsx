import { useCallback, useEffect, useState } from 'react';

import type { WorktreeInfo } from '../../types';
import { useApi } from '../../hooks/useApi';
import { border, detailTab, errorBanner, status, text } from '../../theme';
import { ConfirmDialog } from '../ConfirmDialog';
import { ActionToolbar } from './ActionToolbar';
import { DetailHeader } from './DetailHeader';
import { GitActionInputs } from './GitActionInputs';
import { LogsViewer } from './LogsViewer';
import { TerminalView } from './TerminalView';

interface DetailPanelProps {
  worktree: WorktreeInfo | null;
  onUpdate: () => void;
  onDeleted: () => void;
  onNavigateToIntegrations?: () => void;
  onSelectJiraIssue?: (key: string) => void;
  onSelectLinearIssue?: (identifier: string) => void;
  onSelectLocalIssue?: (identifier: string) => void;
}

export function DetailPanel({ worktree, onUpdate, onDeleted, onNavigateToIntegrations, onSelectJiraIssue, onSelectLinearIssue, onSelectLocalIssue }: DetailPanelProps) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommitInput, setShowCommitInput] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [showCreatePrInput, setShowCreatePrInput] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [isGitLoading, setIsGitLoading] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [tabPerWorktree, setTabPerWorktree] = useState<Record<string, 'logs' | 'terminal'>>({});
  const [openTerminals, setOpenTerminals] = useState<Set<string>>(new Set());

  const activeTab = worktree ? (tabPerWorktree[worktree.id] ?? 'logs') : 'logs';

  const setActiveTab = useCallback((tab: 'logs' | 'terminal') => {
    if (!worktree) return;
    setTabPerWorktree(prev => ({ ...prev, [worktree.id]: tab }));
  }, [worktree]);

  // Reset form state when worktree changes (but NOT tab or terminal state)
  useEffect(() => {
    setError(null);
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
    const result = await api.startWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) setError(result.error || 'Failed to start');
    onUpdate();
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);
    const result = await api.stopWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) setError(result.error || 'Failed to stop');
    onUpdate();
  };

  const handleRemove = () => setShowRemoveModal(true);

  const handleConfirmRemove = async () => {
    setShowRemoveModal(false);
    setError(null);
    const deletedId = worktree.id;

    // Clean up state for this worktree
    setOpenTerminals(prev => {
      const next = new Set(prev);
      next.delete(deletedId);
      return next;
    });
    setTabPerWorktree(prev => {
      const { [deletedId]: _, ...rest } = prev;
      return rest;
    });

    // Switch away immediately so user isn't stuck on "deleting" screen
    onDeleted();

    // Delete in background - worktree will disappear from list via SSE update
    const result = await api.removeWorktree(deletedId);
    if (!result.success) {
      // Show error somewhere? For now just log it
      console.error('Failed to remove worktree:', result.error);
    }
    onUpdate();
  };

  const handleRename = async (changes: { name?: string; branch?: string }): Promise<boolean> => {
    setError(null);
    const result = await api.renameWorktree(worktree.id, changes);
    if (!result.success) setError(result.error || 'Failed to rename');
    onUpdate();
    return result.success;
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setIsGitLoading(true);
    setError(null);
    const result = await api.commitChanges(worktree.id, commitMessage.trim());
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
    const result = await api.pushChanges(worktree.id);
    setIsGitLoading(false);
    if (!result.success) setError(result.error || 'Failed to push');
    onUpdate();
  };

  const handleCreatePr = async () => {
    if (!prTitle.trim()) return;
    setIsGitLoading(true);
    setError(null);
    const result = await api.createPullRequest(worktree.id, prTitle.trim());
    setIsGitLoading(false);
    if (result.success) {
      setShowCreatePrInput(false);
      setPrTitle('');
    } else {
      setError(result.error || 'Failed to create PR');
    }
    onUpdate();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <DetailHeader
        worktree={worktree}
        isRunning={isRunning}
        isCreating={isCreating}
        onRename={handleRename}
        onSelectJiraIssue={onSelectJiraIssue}
        onSelectLinearIssue={onSelectLinearIssue}
        onSelectLocalIssue={onSelectLocalIssue}
      />

      {!isCreating && (
        <div className={`flex-shrink-0 px-5 py-2.5 border-b ${border.section}`}>
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
              className="px-2 py-0.5 text-[11px] font-medium text-accent hover:text-accent-muted transition-colors duration-150 flex-shrink-0"
            >
              Configure
            </button>
          )}
        </div>
      )}

      {!isCreating && (
        <div className={`flex-shrink-0 flex gap-1 px-4 py-2 border-b ${border.section}`}>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'logs' ? detailTab.active : detailTab.inactive
            }`}
          >
            Logs
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('terminal');
              if (!openTerminals.has(worktree.id)) {
                setOpenTerminals(prev => new Set(prev).add(worktree.id));
              }
            }}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'terminal' ? detailTab.active : detailTab.inactive
            }`}
          >
            Terminal
          </button>
        </div>
      )}

      <LogsViewer
        worktree={worktree}
        isRunning={isRunning}
        isCreating={isCreating}
        visible={isCreating || activeTab === 'logs'}
      />
      {[...openTerminals].map(wtId => (
        <TerminalView
          key={wtId}
          worktreeId={wtId}
          visible={wtId === worktree.id && activeTab === 'terminal' && !isCreating}
        />
      ))}

      {showRemoveModal && (
        <ConfirmDialog
          title="Delete worktree?"
          confirmLabel="Delete"
          onConfirm={handleConfirmRemove}
          onCancel={() => setShowRemoveModal(false)}
        >
          <p className={`text-xs ${text.secondary}`}>
            Delete "{worktree.id}"? This will delete the worktree directory.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
