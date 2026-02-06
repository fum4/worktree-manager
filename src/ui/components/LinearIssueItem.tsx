import { GitBranch } from 'lucide-react';
import type { LinearIssueSummary } from '../types';
import { border, linearStateType, surface, text } from '../theme';

interface LinearIssueItemProps {
  issue: LinearIssueSummary;
  isSelected: boolean;
  onSelect: () => void;
  linkedWorktreeId?: string;
  onViewWorktree?: (worktreeId: string) => void;
}

export function LinearIssueItem({ issue, isSelected, onSelect, linkedWorktreeId, onViewWorktree }: LinearIssueItemProps) {
  const stateTypeLower = issue.state.type.toLowerCase();
  const stateClasses = linearStateType[stateTypeLower] ?? `${text.secondary} bg-white/[0.06]`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 text-left transition-colors duration-150 border-l ${
        isSelected
          ? `${surface.panelSelected} ${border.accent}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold ${text.secondary} flex-shrink-0`}>
              {issue.identifier}
            </span>
            <span className={`ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${stateClasses}`}>
              {issue.state.name}
            </span>
          </div>
          <div className={`text-xs ${text.primary} truncate mt-0.5`}>
            {issue.title}
          </div>
        </div>
        {linkedWorktreeId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewWorktree?.(linkedWorktreeId);
            }}
            className="flex-shrink-0 p-0.5 rounded text-accent hover:text-accent-muted hover:bg-accent/10 transition-colors duration-150 self-center"
            title="View linked worktree"
          >
            <GitBranch className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </button>
  );
}
