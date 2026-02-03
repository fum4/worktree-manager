import { useEffect, useState } from 'react';

import { CreateForm } from './components/CreateForm';
import { DetailPanel } from './components/DetailPanel';
import { Header } from './components/Header';
import { WorktreeList } from './components/WorktreeList';
import { useJiraStatus, usePorts, useProjectName, useWorktrees } from './hooks/useWorktrees';

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const projectName = useProjectName();
  const jiraStatus = useJiraStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

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
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <Header
        projectName={projectName}
        runningCount={runningCount}
        isConnected={isConnected}
        portsInfo={ports}
        onPortsDiscovered={refetchPorts}
      />

      {error && (
        <div className="flex-shrink-0 px-4 py-2 bg-red-900/30 border-b border-red-900/40 text-red-300 text-xs">
          {error}
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar */}
        <aside className="w-[300px] flex-shrink-0 border-r border-gray-800 flex flex-col bg-gray-900">
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
        <main className="flex-1 min-w-0 flex flex-col">
          <DetailPanel
            worktree={selectedWorktree}
            onUpdate={refetch}
            onDeleted={handleDeleted}
          />
        </main>
      </div>
    </div>
  );
}
