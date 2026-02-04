import { useState } from 'react';

import type { WorktreeInfo } from '../types';
import { border, input, text } from '../theme';
import { WorktreeItem } from './WorktreeItem';

interface WorktreeListProps {
  worktrees: WorktreeInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function WorktreeList({ worktrees, selectedId, onSelect }: WorktreeListProps) {
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? worktrees.filter((w) => {
        const q = filter.toLowerCase();
        return w.id.toLowerCase().includes(q) || w.branch.toLowerCase().includes(q);
      })
    : worktrees;

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
    <div className="flex-1 flex flex-col min-h-0">
      {worktrees.length > 3 && (
        <div className={`px-3 py-2 border-b ${border.subtle}`}>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter worktrees..."
            className={`w-full px-2 py-1.5 ${input.bg} border ${border.input} rounded ${input.text} ${input.placeholder} text-xs focus:outline-none focus:${border.focusPrimary} focus-visible:ring-1 ${input.ring}`}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <p className={`${text.muted} text-xs`}>No matches</p>
          </div>
        ) : (
          filtered.map((worktree) => (
            <WorktreeItem
              key={worktree.id}
              worktree={worktree}
              isSelected={worktree.id === selectedId}
              onSelect={() => onSelect(worktree.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
