import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { ConfigurationPanel } from './components/ConfigurationPanel';
import { CreateForm } from './components/CreateForm';
import { CreateWorktreeModal } from './components/CreateWorktreeModal';
import { DetailPanel } from './components/detail/DetailPanel';
import { GitHubSetupModal } from './components/GitHubSetupModal';
import { JiraDetailPanel } from './components/detail/JiraDetailPanel';
import { LinearDetailPanel } from './components/detail/LinearDetailPanel';
import { Header } from './components/Header';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { IssueList } from './components/IssueList';
import { ProjectSetupScreen } from './components/ProjectSetupScreen';
import { ResizableHandle } from './components/ResizableHandle';
import { SetupCommitModal } from './components/SetupCommitModal';
import type { View } from './components/NavBar';
import { TabBar } from './components/TabBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { WorktreeList } from './components/WorktreeList';
import { useServer } from './contexts/ServerContext';
import { useApi } from './hooks/useApi';
import { useConfig } from './hooks/useConfig';
import { useJiraIssues } from './hooks/useJiraIssues';
import { useLinearIssues } from './hooks/useLinearIssues';
import { useGitHubStatus, useJiraStatus, useLinearStatus, useWorktrees } from './hooks/useWorktrees';
import { errorBanner, input, surface, text } from './theme';

type Selection =
  | { type: 'worktree'; id: string }
  | { type: 'issue'; key: string }
  | { type: 'linear-issue'; identifier: string }
  | null;

