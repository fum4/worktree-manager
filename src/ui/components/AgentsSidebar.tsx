import { useState } from 'react';

import type { McpServerSummary, SkillSummary, PluginSummary } from '../types';
import { text } from '../theme';
import { McpServerItem } from './McpServerItem';
import { WOK3_SERVER_ID } from './McpServerList';
import { SkillItem } from './SkillItem';
import { PluginItem } from './PluginItem';
import { Spinner } from './Spinner';

type AgentSelection =
  | { type: 'mcp-server'; id: string }
  | { type: 'skill'; name: string; location: 'global' | 'project' }
  | null;

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={`w-3 h-3 ${text.muted} transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`}
    >
      <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

interface AgentsSidebarProps {
  servers: McpServerSummary[];
  serversLoading: boolean;
  deploymentStatus: Record<string, Record<string, { global?: boolean; project?: boolean }>>;
  skills: SkillSummary[];
  skillsLoading: boolean;
  plugins: PluginSummary[];
  selection: AgentSelection;
  onSelect: (selection: AgentSelection) => void;
  search: string;
}

export function AgentsSidebar({
  servers,
  serversLoading,
  deploymentStatus,
  skills,
  skillsLoading,
  plugins,
  selection,
  onSelect,
  search,
}: AgentsSidebarProps) {
  const [mcpCollapsed, setMcpCollapsed] = useState(false);
  const [claudeCollapsed, setClaudeCollapsed] = useState(false);

  // Filter servers (exclude wok3 duplicates — McpServerList handles wok3 internally)
  const filteredServers = servers.filter((s) =>
    s.id !== WOK3_SERVER_ID && !(s.name === 'wok3' && s.command === 'wok3'),
  );

  const filteredSkills = search
    ? skills.filter((s) =>
        s.displayName.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()),
      )
    : skills;

  const filteredPlugins = search
    ? plugins.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : plugins;

  const wok3Seen = typeof localStorage !== 'undefined' && localStorage.getItem('wok3:mcpWok3Seen') === '1';
  const isWok3New = !wok3Seen;

  const handleSelectWok3 = () => {
    if (isWok3New) localStorage.setItem('wok3:mcpWok3Seen', '1');
    onSelect({ type: 'mcp-server', id: WOK3_SERVER_ID });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8">
      {/* MCP Servers Section */}
      <div>
        <button
          type="button"
          onClick={() => setMcpCollapsed(!mcpCollapsed)}
          className="w-full flex items-center gap-2 px-3 py-1.5 mb-px hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
        >
          <ChevronIcon collapsed={mcpCollapsed} />
          <span className={`text-[11px] font-medium ${text.secondary}`}>MCP Servers</span>
          {!serversLoading && (
            <span className={`text-[10px] ${text.muted} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
              {filteredServers.length + 1}
            </span>
          )}
        </button>

        {!mcpCollapsed && (
          <div className="space-y-px">
            {/* wok3 built-in */}
            <Wok3Item
              isSelected={selection?.type === 'mcp-server' && selection.id === WOK3_SERVER_ID}
              onSelect={handleSelectWok3}
              isNew={isWok3New}
              deploymentStatus={deploymentStatus[WOK3_SERVER_ID]}
            />

            {serversLoading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Spinner size="sm" className={text.muted} />
                <span className={`text-xs ${text.muted}`}>Loading...</span>
              </div>
            ) : (
              filteredServers.map((server) => {
                const status = deploymentStatus[server.id] ?? {};
                const agents = Object.entries(status)
                  .filter(([, v]) => v.global || v.project)
                  .map(([name]) => name);

                return (
                  <McpServerItem
                    key={server.id}
                    server={server}
                    isSelected={selection?.type === 'mcp-server' && selection.id === server.id}
                    onSelect={() => onSelect({ type: 'mcp-server', id: server.id })}
                    deployedAgents={agents.length > 0 ? agents : undefined}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Claude Section */}
      <div>
        <button
          type="button"
          onClick={() => setClaudeCollapsed(!claudeCollapsed)}
          className="w-full flex items-center gap-2 px-3 py-1.5 mb-px hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
        >
          <ChevronIcon collapsed={claudeCollapsed} />
          <span className={`text-[11px] font-medium ${text.secondary}`}>Claude</span>
          {!skillsLoading && (
            <span className={`text-[10px] ${text.muted} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
              {filteredSkills.length + filteredPlugins.length}
            </span>
          )}
        </button>

        {!claudeCollapsed && (
          <div className="space-y-px">
            {skillsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Spinner size="sm" className={text.muted} />
                <span className={`text-xs ${text.muted}`}>Loading...</span>
              </div>
            ) : (
              <>
                {filteredSkills.map((skill) => (
                  <SkillItem
                    key={`${skill.location}:${skill.name}`}
                    skill={skill}
                    isSelected={
                      selection?.type === 'skill' &&
                      selection.name === skill.name &&
                      selection.location === skill.location
                    }
                    onSelect={() => onSelect({ type: 'skill', name: skill.name, location: skill.location })}
                  />
                ))}
                {filteredPlugins.map((plugin) => (
                  <PluginItem key={plugin.name} plugin={plugin} />
                ))}
                {filteredSkills.length === 0 && filteredPlugins.length === 0 && (
                  <div className="flex items-center justify-center py-4">
                    <p className={`text-xs ${text.dimmed}`}>No skills or plugins</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Wok3 built-in item ─────────────────────────────────────────

import { Server } from 'lucide-react';
import { mcpServer, surface } from '../theme';

function Wok3Item({ isSelected, onSelect, isNew, deploymentStatus }: { isSelected: boolean; onSelect: () => void; isNew: boolean; deploymentStatus?: Record<string, { global?: boolean; project?: boolean }> }) {
  const deployedAgents = deploymentStatus
    ? Object.entries(deploymentStatus)
        .filter(([, v]) => v.global || v.project)
        .map(([name]) => name)
    : [];
  const isActive = deployedAgents.length > 0;

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
              wok3
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
          <span className={`w-1.5 h-1.5 rounded-full ${mcpServer.deployed} flex-shrink-0 mt-1`} />
        )}
      </div>
    </button>
  );
}

export type { AgentSelection };
