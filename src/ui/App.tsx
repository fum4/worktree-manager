import { CreateForm } from './components/CreateForm';
import { Header } from './components/Header';
import { JiraTaskForm } from './components/JiraTaskForm';
import { WorktreeList } from './components/WorktreeList';
import { useJiraStatus, usePorts, useProjectName, useWorktrees } from './hooks/useWorktrees';

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const projectName = useProjectName();
  const jiraStatus = useJiraStatus();
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

          {jiraStatus?.configured && (
            <JiraTaskForm
              defaultProjectKey={jiraStatus.defaultProjectKey}
              onCreated={refetch}
            />
          )}

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
