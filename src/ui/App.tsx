import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { ConfigurationPanel } from './components/ConfigurationPanel';
import { CreateForm } from './components/CreateForm';
import { DetailPanel } from './components/detail/DetailPanel';
import { JiraDetailPanel } from './components/detail/JiraDetailPanel';
import { Header } from './components/Header';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { IssueList } from './components/IssueList';
import type { View } from './components/NavBar';
import { WorktreeList } from './components/WorktreeList';
import { useConfig } from './hooks/useConfig';
import { useJiraIssues } from './hooks/useJiraIssues';
import { useJiraStatus, usePorts, useWorktrees } from './hooks/useWorktrees';
import { errorBanner, surface, text } from './theme';

type Selection =
  | { type: 'worktree'; id: string }
  | { type: 'issue'; key: string }
  | null;

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const { config, projectName, refetch: refetchConfig } = useConfig();
  const jiraStatus = useJiraStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  const [activeView, setActiveView] = useState<View>('workspace');
  const [selection, setSelection] = useState<Selection>(null);
  const [activeCreateTab, setActiveCreateTab] = useState<'branch' | 'issues'>('branch');

  const jiraEnabled = activeCreateTab === 'issues' && (jiraStatus?.configured ?? false);
  const refreshIntervalMinutes = jiraStatus?.refreshIntervalMinutes ?? 5;
  const {
    issues: jiraIssues,
    isLoading: jiraIssuesLoading,
    isFetching: jiraIssuesFetching,
    error: jiraError,
    searchQuery: jiraSearchQuery,
    setSearchQuery: setJiraSearchQuery,
    refetch: refetchJiraIssues,
    dataUpdatedAt: jiraIssuesUpdatedAt,
  } = useJiraIssues(jiraEnabled, refreshIntervalMinutes);

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
      >
        <Header
          projectName={projectName}
          runningCount={runningCount}
          isConnected={isConnected}
          portsInfo={ports}
          onPortsDiscovered={refetchPorts}
          activeView={activeView}
          onChangeView={setActiveView}
        />
      </motion.div>

      {error && (
        <div className={`flex-shrink-0 px-4 py-2 ${errorBanner.bg} ${text.errorBanner} text-xs`}>
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {activeView === 'workspace' && (
            <motion.div
              key="workspace"
              className="absolute inset-0 flex gap-3 p-4"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              {/* Left sidebar */}
              <motion.aside
                className={`w-[300px] flex-shrink-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: 0.04 }}
              >
                <CreateForm
                  onCreated={refetch}
                  jiraConfigured={jiraStatus?.configured ?? false}
                  defaultProjectKey={jiraStatus?.defaultProjectKey ?? null}
                  activeTab={activeCreateTab}
                  onTabChange={setActiveCreateTab}
                />
                <AnimatePresence mode="wait">
                  {activeCreateTab === 'branch' ? (
                    <motion.div
                      key="worktree-list"
                      className="flex-1 min-h-0 flex flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.05 } }}
                      transition={{ duration: 0.1 }}
                    >
                      <WorktreeList
                        worktrees={worktrees}
                        selectedId={selection?.type === 'worktree' ? selection.id : null}
                        onSelect={(id) => setSelection({ type: 'worktree', id })}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="issue-list"
                      className="flex-1 min-h-0 flex flex-col"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.05 } }}
                      transition={{ duration: 0.1 }}
                    >
                      <IssueList
                        issues={jiraIssues}
                        selectedKey={selection?.type === 'issue' ? selection.key : null}
                        onSelect={(key) => setSelection({ type: 'issue', key })}
                        isLoading={jiraIssuesLoading}
                        isFetching={jiraIssuesFetching}
                        error={jiraError}
                        searchQuery={jiraSearchQuery}
                        onSearchChange={setJiraSearchQuery}
                        onRefresh={refetchJiraIssues}
                        dataUpdatedAt={jiraIssuesUpdatedAt}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.aside>

              {/* Right panel */}
              <motion.main
                className={`flex-1 min-w-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: 0.08 }}
              >
                {selection?.type === 'issue' ? (
                  <JiraDetailPanel
                    issueKey={selection.key}
                    linkedWorktreeId={findLinkedWorktree(selection.key)}
                    onCreateWorktree={handleCreateWorktreeFromJira}
                    onViewWorktree={handleViewWorktreeFromJira}
                    refreshIntervalMinutes={refreshIntervalMinutes}
                  />
                ) : (
                  <DetailPanel
                    worktree={selectedWorktree}
                    onUpdate={refetch}
                    onDeleted={handleDeleted}
                    onNavigateToIntegrations={() => setActiveView('integrations')}
                  />
                )}
              </motion.main>
            </motion.div>
          )}

          {activeView === 'configuration' && (
            <motion.div
              key="configuration"
              className="absolute inset-0 flex flex-col p-4"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <ConfigurationPanel config={config} onSaved={refetchConfig} />
            </motion.div>
          )}

          {activeView === 'integrations' && (
            <motion.div
              key="integrations"
              className="absolute inset-0 flex flex-col p-4"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
            >
              <IntegrationsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
