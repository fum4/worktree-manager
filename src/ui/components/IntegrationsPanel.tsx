import { Check, Copy, ExternalLink, Unplug, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { APP_NAME } from '../../constants';
import { useApi } from '../hooks/useApi';
import { fetchGitHubStatus, fetchJiraStatus, fetchLinearStatus } from '../hooks/api';
import { useGitHubStatus, useJiraStatus, useLinearStatus } from '../hooks/useWorktrees';
import { useServerUrlOptional } from '../contexts/ServerContext';
import type { GitHubStatus, JiraStatus, LinearStatus } from '../types';
import { button, infoBanner, input, settings, surface, text } from '../theme';
import { GitHubSetupModal } from './GitHubSetupModal';
import { Spinner } from './Spinner';

const integrationInput = `px-2.5 py-1.5 rounded-md text-xs bg-white/[0.04] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`;

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]' : 'bg-[#4b5563]'}`} />
  );
}

function StatusRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot active={ok} />
      <span className={`text-[11px] ${text.dimmed} w-10`}>{label}</span>
      <span className={`text-[11px] ${ok ? text.secondary : text.muted}`}>{value}</span>
    </div>
  );
}

function GitHubCard({ status, onStatusChange }: { status: GitHubStatus | null; onStatusChange: () => void }) {
  const api = useApi();
  const serverUrl = useServerUrlOptional();
  const isReady = status?.installed && status?.authenticated && status?.repo;
  const needsRepo = status?.installed && status?.authenticated && !status?.repo && status?.hasCommits;
  const needsCommit = status?.hasCommits === false;
  const needsSetup = needsCommit || needsRepo;
  const [loading, setLoading] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAutoSetup = async (options: { commitMessage: string; repoPrivate: boolean }) => {
    setShowSetupModal(false);
    setSettingUp(true);
    setFeedback(null);

    try {
      // Step 1: Create initial commit if needed
      if (needsCommit) {
        setFeedback({ type: 'success', message: 'Creating initial commit...' });
        const commitResult = await api.createInitialCommit();
        if (!commitResult.success) {
          setFeedback({ type: 'error', message: commitResult.error ?? 'Failed to create commit' });
          setSettingUp(false);
          return;
        }
      }

      // Step 2: Create repo if needed
      if (needsRepo || needsCommit) {
        setFeedback({ type: 'success', message: 'Creating GitHub repository...' });
        const repoResult = await api.createGitHubRepo(options.repoPrivate);
        if (!repoResult.success) {
          setFeedback({ type: 'error', message: repoResult.error ?? 'Failed to create repository' });
          setSettingUp(false);
          onStatusChange();
          return;
        }
        setFeedback({ type: 'success', message: `Created ${repoResult.repo}` });
      }

      onStatusChange();
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({ type: 'error', message: 'Setup failed unexpectedly' });
    }
    setSettingUp(false);
  };

  useEffect(() => {
    if (!waitingForAuth) return;
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchGitHubStatus(serverUrl);
        // Wait for both authenticated AND username to be set (server finished initializing)
        if (data?.authenticated && data.username) {
          setWaitingForAuth(false);
          setFeedback(null);
          onStatusChange();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waitingForAuth, onStatusChange, serverUrl]);

  useEffect(() => {
    if (status?.authenticated && waitingForAuth) {
      setWaitingForAuth(false);
    }
  }, [status?.authenticated, waitingForAuth]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API not available
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setFeedback(null);
    const result = await api.installGitHubCli();
    setLoading(false);
    if (result.success) {
      if (result.code) {
        await copyToClipboard(result.code);
        setFeedback({ type: 'success', message: `Code ${result.code} copied! Paste it in your browser.` });
        setWaitingForAuth(true);
      } else {
        setFeedback({ type: 'success', message: 'gh CLI installed' });
      }
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to install gh' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleLogin = async () => {
    setFeedback(null);
    const result = await api.loginGitHub();
    if (result.success && result.code) {
      await copyToClipboard(result.code);
      setFeedback({ type: 'success', message: `Code ${result.code} copied! Paste it in your browser.` });
      setWaitingForAuth(true);
    } else if (!result.success) {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to start login' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Card header with icon */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isReady ? 'bg-accent/10' : 'bg-white/[0.04]'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 ${isReady ? 'text-accent' : text.muted}`}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </div>
        <div>
          <h3 className={`text-xs font-semibold ${text.primary}`}>GitHub</h3>
          <span className={`text-[10px] ${isReady ? 'text-accent' : text.dimmed}`}>
            {isReady ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {/* Status rows */}
      {status === null ? (
        <span className={`flex items-center gap-2 text-xs ${text.muted}`}>
          <Spinner size="xs" />
          Loading...
        </span>
      ) : (
        <div className="flex flex-col gap-1.5">
          <StatusRow label="CLI" ok={status.installed} value={status.installed ? 'Installed' : 'Not installed'} />
          <StatusRow label="Auth" ok={status.authenticated} value={status.authenticated ? (status.username ?? 'Authenticated') : 'Not authenticated'} />
          <StatusRow
            label="Repo"
            ok={!!status.repo}
            value={status.repo ?? (status.authenticated ? 'Not linked' : '—')}
          />
        </div>
      )}

      {/* Help text */}
      {status && !isReady && !needsSetup && (
        <p className={`text-[11px] ${text.dimmed} leading-relaxed`}>
          {!status.installed
            ? 'Install the GitHub CLI to enable commits, pushes, and pull requests.'
            : 'Authenticate with GitHub to enable git operations.'}
        </p>
      )}

      {/* Repository setup needed */}
      {needsSetup && status?.authenticated && (
        <div className="flex flex-col gap-2">
          <p className={`text-[11px] text-orange-400 leading-relaxed`}>
            {needsCommit && needsRepo
              ? 'This project needs an initial commit and GitHub repository to enable worktrees.'
              : needsCommit
                ? 'This repository has no commits yet. Create an initial commit to enable worktrees.'
                : 'This project is not linked to a GitHub repository.'}
          </p>
          {!settingUp && (
            <button
              onClick={() => setShowSetupModal(true)}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} self-start transition-all duration-150 active:scale-[0.98]`}
            >
              Set Up Repository
            </button>
          )}
          {settingUp && (
            <span className={`flex items-center gap-2 text-[11px] ${text.muted}`}>
              <Spinner size="xs" />
              Setting up...
            </span>
          )}
        </div>
      )}

      {feedback && (
        <span className={`text-[11px] ${feedback.type === 'success' ? 'text-accent' : text.error}`}>
          {feedback.message}
        </span>
      )}

      {/* Actions */}
      {status && !status.installed && !waitingForAuth && (
        <button
          onClick={handleConnect}
          disabled={loading}
          className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 self-start transition-all duration-150 active:scale-[0.98]`}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Spinner size="xs" />
              Installing...
            </span>
          ) : 'Install & Connect'}
        </button>
      )}

      {status && status.installed && !status.authenticated && !waitingForAuth && (
        <button
          onClick={handleLogin}
          disabled={waitingForAuth}
          className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 self-start transition-all duration-150 active:scale-[0.98]`}
        >
          Authenticate
        </button>
      )}


      {/* Logout option */}
      {status?.authenticated && !waitingForAuth && !settingUp && (
        <button
          onClick={async () => {
            setLoading(true);
            setFeedback(null);
            const result = await api.logoutGitHub();
            setLoading(false);
            if (result.success) {
              onStatusChange();
            } else {
              setFeedback({ type: 'error', message: result.error ?? 'Failed to logout' });
              setTimeout(() => setFeedback(null), 4000);
            }
          }}
          disabled={loading}
          className={`flex items-center gap-1 text-[11px] ${text.muted} hover:text-red-400 disabled:opacity-50 transition-colors duration-150 self-start`}
        >
          <Unplug className="w-3 h-3" />
          Disconnect
        </button>
      )}

      {/* Setup modal */}
      {showSetupModal && (
        <GitHubSetupModal
          needsCommit={needsCommit ?? false}
          needsRepo={!status?.repo}
          onAutoSetup={handleAutoSetup}
          onManual={() => setShowSetupModal(false)}
        />
      )}
    </div>
  );
}

function JiraCard({
  status,
  onStatusChange,
}: {
  status: JiraStatus | null;
  onStatusChange: () => void;
}) {
  const api = useApi();
  const [showSetup, setShowSetup] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (status?.defaultProjectKey) {
      setProjectKey(status.defaultProjectKey);
    }
    if (status?.refreshIntervalMinutes) {
      setRefreshInterval(status.refreshIntervalMinutes);
    }
  }, [status?.defaultProjectKey, status?.refreshIntervalMinutes]);

  const handleConnect = async () => {
    if (!baseUrl || !email || !token) return;
    setSaving(true);
    setFeedback(null);
    const result = await api.setupJira(baseUrl, email, token);
    setSaving(false);
    if (result.success) {
      setShowSetup(false);
      setBaseUrl('');
      setEmail('');
      setToken('');
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to connect' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDisconnect = async () => {
    setSaving(true);
    const result = await api.disconnectJira();
    setSaving(false);
    if (result.success) {
      onStatusChange();
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await api.updateJiraConfig(projectKey, refreshInterval);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Settings saved' });
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to save' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const isConfigured = status?.configured ?? false;

  return (
    <div className="flex flex-col gap-4">
      {/* Card header with icon */}
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigured ? 'bg-blue-500/10' : 'bg-white/[0.04]'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-4 h-4 ${isConfigured ? 'text-blue-400' : text.muted}`}>
            <path d="M11.53 2.3A1 1 0 0 0 9.47 2.3L1.59 10.18a1 1 0 0 0 0 1.41l3.87 3.88a1 1 0 0 0 1.41 0L12 10.34l5.13 5.13a1 1 0 0 0 1.41 0l3.87-3.88a1 1 0 0 0 0-1.41L11.53 2.3ZM12 13.47L8.53 10 12 6.53 15.47 10 12 13.47Z" />
          </svg>
        </div>
        <div>
          <h3 className={`text-xs font-semibold ${text.primary}`}>Jira</h3>
          <span className={`text-[10px] ${isConfigured ? 'text-blue-400' : text.dimmed}`}>
            {isConfigured ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {status === null ? (
        <span className={`flex items-center gap-2 text-xs ${text.muted}`}>
          <Spinner size="xs" />
          Loading...
        </span>
      ) : isConfigured ? (
        <div className="flex flex-col gap-3">
          {status.domain && <StatusRow label="Domain" ok={true} value={status.domain} />}
          {status.email && <StatusRow label="Email" ok={true} value={status.email} />}

          <div className="flex gap-3 items-end mt-2">
            <div className="flex flex-col gap-1.5 w-28">
              <label className={`text-[10px] ${settings.label}`}>Project Key</label>
              <input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="PROJ"
                className={integrationInput}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-28">
              <label className={`text-[10px] ${settings.label}`}>Refresh (min)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                className={integrationInput}
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={saving || (projectKey === (status.defaultProjectKey ?? '') && refreshInterval === (status.refreshIntervalMinutes ?? 5))}
              className={`text-[11px] px-2.5 py-1.5 rounded-md ${button.primary} disabled:opacity-50 transition-colors duration-150`}
            >
              Apply
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={saving}
            className={`flex items-center gap-1 text-[11px] ${text.muted} hover:text-red-400 disabled:opacity-50 transition-colors duration-150 self-start mt-2`}
          >
            <Unplug className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      ) : showSetup ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] ${settings.label}`}>Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className={integrationInput}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] ${settings.label}`}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={integrationInput}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] ${settings.label}`}>API Token</label>
            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your Jira API token"
                className={`${integrationInput} w-full pr-16`}
              />
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-medium bg-white/[0.06] text-[#9ca3af] hover:bg-white/[0.10] hover:text-white rounded transition-colors"
              >
                Create
              </a>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !baseUrl || !email || !token}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 transition-all duration-150 active:scale-[0.98]`}
            >
              {saving ? (
              <span className="flex items-center gap-1.5">
                <Spinner size="xs" />
                Connecting...
              </span>
            ) : 'Connect'}
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className={`text-[11px] px-3 py-1.5 rounded-md ${button.secondary} transition-colors duration-150`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className={`text-[11px] ${text.dimmed} leading-relaxed`}>
            Connect Jira to create worktrees directly from issues and track status.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} self-start transition-all duration-150 active:scale-[0.98]`}
          >
            Set up Jira
          </button>
        </div>
      )}

      {feedback && (
        <span
          className={`text-[11px] ${
            feedback.type === 'success' ? 'text-accent' : text.error
          }`}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}

function LinearCard({
  status,
  onStatusChange,
}: {
  status: LinearStatus | null;
  onStatusChange: () => void;
}) {
  const api = useApi();
  const [showSetup, setShowSetup] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [teamKey, setTeamKey] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (status?.defaultTeamKey) {
      setTeamKey(status.defaultTeamKey);
    }
    if (status?.refreshIntervalMinutes) {
      setRefreshInterval(status.refreshIntervalMinutes);
    }
  }, [status?.defaultTeamKey, status?.refreshIntervalMinutes]);

  const handleConnect = async () => {
    if (!apiKey) return;
    setSaving(true);
    setFeedback(null);
    const result = await api.setupLinear(apiKey);
    setSaving(false);
    if (result.success) {
      setShowSetup(false);
      setApiKey('');
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to connect' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleDisconnect = async () => {
    setSaving(true);
    const result = await api.disconnectLinear();
    setSaving(false);
    if (result.success) {
      onStatusChange();
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await api.updateLinearConfig(teamKey, refreshInterval);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Settings saved' });
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to save' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const isConfigured = status?.configured ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConfigured ? 'bg-[#5E6AD2]/10' : 'bg-white/[0.04]'}`}>
          <svg className={`w-4 h-4 ${isConfigured ? 'text-[#5E6AD2]' : text.muted}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
        <div>
          <h3 className={`text-xs font-semibold ${text.primary}`}>Linear</h3>
          <span className={`text-[10px] ${isConfigured ? 'text-[#5E6AD2]' : text.dimmed}`}>
            {isConfigured ? 'Connected' : 'Not connected'}
          </span>
        </div>
      </div>

      {status === null ? (
        <span className={`flex items-center gap-2 text-xs ${text.muted}`}>
          <Spinner size="xs" />
          Loading...
        </span>
      ) : isConfigured ? (
        <div className="flex flex-col gap-3">
          {status.displayName && <StatusRow label="User" ok={true} value={status.displayName} />}

          <div className="flex gap-3 items-end mt-2">
            <div className="flex flex-col gap-1.5 w-28">
              <label className={`text-[10px] ${settings.label}`}>Team Key</label>
              <input
                value={teamKey}
                onChange={(e) => setTeamKey(e.target.value.toUpperCase())}
                placeholder="ENG"
                className={integrationInput}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-28">
              <label className={`text-[10px] ${settings.label}`}>Refresh (min)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                className={integrationInput}
              />
            </div>
            <button
              onClick={handleSaveConfig}
              disabled={saving || (teamKey === (status.defaultTeamKey ?? '') && refreshInterval === (status.refreshIntervalMinutes ?? 5))}
              className={`text-[11px] px-2.5 py-1.5 rounded-md ${button.primary} disabled:opacity-50 transition-colors duration-150`}
            >
              Apply
            </button>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={saving}
            className={`flex items-center gap-1 text-[11px] ${text.muted} hover:text-red-400 disabled:opacity-50 transition-colors duration-150 self-start mt-2`}
          >
            <Unplug className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      ) : showSetup ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] ${settings.label}`}>API Key</label>
            <div className="relative">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="lin_api_..."
                className={`${integrationInput} w-full pr-16`}
              />
              <a
                href="https://linear.app/settings/account/security/api-keys/new"
                target="_blank"
                rel="noopener noreferrer"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-medium bg-white/[0.06] text-[#9ca3af] hover:bg-white/[0.10] hover:text-white rounded transition-colors"
              >
                Create
              </a>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !apiKey}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 transition-all duration-150 active:scale-[0.98]`}
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size="xs" />
                  Connecting...
                </span>
              ) : 'Connect'}
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className={`text-[11px] px-3 py-1.5 rounded-md ${button.secondary} transition-colors duration-150`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className={`text-[11px] ${text.dimmed} leading-relaxed`}>
            Connect Linear to create worktrees directly from issues and track status.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} self-start transition-all duration-150 active:scale-[0.98]`}
          >
            Set up Linear
          </button>
        </div>
      )}

      {feedback && (
        <span
          className={`text-[11px] ${
            feedback.type === 'success' ? 'text-accent' : text.error
          }`}
        >
          {feedback.message}
        </span>
      )}
    </div>
  );
}

