import { useEffect, useRef, useState } from 'react';

import type { WorktreeInfo } from '../hooks/useWorktrees';
import {
  removeWorktree,
  renameWorktree,
  startWorktree,
  stopWorktree,
} from '../hooks/useWorktrees';

interface WorktreeItemProps {
  worktree: WorktreeInfo;
  onUpdate: () => void;
}

export function WorktreeItem({ worktree, onUpdate }: WorktreeItemProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLPreElement>(null);
  const userScrolledUp = useRef(false);
  const [editName, setEditName] = useState(worktree.id);
  const [editBranch, setEditBranch] = useState(worktree.branch);

  const isRunning = worktree.status === 'running';

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);
    const result = await startWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to start');
    }
    onUpdate();
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);
    const result = await stopWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to stop');
    }
    onUpdate();
  };

  const handleRemove = async () => {
    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        `Remove worktree "${worktree.id}"? This will delete the directory.`,
      )
    ) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await removeWorktree(worktree.id);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to remove');
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
    if (editBranch.trim() !== worktree.branch)
      changes.branch = editBranch.trim();

    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await renameWorktree(worktree.id, changes);
    setIsLoading(false);

    if (result.success) {
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to rename');
    }
    onUpdate();
  };

  useEffect(() => {
    if (!showLogs || userScrolledUp.current) return;
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [worktree.logs, showLogs]);

  const handleLogsScroll = () => {
    const el = logsContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledUp.current = !atBottom;
  };

  if (isEditing) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 border border-blue-600 transition-colors">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-xs w-14">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-xs w-14">Branch</label>
            <input
              type="text"
              value={editBranch}
              onChange={(e) => setEditBranch(e.target.value)}
              className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleEditCancel}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-900/30 rounded hover:bg-blue-900/50 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {error && <div className="mt-2 text-red-400 text-xs">{error}</div>}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            isRunning
              ? 'bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.5)]'
              : 'bg-gray-600'
          }`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">
              {worktree.id}
            </span>
            {worktree.ports.length > 0 && (
              <span className="text-gray-500 text-sm">
                {worktree.ports.map((p) => `:${p}`).join(', ')}
              </span>
            )}
          </div>
          <div className="text-gray-500 text-xs truncate">
            {worktree.branch}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <>
              <button
                type="button"
                onClick={handleStop}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-900/30 rounded hover:bg-red-900/50 disabled:opacity-50 transition-colors"
              >
                Stop
              </button>
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  showLogs
                    ? 'text-yellow-300 bg-yellow-900/40'
                    : 'text-gray-300 bg-gray-700 hover:bg-gray-600'
                }`}
              >
                Logs
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleEditStart}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
                title="Rename worktree"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-green-400 bg-green-900/30 rounded hover:bg-green-900/50 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleRemove}
            disabled={isLoading}
            className="px-2 py-1.5 text-red-400 hover:bg-red-900/30 rounded disabled:opacity-50 transition-colors"
            title="Remove worktree"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {error && <div className="mt-2 text-red-400 text-xs">{error}</div>}

      {showLogs && isRunning && (
        <pre
          ref={logsContainerRef}
          onScroll={handleLogsScroll}
          className="mt-2 bg-gray-900 text-gray-300 text-xs font-mono p-3 rounded max-h-[300px] overflow-y-auto"
        >
          {worktree.logs?.length ? worktree.logs.join('\n') : 'No logs yet.'}
          <div ref={logsEndRef} />
        </pre>
      )}
    </div>
  );
}
