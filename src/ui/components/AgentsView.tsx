import { useEffect, useRef, useState } from 'react';
import { Info, Radar, ScanSearch, X } from 'lucide-react';

import { APP_NAME } from '../../constants';
import { useServer } from '../contexts/ServerContext';
import { useApi } from '../hooks/useApi';
import { useConfig } from '../hooks/useConfig';
import { useMcpServers, useMcpDeploymentStatus } from '../hooks/useMcpServers';
import { useSkills, useSkillDeploymentStatus, useClaudePlugins } from '../hooks/useSkills';
import { surface } from '../theme';
import { AgentsSidebar, type AgentSelection } from './AgentsSidebar';
import { AgentsToolbar } from './AgentsToolbar';
import { McpServerDetailPanel } from './detail/McpServerDetailPanel';
import { SkillDetailPanel } from './detail/SkillDetailPanel';
import { PluginDetailPanel } from './detail/PluginDetailPanel';
import { McpServerCreateModal } from './McpServerCreateModal';
import { McpServerScanModal } from './McpServerScanModal';
import { SkillCreateModal } from './SkillCreateModal';
import { PluginInstallModal } from './PluginInstallModal';
import { ResizableHandle } from './ResizableHandle';
import { WOK3_SERVER } from './AgentsSidebar';
import { text } from '../theme';

const BANNER_DISMISSED_KEY = `${APP_NAME}:agentsBannerDismissed`;
const DISCOVERY_DISMISSED_KEY = `${APP_NAME}:agentsDiscoveryDismissed`;

const STORAGE_KEY = `${APP_NAME}:agentsSidebarWidth`;
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

