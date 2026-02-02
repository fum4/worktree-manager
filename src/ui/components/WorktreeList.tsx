import type { WorktreeInfo } from '../hooks/useWorktrees';
import { WorktreeItem } from './WorktreeItem';

interface WorktreeListProps {
  worktrees: WorktreeInfo[];
  onUpdate: () => void;
}

export function WorktreeList({ worktrees, onUpdate }: WorktreeListProps) {
  if (worktrees.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
        <p className="text-gray-400">No worktrees yet</p>
        <p className="text-gray-500 text-sm mt-1">
          Create a worktree to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-gray-300 mb-3">
        Worktrees ({worktrees.length})
      </h2>
      <div className="space-y-2">
        {worktrees.map((worktree) => (
          <WorktreeItem
            key={worktree.id}
            worktree={worktree}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
