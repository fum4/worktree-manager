import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import type { AgentId, Scope } from './tool-configs';

// ─── Shared workflow text ────────────────────────────────────────

const WORK3_WORKFLOW = `When the user mentions an issue key (like PROJ-123, ENG-42), a ticket number, or says "work on <something>", use the work3 MCP server tools:

- Issue key like "PROJ-123" or number like "456" → call the work3 create_from_jira tool
- Linear identifier like "ENG-42" → call the work3 create_from_linear tool
- "show my issues" → call the work3 list_jira_issues or list_linear_issues tool

After creating a worktree:
1. Poll the work3 list_worktrees tool until status is 'stopped'
2. Navigate to the worktree path
3. Call get_hooks_config to discover hooks (pre-implementation, post-implementation, custom, on-demand)
4. Always inform the user before running hooks/skills/commands, and summarize results after
5. For each skill: call report_hook_status BEFORE (without success/summary) to show loading, invoke skill, then call it AGAIN with the result
6. Run any pre-implementation hooks before starting work
5. Read TASK.md to understand the task from the original issue details
6. Follow AI context directions and todo checklist — these are user-defined and take priority over the original task description when they conflict
7. Start implementing
8. After completing all work and post-implementation hooks, call get_git_policy — if commit/push/create_pr are allowed, do them automatically. If the dev server is not already running, ask the user if they'd like you to start it (via start_worktree)

Skill report files: For skills that produce detailed output (code review, changes summary, test instructions, explanations), write the full report to \`{worktreePath}/.work3-{skillName}.md\` and pass the absolute path via filePath in report_hook_status.

Skill quality guidelines:
- Code review: thorough investigation — read actual code, trace logic, check for bugs, edge cases, security. Don't just summarize the diff.
- Changes summary: technical, well-structured, bullet points grouped by area. Not overly verbose.
- Test writing: check if a testing framework exists first. If not, ask the user about integrating one. Ask about scope and priorities.
- Explain like I'm 5: simple language, analogies, accessible to non-technical readers.`;

// ─── Claude: .claude/skills/work/SKILL.md ────────────────────────

const CLAUDE_SKILL = `---
name: work
description: Create a worktree from an issue and start working on it. Use when the user says "work on PROJ-123", "work NOM-10", etc.
argument-hint: <issue-id>
allowed-tools: mcp__work3__*
---

The user wants to work on issue $ARGUMENTS.

IMPORTANT: Use ONLY the work3 MCP tools (mcp__work3__*) to interact with work3. Do NOT read .work3/ files or make HTTP requests to the work3 server. All communication goes through the MCP tools.

## Steps

1. **Create the worktree** by calling the right MCP tool based on the issue identifier:
   - Jira-style key (e.g., PROJ-123, or just a number) → \`mcp__work3__create_from_jira\` with \`issueKey\` param
   - Linear-style key (e.g., ENG-42, NOM-10) → \`mcp__work3__create_from_linear\` with \`identifier\` param

2. **Wait for creation** — poll \`mcp__work3__list_worktrees\` until the worktree status changes from 'creating' to 'stopped'

3. **Navigate** to the worktree path returned in the response

4. **Check hooks** — call \`mcp__work3__get_hooks_config\` to discover all configured hooks. Always inform the user before running any hooks/skills/commands, and summarize results after. For each skill: call \`mcp__work3__report_hook_status\` BEFORE (without success/summary) to show loading in the UI, invoke the skill, then call it AGAIN with the result. Run pre-implementation hooks before starting work. Check custom hook conditions as you work. Run post-implementation hooks when done.

5. **Read TASK.md** to understand the task from the original issue details, then follow AI context directions and todos — these are user-defined and take priority over the task description when they conflict

## Prerequisites

The work3 server must be running for MCP tools to work. Start it with \`work3\` or via the Electron app.

## Available MCP tools

- \`mcp__work3__create_from_jira\` — create worktree from Jira issue
- \`mcp__work3__create_from_linear\` — create worktree from Linear issue
- \`mcp__work3__create_worktree\` — create worktree from a branch name
- \`mcp__work3__list_worktrees\` — list all worktrees and their status
- \`mcp__work3__start_worktree\` — start the dev server in a worktree
- \`mcp__work3__stop_worktree\` — stop the dev server
- \`mcp__work3__get_task_context\` — refresh full task details
- \`mcp__work3__get_logs\` — get recent output logs
- \`mcp__work3__commit\` — stage all changes and commit
- \`mcp__work3__push\` — push commits to remote
- \`mcp__work3__create_pr\` — create a pull request
- \`mcp__work3__read_issue_notes\` — read AI context notes for a worktree
- \`mcp__work3__get_hooks_config\` — discover all configured hooks and trigger types
- \`mcp__work3__run_hooks\` — run hook command steps for a worktree
- \`mcp__work3__report_hook_status\` — report skill hook start (no success/summary = loading) or result (with success/summary = done)
- \`mcp__work3__get_hooks_status\` — check hook run status
`;