type AgentId = 'claude' | 'gemini' | 'codex' | 'cursor' | 'vscode';
type McpScope = 'global' | 'project';

interface ScopeConfig {
  config: string;
  configPath: string;
}

interface AgentConfig {
  id: AgentId;
  name: string;
  docsUrl?: string;
  global?: ScopeConfig;
  project?: ScopeConfig;
}

const MCP_JSON_SNIPPET = `{
  "mcpServers": {
    "wok3": {
      "command": "wok3",
      "args": ["mcp"]
    }
  }
}`;

const AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
    global: { config: MCP_JSON_SNIPPET, configPath: '~/.claude/settings.json' },
    project: { config: MCP_JSON_SNIPPET, configPath: '.mcp.json' },
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    docsUrl: 'https://geminicli.com/docs/tools/mcp-server/',
    global: { config: MCP_JSON_SNIPPET, configPath: '~/.gemini/settings.json' },
    project: { config: MCP_JSON_SNIPPET, configPath: '.gemini/settings.json' },
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    docsUrl: 'https://developers.openai.com/codex/mcp/',
    global: {
      config: `[mcp_servers.wok3]\ncommand = "wok3"\nargs = ["mcp"]`,
      configPath: '~/.codex/config.toml',
    },
    project: {
      config: `[mcp_servers.wok3]\ncommand = "wok3"\nargs = ["mcp"]`,
      configPath: '.codex/config.toml',
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    docsUrl: 'https://docs.cursor.com/context/model-context-protocol',
    global: { config: MCP_JSON_SNIPPET, configPath: '~/.cursor/mcp.json' },
    project: { config: MCP_JSON_SNIPPET, configPath: '.cursor/mcp.json' },
  },
  {
    id: 'vscode',
    name: 'VS Code',
    docsUrl: 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
    global: {
      config: `{
  "mcp": {
    "servers": {
      "wok3": {
        "command": "wok3",
        "args": ["mcp"]
      }
    }
  }
}`,
      configPath: '~/Library/Application Support/Code/User/settings.json',
    },
    project: {
      config: `{
  "mcp": {
    "servers": {
      "wok3": {
        "command": "wok3",
        "args": ["mcp"]
      }
    }
  }
}`,
      configPath: '.vscode/settings.json',
    },
  },
];

