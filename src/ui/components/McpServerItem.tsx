import { Server } from 'lucide-react';

import type { McpServerSummary } from '../types';
import { mcpServer, surface, text } from '../theme';

interface McpServerItemProps {
  server: McpServerSummary;
  isSelected: boolean;
  onSelect: () => void;
  deployedAgents?: string[];
}

export function McpServerItem({ server, isSelected, onSelect, deployedAgents }: McpServerItemProps) {
  const isActive = deployedAgents && deployedAgents.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full text-left px-3 py-2.5 transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} ${mcpServer.accentBorder}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Server className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-colors duration-150 ${isSelected ? 'text-purple-400' : `${text.muted} group-hover:text-purple-400`}`} />
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-medium truncate block ${isSelected ? text.primary : text.secondary}`}>
            {server.name}
          </span>
          {server.tags.length > 0 && (
            <div className="flex gap-1">
              {server.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={`text-[10px] ${text.dimmed}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {isActive && (
          <span className={`w-1.5 h-1.5 rounded-full ${mcpServer.deployed} flex-shrink-0 mt-1 mr-2`} />
        )}
      </div>
    </button>
  );
}
