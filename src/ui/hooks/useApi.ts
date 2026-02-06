import { useMemo } from 'react';

import { useServerUrlOptional } from '../contexts/ServerContext';
import * as api from './api';

// Hook that provides API functions pre-bound to the current server URL
// This makes it easy for components to use API functions without worrying about serverUrl
export function useApi() {
  const serverUrl = useServerUrlOptional();

  return useMemo(
    () => ({
      createWorktree: (branch: string, name?: string) =>
        api.createWorktree(branch, name, serverUrl),

      recoverWorktree: (id: string, action: 'reuse' | 'recreate', branch?: string) =>
        api.recoverWorktree(id, action, branch, serverUrl),

      renameWorktree: (id: string, request: { name?: string; branch?: string }) =>
        api.renameWorktree(id, request, serverUrl),

      startWorktree: (id: string) =>
        api.startWorktree(id, serverUrl),

      stopWorktree: (id: string) =>
        api.stopWorktree(id, serverUrl),

      removeWorktree: (id: string) =>
        api.removeWorktree(id, serverUrl),

      createFromJira: (issueKey: string, branch?: string) =>
        api.createFromJira(issueKey, branch, serverUrl),

      commitChanges: (id: string, message: string) =>
        api.commitChanges(id, message, serverUrl),

      pushChanges: (id: string) =>
        api.pushChanges(id, serverUrl),

      createPullRequest: (id: string, title: string, body?: string) =>
        api.createPullRequest(id, title, body, serverUrl),

      installGitHubCli: () =>
        api.installGitHubCli(serverUrl),

      loginGitHub: () =>
        api.loginGitHub(serverUrl),

      logoutGitHub: () =>
        api.logoutGitHub(serverUrl),

      createInitialCommit: () =>
        api.createInitialCommit(serverUrl),

      createGitHubRepo: (isPrivate: boolean) =>
        api.createGitHubRepo(isPrivate, serverUrl),

      fetchJiraIssues: (query?: string) =>
        api.fetchJiraIssues(query, serverUrl),

      fetchJiraIssueDetail: (key: string) =>
        api.fetchJiraIssueDetail(key, serverUrl),

      discoverPorts: () =>
        api.discoverPorts(serverUrl),

      saveConfig: (updates: Record<string, unknown>) =>
        api.saveConfig(updates, serverUrl),

      setupJira: (baseUrl: string, email: string, token: string) =>
        api.setupJira(baseUrl, email, token, serverUrl),

      updateJiraConfig: (defaultProjectKey: string, refreshIntervalMinutes?: number) =>
        api.updateJiraConfig(defaultProjectKey, refreshIntervalMinutes, serverUrl),

      disconnectJira: () =>
        api.disconnectJira(serverUrl),

      createFromLinear: (identifier: string, branch?: string) =>
        api.createFromLinear(identifier, branch, serverUrl),

      setupLinear: (apiKey: string) =>
        api.setupLinear(apiKey, serverUrl),

      updateLinearConfig: (defaultTeamKey: string, refreshIntervalMinutes?: number) =>
        api.updateLinearConfig(defaultTeamKey, refreshIntervalMinutes, serverUrl),

      disconnectLinear: () =>
        api.disconnectLinear(serverUrl),

      fetchMcpStatus: () =>
        api.fetchMcpStatus(serverUrl),

      setupMcpAgent: (agent: string, scope: 'global' | 'project') =>
        api.setupMcpAgent(agent, scope, serverUrl),

      removeMcpAgent: (agent: string, scope: 'global' | 'project') =>
        api.removeMcpAgent(agent, scope, serverUrl),

      fetchSetupStatus: () =>
        api.fetchSetupStatus(serverUrl),

      commitSetup: (message: string) =>
        api.commitSetup(message, serverUrl),

      detectConfig: () =>
        api.detectConfig(serverUrl),

      initConfig: (config: Partial<api.DetectedConfig>) =>
        api.initConfig(config, serverUrl),

      fetchCustomTasks: () =>
        api.fetchCustomTasks(serverUrl),

      fetchCustomTaskDetail: (id: string) =>
        api.fetchCustomTaskDetail(id, serverUrl),

      createCustomTask: (data: { title: string; description?: string; priority?: string; labels?: string[] }) =>
        api.createCustomTask(data, serverUrl),

      updateCustomTask: (id: string, updates: Record<string, unknown>) =>
        api.updateCustomTask(id, updates, serverUrl),

      deleteCustomTask: (id: string) =>
        api.deleteCustomTask(id, serverUrl),

      createWorktreeFromCustomTask: (id: string, branch?: string) =>
        api.createWorktreeFromCustomTask(id, branch, serverUrl),
    }),
    [serverUrl],
  );
}