export function AgentsView() {
  const { serverUrl } = useServer();
  const [search, setSearch] = useState('');
  const [selection, setSelectionState] = useState<AgentSelection>(() => {
    if (serverUrl) {
      try {
        const saved = localStorage.getItem(`wok3:agentSel:${serverUrl}`);
        if (saved) return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return null;
  });

  const setSelection = (sel: AgentSelection) => {
    setSelectionState(sel);
    if (serverUrl) {
      localStorage.setItem(`wok3:agentSel:${serverUrl}`, JSON.stringify(sel));
    }
  };
  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showCreateSkillModal, setShowCreateSkillModal] = useState(false);
  const [showInstallPluginModal, setShowInstallPluginModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const { config, refetch: refetchConfig } = useConfig();

  const handleTogglePolicy = async (key: 'allowAgentCommits' | 'allowAgentPushes' | 'allowAgentPRs') => {
    await api.saveConfig({ [key]: !config?.[key] });
    refetchConfig();
  };

  const { servers, isLoading: serversLoading, refetch: refetchServers } = useMcpServers(search || undefined);
  const { status: deploymentStatus, refetch: refetchDeployment } = useMcpDeploymentStatus();
  const { skills, isLoading: skillsLoading, refetch: refetchSkills } = useSkills();
  const { status: skillDeploymentStatus, refetch: refetchSkillDeployment } = useSkillDeploymentStatus();
  const { plugins, isLoading: pluginsLoading, refetch: refetchPlugins } = useClaudePlugins();
  const [pluginActing, setPluginActing] = useState(false);

  // Sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (!isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) return w;
    }
    return DEFAULT_WIDTH;
  });

  const handleSidebarResize = (delta: number) => {
    setSidebarWidth((prev) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, prev + delta)));
  };

  const handleSidebarResizeEnd = () => {
    localStorage.setItem(STORAGE_KEY, String(sidebarWidth));
  };

  // Auto-select wok3 built-in if nothing selected
  useEffect(() => {
    if (!selection) {
      setSelection({ type: 'mcp-server', id: WOK3_SERVER.id });
    } else if (selection.type === 'mcp-server' && selection.id !== WOK3_SERVER.id) {
      // Check if selected server still exists
      if (!serversLoading && servers.length > 0 && !servers.find((s) => s.id === selection.id)) {
        setSelection({ type: 'mcp-server', id: WOK3_SERVER.id });
      }
    }
  }, [servers, serversLoading, selection]);

  const handleCreated = () => {
    refetchServers();
    refetchDeployment();
  };

  const handleSkillCreated = (skillName: string) => {
    refetchSkills();
    refetchSkillDeployment();
    setSelection({ type: 'skill', name: skillName });
  };

  const handleSkillInstalled = (skillNames: string[]) => {
    refetchSkills();
    refetchSkillDeployment();
    if (skillNames.length > 0) {
      setSelection({ type: 'skill', name: skillNames[0] });
    }
  };


  const handlePluginInstalled = () => {
    refetchPlugins();
  };

  const handleImported = () => {
    refetchServers();
    refetchDeployment();
    refetchSkills();
    refetchSkillDeployment();
  };

  const hasItems = servers.length > 0 || skills.length > 0;

  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === '1',
  );
  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, '1');
  };

  // Auto-detect: background device scan when registries are empty
  const api = useApi();
  const [discoveryDismissed, setDiscoveryDismissed] = useState(
    () => localStorage.getItem(DISCOVERY_DISMISSED_KEY) === '1',
  );
  const [discoveryCounts, setDiscoveryCounts] = useState<{ servers: number; skills: number } | null>(null);
  const discoveryRan = useRef(false);

  useEffect(() => {
    if (discoveryRan.current || discoveryDismissed) return;
    if (serversLoading || skillsLoading) return;
    // Only auto-scan when registries are empty
    if (servers.length > 0 || skills.length > 0) return;

    discoveryRan.current = true;
    const options = { mode: 'device' as const };
    Promise.all([api.scanMcpServers(options), api.scanSkills(options)]).then(([mcpRes, skillRes]) => {
      const mcpCount = (mcpRes.discovered ?? []).filter((r) => !r.alreadyInRegistry && r.key !== 'wok3').length;
      const skillCount = (skillRes.discovered ?? []).filter((r) => !r.alreadyInRegistry).length;
      if (mcpCount > 0 || skillCount > 0) {
        setDiscoveryCounts({ servers: mcpCount, skills: skillCount });
      }
    });
  }, [serversLoading, skillsLoading, servers.length, skills.length, discoveryDismissed]);

  const dismissDiscovery = () => {
    setDiscoveryCounts(null);
    setDiscoveryDismissed(true);
    localStorage.setItem(DISCOVERY_DISMISSED_KEY, '1');
  };

  return (
    <div className="absolute inset-0 flex px-5 pb-1">
      {/* Left sidebar */}
      <aside
        style={{ width: sidebarWidth }}
        className={`flex-shrink-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
      >
        <AgentsToolbar
          search={search}
          onSearchChange={setSearch}
          onAddServer={() => setShowCreateServerModal(true)}
          onAddSkill={() => setShowCreateSkillModal(true)}
          onAddPlugin={() => setShowInstallPluginModal(true)}
          onScanImport={() => setShowScanModal(true)}
          hasItems={hasItems}
        />
        <AgentsSidebar
          servers={servers}
          serversLoading={serversLoading}
          deploymentStatus={deploymentStatus}
          skills={skills}
          skillsLoading={skillsLoading}
          skillDeploymentStatus={skillDeploymentStatus}
          plugins={plugins}
          pluginsLoading={pluginsLoading}
          selection={selection}
          onSelect={setSelection}
          search={search}
          onAddServer={() => setShowCreateServerModal(true)}
          onAddSkill={() => setShowCreateSkillModal(true)}
          onAddPlugin={() => setShowInstallPluginModal(true)}
          onScanImport={() => setShowScanModal(true)}
          pluginActing={pluginActing}
          onPluginActingChange={setPluginActing}
          allowAgentCommits={config?.allowAgentCommits}
          allowAgentPushes={config?.allowAgentPushes}
          allowAgentPRs={config?.allowAgentPRs}
          onTogglePolicy={handleTogglePolicy}
        />
      </aside>

      {/* Resize handle */}
      <div className="px-[9px]">
        <ResizableHandle
          onResize={handleSidebarResize}
          onResizeEnd={handleSidebarResizeEnd}
        />
      </div>

      {/* Right panel */}
      <main className={`flex-1 min-w-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}>
        {discoveryCounts && (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-teal-400/20 bg-teal-400/[0.04]">
            <Radar className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <p className={`text-[11px] ${text.secondary} leading-relaxed flex-1`}>
              Found{discoveryCounts.servers > 0 ? ` ${discoveryCounts.servers} MCP server${discoveryCounts.servers !== 1 ? 's' : ''}` : ''}
              {discoveryCounts.servers > 0 && discoveryCounts.skills > 0 ? ' and' : ''}
              {discoveryCounts.skills > 0 ? ` ${discoveryCounts.skills} skill${discoveryCounts.skills !== 1 ? 's' : ''}` : ''}
              {' '}on this device.
            </p>
            <button
              type="button"
              onClick={() => { setShowScanModal(true); dismissDiscovery(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-teal-300 bg-teal-400/10 hover:bg-teal-400/20 border border-teal-400/20 rounded-lg transition-colors flex-shrink-0"
            >
              <ScanSearch className="w-3.5 h-3.5" />
              Import
            </button>
            <button
              type="button"
              onClick={dismissDiscovery}
              className="p-1 rounded-md hover:bg-teal-400/10 text-teal-400/40 hover:text-teal-400/70 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {!bannerDismissed && !discoveryCounts && (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-purple-400/20 bg-purple-400/[0.04]">
            <Info className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <p className={`text-[11px] ${text.secondary} leading-relaxed flex-1`}>
              Manage all your agent tooling in one place. Import your MCP servers, skills and Claude plugins, then enable or disable them globally or per project.
            </p>
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-purple-300 bg-purple-400/10 hover:bg-purple-400/20 border border-purple-400/20 rounded-lg transition-colors flex-shrink-0"
            >
              <ScanSearch className="w-3.5 h-3.5" />
              Scan &amp; Import
            </button>
            <button
              type="button"
              onClick={dismissBanner}
              className="p-1 rounded-md hover:bg-purple-400/10 text-purple-400/40 hover:text-purple-400/70 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {selection?.type === 'mcp-server' && selection.id !== WOK3_SERVER.id ? (
          <McpServerDetailPanel
            serverId={selection.id}
            onDeleted={() => {
              setSelection(null);
              refetchServers();
              refetchDeployment();
            }}
          />
        ) : selection?.type === 'mcp-server' && selection.id === WOK3_SERVER.id ? (
          <McpServerDetailPanel
            serverId={WOK3_SERVER.id}
            builtInServer={WOK3_SERVER}
            onDeleted={() => setSelection(null)}
          />
        ) : selection?.type === 'skill' ? (
          <SkillDetailPanel
            skillName={selection.name}
            onDeleted={() => {
              setSelection(null);
              refetchSkills();
              refetchSkillDeployment();
            }}
          />
        ) : selection?.type === 'plugin' ? (
          <PluginDetailPanel
            pluginId={selection.id}
            pluginActing={pluginActing}
            onPluginActingChange={setPluginActing}
            onDeleted={() => {
              setSelection(null);
              refetchPlugins();
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className={`text-xs ${text.dimmed}`}>Select an agent to view details</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateServerModal && (
        <McpServerCreateModal
          onCreated={handleCreated}
          onClose={() => setShowCreateServerModal(false)}
        />
      )}
      {showCreateSkillModal && (
        <SkillCreateModal
          onCreated={handleSkillCreated}
          onInstalled={handleSkillInstalled}
          onClose={() => setShowCreateSkillModal(false)}
        />
      )}
      {showInstallPluginModal && (
        <PluginInstallModal
          onInstalled={handlePluginInstalled}
          onClose={() => setShowInstallPluginModal(false)}
        />
      )}
      {showScanModal && (
        <McpServerScanModal
          onImported={handleImported}
          onClose={() => setShowScanModal(false)}
          plugins={plugins}
        />
      )}
    </div>
  );
}
