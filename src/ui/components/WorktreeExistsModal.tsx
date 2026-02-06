import { useState } from 'react';

import { useApi } from '../hooks/useApi';
import { border, button, surface, text } from '../theme';
import { Spinner } from './Spinner';

interface WorktreeExistsModalProps {
  worktreeId: string;
  branch: string;
  onResolved: () => void;
  onCancel: () => void;
}

export function WorktreeExistsModal({
  worktreeId,
  branch,
  onResolved,
  onCancel,
}: WorktreeExistsModalProps) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReuse = async () => {
    setIsLoading(true);
    setError(null);
    const result = await api.recoverWorktree(worktreeId, 'reuse');
    setIsLoading(false);
    if (result.success) {
      onResolved();
    } else {
      setError(result.error || 'Failed to reuse worktree');
    }
  };

  const handleRecreate = async () => {
    setIsLoading(true);
    setError(null);
    const result = await api.recoverWorktree(worktreeId, 'recreate', branch);
    setIsLoading(false);
    if (result.success) {
      onResolved();
    } else {
      setError(result.error || 'Failed to recreate worktree');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div
        className={`relative ${surface.modal} border ${border.modal} rounded-xl p-5 max-w-md w-full mx-4 shadow-2xl`}
      >
        <h3 className={`text-sm font-semibold ${text.primary} mb-2`}>
          Worktree Already Exists
        </h3>
        <p className={`text-xs ${text.secondary} mb-4 leading-relaxed`}>
          A worktree named <span className="font-medium text-white">"{worktreeId}"</span> already exists.
        </p>

        {error && (
          <p className={`text-xs ${text.error} mb-4`}>{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleReuse}
            disabled={isLoading}
            className={`w-full px-4 py-2 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150 text-left`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Reuse existing worktree</div>
                <div className={`text-[10px] ${text.muted} mt-0.5`}>
                  Keep the existing files and continue using this worktree
                </div>
              </div>
              {isLoading && <Spinner size="xs" />}
            </div>
          </button>

          <button
            onClick={handleRecreate}
            disabled={isLoading}
            className={`w-full px-4 py-2 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg disabled:opacity-50 transition-colors duration-150 text-left`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Delete and recreate</div>
                <div className={`text-[10px] text-red-400/70 mt-0.5`}>
                  Remove the existing worktree and create a fresh one
                </div>
              </div>
              {isLoading && <Spinner size="xs" />}
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={isLoading}
          className={`mt-4 w-full px-3 py-1.5 text-xs ${button.secondary} rounded-lg transition-colors duration-150`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