// ─── Cursor: .cursor/rules/work3.mdc ─────────────────────────────

const CURSOR_RULE = `---
description: work3 worktree management — use work3 MCP tools when user mentions issue keys or wants to work on a ticket
alwaysApply: true
---

Note: The work3 server must be running for MCP tools to work.

${WORK3_WORKFLOW}
`;

// ─── VS Code Copilot: .github/prompts/work.prompt.md ────────────

const VSCODE_PROMPT = `---
description: Create a worktree from an issue and start working on it using work3
---

Note: The work3 server must be running for MCP tools to work.

${WORK3_WORKFLOW}
`;

// ─── Deploy/remove per agent ─────────────────────────────────────

interface InstructionFile {
  /** Path relative to project root (project scope) or absolute (global scope) */
  getPath: (projectDir: string, scope: Scope) => string | null;
  content: string;
  /** Whether the file lives inside a directory that should be removed as a unit */
  isDir?: boolean;
}

const AGENT_INSTRUCTIONS: Partial<Record<AgentId, InstructionFile[]>> = {
  claude: [{
    getPath: (_projectDir, scope) =>
      scope === 'global'
        ? path.join(os.homedir(), '.claude', 'skills', 'work', 'SKILL.md')
        : path.join(_projectDir, '.claude', 'skills', 'work', 'SKILL.md'),
    content: CLAUDE_SKILL,
    isDir: true,
  }],
  cursor: [{
    getPath: (projectDir, scope) =>
      // Cursor global rules are in IDE settings, not files — project only
      scope === 'project' ? path.join(projectDir, '.cursor', 'rules', 'work3.mdc') : null,
    content: CURSOR_RULE,
  }],
  vscode: [{
    getPath: (projectDir, scope) =>
      // VS Code global is IDE settings — project only
      scope === 'project' ? path.join(projectDir, '.github', 'prompts', 'work.prompt.md') : null,
    content: VSCODE_PROMPT,
  }],
  // Codex and Gemini use single-file instruction systems (AGENTS.md, GEMINI.md)
  // that we can't safely auto-deploy into. MCP_INSTRUCTIONS cover them.
};

const CLAUDE_AUTO_ALLOW = ['mcp__work3__*'];

function mergeClaudeSettings(filePath: string, permissions: string[]): void {
  let settings: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    try {
      settings = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { /* ignore */ }
  }
  const perms = (settings.permissions ?? {}) as Record<string, unknown>;
  const allow = new Set<string>((perms.allow ?? []) as string[]);
  for (const p of permissions) allow.add(p);
  perms.allow = [...allow];
  settings.permissions = perms;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
}

function unmergeClaudeSettings(filePath: string, permissions: string[]): void {
  if (!existsSync(filePath)) return;
  try {
    const settings = JSON.parse(readFileSync(filePath, 'utf-8'));
    const perms = settings.permissions ?? {};
    const allow = ((perms.allow ?? []) as string[]).filter((p: string) => !permissions.includes(p));
    if (allow.length > 0) {
      perms.allow = allow;
      settings.permissions = perms;
      writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
    } else {
      delete perms.allow;
      if (Object.keys(perms).length === 0) delete settings.permissions;
      if (Object.keys(settings).length === 0) {
        rmSync(filePath);
      } else {
        writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n');
      }
    }
  } catch { /* ignore */ }
}

export function deployAgentInstructions(agent: AgentId, projectDir: string, scope: Scope): void {
  const files = AGENT_INSTRUCTIONS[agent];
  if (!files) return;

  for (const file of files) {
    const filePath = file.getPath(projectDir, scope);
    if (!filePath) continue;

    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, file.content);
  }

  // Auto-approve work3 MCP tools in Claude settings
  if (agent === 'claude') {
    const settingsPath = scope === 'global'
      ? path.join(os.homedir(), '.claude', 'settings.json')
      : path.join(projectDir, '.claude', 'settings.json');
    mergeClaudeSettings(settingsPath, CLAUDE_AUTO_ALLOW);
  }
}

export function removeAgentInstructions(agent: AgentId, projectDir: string, scope: Scope): void {
  const files = AGENT_INSTRUCTIONS[agent];
  if (!files) return;

  for (const file of files) {
    const filePath = file.getPath(projectDir, scope);
    if (!filePath || !existsSync(filePath)) continue;

    if (file.isDir) {
      // Remove the parent directory (e.g., .claude/skills/work/)
      rmSync(path.dirname(filePath), { recursive: true });
    } else {
      rmSync(filePath);
    }
  }

  // Remove work3 MCP tool permissions from Claude settings
  if (agent === 'claude') {
    const settingsPath = scope === 'global'
      ? path.join(os.homedir(), '.claude', 'settings.json')
      : path.join(projectDir, '.claude', 'settings.json');
    unmergeClaudeSettings(settingsPath, CLAUDE_AUTO_ALLOW);
  }
}
