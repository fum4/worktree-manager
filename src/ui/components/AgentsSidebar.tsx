import { useState, useRef, useEffect } from 'react';
import { Filter, Plus, Server, Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import type { McpServerSummary, SkillSummary, PluginSummary } from '../types';
import { useApi } from '../hooks/useApi';
import { border, mcpServer, surface, text } from '../theme';
import { McpServerItem } from './McpServerItem';
import { WOK3_SERVER_ID } from './McpServerList';
import { SkillItem } from './SkillItem';
import { PluginItem } from './PluginItem';
import { Spinner } from './Spinner';

type AgentSelection =
  | { type: 'mcp-server'; id: string }
  | { type: 'skill'; name: string }
  | { type: 'plugin'; id: string }
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
  skillDeploymentStatus: Record<string, { global: boolean; local: boolean }>;
  plugins: PluginSummary[];
  pluginsLoading: boolean;
  selection: AgentSelection;
  onSelect: (selection: AgentSelection) => void;
  search: string;
  onAddServer: () => void;
  onAddSkill: () => void;
  onAddPlugin: () => void;
}

export function AgentsSidebar({
  servers,
  serversLoading,
  deploymentStatus,
  skills,
  skillsLoading,
  skillDeploymentStatus,
  plugins,
  pluginsLoading,
  selection,
  onSelect,
  search,
  onAddServer,
  onAddSkill,
  onAddPlugin,
}: AgentsSidebarProps) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [mcpCollapsed, setMcpCollapsed] = useState(() => localStorage.getItem('wok3:agentsMcpCollapsed') === '1');
  const [skillsCollapsed, setSkillsCollapsed] = useState(() => localStorage.getItem('wok3:agentsSkillsCollapsed') === '1');
  const [pluginsCollapsed, setPluginsCollapsed] = useState(() => localStorage.getItem('wok3:agentsPluginsCollapsed') === '1');

  const [showGlobal, setShowGlobal] = useState(() => {
    const saved = localStorage.getItem('wok3:agentsShowGlobal');
    return saved !== null ? saved === '1' : true;
  });
  const [showProject, setShowProject] = useState(() => {
    const saved = localStorage.getItem('wok3:agentsShowProject');
    return saved !== null ? saved === '1' : true;
  });
  const [configOpen, setConfigOpen] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const [hiddenMarketplaces, setHiddenMarketplaces] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('wok3:hiddenMarketplaces');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('wok3:agentsMcpCollapsed', mcpCollapsed ? '1' : '0');
  }, [mcpCollapsed]);
  useEffect(() => {
    localStorage.setItem('wok3:agentsSkillsCollapsed', skillsCollapsed ? '1' : '0');
  }, [skillsCollapsed]);
  useEffect(() => {
    localStorage.setItem('wok3:agentsPluginsCollapsed', pluginsCollapsed ? '1' : '0');
  }, [pluginsCollapsed]);
  useEffect(() => {
    localStorage.setItem('wok3:agentsShowGlobal', showGlobal ? '1' : '0');
  }, [showGlobal]);
  useEffect(() => {
    localStorage.setItem('wok3:agentsShowProject', showProject ? '1' : '0');
  }, [showProject]);
  useEffect(() => {
    if (!configOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [configOpen]);
  useEffect(() => {
    localStorage.setItem('wok3:hiddenMarketplaces', JSON.stringify([...hiddenMarketplaces]));
  }, [hiddenMarketplaces]);
  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [filterOpen]);

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
    ? plugins.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()),
      )
    : plugins;

  const wok3Seen = typeof localStorage !== 'undefined' && localStorage.getItem('wok3:mcpWok3Seen') === '1';
  const isWok3New = !wok3Seen;

  const handleSelectWok3 = () => {
    if (isWok3New) localStorage.setItem('wok3:mcpWok3Seen', '1');
    onSelect({ type: 'mcp-server', id: WOK3_SERVER_ID });
  };

  // Filter helpers
  const isServerVisible = (serverId: string) => {
    if (showGlobal && showProject) return true;
    const st = deploymentStatus[serverId] ?? {};
    const hasGlobal = Object.values(st).some((v) => v.global);
    const hasProj = Object.values(st).some((v) => v.project);
    const isActive = hasGlobal || hasProj;
    if (!isActive) return true; // inactive items always show
    if (showGlobal && hasGlobal) return true;
    if (showProject && hasProj) return true;
    return false;
  };

  const isSkillVisible = (skillName: string) => {
    if (showGlobal && showProject) return true;
    const st = skillDeploymentStatus[skillName];
    if (!st) return true;
    const isActive = st.global || st.local;
    if (!isActive) return true;
    if (showGlobal && st.global) return true;
    if (showProject && st.local) return true;
    return false;
  };

  const isPluginVisible = (plugin: PluginSummary) => {
    if (showGlobal && showProject) return true;
    if (plugin.scope === 'user') return showGlobal;
    if (plugin.scope === 'project' || plugin.scope === 'local') return showProject;
    return true;
  };

  // Sort plugins: errors first, then warnings, then enabled, then disabled; alphabetical within each group
  const pluginSortPriority = (p: PluginSummary) => {
    if (p.error) return 0;
    if (p.warning) return 1;
    if (p.enabled) return 2;
    return 3;
  };
  const marketplaceNames = [...new Set(plugins.map((p) => p.marketplace).filter(Boolean))].sort();

  const toggleMarketplace = (name: string) => {
    setHiddenMarketplaces((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const sortedPlugins = [...filteredPlugins]
    .filter((p) => isPluginVisible(p) && (!p.marketplace || !hiddenMarketplaces.has(p.marketplace)))
    .sort((a, b) => {
      const pa = pluginSortPriority(a);
      const pb = pluginSortPriority(b);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });

  return (
    <>
    <div className="flex-1 min-h-0 overflow-y-auto space-y-8" style={{ scrollbarGutter: 'stable' }}>
      {/* MCP Servers Section */}
      <div>
        <div className="relative mb-px group">
          <button
            type="button"
            onClick={() => setMcpCollapsed(!mcpCollapsed)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
          >
            <ChevronIcon collapsed={mcpCollapsed} />
            <span className={`text-[11px] font-medium ${text.secondary}`}>MCP Servers</span>
            {!serversLoading && (
              <span className={`text-[10px] ${text.muted} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {filteredServers.length + 1}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onAddServer}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${text.dimmed} hover:${text.muted} hover:bg-white/[0.06] transition-colors z-10`}
            title="Add MCP server"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!mcpCollapsed && (
          <div className="space-y-px">
            {serversLoading ? (
              <>
                <Wok3Item
                  isSelected={selection?.type === 'mcp-server' && selection.id === WOK3_SERVER_ID}
                  onSelect={handleSelectWok3}
                  isNew={isWok3New}
                  deploymentStatus={deploymentStatus[WOK3_SERVER_ID]}
                />
                <div className="flex items-center justify-center gap-2 py-4">
                  <Spinner size="sm" className={text.muted} />
                  <span className={`text-xs ${text.muted}`}>Loading...</span>
                </div>
              </>
            ) : (
              (() => {
                const wok3Status = deploymentStatus[WOK3_SERVER_ID] ?? {};
                const wok3Active = Object.values(wok3Status).some((v) => v.global || v.project);

                type SortEntry = { type: 'server'; server: McpServerSummary } | { type: 'wok3' };
                const entries: SortEntry[] = [
                  ...(isServerVisible(WOK3_SERVER_ID) ? [{ type: 'wok3' as const }] : []),
                  ...filteredServers
                    .filter((s) => isServerVisible(s.id))
                    .map((s) => ({ type: 'server' as const, server: s })),
                ];

                const isActive = (e: SortEntry) => {
                  if (e.type === 'wok3') return wok3Active;
                  const st = deploymentStatus[e.server.id] ?? {};
                  return Object.values(st).some((v) => v.global || v.project);
                };
                const getName = (e: SortEntry) =>
                  e.type === 'wok3' ? 'wok3' : e.server.name;

                entries.sort((a, b) => {
                  const aAct = isActive(a);
                  const bAct = isActive(b);
                  if (aAct !== bAct) return aAct ? -1 : 1;
                  return getName(a).localeCompare(getName(b));
                });

                return entries.map((entry) => {
                  if (entry.type === 'wok3') {
                    return (
                      <Wok3Item
                        key={WOK3_SERVER_ID}
                        isSelected={selection?.type === 'mcp-server' && selection.id === WOK3_SERVER_ID}
                        onSelect={handleSelectWok3}
                        isNew={isWok3New}
                        deploymentStatus={deploymentStatus[WOK3_SERVER_ID]}
                      />
                    );
                  }
                  const server = entry.server;
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
                });
              })()
            )}
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div>
        <div className="relative mb-px group">
          <button
            type="button"
            onClick={() => setSkillsCollapsed(!skillsCollapsed)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
          >
            <ChevronIcon collapsed={skillsCollapsed} />
            <span className={`text-[11px] font-medium ${text.secondary}`}>Skills</span>
            {!skillsLoading && (
              <span className={`text-[10px] ${text.muted} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {filteredSkills.filter((s) => isSkillVisible(s.name)).length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onAddSkill}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded ${text.dimmed} hover:${text.muted} hover:bg-white/[0.06] transition-colors z-10`}
            title="Add skill"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {!skillsCollapsed && (
          <div className="space-y-px">
            {skillsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Spinner size="sm" className={text.muted} />
                <span className={`text-xs ${text.muted}`}>Loading...</span>
              </div>
            ) : (
              <>
                {[...filteredSkills]
                  .filter((s) => isSkillVisible(s.name))
                  .sort((a, b) => {
                    const aStatus = skillDeploymentStatus[a.name];
                    const bStatus = skillDeploymentStatus[b.name];
                    const aActive = aStatus ? (aStatus.global || aStatus.local) : false;
                    const bActive = bStatus ? (bStatus.global || bStatus.local) : false;
                    if (aActive !== bActive) return aActive ? -1 : 1;
                    return a.displayName.localeCompare(b.displayName);
                  })
                  .map((skill) => {
                    const depStatus = skillDeploymentStatus[skill.name];
                    const isDeployed = depStatus ? (depStatus.global || depStatus.local) : false;

                    return (
                      <SkillItem
                        key={skill.name}
                        skill={skill}
                        isSelected={selection?.type === 'skill' && selection.name === skill.name}
                        onSelect={() => onSelect({ type: 'skill', name: skill.name })}
                        isDeployed={isDeployed}
                        isProjectDeployed={depStatus?.local ?? false}
                      />
                    );
                  })}
                {filteredSkills.filter((s) => isSkillVisible(s.name)).length === 0 && (
                  <div className="flex items-center justify-center py-4">
                    <p className={`text-xs ${text.dimmed}`}>No skills</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Plugins Section */}
      <div>
        <div className="relative mb-px group">
          <button
            type="button"
            onClick={() => setPluginsCollapsed(!pluginsCollapsed)}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
          >
            <ChevronIcon collapsed={pluginsCollapsed} />
            <span className={`text-[11px] font-medium ${text.secondary}`}>Plugins</span>
            {!pluginsLoading && (
              <span className={`text-[10px] ${text.muted} bg-white/[0.06] px-1.5 py-0.5 rounded-full`}>
                {sortedPlugins.length}
              </span>
            )}
          </button>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
            {marketplaceNames.length > 1 && (
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`p-1 rounded transition-colors duration-150 ${
                    hiddenMarketplaces.size > 0
                      ? 'text-teal-400 hover:text-teal-300 hover:bg-white/[0.06]'
                      : `${text.dimmed} hover:${text.muted} hover:bg-white/[0.06]`
                  }`}
                >
                  <Filter className="w-3 h-3" />
                </button>
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-[#1a1d24] border border-white/[0.08] shadow-xl py-1 z-50">
                    {marketplaceNames.map((name) => (
                      <SettingsToggle
                        key={name}
                        label={name}
                        checked={!hiddenMarketplaces.has(name)}
                        onToggle={() => toggleMarketplace(name)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onAddPlugin}
              className={`p-1 rounded ${text.dimmed} hover:${text.muted} hover:bg-white/[0.06] transition-colors`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!pluginsCollapsed && (
          <div className="space-y-px">
            {pluginsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Spinner size="sm" className={text.muted} />
                <span className={`text-xs ${text.muted}`}>Loading...</span>
              </div>
            ) : sortedPlugins.length === 0 ? (
              <div className="flex items-center justify-center py-4">
                <p className={`text-xs ${text.dimmed}`}>No plugins</p>
              </div>
            ) : (
              sortedPlugins.map((plugin) => (
                <PluginItem
                  key={plugin.id}
                  plugin={plugin}
                  isSelected={selection?.type === 'plugin' && selection.id === plugin.id}
                  onSelect={() => onSelect({ type: 'plugin', id: plugin.id })}
                  onToggleEnabled={async () => {
                    if (plugin.enabled) {
                      await api.disableClaudePlugin(plugin.id, plugin.scope);
                    } else {
                      await api.enableClaudePlugin(plugin.id, plugin.scope);
                    }
                    queryClient.invalidateQueries({ queryKey: ['claudePlugins'] });
                  }}
                  onRemove={async () => {
                    await api.uninstallClaudePlugin(plugin.id, plugin.scope);
                    await queryClient.invalidateQueries({ queryKey: ['claudePlugins'] });
                    if (selection?.type === 'plugin' && selection.id === plugin.id) {
                      onSelect(null as unknown as AgentSelection);
                    }
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>

    {/* Settings bar */}
    <div className={`flex-shrink-0 border-t ${border.subtle} px-2 py-1.5`}>
      <div className="relative" ref={configRef}>
        <button
          type="button"
          onClick={() => setConfigOpen(!configOpen)}
          className={`p-1 rounded transition-colors duration-150 ${
            configOpen ? `${text.secondary} bg-white/[0.06]` : `${text.dimmed} hover:${text.secondary} hover:bg-white/[0.06]`
          }`}
          title="List settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {configOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-44 rounded-lg bg-[#1a1d24] border border-white/[0.08] shadow-xl py-1 z-50">
            <SettingsToggle label="Show global" checked={showGlobal} onToggle={() => setShowGlobal(!showGlobal)} />
            <SettingsToggle label="Show project" checked={showProject} onToggle={() => setShowProject(!showProject)} />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

function SettingsToggle({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full px-3 py-1.5 flex items-center gap-2 text-left text-[11px] ${text.secondary} hover:bg-white/[0.04] transition-colors duration-150`}
    >
      <span className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
        checked ? 'bg-teal-400/20 border-teal-400/40' : 'border-white/[0.15]'
      }`}>
        {checked && (
          <svg className="w-2 h-2 text-teal-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

// ─── Wok3 built-in item ─────────────────────────────────────────

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
      className={`group w-full text-left px-3 py-2.5 transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} ${mcpServer.accentBorder}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Server className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 transition-colors duration-150 ${isSelected ? 'text-purple-400' : `${text.muted} group-hover:text-purple-400`}`} />
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
          <span className={`w-1.5 h-1.5 rounded-full ${mcpServer.deployed} flex-shrink-0 mt-1 mr-2`} />
        )}
      </div>
    </button>
  );
}

export type { AgentSelection };
