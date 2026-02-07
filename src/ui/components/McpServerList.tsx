import type { McpServerSummary } from '../types';
import { mcpServer, surface, text } from '../theme';
import { McpServerItem } from './McpServerItem';
import { Spinner } from './Spinner';
import { Server } from 'lucide-react';

const WOK3_SERVER_ID = 'wok3';

const WOK3_SERVER: McpServerSummary = {
  id: WOK3_SERVER_ID,
  name: 'wok3',
  description: 'Worktree management, issue tracking, and more',
  tags: ['built-in'],
  command: 'wok3',
  args: ['mcp'],
  env: {},
  source: 'built-in',
  createdAt: '',
  updatedAt: '',
};

function Wok3McpItem({ isSelected, onSelect, isNew, deployedAgents }: { isSelected: boolean; onSelect: () => void; isNew: boolean; deployedAgents?: string[] }) {
  const isActive = deployedAgents && deployedAgents.length > 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} ${mcpServer.accentBorder}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Server className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-purple-400' : text.muted}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium truncate ${isSelected ? text.primary : text.secondary}`}>
              {WOK3_SERVER.name}
            </span>
            {isNew && (
              <span className="relative flex-shrink-0">
                <span className="absolute inset-0 rounded-full bg-purple-400/40 animate-ping" />
                <span className="relative block w-2 h-2 rounded-full bg-purple-400" />
              </span>
            )}
          </div>
        </div>
        {isActive && (
          <span className={`w-1.5 h-1.5 rounded-full ${mcpServer.deployed} flex-shrink-0 mt-1 mr-2`} />
        )}
      </div>
    </button>
  );
}

interface McpServerListProps {
  servers: McpServerSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
  deploymentStatus: Record<string, Record<string, { global?: boolean; project?: boolean }>>;
}

export function McpServerList({ servers: rawServers, selectedId, onSelect, isLoading, deploymentStatus }: McpServerListProps) {
  // Filter out any manually-added wok3 duplicates (built-in is always shown separately)
  const servers = rawServers.filter((s) => s.id !== WOK3_SERVER_ID && !(s.name === 'wok3' && s.command === 'wok3'));
  const wok3Seen = typeof localStorage !== 'undefined' && localStorage.getItem('wok3:mcpWok3Seen') === '1';
  const isNew = !wok3Seen;

  const wok3Status = deploymentStatus[WOK3_SERVER_ID] ?? {};
  const wok3Agents = Object.entries(wok3Status)
    .filter(([, v]) => v.global || v.project)
    .map(([name]) => name);

  const handleSelectWok3 = () => {
    if (isNew) localStorage.setItem('wok3:mcpWok3Seen', '1');
    onSelect(WOK3_SERVER_ID);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <Wok3McpItem isSelected={selectedId === WOK3_SERVER_ID} onSelect={handleSelectWok3} isNew={isNew} deployedAgents={wok3Agents.length > 0 ? wok3Agents : undefined} />
        <div className="flex-1 flex items-center justify-center gap-2 py-8">
          <Spinner size="sm" className={text.muted} />
          <span className={`text-xs ${text.muted}`}>Loading servers...</span>
        </div>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <Wok3McpItem isSelected={selectedId === WOK3_SERVER_ID} onSelect={handleSelectWok3} isNew={isNew} deployedAgents={wok3Agents.length > 0 ? wok3Agents : undefined} />
        <div className="flex-1 flex items-center justify-center py-8">
          <p className={`text-xs ${text.dimmed}`}>No servers in registry</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-px">
        <Wok3McpItem isSelected={selectedId === WOK3_SERVER_ID} onSelect={handleSelectWok3} isNew={isNew} deployedAgents={wok3Agents.length > 0 ? wok3Agents : undefined} />
        {servers.map((server) => {
          const status = deploymentStatus[server.id] ?? {};
          const agents = Object.entries(status)
            .filter(([, v]) => v.global || v.project)
            .map(([name]) => name);

          return (
            <McpServerItem
              key={server.id}
              server={server}
              isSelected={selectedId === server.id}
              onSelect={() => onSelect(server.id)}
              deployedAgents={agents.length > 0 ? agents : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export { WOK3_SERVER_ID, WOK3_SERVER };
