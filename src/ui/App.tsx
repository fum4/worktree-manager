import { useEffect, useState } from 'react';

import { ConfigurationPanel } from './components/ConfigurationPanel';
import { CreateForm } from './components/CreateForm';
import { DetailPanel } from './components/DetailPanel';
import { Header } from './components/Header';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { NavBar, type View } from './components/NavBar';
import { WorktreeList } from './components/WorktreeList';
import { useConfig } from './hooks/useConfig';
import { useJiraStatus, usePorts, useWorktrees } from './hooks/useWorktrees';
import { errorBanner, surface, text } from './theme';

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const { config, projectName, refetch: refetchConfig } = useConfig();
  const jiraStatus = useJiraStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  const [activeView, setActiveView] = useState<View>('workspace');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select first worktree if none selected, or fix stale selection
  useEffect(() => {
    if (worktrees.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !worktrees.find((w) => w.id === selectedId)) {
      setSelectedId(worktrees[0].id);
    }
  }, [worktrees, selectedId]);

  const selectedWorktree = worktrees.find((w) => w.id === selectedId) || null;

  const handleDeleted = () => {
    setSelectedId(null);
  };

  return (
    <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
      <Header
        projectName={projectName}
        runningCount={runningCount}
        isConnected={isConnected}
        portsInfo={ports}
        onPortsDiscovered={refetchPorts}
      />

      <NavBar activeView={activeView} onChangeView={setActiveView} />

      {error && (
        <div className={`flex-shrink-0 px-4 py-2 ${errorBanner.bg} ${text.errorBanner} text-xs`}>
          {error}
        </div>
      )}

      {activeView === 'workspace' && (
        <div className="flex-1 flex min-h-0 gap-3 p-4 pt-3">
          {/* Left sidebar */}
          <aside className={`w-[300px] flex-shrink-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}>
            <CreateForm
              onCreated={refetch}
              jiraConfigured={jiraStatus?.configured ?? false}
              defaultProjectKey={jiraStatus?.defaultProjectKey ?? null}
            />
            <WorktreeList
              worktrees={worktrees}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>

          {/* Right panel */}
          <main className={`flex-1 min-w-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}>
            <DetailPanel
              worktree={selectedWorktree}
              onUpdate={refetch}
              onDeleted={handleDeleted}
            />
          </main>
        </div>
      )}

      {activeView === 'configuration' && (
        <div className="flex-1 min-h-0 p-4 pt-3">
          <ConfigurationPanel config={config} onSaved={refetchConfig} />
        </div>
      )}

      {activeView === 'integrations' && (
        <div className="flex-1 min-h-0 p-4 pt-3">
          <IntegrationsPanel />
        </div>
      )}
    </div>
  );
}