export default function App() {
  const api = useApi();
  const { projects, activeProject, isElectron, selectFolder, openProject, serverUrl } = useServer();
  const { worktrees, isConnected, error, refetch } = useWorktrees();
  const { config, projectName, isLoading: configLoading, refetch: refetchConfig } = useConfig();
  const { jiraStatus, refetchJiraStatus } = useJiraStatus();
  const { linearStatus, refetchLinearStatus } = useLinearStatus();
  const githubStatus = useGitHubStatus();
  const runningCount = worktrees.filter((w) => w.status === 'running').length;

  // Track if config existed when we first connected (to detect "deleted while open")
  const [hadConfigOnConnect, setHadConfigOnConnect] = useState<boolean | null>(null);
  const [isAutoInitializing, setIsAutoInitializing] = useState(false);

  // Track config state for setup screen logic
  useEffect(() => {
    if (configLoading || !serverUrl) return;

    // First time we see config status for this connection
    if (hadConfigOnConnect === null) {
      setHadConfigOnConnect(!!config);

      // If no config and this is Electron, check if we should auto-init
      if (!config && isElectron) {
        window.electronAPI?.getSetupPreference().then(async (pref) => {
          if (pref === 'auto') {
            setIsAutoInitializing(true);
            try {
              const result = await api.initConfig({});
              if (result.success) {
                refetchConfig();
              }
            } finally {
              setIsAutoInitializing(false);
            }
          }
        });
      }
    }
  }, [configLoading, serverUrl, config, hadConfigOnConnect, isElectron]);

  // Reset hadConfigOnConnect when serverUrl changes (switching projects)
  useEffect(() => {
    setHadConfigOnConnect(null);
  }, [serverUrl]);

  // Show setup screen when:
  // - Config is missing AND we have a server connection (Electron mode)
  // - AND we're not auto-initializing
  // - AND (this is a new project without config OR config was deleted while open)
  const needsSetup = isElectron && serverUrl && !configLoading && !config && !isAutoInitializing;

  // In Electron mode with multi-project: show welcome when no projects
  // In web/single-project mode: show welcome when no config
  const showWelcomeScreen = isElectron
    ? projects.length === 0
    : !configLoading && !config;

  // Don't show main UI if we have projects but none running yet (still loading)
  const showLoadingState = isElectron && projects.length > 0 && !serverUrl;

  const handleSetupComplete = () => {
    refetchConfig();
    setHadConfigOnConnect(true);
  };

  const handleRememberChoice = (choice: 'auto' | 'manual') => {
    window.electronAPI?.setSetupPreference(choice);
  };

  const handleImportProject = async () => {
    if (isElectron) {
      const folderPath = await selectFolder();
      if (folderPath) {
        await openProject(folderPath);
      }
    } else {
      // For web mode, redirect to init
      window.location.href = '/init';
    }
  };

  const [activeView, setActiveView] = useState<View>('workspace');

  const [selection, setSelection] = useState<Selection>(null);
  const [activeCreateTab, setActiveCreateTab] = useState<'branch' | 'issues'>('branch');
  const [worktreeFilter, setWorktreeFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<'branch' | 'jira' | 'linear'>('branch');

  // Sidebar width state with persistence
  const DEFAULT_SIDEBAR_WIDTH = 300;
  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH = 500;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Try to load from localStorage first (works for both Electron and web)
    const saved = localStorage.getItem('wok3:sidebarWidth');
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
        return width;
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  // Load sidebar width from Electron preferences (overrides localStorage)
  useEffect(() => {
    if (isElectron) {
      window.electronAPI?.getSidebarWidth().then((width) => {
        if (width >= MIN_SIDEBAR_WIDTH && width <= MAX_SIDEBAR_WIDTH) {
          setSidebarWidth(width);
        }
      });
    }
  }, [isElectron]);

  const handleSidebarResize = (delta: number) => {
    setSidebarWidth((prev) => {
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, prev + delta));
      return newWidth;
    });
  };

  const handleSidebarResizeEnd = () => {
    // Persist to localStorage (always)
    localStorage.setItem('wok3:sidebarWidth', String(sidebarWidth));

    // Also persist to Electron preferences if available
    if (isElectron) {
      window.electronAPI?.setSidebarWidth(sidebarWidth);
    }
  };

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [showSetupCommitModal, setShowSetupCommitModal] = useState(false);
  const [configNeedsPush, setConfigNeedsPush] = useState(false);

  // Check if wok3 config files need to be committed when project loads
  useEffect(() => {
    if (!serverUrl || configLoading) return;

    api.fetchSetupStatus().then((status) => {
      setConfigNeedsPush(status.needsPush);
    }).catch(() => {
      // Ignore errors - this is a nice-to-have prompt
    });
  }, [serverUrl, configLoading]);

  const handleSetupCommit = async (message: string) => {
    await api.commitSetup(message);
    setShowSetupCommitModal(false);
    setConfigNeedsPush(false);
  };

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
        const commitResult = await api.createInitialCommit();
        if (!commitResult.success) {
          setSetupError(commitResult.error ?? 'Failed to create commit');
          return;
        }
      }

      // Step 2: Create repo if needed
      if (needsRepo || needsCommit) {
        const repoResult = await api.createGitHubRepo(options.repoPrivate);
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

  const linearEnabled = activeCreateTab === 'issues' && (linearStatus?.configured ?? false);
  const linearRefreshIntervalMinutes = linearStatus?.refreshIntervalMinutes ?? 5;
  const {
    issues: linearIssues,
    isLoading: linearIssuesLoading,
    isFetching: linearIssuesFetching,
    error: linearError,
    setSearchQuery: setLinearSearchQuery,
    refetch: refetchLinearIssues,
    dataUpdatedAt: linearIssuesUpdatedAt,
  } = useLinearIssues(linearEnabled, linearRefreshIntervalMinutes);

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

  const handleCreateWorktreeFromLinear = () => {
    setActiveCreateTab('branch');
    setSelection(null);
    refetch();
  };

  const handleViewWorktreeFromLinear = (worktreeId: string) => {
    setActiveCreateTab('branch');
    setSelection({ type: 'worktree', id: worktreeId });
  };

  const findLinkedLinearWorktree = (identifier: string): string | null => {
    const suffix = `/issue/${identifier}`;
    const wt = worktrees.find((w) => w.linearUrl?.includes(suffix));
    return wt?.id ?? null;
  };


  // Show welcome screen when no config (web mode) or no projects (Electron mode)
  if (showWelcomeScreen) {
    return (
      <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
        <div className="flex-1 flex items-center justify-center">
          <WelcomeScreen onImportProject={handleImportProject} />
        </div>
        <TabBar />
      </div>
    );
  }

  // Show loading state when we have projects but server isn't ready yet
  if (showLoadingState) {
    return (
      <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className={`text-sm ${text.muted}`}>
              Starting {activeProject?.name ?? 'project'}...
            </span>
          </div>
        </div>
        <TabBar />
      </div>
    );
  }

  // Show setup screen when config is missing (Electron only)
  if (needsSetup) {
    return (
      <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
        <ProjectSetupScreen
          projectName={projectName ?? activeProject?.name ?? null}
          onSetupComplete={handleSetupComplete}
          onRememberChoice={handleRememberChoice}
        />
        <TabBar />
      </div>
    );
  }

  // Show auto-init loading state
  if (isAutoInitializing) {
    return (
      <div className={`h-screen flex flex-col ${surface.page} ${text.body}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[#2dd4bf] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <span className={`text-sm ${text.muted}`}>
              Setting up {activeProject?.name ?? 'project'}...
            </span>
          </div>
        </div>
        <TabBar />
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
          runningCount={runningCount}
          activeView={activeView}
          onChangeView={setActiveView}
          configNeedsPush={configNeedsPush}
          onCommitConfig={() => setShowSetupCommitModal(true)}
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
              className="absolute inset-0 flex p-5"
            >
              {/* Left sidebar */}
              <aside
                style={{ width: sidebarWidth }}
                className={`flex-shrink-0 flex flex-col ${surface.panel} rounded-xl overflow-hidden`}
              >
                <CreateForm
                  jiraConfigured={jiraStatus?.configured ?? false}
                  linearConfigured={linearStatus?.configured ?? false}
                  activeTab={activeCreateTab}
                  onTabChange={setActiveCreateTab}
                  onCreateWorktree={() => {
                    setCreateModalMode('branch');
                    setShowCreateModal(true);
                  }}
                  onCreateFromJira={() => {
                    setCreateModalMode('jira');
                    setShowCreateModal(true);
                  }}
                  onCreateFromLinear={() => {
                    setCreateModalMode('linear');
                    setShowCreateModal(true);
                  }}
                  onNavigateToIntegrations={() => setActiveView('integrations')}
                />

                {/* Shared search bar */}
                <div className="px-3 py-2">
                    <input
                      type="text"
                      value={activeCreateTab === 'branch' ? worktreeFilter : jiraSearchQuery}
                      onChange={(e) => {
                        if (activeCreateTab === 'branch') {
                          setWorktreeFilter(e.target.value);
                        } else {
                          setJiraSearchQuery(e.target.value);
                          setLinearSearchQuery(e.target.value);
                        }
                      }}
                      placeholder={activeCreateTab === 'branch' ? 'Filter worktrees...' : 'Search issues...'}
                      className={`w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md ${input.text} placeholder-[#4b5563] text-xs focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`}
                    />
                </div>

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
                        onRefreshJira={() => refetchJiraIssues()}
                        jiraUpdatedAt={jiraIssuesUpdatedAt}
                        linearIssues={linearIssues}
                        linearConfigured={linearStatus?.configured ?? false}
                        linearLoading={linearIssuesLoading}
                        linearFetching={linearIssuesFetching}
                        linearError={linearError}
                        selectedLinearIdentifier={selection?.type === 'linear-issue' ? selection.identifier : null}
                        onSelectLinear={(identifier) => setSelection({ type: 'linear-issue', identifier })}
                        onRefreshLinear={() => refetchLinearIssues()}
                        linearUpdatedAt={linearIssuesUpdatedAt}
                        worktrees={worktrees}
                        onViewWorktree={handleViewWorktreeFromJira}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </aside>

              {/* Resize handle */}
              <div className="px-[9px]">
                <ResizableHandle
                  onResize={handleSidebarResize}
                  onResizeEnd={handleSidebarResizeEnd}
                />
              </div>

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
                ) : selection?.type === 'linear-issue' ? (
                  <LinearDetailPanel
                    identifier={selection.identifier}
                    linkedWorktreeId={findLinkedLinearWorktree(selection.identifier)}
                    onCreateWorktree={handleCreateWorktreeFromLinear}
                    onViewWorktree={handleViewWorktreeFromLinear}
                    refreshIntervalMinutes={linearRefreshIntervalMinutes}
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
              <ConfigurationPanel config={config} onSaved={refetchConfig} isConnected={isConnected} />
            </div>
          )}

          {activeView === 'integrations' && (
            <div className="absolute inset-0 flex flex-col p-4">
              <IntegrationsPanel onJiraStatusChange={refetchJiraStatus} onLinearStatusChange={refetchLinearStatus} />
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

      {/* Setup commit modal for wok3 config files */}
      {showSetupCommitModal && (
        <SetupCommitModal
          onCommit={handleSetupCommit}
          onSkip={() => setShowSetupCommitModal(false)}
        />
      )}

      {/* Create worktree modal */}
      {showCreateModal && (
        <CreateWorktreeModal
          mode={createModalMode}
          onCreated={refetch}
          onClose={() => setShowCreateModal(false)}
          onSetupNeeded={handleSetupNeeded}
        />
      )}

      {/* Tab bar for multi-project (Electron only) */}
      <TabBar />
    </div>
  );
}
