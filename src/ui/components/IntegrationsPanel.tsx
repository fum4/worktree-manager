import { useEffect, useRef, useState } from 'react';

import { disconnectJira, setupJira, updateJiraConfig } from '../hooks/useConfig';
import { installGitHubCli, loginGitHub } from '../hooks/api';
import { useGitHubStatus, useJiraStatus } from '../hooks/useWorktrees';
import type { GitHubStatus, JiraStatus } from '../types';
import { border, button, input, settings, surface, text } from '../theme';

const integrationInput = `px-2.5 py-1.5 rounded-md text-xs bg-white/[0.04] border border-accent/0 ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.06] focus:border-accent/30 transition-all duration-150`;

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
  const isReady = status?.installed && status?.authenticated;
  const [loading, setLoading] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!waitingForAuth) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/github/status');
        const data = await res.json();
        if (data.authenticated) {
          setWaitingForAuth(false);
          setFeedback({ type: 'success', message: 'Authenticated with GitHub' });
          onStatusChange();
          setTimeout(() => setFeedback(null), 4000);
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [waitingForAuth, onStatusChange]);

  useEffect(() => {
    if (status?.authenticated && waitingForAuth) {
      setWaitingForAuth(false);
    }
  }, [status?.authenticated, waitingForAuth]);

  const handleConnect = async () => {
    setLoading(true);
    setFeedback(null);
    const result = await installGitHubCli();
    setLoading(false);
    if (result.success) {
      const msg = result.code
        ? `Enter code ${result.code} in your browser`
        : 'gh CLI installed';
      setFeedback({ type: 'success', message: msg });
      if (result.code) setWaitingForAuth(true);
      onStatusChange();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to install gh' });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleLogin = async () => {
    setFeedback(null);
    const result = await loginGitHub();
    if (result.success && result.code) {
      setFeedback({ type: 'success', message: `Enter code ${result.code} in your browser` });
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
        <span className={`text-xs ${text.muted}`}>Loading...</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          <StatusRow label="CLI" ok={status.installed} value={status.installed ? 'Installed' : 'Not installed'} />
          <StatusRow label="Auth" ok={status.authenticated} value={status.authenticated ? 'Authenticated' : 'Not authenticated'} />
          {status.repo && (
            <StatusRow label="Repo" ok={true} value={status.repo} />
          )}
        </div>
      )}

      {/* Help text */}
      {status && !isReady && (
        <p className={`text-[11px] ${text.dimmed} leading-relaxed`}>
          {!status.installed
            ? 'Install the GitHub CLI to enable commits, pushes, and pull requests.'
            : 'Authenticate with GitHub to enable git operations.'}
        </p>
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
          {loading ? 'Installing...' : 'Install & Connect'}
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
  const [showSetup, setShowSetup] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (status?.defaultProjectKey) {
      setProjectKey(status.defaultProjectKey);
    }
  }, [status?.defaultProjectKey]);

  const handleConnect = async () => {
    if (!baseUrl || !email || !token) return;
    setSaving(true);
    setFeedback(null);
    const result = await setupJira(baseUrl, email, token);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Connected to Jira' });
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
    const result = await disconnectJira();
    setSaving(false);
    if (result.success) {
      onStatusChange();
    }
  };

  const handleSaveProjectKey = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await updateJiraConfig(projectKey);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Project key saved' });
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
        <span className={`text-xs ${text.muted}`}>Loading...</span>
      ) : isConfigured ? (
        <div className="flex flex-col gap-3">
          <StatusRow label="Auth" ok={true} value="API Token" />

          <div className="flex flex-col gap-1.5">
            <label className={`text-[10px] ${settings.label}`}>Default Project Key</label>
            <div className="flex gap-2">
              <input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="PROJ"
                className={`flex-1 ${integrationInput}`}
              />
              <button
                onClick={handleSaveProjectKey}
                disabled={saving}
                className={`text-[11px] px-2.5 py-1.5 rounded-md ${button.secondary} disabled:opacity-50 transition-colors duration-150`}
              >
                Save
              </button>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={saving}
            className={`text-[11px] ${text.muted} hover:text-red-400 text-left disabled:opacity-50 transition-colors duration-150`}
          >
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
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your Jira API token"
              className={integrationInput}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !baseUrl || !email || !token}
              className={`text-[11px] px-3 py-1.5 rounded-md font-medium ${button.primary} disabled:opacity-50 transition-all duration-150 active:scale-[0.98]`}
            >
              {saving ? 'Connecting...' : 'Connect'}
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

export function IntegrationsPanel() {
  const githubStatus = useGitHubStatus();
  const jiraStatus = useJiraStatus();
  const [githubRefreshKey, setGithubRefreshKey] = useState(0);
  const [jiraRefreshKey, setJiraRefreshKey] = useState(0);

  const [currentGithubStatus, setCurrentGithubStatus] = useState<GitHubStatus | null>(null);
  const [currentJiraStatus, setCurrentJiraStatus] = useState<JiraStatus | null>(null);

  useEffect(() => {
    setCurrentGithubStatus(githubStatus);
  }, [githubStatus]);

  useEffect(() => {
    setCurrentJiraStatus(jiraStatus);
  }, [jiraStatus]);

  useEffect(() => {
    if (githubRefreshKey === 0) return;
    fetch('/api/github/status')
      .then((r) => r.json())
      .then((d) => setCurrentGithubStatus(d))
      .catch(() => {});
  }, [githubRefreshKey]);

  useEffect(() => {
    if (jiraRefreshKey === 0) return;
    fetch('/api/jira/status')
      .then((r) => r.json())
      .then((d) => setCurrentJiraStatus(d))
      .catch(() => {});
  }, [jiraRefreshKey]);

  return (
    <div className={`flex-1 ${surface.panel} rounded-xl overflow-auto`}>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div>
          <h2 className={`text-sm font-semibold ${text.primary}`}>Integrations</h2>
          <p className={`text-[11px] ${text.dimmed} mt-1`}>Connect external services to enhance your workflow.</p>
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className={`rounded-xl border ${border.subtle} bg-white/[0.02] p-5`}>
            <GitHubCard
              status={currentGithubStatus}
              onStatusChange={() => setGithubRefreshKey((k) => k + 1)}
            />
          </div>
          <div className={`rounded-xl border ${border.subtle} bg-white/[0.02] p-5`}>
            <JiraCard
              status={currentJiraStatus}
              onStatusChange={() => setJiraRefreshKey((k) => k + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
