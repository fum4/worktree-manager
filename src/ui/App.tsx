import { CreateForm } from './components/CreateForm';
import { Header } from './components/Header';
import { WorktreeList } from './components/WorktreeList';
import { usePorts, useProjectName, useWorktrees } from './hooks/useWorktrees';

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const projectName = useProjectName();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-2xl mx-auto p-6">
        <Header
          projectName={projectName}
          runningCount={runningCount}
          isConnected={isConnected}
          portsInfo={ports}
          onPortsDiscovered={refetchPorts}
        />

        <main className="space-y-6">
          <CreateForm onCreated={refetch} />

          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
              {error}
            </div>
          )}

          <WorktreeList worktrees={worktrees} onUpdate={refetch} />
        </main>
      </div>
    </div>
  );
}
