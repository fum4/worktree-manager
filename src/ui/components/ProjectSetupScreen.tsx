import { useEffect, useState } from 'react';
import { Check, ChevronDown, GitCommit, Loader2, Settings, Sparkles } from 'lucide-react';

import { APP_NAME, CONFIG_DIR_NAME } from '../../constants';
import { useApi } from '../hooks/useApi';
import type { DetectedConfig } from '../hooks/api';
import { button, input, surface, text } from '../theme';

interface ProjectSetupScreenProps {
  projectName: string | null;
  onSetupComplete: () => void;
  onRememberChoice?: (choice: 'auto' | 'manual') => void;
}

type SetupMode = 'choice' | 'manual' | 'commit-prompt';

export function ProjectSetupScreen({
  projectName,
  onSetupComplete,
  onRememberChoice,
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
    serverPort: 6969,
  });
  const [showAll, setShowAll] = useState(false);
  const [extraValues, setExtraValues] = useState({
    projectDir: '',
    autoInstall: true,
    localIssuePrefix: 'LOCAL',
  });

  // Commit message for the commit prompt
  const [commitMessage, setCommitMessage] = useState(`chore: initialize ${APP_NAME} configuration`);

  // Load detected config on mount
  useEffect(() => {
    api.detectConfig().then((result) => {
      if (result.success && result.config) {
        setDetectedConfig(result.config);
        setFormValues(result.config);
      }
    });
  }, []);

  const handleAutoSetup = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.initConfig({});
      if (result.success) {
        if (rememberChoice) {
          onRememberChoice?.('auto');
        }
        setMode('commit-prompt');
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
        setMode('commit-prompt');
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
        onSetupComplete();
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
    onSetupComplete();
  };

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
          <label className="flex items-center justify-center gap-2 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="sr-only peer"
              />
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
            </div>
            <span className={`text-xs ${text.muted} group-hover:${text.secondary} transition-colors`}>
              Remember my choice for future projects
            </span>
          </label>
        )}

        {error && (
          <p className={`mt-4 text-xs ${text.error}`}>{error}</p>
        )}
      </div>
    </div>
  );
}
