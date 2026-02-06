import { useEffect, useState } from 'react';
import { Loader2, Settings, Sparkles } from 'lucide-react';

import { useApi } from '../hooks/useApi';
import type { DetectedConfig } from '../hooks/api';
import { button, input, surface, text } from '../theme';

interface ProjectSetupScreenProps {
  projectName: string | null;
  onSetupComplete: () => void;
  onRememberChoice?: (choice: 'auto' | 'manual') => void;
}

type SetupMode = 'choice' | 'manual';

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
        onSetupComplete();
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
      const result = await api.initConfig(formValues);
      if (result.success) {
        if (rememberChoice) {
          onRememberChoice?.('manual');
        }
        onSetupComplete();
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
            This project doesn't have a wok3 configuration yet.
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
