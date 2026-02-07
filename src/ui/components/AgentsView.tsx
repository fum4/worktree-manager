import { useEffect, useState } from 'react';

import { APP_NAME } from '../../constants';
import { useServer } from '../contexts/ServerContext';
import { useMcpServers, useMcpDeploymentStatus } from '../hooks/useMcpServers';
import { useClaudeSkills, useClaudePlugins } from '../hooks/useClaudeSkills';
import { surface } from '../theme';
import { AgentsSidebar, type AgentSelection } from './AgentsSidebar';
import { AgentsToolbar } from './AgentsToolbar';
import { McpServerDetailPanel } from './detail/McpServerDetailPanel';
import { SkillDetailPanel } from './detail/SkillDetailPanel';
import { McpServerCreateModal } from './McpServerCreateModal';
import { McpServerScanModal } from './McpServerScanModal';
import { SkillCreateModal } from './SkillCreateModal';
import { ResizableHandle } from './ResizableHandle';
import { WOK3_SERVER_ID, WOK3_SERVER } from './McpServerList';
import { text } from '../theme';

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
  const [showScanModal, setShowScanModal] = useState(false);

  const { servers, isLoading: serversLoading, refetch: refetchServers } = useMcpServers(search || undefined);
  const { status: deploymentStatus, refetch: refetchDeployment } = useMcpDeploymentStatus();
  const { skills, isLoading: skillsLoading, refetch: refetchSkills } = useClaudeSkills();
  const { plugins } = useClaudePlugins();

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
      setSelection({ type: 'mcp-server', id: WOK3_SERVER_ID });
    } else if (selection.type === 'mcp-server' && selection.id !== WOK3_SERVER_ID) {
      // Check if selected server still exists
      if (!serversLoading && servers.length > 0 && !servers.find((s) => s.id === selection.id)) {
        setSelection({ type: 'mcp-server', id: WOK3_SERVER_ID });
      }
    }
  }, [servers, serversLoading, selection]);

  const handleCreated = () => {
    refetchServers();
    refetchDeployment();
  };

  const handleSkillCreated = () => {
    refetchSkills();
  };

  const handleImported = () => {
    refetchServers();
    refetchDeployment();
  };

  const hasItems = servers.length > 0 || skills.length > 0;

  return (
    <div className="absolute inset-0 flex p-5">
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
          onScanImport={() => setShowScanModal(true)}
          hasItems={hasItems}
        />
        <AgentsSidebar
          servers={servers}
          serversLoading={serversLoading}
          deploymentStatus={deploymentStatus}
          skills={skills}
          skillsLoading={skillsLoading}
          plugins={plugins}
          selection={selection}
          onSelect={setSelection}
          search={search}
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
        {selection?.type === 'mcp-server' && selection.id !== WOK3_SERVER_ID ? (
          <McpServerDetailPanel
            serverId={selection.id}
            onDeleted={() => {
              setSelection(null);
              refetchServers();
              refetchDeployment();
            }}
          />
        ) : selection?.type === 'mcp-server' && selection.id === WOK3_SERVER_ID ? (
          <McpServerDetailPanel
            serverId={WOK3_SERVER_ID}
            builtInServer={WOK3_SERVER}
            onDeleted={() => setSelection(null)}
          />
        ) : selection?.type === 'skill' ? (
          <SkillDetailPanel
            skillName={selection.name}
            location={selection.location ?? 'global'}
            onDeleted={() => {
              setSelection(null);
              refetchSkills();
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
          onClose={() => setShowCreateSkillModal(false)}
        />
      )}
      {showScanModal && (
        <McpServerScanModal
          onImported={handleImported}
          onClose={() => setShowScanModal(false)}
        />
      )}
    </div>
  );
}
