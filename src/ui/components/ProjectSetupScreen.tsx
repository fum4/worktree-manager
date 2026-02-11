import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, ChevronDown, GitBranch, GitCommit, Link, ListTodo, Loader2, Plug, Settings, Sparkles } from 'lucide-react';

import { APP_NAME, CONFIG_DIR_NAME } from '../../constants';
import { useApi } from '../hooks/useApi';
import type { DetectedConfig } from '../hooks/api';
import { button, input, surface, text } from '../theme';
import { AGENT_CONFIGS, type AgentId, type McpScope } from '../agent-configs';

interface ProjectSetupScreenProps {
  projectName: string | null;
  onSetupComplete: () => void;
  onRememberChoice?: (choice: 'auto' | 'manual') => void;
  onCreateWorktree?: () => void;
  onCreateTask?: () => void;
  onNavigateToIntegrations?: () => void;
  onNavigateToAgents?: () => void;
}

type SetupMode = 'choice' | 'manual' | 'agents' | 'commit-prompt' | 'getting-started';

export function ProjectSetupScreen({
  projectName,
  onSetupComplete,
  onRememberChoice,
  onCreateWorktree,
  onCreateTask,
  onNavigateToIntegrations,
  onNavigateToAgents,
}: ProjectSetupScreenProps) {
  const api = useApi();
  const [mode, setMode] = useState<SetupMode>('choice');
  const [rememberChoice, setRememberChoice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form values for manual setup
  const [detectedConfig, setDetectedConfig] = useState<DetectedConfig | null>(null);
  const [formValues, setFormValues] = useState<DetectedConfig>({
    baseBranch: 'origin/main',
    startCommand: 'npm run dev',
    installCommand: 'npm install',
  });
  const [showAll, setShowAll] = useState(false);
  const [extraValues, setExtraValues] = useState({
    projectDir: '',
    autoInstall: true,
    localIssuePrefix: 'LOCAL',
  });

  // Commit message for the commit prompt
  const [commitMessage, setCommitMessage] = useState(`chore: initialize ${APP_NAME} configuration`);

  // Agents step state
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { global?: boolean; project?: boolean }>>({});
  const [agentDesired, setAgentDesired] = useState<Record<string, { global: boolean; project: boolean }>>({});
  const [agentsApplying, setAgentsApplying] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const hasAgentChanges = useMemo(() => {
    for (const agent of AGENT_CONFIGS) {
      const desired = agentDesired[agent.id];
      const current = agentStatuses[agent.id];
      if (!desired) continue;
      for (const scope of ['global', 'project'] as McpScope[]) {
        if (desired[scope] !== (current?.[scope] === true)) return true;
      }
    }
    return false;
  }, [agentDesired, agentStatuses]);

  // Load detected config on mount
  useEffect(() => {
    api.detectConfig().then((result) => {
      if (result.success && result.config) {
        setDetectedConfig(result.config);
        setFormValues(result.config);
      }
    });
  }, []);

  // Fetch agent statuses when entering agents step
  useEffect(() => {
    if (mode === 'agents') {
      api.fetchMcpStatus().then((result) => {
        setAgentStatuses(result.statuses);
        const desired: Record<string, { global: boolean; project: boolean }> = {};
        for (const agent of AGENT_CONFIGS) {
          desired[agent.id] = {
            global: result.statuses[agent.id]?.global === true,
            project: result.statuses[agent.id]?.project === true,
          };
        }
        setAgentDesired(desired);
      });
    }
  }, [mode]);

  const handleAutoSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.initConfig({});
      if (result.success) {
        if (rememberChoice) {
          onRememberChoice?.('auto');
        }
        setMode('agents');
      } else {
        setError(result.error ?? 'Failed to initialize config');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize config');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSetup = () => {
    setMode('manual');
  };

  const handleManualSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.initConfig({ ...formValues, ...extraValues });
      if (result.success) {
        if (rememberChoice) {
          onRememberChoice?.('manual');
        }
        setMode('agents');
      } else {
        setError(result.error ?? 'Failed to initialize config');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize config');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setMode('choice');
    setError(null);
  };

  const handleAgentsSetup = async () => {
    const changes: { agentId: AgentId; scope: McpScope; action: 'setup' | 'remove' }[] = [];

    for (const agent of AGENT_CONFIGS) {
      const desired = agentDesired[agent.id];
      const current = agentStatuses[agent.id];
      if (!desired) continue;

      for (const scope of ['global', 'project'] as McpScope[]) {
        const wantEnabled = desired[scope];
        const isEnabled = current?.[scope] === true;
        if (wantEnabled && !isEnabled) changes.push({ agentId: agent.id, scope, action: 'setup' });
        if (!wantEnabled && isEnabled) changes.push({ agentId: agent.id, scope, action: 'remove' });
      }
    }

    if (changes.length === 0) {
      setMode('commit-prompt');
      return;
    }

    setAgentsApplying(true);
    setAgentsError(null);

    const errors: string[] = [];
    for (const { agentId, scope, action } of changes) {
      const result = action === 'setup'
        ? await api.setupMcpAgent(agentId, scope)
        : await api.removeMcpAgent(agentId, scope);
      if (!result.success) {
        const agent = AGENT_CONFIGS.find((a) => a.id === agentId)!;
        errors.push(`${agent.name} (${scope}): ${result.error ?? 'failed'}`);
      }
    }

    setAgentsApplying(false);

    if (errors.length > 0) {
      setAgentsError(errors.join(', '));
    } else {
      setMode('commit-prompt');
    }
  };

  const handleCommitConfig = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.commitSetup(commitMessage.trim());
      if (result.success) {
        setMode('getting-started');
      } else {
        setError(result.error ?? 'Failed to commit config');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to commit config');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipCommit = () => {
    setMode('getting-started');
  };

  if (mode === 'getting-started') {
    const actions = [
      { icon: GitBranch, color: 'text-[#2dd4bf]', bg: 'from-[#2dd4bf]/15 to-[#2dd4bf]/5', label: 'Create a worktree', desc: 'Branch off and start developing in isolation', onClick: () => { onSetupComplete(); onCreateWorktree?.(); } },
      { icon: ListTodo, color: 'text-amber-400', bg: 'from-amber-400/15 to-amber-400/5', label: 'Create a task', desc: 'Track work with local issues', onClick: () => { onSetupComplete(); onCreateTask?.(); } },
      { icon: Link, color: 'text-blue-400', bg: 'from-blue-400/15 to-blue-400/5', label: 'Connect integrations', desc: 'Pull issues from Jira or Linear', onClick: () => { onSetupComplete(); onNavigateToIntegrations?.(); } },
      { icon: Bot, color: 'text-purple-400', bg: 'from-purple-400/15 to-purple-400/5', label: 'Set up AI agents', desc: 'Connect Claude or other coding agents', onClick: () => { onSetupComplete(); onNavigateToAgents?.(); } },
    ];

    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md w-full">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2dd4bf]/20 to-[#2dd4bf]/5 mb-4">
              <Sparkles className="w-8 h-8 text-[#2dd4bf]" />
            </div>
            <h1 className={`text-xl font-semibold ${text.primary} mb-2`}>
              You're all set!
            </h1>
            <p className={`text-sm ${text.secondary} leading-relaxed`}>
              What would you like to do first?
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className={`group flex items-center gap-3.5 w-full p-4 rounded-xl ${surface.panel} border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-200 text-left`}
              >
                <div className={`flex-shrink-0 p-2 rounded-lg bg-gradient-to-br ${a.bg} flex items-center justify-center`}>
                  <a.icon className={`w-5 h-5 ${a.color}`} />
                </div>
                <div>
                  <h3 className={`text-sm font-medium ${text.primary} group-hover:text-white transition-colors mb-0.5`}>{a.label}</h3>
                  <p className={`text-xs ${text.muted} leading-relaxed`}>{a.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={onSetupComplete}
            className={`w-full py-2.5 rounded-xl text-sm font-medium ${button.primary} transition-colors`}
          >
            Go to workspace →
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'agents') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md w-full">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-purple-400">
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
            <h1 className={`text-xl font-semibold ${text.primary} mb-2`}>
              Connect Coding Agents
            </h1>
            <p className={`text-sm ${text.secondary} leading-relaxed`}>
              Set up MCP integration so your AI coding agents can
              <br />
              manage worktrees, start dev servers, and more.
            </p>
          </div>

          <div className="space-y-2 mb-6">
            {AGENT_CONFIGS.map((agent) => {
              const desired = agentDesired[agent.id];
              const globalOn = desired?.global ?? false;
              const projectOn = desired?.project ?? false;

              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg ${surface.panel} border border-white/[0.08]`}
                >
                  <span className={`text-xs font-medium ${text.primary} flex-1 text-left`}>{agent.name}</span>
                  <button
                    onClick={() => setAgentDesired((prev) => ({
                      ...prev,
                      [agent.id]: { ...prev[agent.id], global: !globalOn },
                    }))}
                    disabled={agentsApplying || !agent.global}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      globalOn
                        ? 'bg-[#2dd4bf]/10 hover:bg-[#2dd4bf]/15'
                        : 'bg-white/[0.03] hover:bg-white/[0.06]'
                    } disabled:opacity-40`}
                  >
                    <div className={`w-2 h-2 rounded-full ${globalOn ? 'bg-[#2dd4bf]' : 'bg-white/[0.15]'}`} />
                    <span className={globalOn ? 'text-[#2dd4bf]' : text.dimmed}>Global</span>
                  </button>
                  <button
                    onClick={() => setAgentDesired((prev) => ({
                      ...prev,
                      [agent.id]: { ...prev[agent.id], project: !projectOn },
                    }))}
                    disabled={agentsApplying || !agent.project}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      projectOn
                        ? 'bg-[#2dd4bf]/10 hover:bg-[#2dd4bf]/15'
                        : 'bg-white/[0.03] hover:bg-white/[0.06]'
                    } disabled:opacity-40`}
                  >
                    <div className={`w-2 h-2 rounded-full ${projectOn ? 'bg-[#2dd4bf]' : 'bg-white/[0.15]'}`} />
                    <span className={projectOn ? 'text-[#2dd4bf]' : text.dimmed}>Project</span>
                  </button>
                </div>
              );
            })}
          </div>

          {agentsError && (
            <p className={`mb-4 text-xs ${text.error}`}>{agentsError}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleAgentsSetup}
              disabled={agentsApplying || !hasAgentChanges}
              className={`w-full px-4 py-2.5 text-sm font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2`}
            >
              {agentsApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect Agents
                </>
              )}
            </button>
            <button
              onClick={() => setMode('commit-prompt')}
              disabled={agentsApplying}
              className={`w-full px-4 py-2 text-xs ${text.muted} hover:${text.secondary} transition-colors`}
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'commit-prompt') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2dd4bf]/20 to-[#2dd4bf]/5 mb-4">
              <Check className="w-8 h-8 text-[#2dd4bf]" />
            </div>
            <h1 className={`text-xl font-semibold ${text.primary} mb-2`}>
              Configuration Created
            </h1>
            <p className={`text-sm ${text.secondary} leading-relaxed`}>
              Your project is now configured. Commit and push the configuration
              <br />
              so it's available in all worktrees.
            </p>
          </div>

          <div className={`${surface.panel} rounded-xl border border-white/[0.08] p-4 mb-4 text-left`}>
            <div className="flex items-center gap-2 mb-3">
              <GitCommit className="w-4 h-4 text-[#2dd4bf]" />
              <span className={`text-xs font-medium ${text.primary}`}>Files to commit:</span>
            </div>
            <div className={`text-xs ${text.muted} font-mono space-y-1`}>
              <div>{CONFIG_DIR_NAME}/config.json</div>
              <div>{CONFIG_DIR_NAME}/.gitignore</div>
            </div>
          </div>

          <div className="mb-6 text-left">
            <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
              Commit message
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && commitMessage.trim()) handleCommitConfig(); }}
              className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
            />
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCommitConfig}
              disabled={isLoading || !commitMessage.trim()}
              className={`w-full px-4 py-2.5 text-sm font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <GitCommit className="w-4 h-4" />
                  Commit & Push
                </>
              )}
            </button>
            <button
              onClick={handleSkipCommit}
              disabled={isLoading}
              className={`w-full px-4 py-2 text-xs ${text.muted} hover:${text.secondary} transition-colors`}
            >
              Skip for now
            </button>
          </div>

          {error && (
            <p className={`mt-4 text-xs ${text.error}`}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'manual') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className={`w-full max-w-lg ${surface.panel} rounded-xl shadow-2xl border border-white/[0.08] overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/[0.06]">
                <Settings className="w-5 h-5 text-[#9ca3af]" />
              </div>
              <h2 className={`text-sm font-medium ${text.primary}`}>Configure Project</h2>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
                Base branch
              </label>
              <input
                type="text"
                value={formValues.baseBranch}
                onChange={(e) => setFormValues({ ...formValues, baseBranch: e.target.value })}
                className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
                placeholder="origin/main"
              />
              <p className={`mt-1 text-[11px] ${text.dimmed}`}>
                New worktrees will be created from this branch
              </p>
            </div>

            <div>
              <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
                Start command
              </label>
              <input
                type="text"
                value={formValues.startCommand}
                onChange={(e) => setFormValues({ ...formValues, startCommand: e.target.value })}
                className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
                placeholder="npm run dev"
              />
              <p className={`mt-1 text-[11px] ${text.dimmed}`}>
                Command to start the dev server
              </p>
            </div>

            <div>
              <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
                Install command
              </label>
              <input
                type="text"
                value={formValues.installCommand}
                onChange={(e) => setFormValues({ ...formValues, installCommand: e.target.value })}
                className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
                placeholder="npm install"
              />
              <p className={`mt-1 text-[11px] ${text.dimmed}`}>
                Command to install dependencies in new worktrees
              </p>
            </div>

            {/* Show all toggle */}
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className={`flex items-center gap-1.5 text-[11px] ${text.muted} hover:${text.secondary} transition-colors`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${showAll ? 'rotate-180' : ''}`} />
              {showAll ? 'Show less' : 'Show all options'}
            </button>

            {showAll && (
              <>
                <div>
                  <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
                    Project directory
                  </label>
                  <input
                    type="text"
                    value={extraValues.projectDir}
                    onChange={(e) => setExtraValues({ ...extraValues, projectDir: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
                    placeholder="(root)"
                  />
                  <p className={`mt-1 text-[11px] ${text.dimmed}`}>
                    Subdirectory to run commands in (leave empty for project root)
                  </p>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
                    Local issue prefix
                  </label>
                  <input
                    type="text"
                    value={extraValues.localIssuePrefix}
                    onChange={(e) => setExtraValues({ ...extraValues, localIssuePrefix: e.target.value })}
                    className={`w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`}
                    placeholder="LOCAL"
                  />
                  <p className={`mt-1 text-[11px] ${text.dimmed}`}>
                    Prefix for local issue identifiers (e.g. LOCAL-1). Leave empty for number only.
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer group py-1">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={extraValues.autoInstall}
                      onChange={(e) => setExtraValues({ ...extraValues, autoInstall: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`
                      w-4 h-4 rounded border transition-all duration-150
                      ${extraValues.autoInstall
                        ? 'bg-[#2dd4bf]/20 border-[#2dd4bf]/50'
                        : 'bg-white/[0.04] border-white/[0.1] group-hover:border-white/[0.2]'
                      }
                    `}>
                      {extraValues.autoInstall && (
                        <svg className="w-4 h-4 text-[#2dd4bf]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 8l3 3 5-6" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`text-xs font-medium ${text.muted} group-hover:${text.secondary} transition-colors`}>
                      Auto-install dependencies
                    </span>
                    <p className={`text-[11px] ${text.dimmed}`}>
                      Automatically run install command when creating worktrees
                    </p>
                  </div>
                </label>
              </>
            )}

            {error && (
              <p className={`text-[11px] ${text.error}`}>{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
            <button
              onClick={handleBack}
              className={`px-3 py-1.5 text-xs font-medium ${text.muted} hover:${text.secondary} rounded-lg hover:bg-white/[0.04] transition-colors`}
              disabled={isLoading}
            >
              Back
            </button>
            <button
              onClick={handleManualSubmit}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2`}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Initialize
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Choice mode - show two options
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2dd4bf]/20 to-[#2dd4bf]/5 mb-4">
            <Settings className="w-8 h-8 text-[#2dd4bf]" />
          </div>
          <h1 className={`text-xl font-semibold ${text.primary} mb-2`}>
            Set up {projectName ?? 'this project'}
          </h1>
          <p className={`text-sm ${text.secondary} leading-relaxed`}>
            This project is not configured yet.
            <br />
            Choose how you'd like to set it up.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {/* Auto-detect option */}
          <button
            onClick={handleAutoSetup}
            disabled={isLoading}
            className={`w-full p-4 rounded-xl ${surface.panel} border border-white/[0.08] hover:border-[#2dd4bf]/30 hover:bg-white/[0.04] transition-all text-left group`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#2dd4bf]/10 group-hover:bg-[#2dd4bf]/20 transition-colors">
                <Sparkles className="w-5 h-5 text-[#2dd4bf]" />
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${text.primary} mb-1`}>
                  Auto-detect settings
                </h3>
                <p className={`text-xs ${text.muted} leading-relaxed`}>
                  Automatically detect package manager, commands, and base branch
                  {detectedConfig && (
                    <span className="block mt-1 text-[#2dd4bf]/70">
                      Detected: {detectedConfig.startCommand}, {detectedConfig.installCommand}, {detectedConfig.baseBranch}
                    </span>
                  )}
                </p>
              </div>
              {isLoading && <Loader2 className="w-5 h-5 text-[#2dd4bf] animate-spin" />}
            </div>
          </button>

          {/* Manual setup option */}
          <button
            onClick={handleManualSetup}
            disabled={isLoading}
            className={`w-full p-4 rounded-xl ${surface.panel} border border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all text-left group`}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-white/[0.06] group-hover:bg-white/[0.1] transition-colors">
                <Settings className="w-5 h-5 text-[#9ca3af]" />
              </div>
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${text.primary} mb-1`}>
                  Manual setup
                </h3>
                <p className={`text-xs ${text.muted} leading-relaxed`}>
                  Review and customize settings before initialization
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Remember choice checkbox */}
        {onRememberChoice && (
          <button
            type="button"
            onClick={() => setRememberChoice(!rememberChoice)}
            className="mx-auto flex items-center justify-center gap-2 cursor-pointer group"
          >
            <div className={`
              w-4 h-4 rounded border transition-all duration-150
              ${rememberChoice
                ? 'bg-[#2dd4bf]/20 border-[#2dd4bf]/50'
                : 'bg-white/[0.04] border-white/[0.1] group-hover:border-white/[0.2]'
              }
            `}>
              {rememberChoice && (
                <svg
                  className="w-4 h-4 text-[#2dd4bf]"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 8l3 3 5-6" />
                </svg>
              )}
            </div>
            <span className={`text-xs ${text.muted} group-hover:${text.secondary} transition-colors`}>
              Remember my choice for future projects
            </span>
          </button>
        )}

        {error && (
          <p className={`mt-4 text-xs ${text.error}`}>{error}</p>
        )}
      </div>
    </div>
  );
}
