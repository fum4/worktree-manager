import { useState } from 'react';
import { Puzzle, Trash2 } from 'lucide-react';

import type { PluginSummary } from '../types';
import { surface, text } from '../theme';
import { Spinner } from './Spinner';
import { Tooltip } from './Tooltip';

interface PluginItemProps {
  plugin: PluginSummary;
  isSelected: boolean;
  onSelect: () => void;
  onToggleEnabled: () => Promise<void>;
  onRemove: () => Promise<void>;
}

function parsePluginName(plugin: PluginSummary): { name: string; marketplace: string } {
  // If marketplace is already a separate field, use it
  if (plugin.marketplace) {
    // Strip marketplace suffix from name if present (e.g. "my-plugin@marketplace")
    const name = plugin.name.replace(/@.*$/, '');
    return { name, marketplace: plugin.marketplace };
  }
  // If name contains @, split into name and marketplace
  if (plugin.name.includes('@')) {
    const [name, marketplace] = plugin.name.split('@', 2);
    return { name, marketplace };
  }
  return { name: plugin.name, marketplace: '' };
}

export function PluginItem({ plugin, isSelected, onSelect, onToggleEnabled, onRemove }: PluginItemProps) {
  const { name, marketplace } = parsePluginName(plugin);
  const [acting, setActing] = useState<string | null>(null);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActing('toggle');
    await onToggleEnabled();
    setActing(null);
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActing('remove');
    await onRemove();
  };

  const badgeDot = plugin.error
    ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
    : plugin.warning
      ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-yellow-400" />
      : plugin.enabled
        ? <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-teal-400" />
        : null;

  const tooltipText = plugin.error || plugin.warning;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left px-3 py-2.5 transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} border-[#D4A574]/30`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Puzzle className={`w-3.5 h-3.5 flex-shrink-0 transition-colors duration-150 ${isSelected ? 'text-[#D4A574]' : `${text.muted} group-hover:text-[#D4A574]`}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium truncate ${isSelected ? text.primary : text.secondary}`}>
              {name}
            </span>
          </div>
          {marketplace && (
            <div className={`text-[10px] ${text.dimmed} truncate mt-0.5`}>
              {marketplace}
            </div>
          )}
        </div>

        {/* Status dot (default) / Actions (hover) */}
        {acting ? (
          <div className="flex-shrink-0 ml-1">
            <Spinner size="xs" className={acting === 'remove' ? 'text-red-400' : text.muted} />
          </div>
        ) : (
          <>
            {/* Default: status dot */}
            <div className="flex-shrink-0 ml-1 flex items-center group-hover:hidden">
              {tooltipText ? (
                <Tooltip text={tooltipText} position="right">
                  {badgeDot!}
                </Tooltip>
              ) : badgeDot}
            </div>

            {/* Hover: toggle + remove */}
            <div className="flex-shrink-0 ml-1 mr-[-4px] hidden group-hover:flex items-center gap-2.5">
              <Tooltip text="Remove" position="top">
                <span
                  role="button"
                  onClick={handleRemove}
                  className="p-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-red-400/15 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </span>
              </Tooltip>
              <Tooltip text={plugin.enabled ? 'Disable' : 'Enable'} position="top">
                <span
                  role="button"
                  onClick={handleToggle}
                  className={`relative w-6 h-3.5 rounded-full transition-colors duration-200 cursor-pointer block ${
                    plugin.enabled ? 'bg-teal-400/35' : 'bg-white/[0.08]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                      plugin.enabled ? 'left-3 bg-teal-400' : 'left-0.5 bg-white/40'
                    }`}
                  />
                </span>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </button>
  );
}
