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
  linearUrl?: string;
  linearStatus?: string;
  localIssueId?: string;
  localIssueStatus?: string;
  githubPrUrl?: string;
  githubPrState?: string;
  hasUncommitted?: boolean;
  hasUnpushed?: boolean;
  commitsAhead?: number;
  commitsAheadOfBase?: number;
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

export interface LinearStatus {
  configured: boolean;
  defaultTeamKey: string | null;
  refreshIntervalMinutes: number;
  displayName: string | null;
}

export interface LinearState {
  name: string;
  type: string;
  color: string;
}

export interface LinearLabel {
  name: string;
  color: string;
}

export interface LinearIssueSummary {
  identifier: string;
  title: string;
  state: LinearState;
  priority: number;
  assignee: string | null;
  updatedAt: string;
  labels: LinearLabel[];
  url: string;
}

export interface LinearIssueDetail extends LinearIssueSummary {
  description: string | null;
  createdAt: string;
  comments: Array<{ author: string; body: string; createdAt: string }>;
}

export interface CustomTaskSummary {
  id: string;
  identifier: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  labels: string[];
  linkedWorktreeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomTaskDetail extends CustomTaskSummary {
  description: string;
}

// ─── MCP Server Manager types ───────────────────────────────────

export interface McpServerSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  command: string;
  args: string[];
  env: Record<string, string>;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpServerDetail extends McpServerSummary {}

export interface McpDeploymentStatus {
  /** serverId -> agentId -> { global?, project?, globalPath?, projectPath? } */
  status: Record<string, Record<string, {
    global?: boolean;
    project?: boolean;
    globalPath?: string;
    projectPath?: string;
  }>>;
}

export interface McpScanResult {
  key: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  foundIn: Array<{ configPath: string }>;
  alreadyInRegistry: boolean;
}

// ─── Claude Skills / Plugins types ──────────────────────────────

export interface SkillSummary {
  name: string;
  displayName: string;
  description: string;
  path: string;
}

export interface SkillDetail extends SkillSummary {
  skillMd: string;
  frontmatter: {
    name: string;
    description: string;
    allowedTools: string;
    context: string;
    agent: string;
    model: string;
    argumentHint: string;
    disableModelInvocation: boolean;
    userInvocable: boolean;
    mode: boolean;
  };
  hasReference: boolean;
  referenceMd?: string;
  hasExamples: boolean;
  examplesMd?: string;
}

export interface SkillDeploymentStatus {
  status: Record<string, { global: boolean; local: boolean; localIsSymlink: boolean; localIsCopy: boolean; inRegistry: boolean }>;
}

export interface PluginSummary {
  name: string;
  enabled: boolean;
}

export interface SkillScanResult {
  name: string;
  displayName: string;
  description: string;
  skillPath: string;
  alreadyInRegistry: boolean;
}

// ─── Jira types ─────────────────────────────────────────────────

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
