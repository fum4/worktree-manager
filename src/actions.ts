import { existsSync, readFileSync } from 'fs';
import path from 'path';

import { APP_NAME, CONFIG_DIR_NAME } from './constants';
import type { WorktreeManager } from './server/manager';
import type { NotesManager } from './server/notes-manager';
import { generateTaskMd, writeTaskMd } from './server/task-context';
import type { TaskContextData } from './server/task-context';

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
  notesManager: NotesManager;
}

export const MCP_INSTRUCTIONS = `${APP_NAME} manages git worktrees with automatic port offsetting for running multiple dev server instances.

## Workflow

When a user wants to work on an issue:
1. Create a worktree using create_from_jira, create_from_linear, or create_worktree
   - The response includes full task context (description, comments, AI notes)
   - The worktree is created asynchronously — check list_worktrees for status
2. Once the worktree status is 'stopped' (creation complete), navigate to the worktree path
3. A TASK.md file in the worktree root contains all task context
4. Start implementing the task based on the description and AI context

When working inside a worktree:
- Use get_task_context to get (or refresh) full task details at any time
- Use start_worktree to launch the dev server
- Use commit, push, create_pr for git operations

## Issue Identification
- Jira key (e.g. "PROJ-123", "jira 123", "work on 456"): use create_from_jira
- Linear issue (e.g. "ENG-42", "linear 42"): use create_from_linear
- Branch name: use create_worktree directly
- Just a number (e.g. "1234"): try the configured tracker (Jira or Linear)

## Browsing Issues
- "show my issues" or "what should I work on": use list_jira_issues or list_linear_issues depending on which is configured
- For issue details before creating a worktree: use get_jira_issue or get_linear_issue`;

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

  // -- Notes --
  {
    name: 'read_issue_notes',
    description: 'Read AI context notes for a worktree or issue. Returns user-provided directions for AI agents. Use this before starting work on a worktree to get context.',
    params: {
      worktreeId: { type: 'string', description: 'Worktree ID to find linked issue notes for' },
      source: { type: 'string', description: 'Issue source: "jira", "linear", or "local" (use with issueId)' },
      issueId: { type: 'string', description: 'Issue ID (use with source)' },
    },
    handler: async (ctx, params) => {
      const worktreeId = params.worktreeId as string | undefined;
      const source = params.source as string | undefined;
      const issueId = params.issueId as string | undefined;

      if (worktreeId) {
        // Find linked issue for this worktree
        const linkMap = ctx.notesManager.buildWorktreeLinkMap();
        const linked = linkMap.get(worktreeId);
        if (!linked) {
          return { error: `No linked issue found for worktree "${worktreeId}"` };
        }
        const notes = ctx.notesManager.loadNotes(linked.source, linked.issueId);
        return {
          source: linked.source,
          issueId: linked.issueId,
          aiContext: notes.aiContext?.content ?? null,
          personal: notes.personal?.content ?? null,
        };
      }

      if (source && issueId) {
        if (!['jira', 'linear', 'local'].includes(source)) {
          return { error: 'Invalid source (must be "jira", "linear", or "local")' };
        }
        const notes = ctx.notesManager.loadNotes(source as 'jira' | 'linear' | 'local', issueId);
        return {
          source,
          issueId,
          aiContext: notes.aiContext?.content ?? null,
          personal: notes.personal?.content ?? null,
        };
      }

      return { error: 'Provide either worktreeId or both source and issueId' };
    },
  },

  // -- Task context --
  {
    name: 'get_task_context',
    description: 'Get full task context for a worktree. Returns issue details, description, comments, AI context notes, and worktree path. Call this before starting work on a worktree to understand the full scope. Also regenerates the TASK.md file in the worktree.',
    params: {
      worktreeId: { type: 'string', description: 'Worktree ID (e.g., PROJ-123)', required: true },
    },
    handler: async (ctx, params) => {
      const worktreeId = params.worktreeId as string;

      // Find linked issue via buildWorktreeLinkMap()
      const linkMap = ctx.notesManager.buildWorktreeLinkMap();
      const linked = linkMap.get(worktreeId);

      if (!linked) {
        return { error: `No linked issue found for worktree "${worktreeId}". This worktree may have been created from a plain branch.` };
      }

      const { source, issueId } = linked;
      const configDir = ctx.manager.getConfigDir();
      const issuesDir = path.join(configDir, CONFIG_DIR_NAME, 'issues');

      // Load notes
      const notes = ctx.notesManager.loadNotes(source, issueId);
      const aiContext = notes.aiContext?.content ?? null;
      const personal = notes.personal?.content ?? null;

      // Load issue data based on source
      let taskData: TaskContextData | null = null;

      if (source === 'local') {
        const taskFile = path.join(issuesDir, 'local', issueId, 'task.json');
        if (existsSync(taskFile)) {
          try {
            const raw = JSON.parse(readFileSync(taskFile, 'utf-8'));
            taskData = {
              source: 'local',
              issueId,
              identifier: raw.identifier ?? worktreeId,
              title: raw.title ?? '',
              description: raw.description ?? '',
              status: raw.status ?? 'unknown',
              url: '',
            };
          } catch { /* ignore */ }
        }
      } else {
        const issueFile = path.join(issuesDir, source, issueId, 'issue.json');
        if (existsSync(issueFile)) {
          try {
            const raw = JSON.parse(readFileSync(issueFile, 'utf-8'));
            if (source === 'jira') {
              taskData = {
                source: 'jira',
                issueId,
                identifier: raw.key ?? worktreeId,
                title: raw.summary ?? '',
                description: raw.description ?? '',
                status: raw.status ?? 'Unknown',
                url: raw.url ?? '',
                comments: raw.comments?.slice(0, 10),
              };
            } else if (source === 'linear') {
              taskData = {
                source: 'linear',
                issueId,
                identifier: raw.identifier ?? worktreeId,
                title: raw.title ?? '',
                description: raw.description ?? '',
                status: raw.status ?? raw.state?.name ?? 'Unknown',
                url: raw.url ?? '',
                comments: raw.comments?.map((c: { author?: string; body?: string; createdAt?: string }) => ({
                  author: c.author ?? 'Unknown',
                  body: c.body ?? '',
                  created: c.createdAt,
                })),
              };
            }
          } catch { /* ignore */ }
        }
      }

      if (!taskData) {
        return {
          worktreeId,
          source,
          issueId,
          aiContext,
          personal,
          error: 'Issue data file not found on disk. Notes are still available.',
        };
      }

      // Find worktree path and regenerate TASK.md
      const wt = ctx.manager.getWorktrees().find((w) => w.id === worktreeId);
      const worktreePath = wt?.path ?? null;

      if (worktreePath && existsSync(worktreePath)) {
        try {
          const content = generateTaskMd(taskData, aiContext);
          writeTaskMd(worktreePath, content);
        } catch { /* non-critical */ }
      }

      return {
        worktreeId,
        worktreePath,
        task: taskData,
        aiContext,
        personal,
      };
    },
  },
];
