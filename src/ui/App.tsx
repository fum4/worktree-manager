import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

import { ConfigurationPanel } from './components/ConfigurationPanel';
import { CreateForm } from './components/CreateForm';
import { DetailPanel } from './components/detail/DetailPanel';
import { GitHubSetupModal } from './components/GitHubSetupModal';
import { JiraDetailPanel } from './components/detail/JiraDetailPanel';
import { Header } from './components/Header';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { IssueList } from './components/IssueList';
import type { View } from './components/NavBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WorktreeList } from './components/WorktreeList';
import { createGitHubRepo, createInitialCommit } from './hooks/api';
import { useConfig } from './hooks/useConfig';
import { useJiraIssues } from './hooks/useJiraIssues';
import { useGitHubStatus, useJiraStatus, usePorts, useWorktrees } from './hooks/useWorktrees';
import { border, errorBanner, input, surface, text } from './theme';

type Selection =
  | { type: 'worktree'; id: string }
  | { type: 'issue'; key: string }
  | null;

export default function App() {
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { ports, refetchPorts } = usePorts();
  const { config, projectName, isLoading: configLoading, refetch: refetchConfig } = useConfig();
  const { jiraStatus, refetchJiraStatus } = useJiraStatus();
  const githubStatus = useGitHubStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  // Show welcome screen if no config is loaded (no .wok3 directory)
  const showWelcomeScreen = !configLoading && !config;

  const handleImportProject = () => {
    // For now, redirect to configuration panel
    // In the future, this could open a native folder picker (in Electron)
    // or trigger an init flow
    window.location.href = '/init';
  };

  const [activeView, setActiveView] = useState<View>('workspace');

  const [selection, setSelection] = useState<Selection>(null);
  const [activeCreateTab, setActiveCreateTab] = useState<'branch' | 'issues'>('branch');
  const [createFormExpanded, setCreateFormExpanded] = useState(() => {
    const saved = localStorage.getItem('wok3:sidebarExpanded');
    if (saved !== null) return saved === 'true';
    return worktrees.length === 0;
  });
  const [worktreeFilter, setWorktreeFilter] = useState('');

  // Persist sidebar expanded state to localStorage
  useEffect(() => {
    localStorage.setItem('wok3:sidebarExpanded', String(createFormExpanded));
  }, [createFormExpanded]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const needsCommit = githubStatus?.hasCommits === false;
  const needsRepo = githubStatus?.installed && githubStatus?.authenticated && !githubStatus?.repo;

  const handleSetupNeeded = () => {
    setShowSetupModal(true);
  };

  const handleAutoSetup = async (options: { commitMessage: string; repoPrivate: boolean }) => {
    setShowSetupModal(false);
    setSetupError(null);

    try {
      // Step 1: Create initial commit if needed
      if (needsCommit) {
        const commitResult = await createInitialCommit();
        if (!commitResult.success) {
          setSetupError(commitResult.error ?? 'Failed to create commit');
          return;
        }
      }

      // Step 2: Create repo if needed
      if (needsRepo || needsCommit) {
        const repoResult = await createGitHubRepo(options.repoPrivate);
        if (!repoResult.success) {
          setSetupError(repoResult.error ?? 'Failed to create repository');
          return;
        }
      }

      // Refresh status after setup
      window.location.reload();
    } catch {
      setSetupError('Setup failed unexpectedly');
    }
  };

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

  const handlePortsDiscovered = () => {
    refetchPorts();
    refetchConfig();
  };

  // Show welcome screen when no config
  if (showWelcomeScreen) {
    return (
      <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
        <WelcomeScreen onImportProject={handleImportProject} />
      </div>
    );
  }

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
          onPortsDiscovered={handlePortsDiscovered}
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
          {activeView === 'workspace' && (
            <div
              className="absolute inset-0 flex gap-3 p-4"
            >
              {/* Left sidebar */}
              <aside
                className={`w-[300px] flex-shrink-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
              >
                <CreateForm
                  onCreated={refetch}
                  jiraConfigured={jiraStatus?.configured ?? false}
                  defaultProjectKey={jiraStatus?.defaultProjectKey ?? null}
                  activeTab={activeCreateTab}
                  onTabChange={setActiveCreateTab}
                  isExpanded={createFormExpanded}
                  onExpandedChange={setCreateFormExpanded}
                  onSetupNeeded={handleSetupNeeded}
                />

                {/* Shared search bar - outside AnimatePresence to prevent animation */}
                {createFormExpanded && (
                  <div className={`px-3 py-2 border-b ${border.subtle}`}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={activeCreateTab === 'branch' ? worktreeFilter : jiraSearchQuery}
                        onChange={(e) =>
                          activeCreateTab === 'branch'
                            ? setWorktreeFilter(e.target.value)
                            : setJiraSearchQuery(e.target.value)
                        }
                        placeholder={activeCreateTab === 'branch' ? 'Filter worktrees...' : 'Search issues...'}
                        className={`flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md ${input.text} placeholder-[#4b5563] text-xs focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`}
                      />
                      {activeCreateTab === 'issues' && (
                        <button
                          type="button"
                          onClick={() => refetchJiraIssues()}
                          title={jiraIssuesUpdatedAt ? `Last refreshed: ${formatTimeAgo(jiraIssuesUpdatedAt)}` : 'Refresh'}
                          className={`flex-shrink-0 p-1.5 rounded-md ${text.muted} hover:${text.secondary} hover:bg-white/[0.06] transition-all duration-150`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className={`w-3.5 h-3.5 ${jiraIssuesFetching && jiraIssues.length > 0 ? 'animate-spin' : ''}`}
                          >
                            <path
                              fillRule="evenodd"
                              d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.681.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-.908l.84.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44.908l-.84-.84v1.456a.75.75 0 0 1-1.5 0V9.341a.75.75 0 0 1 .75-.75h3.182a.75.75 0 0 1 0 1.5h-1.37l.84.841a4.5 4.5 0 0 0 7.08-.681.75.75 0 0 1 1.024-.274Z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <AnimatePresence mode="wait" initial={false}>
                  {activeCreateTab === 'branch' ? (
                    <motion.div
                      key="worktree-list"
                      className="flex-1 min-h-0 flex flex-col"
                      initial={{ opacity: 0, x: -40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.075, ease: 'easeInOut' }}
                    >
                      <WorktreeList
                        worktrees={worktrees}
                        selectedId={selection?.type === 'worktree' ? selection.id : null}
                        onSelect={(id) => setSelection({ type: 'worktree', id })}
                        filter={worktreeFilter}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="issue-list"
                      className="flex-1 min-h-0 flex flex-col"
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ duration: 0.075, ease: 'easeInOut' }}
                    >
                      <IssueList
                        issues={jiraIssues}
                        selectedKey={selection?.type === 'issue' ? selection.key : null}
                        onSelect={(key) => setSelection({ type: 'issue', key })}
                        isLoading={jiraIssuesLoading}
                        isFetching={jiraIssuesFetching}
                        error={jiraError}
                        worktrees={worktrees}
                        onViewWorktree={handleViewWorktreeFromJira}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </aside>

              {/* Right panel */}
              <main
                className={`flex-1 min-w-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
              >
                {selection?.type === 'issue' ? (
                  <JiraDetailPanel
                    issueKey={selection.key}
                    linkedWorktreeId={findLinkedWorktree(selection.key)}
                    onCreateWorktree={handleCreateWorktreeFromJira}
                    onViewWorktree={handleViewWorktreeFromJira}
                    refreshIntervalMinutes={refreshIntervalMinutes}
                    onSetupNeeded={handleSetupNeeded}
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
            <div className="absolute inset-0 flex flex-col p-4">
              <ConfigurationPanel config={config} onSaved={refetchConfig} />
            </div>
          )}

          {activeView === 'integrations' && (
            <div className="absolute inset-0 flex flex-col p-4">
              <IntegrationsPanel onJiraStatusChange={refetchJiraStatus} />
            </div>
          )}
      </div>

      {/* Setup error banner */}
      {setupError && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 ${errorBanner.bg} ${text.errorBanner} text-xs rounded-lg shadow-lg`}>
          {setupError}
        </div>
      )}

      {/* GitHub setup modal */}
      {showSetupModal && (
        <GitHubSetupModal
          needsCommit={needsCommit ?? false}
          needsRepo={needsRepo ?? false}
          onAutoSetup={handleAutoSetup}
          onManual={() => setShowSetupModal(false)}
        />
      )}
    </div>
  );
}
