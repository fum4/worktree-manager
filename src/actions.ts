import { APP_NAME } from './constants';
import type { WorktreeManager } from './server/manager';

export interface ActionParam {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required?: boolean;
}

export interface Action {
  name: string;
  description: string;
  params: Record<string, ActionParam>;
  handler: (ctx: ActionContext, params: Record<string, unknown>) => Promise<unknown>;
}

export interface ActionContext {
  manager: WorktreeManager;
}

export const MCP_INSTRUCTIONS = `${APP_NAME} manages git worktrees with automatic port offsetting for running multiple dev server instances.

Common workflows:
- User says a Jira issue key (e.g. "PROJ-123", "jira 123", "work on 456"): use create_from_jira to create a worktree from that issue.
- User says a Linear issue (e.g. "ENG-42", "linear 42"): use create_from_linear to create a worktree from that issue.
- User says "show my issues" or "what should I work on": use list_jira_issues or list_linear_issues depending on which is configured.
- User mentions an issue and wants details: use get_jira_issue or get_linear_issue first, then offer to create a worktree.
- User says a branch name: use create_worktree directly.
- If the user just gives a number (e.g. "1234"), try the configured issue tracker (Jira or Linear) with that number.
- After creating a worktree, the user can start it with start_worktree to launch the dev server.`;

function findWorktreeOrThrow(ctx: ActionContext, id: string) {
  const worktrees = ctx.manager.getWorktrees();
  const wt = worktrees.find((w) => w.id === id);
  if (!wt) throw new Error(`Worktree "${id}" not found`);
  return wt;
}

