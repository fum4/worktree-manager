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

function findWorktreeOrThrow(ctx: ActionContext, id: string) {
  const worktrees = ctx.manager.getWorktrees();
  const wt = worktrees.find((w) => w.id === id);
  if (!wt) throw new Error(`Worktree "${id}" not found`);
  return wt;
}

export const actions: Action[] = [
  {
    name: 'list_worktrees',
    description: 'List all worktrees with their status, branch, ports, and git/PR info',
    params: {},
    handler: async (ctx) => ctx.manager.getWorktrees(),
  },
  {
    name: 'create_worktree',
    description: 'Create a new git worktree. Returns immediately with status "creating" — poll list_worktrees for completion.',
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
  {
    name: 'get_config',
    description: 'Get the current wok3 configuration and project name',
    params: {},
    handler: async (ctx) => ({
      config: ctx.manager.getConfig(),
      projectName: ctx.manager.getProjectName(),
    }),
  },
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
    name: 'create_from_jira',
    description: 'Create a worktree from a Jira issue key (fetches issue, saves task data, creates worktree)',
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
    description: 'Create a worktree from a Linear issue identifier (fetches issue, saves task data, creates worktree)',
    params: {
      identifier: { type: 'string', description: 'Linear issue identifier (e.g. ENG-123 or just 123 if default team is configured)', required: true },
    },
    handler: async (ctx, params) => {
      const identifier = params.identifier as string;
      return ctx.manager.createWorktreeFromLinear(identifier);
    },
  },
];
