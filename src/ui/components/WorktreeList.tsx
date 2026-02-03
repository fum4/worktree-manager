import type { WorktreeInfo } from '../hooks/useWorktrees';
import { WorktreeItem } from './WorktreeItem';

interface WorktreeListProps {
  worktrees: WorktreeInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorktreeList({ worktrees, selectedId, onSelect }: WorktreeListProps) {
  if (worktrees.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500 text-xs">No worktrees yet</p>
          <p className="text-gray-600 text-[10px] mt-1">Create one to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {worktrees.map((worktree) => (
        <WorktreeItem
          key={worktree.id}
          worktree={worktree}
          isSelected={worktree.id === selectedId}
          onSelect={() => onSelect(worktree.id)}
        />
      ))}
    </div>
  );
}
