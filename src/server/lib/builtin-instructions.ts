import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

import type { AgentId, Scope } from './tool-configs';

// ─── Shared workflow text ────────────────────────────────────────

const WOK3_WORKFLOW = `When the user mentions an issue key (like PROJ-123, ENG-42), a ticket number, or says "work on <something>", use the wok3 MCP server tools:

- Issue key like "PROJ-123" or number like "456" → call the wok3 create_from_jira tool
- Linear identifier like "ENG-42" → call the wok3 create_from_linear tool
- "show my issues" → call the wok3 list_jira_issues or list_linear_issues tool

After creating a worktree:
1. Poll the wok3 list_worktrees tool until status is 'stopped'
2. Navigate to the worktree path
3. Read TASK.md for full context
4. Start implementing`;

// ─── Claude: .claude/skills/work/SKILL.md ────────────────────────

const CLAUDE_SKILL = `---
name: work
description: Create a worktree from an issue and start working on it. Use when the user says "work on PROJ-123", "work NOM-10", etc.
argument-hint: <issue-id>
allowed-tools: mcp__wok3__*
---

The user wants to work on issue $ARGUMENTS.

Use the wok3 MCP tools to set up a worktree and start working:

1. **Identify the issue type** from the identifier:
   - Jira-style key (e.g., PROJ-123, or just a number): call \`mcp__wok3__create_from_jira\`
   - Linear-style key (e.g., ENG-42): call \`mcp__wok3__create_from_linear\`

2. **Create the worktree** — the response includes full task context (description, comments, AI notes) and the worktree path

3. **Wait for creation** — poll \`mcp__wok3__list_worktrees\` until the worktree status changes from 'creating' to 'stopped'

4. **Navigate** to the worktree path and read the TASK.md file

5. **Start implementing** based on the task description and AI context
`;

// ─── Cursor: .cursor/rules/wok3.mdc ─────────────────────────────

const CURSOR_RULE = `---
description: wok3 worktree management — use wok3 MCP tools when user mentions issue keys or wants to work on a ticket
alwaysApply: true
---

${WOK3_WORKFLOW}
`;

// ─── VS Code Copilot: .github/prompts/work.prompt.md ────────────

const VSCODE_PROMPT = `---
description: Create a worktree from an issue and start working on it using wok3
---

${WOK3_WORKFLOW}
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
      scope === 'project' ? path.join(projectDir, '.cursor', 'rules', 'wok3.mdc') : null,
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

export function deployAgentInstructions(agent: AgentId, projectDir: string, scope: Scope): void {
  const files = AGENT_INSTRUCTIONS[agent];
  if (!files) return;

  for (const file of files) {
    const filePath = file.getPath(projectDir, scope);
    if (!filePath) continue;

    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, file.content);
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
}
