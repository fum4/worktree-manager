import { Puzzle } from 'lucide-react';

import type { PluginSummary } from '../types';
import { surface, text } from '../theme';

interface PluginItemProps {
  plugin: PluginSummary;
}

export function PluginItem({ plugin }: PluginItemProps) {
  return (
    <div
      className={`w-full text-left px-3 py-2.5 border-l-2 border-transparent opacity-60`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Puzzle className={`w-3.5 h-3.5 flex-shrink-0 ${text.dimmed}`} />
        <div className="flex-1 min-w-0">
          <span className={`text-xs truncate ${text.muted}`}>
            {plugin.name}
          </span>
        </div>
        <span className={`text-[10px] ${plugin.enabled ? 'text-emerald-400/60' : text.dimmed}`}>
          {plugin.enabled ? 'enabled' : 'disabled'}
        </span>
      </div>
    </div>
  );
}
