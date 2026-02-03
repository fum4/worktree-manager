import { useEffect, useRef, useState } from 'react';

import { disconnectJira, setupJira, updateJiraConfig } from '../hooks/useConfig';
import { installGitHubCli, loginGitHub } from '../hooks/api';
import { useGitHubStatus, useJiraStatus } from '../hooks/useWorktrees';
import type { GitHubStatus, JiraStatus } from '../types';
import { border, button, input, settings, surface, text } from '../theme';

function GitHubCard({ status, onStatusChange }: { status: GitHubStatus | null; onStatusChange: () => void }) {
  const isReady = status?.installed && status?.authenticated;
  const [loading, setLoading] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for auth completion after triggering login
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

  // Stop polling if status shows authenticated
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
    <div className={`rounded-lg border ${border.subtle} ${settings.card} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-semibold ${text.primary}`}>GitHub</h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            isReady ? 'text-green-400 bg-green-900/30' : 'text-gray-400 bg-gray-800'
          }`}
        >
          {isReady ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {status === null ? (
        <span className={`text-xs ${text.muted}`}>Loading...</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2 text-xs">
            <span className={text.muted}>CLI:</span>
            <span className={status.installed ? 'text-green-400' : text.error}>
              {status.installed ? 'Installed' : 'Not installed'}
            </span>
          </div>
          <div className="flex gap-2 text-xs">
            <span className={text.muted}>Auth:</span>
            <span className={status.authenticated ? 'text-green-400' : text.error}>
              {status.authenticated ? 'Authenticated' : 'Not authenticated'}
            </span>
          </div>
          {status.repo && (
            <div className="flex gap-2 text-xs">
              <span className={text.muted}>Repo:</span>
              <span className={text.secondary}>{status.repo}</span>
            </div>
          )}
          {!isReady && !status.installed && (
            <p className={`text-[11px] ${text.muted} mt-1`}>
              Install the GitHub CLI and authenticate to enable commits, pushes, and pull requests.
            </p>
          )}
          {!isReady && status.installed && !status.authenticated && (
            <p className={`text-[11px] ${text.muted} mt-1`}>
              Authenticate with GitHub to enable commits, pushes, and pull requests.
            </p>
          )}
        </div>
      )}

      {feedback && (
        <span className={`text-xs ${feedback.type === 'success' ? 'text-green-400' : text.error}`}>
          {feedback.message}
        </span>
      )}

      {status && !status.installed && !waitingForAuth && (
        <button
          onClick={handleConnect}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded font-medium ${button.primary} disabled:opacity-50 self-start`}
        >
          {loading ? 'Installing...' : 'Connect'}
        </button>
      )}

      {status && status.installed && !status.authenticated && !waitingForAuth && (
        <button
          onClick={handleLogin}
          disabled={waitingForAuth}
          className={`text-xs px-3 py-1.5 rounded font-medium ${button.primary} disabled:opacity-50 self-start`}
        >
          Login
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
    <div className={`rounded-lg border ${border.subtle} ${settings.card} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-semibold ${text.primary}`}>Jira</h3>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            isConfigured ? 'text-green-400 bg-green-900/30' : 'text-gray-400 bg-gray-800'
          }`}
        >
          {isConfigured ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {status === null ? (
        <span className={`text-xs ${text.muted}`}>Loading...</span>
      ) : isConfigured ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 text-xs">
            <span className={text.muted}>Auth:</span>
            <span className="text-green-400">API Token</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className={`text-[11px] ${settings.label}`}>Default Project Key</label>
            <div className="flex gap-2">
              <input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="PROJ"
                className={`flex-1 px-2 py-1 rounded text-xs ${input.bg} ${input.text} ${input.placeholder} border ${border.input} focus:border-blue-500 focus:outline-none`}
              />
              <button
                onClick={handleSaveProjectKey}
                disabled={saving}
                className={`text-xs px-2 py-1 rounded ${button.secondary} disabled:opacity-50`}
              >
                Save
              </button>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={saving}
            className={`text-xs ${text.error} hover:underline text-left disabled:opacity-50`}
          >
            Disconnect Jira
          </button>
        </div>
      ) : showSetup ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] ${settings.label}`}>Jira Base URL</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-org.atlassian.net"
              className={`px-2 py-1.5 rounded text-xs ${input.bg} ${input.text} ${input.placeholder} border ${border.input} focus:border-blue-500 focus:outline-none`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] ${settings.label}`}>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={`px-2 py-1.5 rounded text-xs ${input.bg} ${input.text} ${input.placeholder} border ${border.input} focus:border-blue-500 focus:outline-none`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[11px] ${settings.label}`}>API Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your Jira API token"
              className={`px-2 py-1.5 rounded text-xs ${input.bg} ${input.text} ${input.placeholder} border ${border.input} focus:border-blue-500 focus:outline-none`}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConnect}
              disabled={saving || !baseUrl || !email || !token}
              className={`text-xs px-3 py-1.5 rounded font-medium ${button.primary} disabled:opacity-50`}
            >
              {saving ? 'Connecting...' : 'Connect'}
            </button>
            <button
              onClick={() => setShowSetup(false)}
              className={`text-xs px-3 py-1.5 rounded ${button.secondary}`}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={`text-[11px] ${text.muted}`}>
            Connect Jira to create worktrees directly from issues.
          </p>
          <button
            onClick={() => setShowSetup(true)}
            className={`text-xs px-3 py-1.5 rounded font-medium ${button.primary} self-start`}
          >
            Set up Jira
          </button>
        </div>
      )}

      {feedback && (
        <span
          className={`text-xs ${
            feedback.type === 'success' ? 'text-green-400' : text.error
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
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-5">
        <h2 className={`text-sm font-semibold ${text.primary}`}>Integrations</h2>
        <div className="grid grid-cols-2 gap-4">
          <GitHubCard
            status={currentGithubStatus}
            onStatusChange={() => setGithubRefreshKey((k) => k + 1)}
          />
          <JiraCard
            status={currentJiraStatus}
            onStatusChange={() => setJiraRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