function CodingAgentsCard() {
  const api = useApi();
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('claude');
  const [scope, setScope] = useState<McpScope>('global');
  const [copied, setCopied] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, { global?: boolean; project?: boolean }>>({});
  const [settingUp, setSettingUp] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const agent = AGENT_CONFIGS.find((a) => a.id === selectedAgent)!;
  const scopeConfig = agent[scope];
  const isConfigured = statuses[selectedAgent]?.[scope] === true;
  const hasGlobal = !!agent.global;
  const hasProject = !!agent.project;

  // Pick a valid scope when agent changes
  useEffect(() => {
    const a = AGENT_CONFIGS.find((c) => c.id === selectedAgent)!;
    if (!a[scope]) {
      setScope(a.global ? 'global' : 'project');
    }
  }, [selectedAgent, scope]);

  useEffect(() => {
    api.fetchMcpStatus().then((result) => {
      setStatuses(result.statuses);
    });
  }, [api]);

  const handleCopy = async () => {
    if (!scopeConfig) return;
    try {
      await navigator.clipboard.writeText(scopeConfig.config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleSetup = async () => {
    setSettingUp(true);
    setFeedback(null);
    const result = await api.setupMcpAgent(selectedAgent, scope);
    setSettingUp(false);
    if (result.success) {
      setStatuses((prev) => ({
        ...prev,
        [selectedAgent]: { ...prev[selectedAgent], [scope]: true },
      }));
      setFeedback({ type: 'success', message: `Added to ${scopeConfig!.configPath}` });
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Setup failed' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRemove = async () => {
    setSettingUp(true);
    setFeedback(null);
    const result = await api.removeMcpAgent(selectedAgent, scope);
    setSettingUp(false);
    if (result.success) {
      setStatuses((prev) => ({
        ...prev,
        [selectedAgent]: { ...prev[selectedAgent], [scope]: false },
      }));
      setFeedback({ type: 'success', message: `Removed from ${scopeConfig!.configPath}` });
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Remove failed' });
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Card header with icon */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-purple-400">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>
        <div>
          <h3 className={`text-xs font-semibold ${text.primary}`}>Coding Agents</h3>
          <span className={`text-[10px] text-purple-400`}>MCP Integration</span>
        </div>
      </div>

      <p className={`text-[11px] ${text.dimmed} leading-relaxed`}>
        Connect your AI coding agents to manage issues & worktrees, start/stop dev servers, and more.
      </p>

      {/* Agent tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {AGENT_CONFIGS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setSelectedAgent(a.id);
                setCopied(false);
                setFeedback(null);
              }}
              className={`relative px-2.5 py-1 rounded text-[10px] font-medium transition-colors duration-150 ${
                selectedAgent === a.id
                  ? 'text-white bg-white/[0.08]'
                  : `${text.muted} hover:text-[#9ca3af]`
              }`}
            >
              {a.name}
              {(statuses[a.id]?.global || statuses[a.id]?.project) && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          ))}
        </div>

        {/* Scope toggle */}
        {hasGlobal && hasProject && <div className="border-t border-white/[0.06]" />}
        {hasGlobal && hasProject && (
          <div className="flex gap-1">
            {(['global', 'project'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setScope(s); setCopied(false); setFeedback(null); }}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors duration-150 ${
                  scope === s
                    ? 'text-white bg-white/[0.08]'
                    : `${text.muted} hover:text-[#9ca3af]`
                }`}
              >
                {s === 'global' ? 'Global' : 'This project'}
                {statuses[selectedAgent]?.[s] && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1.5 align-middle" />
                )}
              </button>
            ))}
          </div>
        )}

        {scopeConfig && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] ${text.dimmed}`}>
                  {scopeConfig.configPath}
                </span>
                {isConfigured && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1 text-[10px] ${copied ? 'text-accent' : `${text.muted} hover:text-[#9ca3af]`} transition-colors duration-150`}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <pre className={`text-[10px] font-mono ${text.secondary} bg-white/[0.04] border border-white/[0.06] rounded-md p-3 overflow-x-auto`}>
              {scopeConfig.config}
            </pre>

            <div className="flex items-center gap-4">
              {feedback && (
                <span className={`text-[11px] ${feedback.type === 'success' ? 'text-accent' : text.error}`}>
                  {feedback.message}
                </span>
              )}
              <div className="flex items-center gap-4 ml-auto">
                {agent.docsUrl && (
                  <a
                    href={agent.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-1 text-[10px] ${text.muted} hover:text-[#9ca3af] transition-colors duration-150`}
                  >
                    View Docs
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {!isConfigured ? (
                  <button
                    onClick={handleSetup}
                    disabled={settingUp}
                    className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 transition-all duration-150 active:scale-[0.98]`}
                  >
                    {settingUp ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size="xs" />
                        Setting up...
                      </span>
                    ) : `Setup ${agent.name}`}
                  </button>
                ) : (
                  <button
                    onClick={handleRemove}
                    disabled={settingUp}
                    className={`flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-md font-medium ${button.secondary} disabled:opacity-50 transition-all duration-150 active:scale-[0.98]`}
                  >
                    <Unplug className="w-3 h-3" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 pt-1">
        <span className={`text-[10px] font-medium ${settings.label}`}>Available Tools</span>
        <div className="flex flex-wrap gap-1.5">
          {['list_worktrees', 'create_worktree', 'start', 'stop', 'commit', 'push', 'create_pr', 'get_logs'].map((tool) => (
            <span key={tool} className={`text-[9px] px-1.5 py-0.5 rounded ${text.secondary} bg-white/[0.06]`}>
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface IntegrationsPanelProps {
  onJiraStatusChange?: () => void;
  onLinearStatusChange?: () => void;
}

const BANNER_DISMISSED_KEY = `${APP_NAME}-integrations-banner-dismissed`;

export function IntegrationsPanel({ onJiraStatusChange, onLinearStatusChange }: IntegrationsPanelProps) {
  const serverUrl = useServerUrlOptional();
  const githubStatus = useGitHubStatus();
  const { jiraStatus } = useJiraStatus();
  const { linearStatus } = useLinearStatus();
  const [githubRefreshKey, setGithubRefreshKey] = useState(0);
  const [jiraRefreshKey, setJiraRefreshKey] = useState(0);
  const [linearRefreshKey, setLinearRefreshKey] = useState(0);
  const [showBanner, setShowBanner] = useState(() => {
    return localStorage.getItem(BANNER_DISMISSED_KEY) !== 'true';
  });

  const [currentGithubStatus, setCurrentGithubStatus] = useState<GitHubStatus | null>(null);
  const [currentJiraStatus, setCurrentJiraStatus] = useState<JiraStatus | null>(null);
  const [currentLinearStatus, setCurrentLinearStatus] = useState<LinearStatus | null>(null);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
  };

  useEffect(() => {
    setCurrentGithubStatus(githubStatus);
  }, [githubStatus]);

  useEffect(() => {
    setCurrentJiraStatus(jiraStatus);
  }, [jiraStatus]);

  useEffect(() => {
    setCurrentLinearStatus(linearStatus);
  }, [linearStatus]);

  useEffect(() => {
    if (githubRefreshKey === 0) return;
    fetchGitHubStatus(serverUrl)
      .then((d) => setCurrentGithubStatus(d))
      .catch(() => {});
  }, [githubRefreshKey, serverUrl]);

  useEffect(() => {
    if (jiraRefreshKey === 0) return;
    fetchJiraStatus(serverUrl)
      .then((d) => {
        setCurrentJiraStatus(d);
        onJiraStatusChange?.();
      })
      .catch(() => {});
  }, [jiraRefreshKey, onJiraStatusChange, serverUrl]);

  useEffect(() => {
    if (linearRefreshKey === 0) return;
    fetchLinearStatus(serverUrl)
      .then((d) => {
        setCurrentLinearStatus(d);
        onLinearStatusChange?.();
      })
      .catch(() => {});
  }, [linearRefreshKey, onLinearStatusChange, serverUrl]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-8">
        {showBanner && (
          <div className={`relative p-4 pl-5 pr-10 rounded-xl ${infoBanner.bg} border ${infoBanner.border}`}>
            <button
              onClick={dismissBanner}
              className={`absolute top-1/2 -translate-y-1/2 right-4 p-1 rounded-md ${infoBanner.textMuted} hover:${infoBanner.text} ${infoBanner.hoverBg} transition-colors`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <p className={`text-xs ${text.secondary} leading-relaxed`}>
              Connect external services to enhance your workflow.
            </p>
          </div>
        )}
        <div className={`rounded-xl ${surface.panel} border border-white/[0.08] p-5`}>
          <GitHubCard
            status={currentGithubStatus}
            onStatusChange={() => setGithubRefreshKey((k) => k + 1)}
          />
        </div>
        <div className={`rounded-xl ${surface.panel} border border-white/[0.08] p-5`}>
          <JiraCard
            status={currentJiraStatus}
            onStatusChange={() => setJiraRefreshKey((k) => k + 1)}
          />
        </div>
        <div className={`rounded-xl ${surface.panel} border border-white/[0.08] p-5`}>
          <LinearCard
            status={currentLinearStatus}
            onStatusChange={() => setLinearRefreshKey((k) => k + 1)}
          />
        </div>
        <div className={`rounded-xl ${surface.panel} border border-white/[0.08] p-5`}>
          <CodingAgentsCard />
        </div>
      </div>
    </div>
  );
}
