import type { JiraIssueSummary } from '../types';
import { border, jiraType, surface, text } from '../theme';

interface JiraIssueItemProps {
  issue: JiraIssueSummary;
  isSelected: boolean;
  onSelect: () => void;
}

export function JiraIssueItem({ issue, isSelected, onSelect }: JiraIssueItemProps) {
  const typeLower = issue.type.toLowerCase();
  const typeClasses = jiraType[typeLower] ?? 'text-gray-400 bg-gray-800';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 flex items-start gap-2.5 text-left transition-colors duration-150 border-l-2 ${
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
          <span className={`text-[10px] font-semibold ${text.secondary} flex-shrink-0`}>
            {issue.key}
          </span>
          <span className={`text-[10px] ${text.muted} truncate`}>
            {issue.status}
          </span>
        </div>
        <div className={`text-xs ${text.primary} truncate mt-0.5`}>
          {issue.summary}
        </div>
      </div>
    </button>
  );
}
