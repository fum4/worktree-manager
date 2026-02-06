import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { select } from '@inquirer/prompts';

import { copyEnvFiles } from '../core/env-files';
import {
  loadJiraCredentials,
  loadJiraProjectConfig,
} from '../integrations/jira/credentials';
import {
  getApiBase,
  getAuthHeaders,
} from '../integrations/jira/auth';
import {
  resolveTaskKey,
  fetchIssue,
  saveTaskData,
  downloadAttachments,
} from '../integrations/jira/api';
import type { JiraTaskData } from '../integrations/jira/types';
import { findConfigDir, findConfigFile, loadConfig } from './config';

export async function runTask(taskId: string) {
  const configDir = findConfigDir();
  if (!configDir) {
    console.error('[wok3] No config found. Run "wok3 init" first.');
    process.exit(1);
  }

  const creds = loadJiraCredentials(configDir);
  if (!creds) {
    console.error('[wok3] Jira not connected. Run "wok3 connect jira" first.');
    process.exit(1);
  }

  const projectConfig = loadJiraProjectConfig(configDir);
  const key = resolveTaskKey(taskId, projectConfig);

  console.log(`[wok3] Fetching ${key}...`);

  const taskData = await fetchIssue(key, creds, configDir);

  // Print summary
  console.log('');
  console.log(`  ${taskData.key}: ${taskData.summary}`);
  console.log(`  Status: ${taskData.status}  |  Priority: ${taskData.priority}  |  Type: ${taskData.type}`);
  if (taskData.assignee) console.log(`  Assignee: ${taskData.assignee}`);
  if (taskData.labels.length > 0) console.log(`  Labels: ${taskData.labels.join(', ')}`);
  console.log(`  URL: ${taskData.url}`);
  console.log('');

  // Save task data
  const tasksDir = path.join(configDir, '.wok3', 'tasks');
  saveTaskData(taskData, tasksDir);
  console.log(`[wok3] Task saved to .wok3/tasks/${key}/task.json`);

  // Download attachments if any
  if (taskData.attachments.length > 0) {
    console.log(`[wok3] Downloading ${taskData.attachments.length} attachment(s)...`);

    // Re-fetch raw attachment data for download URLs
    const configPath = findConfigFile()!;
    const base = getApiBase(creds);
    const headers = await getAuthHeaders(creds, configDir);

    const resp = await fetch(`${base}/issue/${encodeURIComponent(key)}?fields=attachment`, { headers });
    if (resp.ok) {
      const issue = (await resp.json()) as { fields: { attachment: Array<{ filename: string; content: string; mimeType: string; size: number }> } };
      const attachmentsDir = path.join(tasksDir, key, 'attachments');
      const downloaded = await downloadAttachments(issue.fields.attachment, attachmentsDir, creds, configDir);
      taskData.attachments = downloaded;

      // Re-save with updated attachment paths
      saveTaskData(taskData, tasksDir);
      console.log(`[wok3] ${downloaded.length} attachment(s) downloaded`);
    }
  }

  // Prompt for worktree action
  console.log('');
  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Create a worktree for this task', value: 'create' },
      { name: 'Link to an existing worktree', value: 'link' },
      { name: 'Just save the data', value: 'save' },
    ],
    default: 'save',
  });

  if (action === 'create') {
    await createWorktreeForTask(taskData, configDir, tasksDir);
  } else if (action === 'link') {
    await linkWorktreeToTask(taskData, configDir, tasksDir);
  }

  console.log('[wok3] Done.');
}

async function createWorktreeForTask(
  taskData: { key: string; linkedWorktree: string | null },
  configDir: string,
  tasksDir: string,
) {
  const { config } = loadConfig();
  const branchName = taskData.key.toLowerCase();

  const worktreesDir = path.join(configDir, '.wok3', 'worktrees');

  if (!existsSync(worktreesDir)) {
    mkdirSync(worktreesDir, { recursive: true });
  }

  const worktreePath = path.join(worktreesDir, branchName);

  if (existsSync(worktreePath)) {
    console.log(`[wok3] Worktree directory already exists: ${worktreePath}`);
    console.log('[wok3] Linking to existing worktree instead.');
    taskData.linkedWorktree = branchName;
    saveTaskData(taskData as JiraTaskData, tasksDir);
    return;
  }

  console.log(`[wok3] Creating worktree at ${worktreePath} (branch: ${branchName})...`);

  // Prune stale worktree references before creating
  try {
    execFileSync('git', ['worktree', 'prune'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    // Ignore prune errors
  }

  // Try creating with -b (new branch), fallback to existing branch, fallback to -B
  try {
    execFileSync('git', ['worktree', 'add', '-b', branchName, worktreePath, config.baseBranch], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    try {
      execFileSync('git', ['worktree', 'add', worktreePath, branchName], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      execFileSync('git', ['worktree', 'add', '-B', branchName, worktreePath, config.baseBranch], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
  }

  console.log('[wok3] Worktree created.');

  // Copy .env files
  copyEnvFiles(configDir, worktreePath, worktreesDir);

  // Run install command
  if (config.installCommand) {
    const projectSubdir = config.projectDir && config.projectDir !== '.'
      ? path.join(worktreePath, config.projectDir)
      : worktreePath;

    console.log(`[wok3] Running: ${config.installCommand}`);
    try {
      const [cmd, ...args] = config.installCommand.split(' ');
      execFileSync(cmd, args, {
        encoding: 'utf-8',
        cwd: projectSubdir,
        stdio: 'inherit',
      });
    } catch (err) {
      console.log(`[wok3] Warning: install command failed: ${err}`);
    }
  }

  taskData.linkedWorktree = branchName;
  saveTaskData(taskData as JiraTaskData, tasksDir);
  console.log(`[wok3] Worktree linked to task ${taskData.key}`);
}

async function linkWorktreeToTask(
  taskData: { key: string; linkedWorktree: string | null },
  configDir: string,
  tasksDir: string,
) {
  const worktreesDir = path.join(configDir, '.wok3', 'worktrees');

  if (!existsSync(worktreesDir)) {
    console.log('[wok3] No worktrees directory found.');
    return;
  }

  const entries = readdirSync(worktreesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(worktreesDir, e.name, '.git')));

  if (entries.length === 0) {
    console.log('[wok3] No existing worktrees found.');
    return;
  }

  const chosen = await select({
    message: 'Select worktree',
    choices: entries.map((e) => ({
      name: e.name,
      value: e.name,
    })),
  });

  taskData.linkedWorktree = chosen;
  saveTaskData(taskData as JiraTaskData, tasksDir);
  console.log(`[wok3] Task ${taskData.key} linked to worktree: ${chosen}`);
}
