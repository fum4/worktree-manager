export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  status: 'running' | 'stopped' | 'starting' | 'creating';
  statusMessage?: string;
  ports: number[];
  offset: number | null;
  pid: number | null;
  lastActivity?: number;
  logs?: string[];
  jiraUrl?: string;
  jiraStatus?: string;
  githubPrUrl?: string;
  githubPrState?: string;
  hasUncommitted?: boolean;
  hasUnpushed?: boolean;
  commitsAhead?: number;
}

export interface PortsInfo {
  discovered: number[];
  offsetStep: number;
}

export interface JiraStatus {
  configured: boolean;
  defaultProjectKey: string | null;
}

export interface GitHubStatus {
  installed: boolean;
  authenticated: boolean;
  repo: string | null;
}