export const actions: Action[] = [
  // -- Issue browsing --
  {
    name: 'list_jira_issues',
    description: 'List your assigned Jira issues (unresolved). Optionally search by text. Use this when the user wants to see their issues or find something to work on.',
    params: {
      query: { type: 'string', description: 'Optional text search to filter issues' },
    },
    handler: async (ctx, params) => {
      const query = params.query as string | undefined;
      return ctx.manager.listJiraIssues(query);
    },
  },
  {
    name: 'get_jira_issue',
    description: 'Get full details of a Jira issue including description and comments. Use this to show issue details before creating a worktree.',
    params: {
      issueKey: { type: 'string', description: 'Jira issue key (e.g. PROJ-123 or just 123 if default project is configured)', required: true },
    },
    handler: async (ctx, params) => {
      const issueKey = params.issueKey as string;
      return ctx.manager.getJiraIssue(issueKey);
    },
  },
  {
    name: 'list_linear_issues',
    description: 'List your assigned Linear issues (open/in progress). Optionally search by text. Use this when the user wants to see their issues or find something to work on.',
    params: {
      query: { type: 'string', description: 'Optional text search to filter issues' },
    },
    handler: async (ctx, params) => {
      const query = params.query as string | undefined;
      return ctx.manager.listLinearIssues(query);
    },
  },
  {
    name: 'get_linear_issue',
    description: 'Get full details of a Linear issue including description. Use this to show issue details before creating a worktree.',
    params: {
      identifier: { type: 'string', description: 'Linear issue identifier (e.g. ENG-123 or just 123 if default team is configured)', required: true },
    },
    handler: async (ctx, params) => {
      const identifier = params.identifier as string;
      return ctx.manager.getLinearIssue(identifier);
    },
  },

  // -- Worktree management --
  {
    name: 'list_worktrees',
    description: 'List all worktrees with their status, branch, ports, and git/PR info. Use this to see existing worktrees before creating new ones.',
    params: {},
    handler: async (ctx) => ctx.manager.getWorktrees(),
  },
  {
    name: 'create_worktree',
    description: 'Create a new git worktree from a branch name. Use create_from_jira or create_from_linear instead when the user provides an issue key.',
    params: {
      branch: { type: 'string', description: 'Git branch name for the worktree', required: true },
      name: { type: 'string', description: 'Optional worktree directory name (defaults to sanitized branch name)' },
    },
    handler: async (ctx, params) => {
      const branch = params.branch as string;
      const name = params.name as string | undefined;
      return ctx.manager.createWorktree({ branch, name });
    },
  },
  {
    name: 'create_from_jira',
    description: 'Create a worktree from a Jira issue key. Fetches the issue, saves task data locally, and creates a worktree with the issue key as branch name. The user might say "jira 123", "PROJ-123", or just a number.',
    params: {
      issueKey: { type: 'string', description: 'Jira issue key (e.g. PROJ-123 or just 123 if default project is configured)', required: true },
    },
    handler: async (ctx, params) => {
      const issueKey = params.issueKey as string;
      return ctx.manager.createWorktreeFromJira(issueKey);
    },
  },
  {
    name: 'create_from_linear',
    description: 'Create a worktree from a Linear issue identifier. Fetches the issue, saves task data locally, and creates a worktree with the identifier as branch name. The user might say "linear 42", "ENG-42", or just a number.',
    params: {
      identifier: { type: 'string', description: 'Linear issue identifier (e.g. ENG-123 or just 123 if default team is configured)', required: true },
    },
    handler: async (ctx, params) => {
      const identifier = params.identifier as string;
      return ctx.manager.createWorktreeFromLinear(identifier);
    },
  },
  {
    name: 'start_worktree',
    description: 'Start the dev server in a worktree (allocates port offset, spawns process)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      findWorktreeOrThrow(ctx, id);
      return ctx.manager.startWorktree(id);
    },
  },
  {
    name: 'stop_worktree',
    description: 'Stop the running dev server in a worktree',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      return ctx.manager.stopWorktree(id);
    },
  },
  {
    name: 'remove_worktree',
    description: 'Remove a worktree (stops it first if running, then deletes the directory and git worktree reference)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      return ctx.manager.removeWorktree(id);
    },
  },
  {
    name: 'get_logs',
    description: 'Get recent output logs from a running worktree (up to 100 lines)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      return { logs: ctx.manager.getLogs(id) };
    },
  },

  // -- Git operations --
  {
    name: 'commit',
    description: 'Stage all changes and commit in a worktree (requires GitHub integration)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
      message: { type: 'string', description: 'Commit message', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      const message = params.message as string;
      const ghManager = ctx.manager.getGitHubManager();
      if (!ghManager?.isAvailable()) {
        return { success: false, error: 'GitHub integration not available' };
      }
      const wt = findWorktreeOrThrow(ctx, id);
      return ghManager.commitAll(wt.path, id, message);
    },
  },
  {
    name: 'push',
    description: 'Push commits in a worktree to the remote (requires GitHub integration)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      const ghManager = ctx.manager.getGitHubManager();
      if (!ghManager?.isAvailable()) {
        return { success: false, error: 'GitHub integration not available' };
      }
      const wt = findWorktreeOrThrow(ctx, id);
      return ghManager.pushBranch(wt.path, id);
    },
  },
  {
    name: 'create_pr',
    description: 'Create a GitHub pull request for a worktree branch (requires GitHub integration)',
    params: {
      id: { type: 'string', description: 'Worktree ID', required: true },
      title: { type: 'string', description: 'PR title', required: true },
      body: { type: 'string', description: 'PR body/description' },
    },
    handler: async (ctx, params) => {
      const id = params.id as string;
      const title = params.title as string;
      const body = params.body as string | undefined;
      const ghManager = ctx.manager.getGitHubManager();
      if (!ghManager?.isAvailable()) {
        return { success: false, error: 'GitHub integration not available' };
      }
      const wt = findWorktreeOrThrow(ctx, id);
      return ghManager.createPR(wt.path, id, title, body);
    },
  },
  {
    name: 'get_config',
    description: `Get the current ${APP_NAME} configuration and project name`,
    params: {},
    handler: async (ctx) => ({
      config: ctx.manager.getConfig(),
      projectName: ctx.manager.getProjectName(),
    }),
  },
];
