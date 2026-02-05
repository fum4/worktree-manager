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
  refreshIntervalMinutes: number;
  email: string | null;
  domain: string | null;
}

export interface GitHubStatus {
  installed: boolean;
  authenticated: boolean;
  username: string | null;
  repo: string | null;
  hasRemote: boolean;
  hasCommits: boolean;
}

export interface JiraIssueSummary {
  key: string;
  summary: string;
  status: string;
  priority: string;
  type: string;
  assignee: string | null;
  updated: string;
  labels: string[];
  url: string;
}

export interface JiraIssueDetail {
  key: string;
  summary: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  created: string;
  updated: string;
  comments: Array<{ author: string; body: string; created: string }>;
  attachments: Array<{ filename: string; mimeType: string; size: number; contentUrl?: string; thumbnail?: string | null }>;
  linkedWorktree: string | null;
  fetchedAt: string;
  url: string;
}
