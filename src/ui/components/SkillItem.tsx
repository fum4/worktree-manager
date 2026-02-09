import { Sparkles } from 'lucide-react';

import type { SkillSummary } from '../types';
import { claudeSkill, surface, text } from '../theme';

interface SkillItemProps {
  skill: SkillSummary;
  isSelected: boolean;
  onSelect: () => void;
  isDeployed?: boolean;
  isProjectDeployed?: boolean;
}

export function SkillItem({ skill, isSelected, onSelect, isDeployed, isProjectDeployed }: SkillItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} ${claudeSkill.accentBorder}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-[#D4A574]' : text.muted}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium truncate ${isSelected ? text.primary : text.secondary}`}>
              {skill.displayName}
            </span>
          </div>
          {skill.description && (
            <div className={`text-[10px] ${text.dimmed} truncate mt-0.5`}>
              {skill.description}
            </div>
          )}
        </div>
        {isDeployed && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-2 bg-teal-400" />
        )}
      </div>
    </button>
  );
}
