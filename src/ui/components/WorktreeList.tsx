import type { WorktreeInfo } from '../types';
import { text } from '../theme';
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
          <p className={`${text.muted} text-xs`}>No worktrees yet</p>
          <p className={`${text.dimmed} text-[10px] mt-1`}>Create one to get started</p>
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
