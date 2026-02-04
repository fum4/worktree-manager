import { useEffect, useState } from 'react';

import { ConfigurationPanel } from './components/ConfigurationPanel';
import { CreateForm } from './components/CreateForm';
import { DetailPanel } from './components/detail/DetailPanel';
import { JiraDetailPanel } from './components/detail/JiraDetailPanel';
import { Header } from './components/Header';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { JiraIssueList } from './components/JiraIssueList';
import { NavBar, type View } from './components/NavBar';
import { WorktreeList } from './components/WorktreeList';
import { useConfig } from './hooks/useConfig';
import { useJiraIssues } from './hooks/useJiraIssues';
import { useJiraStatus, usePorts, useWorktrees } from './hooks/useWorktrees';
import { errorBanner, surface, text } from './theme';

type Selection =
  | { type: 'worktree'; id: string }
  | { type: 'jira'; key: string }
  | null;

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const { config, projectName, refetch: refetchConfig } = useConfig();
  const jiraStatus = useJiraStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  const [activeView, setActiveView] = useState<View>('workspace');
  const [selection, setSelection] = useState<Selection>(null);
  const [activeCreateTab, setActiveCreateTab] = useState<'branch' | 'jira'>('branch');

  const jiraEnabled = activeCreateTab === 'jira' && (jiraStatus?.configured ?? false);
  const { issues: jiraIssues, isLoading: jiraIssuesLoading, error: jiraError, searchQuery: jiraSearchQuery, setSearchQuery: setJiraSearchQuery } = useJiraIssues(jiraEnabled);

  // Auto-select first worktree when on branch tab, or fix stale selection
  useEffect(() => {
    if (activeCreateTab !== 'branch') return;
    if (worktrees.length === 0) {
      setSelection(null);
      return;
    }
    if (!selection || selection.type !== 'worktree' || !worktrees.find((w) => w.id === selection.id)) {
      setSelection({ type: 'worktree', id: worktrees[0].id });
    }
  }, [worktrees, selection, activeCreateTab]);

  const selectedWorktree = selection?.type === 'worktree'
    ? worktrees.find((w) => w.id === selection.id) || null
    : null;

  const handleDeleted = () => {
    setSelection(null);
  };

  const handleCreateWorktreeFromJira = () => {
    // Switch to worktree tab so user sees the newly created worktree
    setActiveCreateTab('branch');
    setSelection(null);
    refetch();
  };

  const handleViewWorktreeFromJira = (worktreeId: string) => {
    setActiveCreateTab('branch');
    setSelection({ type: 'worktree', id: worktreeId });
  };

  const findLinkedWorktree = (issueKey: string): string | null => {
    const suffix = `/browse/${issueKey}`;
    const wt = worktrees.find((w) => w.jiraUrl?.endsWith(suffix));
    return wt?.id ?? null;
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
              onTabChange={setActiveCreateTab}
            />
            {activeCreateTab === 'branch' ? (
              <WorktreeList
                worktrees={worktrees}
                selectedId={selection?.type === 'worktree' ? selection.id : null}
                onSelect={(id) => setSelection({ type: 'worktree', id })}
              />
            ) : (
              <JiraIssueList
                issues={jiraIssues}
                selectedKey={selection?.type === 'jira' ? selection.key : null}
                onSelect={(key) => setSelection({ type: 'jira', key })}
                isLoading={jiraIssuesLoading}
                error={jiraError}
                searchQuery={jiraSearchQuery}
                onSearchChange={setJiraSearchQuery}
              />
            )}
          </aside>

          {/* Right panel */}
          <main className={`flex-1 min-w-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}>
            {selection?.type === 'jira' ? (
              <JiraDetailPanel
                issueKey={selection.key}
                linkedWorktreeId={findLinkedWorktree(selection.key)}
                onCreateWorktree={handleCreateWorktreeFromJira}
                onViewWorktree={handleViewWorktreeFromJira}
              />
            ) : (
              <DetailPanel
                worktree={selectedWorktree}
                onUpdate={refetch}
                onDeleted={handleDeleted}
                onNavigateToIntegrations={() => setActiveView('integrations')}
              />
            )}
          </main>
        </div>
      )}

      {activeView === 'configuration' && (
        <div className="flex-1 flex flex-col min-h-0 p-4 pt-3">
          <ConfigurationPanel config={config} onSaved={refetchConfig} />
        </div>
      )}

      {activeView === 'integrations' && (
        <div className="flex-1 flex flex-col min-h-0 p-4 pt-3">
          <IntegrationsPanel />
        </div>
      )}
    </div>
  );
}
