import { GitBranch } from 'lucide-react';
import type { JiraIssueSummary } from '../types';
import { border, jiraType, surface, text } from '../theme';

interface JiraIssueItemProps {
  issue: JiraIssueSummary;
  isSelected: boolean;
  onSelect: () => void;
  linkedWorktreeId?: string;
  onViewWorktree?: (worktreeId: string) => void;
}

export function JiraIssueItem({ issue, isSelected, onSelect, linkedWorktreeId, onViewWorktree }: JiraIssueItemProps) {
  const typeLower = issue.type.toLowerCase();
  const typeClasses = jiraType[typeLower] ?? `${text.secondary} bg-white/[0.06]`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 flex items-start gap-2.5 text-left transition-colors duration-150 border-l ${
        isSelected
          ? `${surface.panelSelected} ${border.accent}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${typeClasses}`}>
        {issue.type}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${text.secondary} flex-shrink-0`}>
            {issue.key}
          </span>
          <span className={`text-[11px] ${text.muted} truncate`}>
            {issue.status}
          </span>
        </div>
        <div className={`text-xs ${text.primary} truncate mt-0.5`}>
          {issue.summary}
        </div>
      </div>

      {linkedWorktreeId && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewWorktree?.(linkedWorktreeId);
          }}
          className="flex-shrink-0 p-1 rounded text-accent hover:text-accent-muted hover:bg-accent/10 transition-colors duration-150"
          title="View linked worktree"
        >
          <GitBranch className="w-3.5 h-3.5" />
        </button>
      )}
    </button>
  );
}
