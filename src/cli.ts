#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { createInterface } from 'readline';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { select, input, password } from '@inquirer/prompts';

import { startWorktreeServer, PortManager } from './server/index';
import type { PortConfig, WorktreeConfig } from './server/types';
import { checkGhAuth, checkGhInstalled, getRepoInfo } from './github/gh-client';
import {
  loadJiraCredentials,
  saveJiraCredentials,
  loadJiraProjectConfig,
  saveJiraProjectConfig,
  runOAuthFlow,
  discoverCloudId,
  testConnection,
  resolveTaskKey,
  fetchIssue,
  saveTaskData,
} from './jira/index';
import type { JiraCredentials } from './jira/types';

const CONFIG_DIR_NAME = '.wok3';
const CONFIG_FILE_NAME = 'config.json';

interface ConfigFile {
  projectDir?: string;
  worktreesDir?: string;
  startCommand?: string;
  installCommand?: string;
  baseBranch?: string;
  ports?: Partial<PortConfig>;
  envMapping?: Record<string, string>;
  serverPort?: number;
}

function findConfigFile(): string | null {
  let currentDir = process.cwd();
  const { root } = path.parse(currentDir);

  while (currentDir !== root) {
    const configPath = path.join(currentDir, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
    if (existsSync(configPath)) {
      return configPath;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

function detectDefaultBranch(): string {
  // Try to detect the default branch from the remote
  try {
    const ref = execFileSync(
      'git',
      ['symbolic-ref', 'refs/remotes/origin/HEAD'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    // ref is like "refs/remotes/origin/main" → extract "origin/main"
    const match = ref.match(/^refs\/remotes\/(.+)$/);
    if (match) return match[1];
  } catch {
    // Fallback: check which common branches exist
  }

  for (const branch of ['origin/develop', 'origin/main', 'origin/master']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', branch], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return branch;
    } catch {
      // Try next
    }
  }

  return 'origin/main';
}

function detectInstallCommand(projectDir: string): string | null {
  if (existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm install';
  if (existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn install';
  if (existsSync(path.join(projectDir, 'package-lock.json'))) return 'npm install';
  if (existsSync(path.join(projectDir, 'bun.lockb'))) return 'bun install';
  return null;
}

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function runInit() {
  const existingConfig = findConfigFile();
  if (existingConfig) {
    console.log(`[wok3] Config already exists at ${existingConfig}`);
    console.log('Delete it first if you want to re-initialize.');
    process.exit(1);
  }

  // Check we're in a git repo
  try {
    execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    console.error('[wok3] Not inside a git repository.');
    process.exit(1);
  }

  console.log('[wok3] Initializing configuration...\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const projectDir = (await prompt(
    rl,
    `Project directory (absolute or relative to cwd) [.]: `,
  )) || '.';

  const resolvedProjectDir = path.resolve(process.cwd(), projectDir);

  if (!existsSync(resolvedProjectDir)) {
    console.error(`[wok3] Directory "${resolvedProjectDir}" does not exist.`);
    rl.close();
    process.exit(1);
  }

  const detectedBranch = detectDefaultBranch();
  const baseBranch = (await prompt(
    rl,
    `Base branch for new worktrees [${detectedBranch}]: `,
  )) || detectedBranch;

  let startCommand = '';
  while (!startCommand) {
    startCommand = await prompt(rl, 'Dev start command: ');
    if (!startCommand) console.log('  Start command is required.');
  }

  const detectedInstallCommand = detectInstallCommand(resolvedProjectDir);
  let installCommand = '';
  while (!installCommand) {
    installCommand = (await prompt(
      rl,
      detectedInstallCommand
        ? `Install dependencies command [${detectedInstallCommand}]: `
        : 'Install dependencies command: ',
    )) || detectedInstallCommand || '';
    if (!installCommand) console.log('  Install command is required.');
  }

  const serverPort = parseInt(
    (await prompt(rl, 'Manager UI port [3100]: ')) || '3100',
    10,
  );

  const worktreesDir = (await prompt(
    rl,
    'Worktrees directory [.wok3/worktrees]: ',
  )) || '.wok3/worktrees';

  rl.close();

  const config: ConfigFile = {
    worktreesDir,
    startCommand,
    installCommand,
    baseBranch,
    serverPort,
    ports: {
      discovered: [],
      offsetStep: 1,
    },
  };

  const configDirPath = path.join(resolvedProjectDir, CONFIG_DIR_NAME);
  if (!existsSync(configDirPath)) {
    mkdirSync(configDirPath, { recursive: true });
  }
  const configPath = path.join(configDirPath, CONFIG_FILE_NAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`\n[wok3] Config written to ${configPath}`);

  // Auto-detect env var mappings if ports are already known
  if (config.ports?.discovered && config.ports.discovered.length > 0) {
    const tempConfig: WorktreeConfig = {
      projectDir: projectDir,
      worktreesDir: worktreesDir,
      startCommand,
      installCommand,
      baseBranch,
      ports: config.ports as PortConfig,
      serverPort,
    };
    const pm = new PortManager(tempConfig, configPath);
    const envMapping = pm.detectEnvMapping(resolvedProjectDir);
    if (Object.keys(envMapping).length > 0) {
      pm.persistEnvMapping(envMapping);
      console.log('\nFound env var mappings:');
      for (const [key, template] of Object.entries(envMapping)) {
        const original = template.replace(/\$\{(\d+)\}/g, (_, p) => p);
        console.log(`  ${key}=${original} → ${template}`);
      }
      console.log('Saved to config.');
    }
  }

  console.log('');
  console.log('Next steps:');
  console.log('  1. Run `wok3` to start the manager UI');
  console.log('  2. Click "Discover Ports" in the UI to auto-detect all ports');
  console.log('  3. Create worktrees and start them — ports are offset automatically');
  console.log('');
}

function loadConfig(): { config: WorktreeConfig; configPath: string | null } {
  const configPath = findConfigFile();

  const defaults: WorktreeConfig = {
    projectDir: '.',
    worktreesDir: '.wok3/worktrees',
    startCommand: '',
    installCommand: '',
    baseBranch: 'origin/main',
    ports: {
      discovered: [],
      offsetStep: 1,
    },
    serverPort: 3100,
  };

  if (!configPath) {
    console.log(
      `[wok3] No ${CONFIG_DIR_NAME}/${CONFIG_FILE_NAME} found, using defaults`,
    );
    console.log(
      `[wok3] Run "wok3 init" to create a config file`,
    );
    return { config: defaults, configPath: null };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const fileConfig: ConfigFile = JSON.parse(content);

    const configDir = path.dirname(path.dirname(configPath));
    if (configDir !== process.cwd()) {
      console.log(`[wok3] Found config at ${configPath}`);
      process.chdir(configDir);
      console.log(
        `[wok3] Changed working directory to ${configDir}`,
      );
    }

    const config: WorktreeConfig = {
      projectDir: fileConfig.projectDir ?? defaults.projectDir,
      worktreesDir: fileConfig.worktreesDir ?? defaults.worktreesDir,
      startCommand: fileConfig.startCommand ?? defaults.startCommand,
      installCommand: fileConfig.installCommand ?? defaults.installCommand,
      baseBranch: fileConfig.baseBranch ?? defaults.baseBranch,
      ports: {
        discovered: fileConfig.ports?.discovered ?? defaults.ports.discovered,
        offsetStep: fileConfig.ports?.offsetStep ?? defaults.ports.offsetStep,
      },
      envMapping: fileConfig.envMapping,
      serverPort: fileConfig.serverPort ?? defaults.serverPort,
    };

    return { config, configPath };
  } catch (error) {
    console.error(
      `[wok3] Failed to load config from ${configPath}:`,
      error,
    );
    return { config: defaults, configPath: null };
  }
}

function findConfigDir(): string | null {
  const configPath = findConfigFile();
  if (!configPath) return null;
  // configPath is like /path/to/project/.wok3/config.json → project dir is two levels up
  return path.dirname(path.dirname(configPath));
}

interface Integration {
  name: string;
  description: string;
  getStatus: (configDir: string) => string;
  setup: () => Promise<void>;
}

const INTEGRATIONS: Integration[] = [
  {
    name: 'github',
    description: 'GitHub (PRs, commit & push)',
    getStatus: () => {
      try {
        execFileSync('which', ['gh'], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
        return 'ready (gh installed)';
      } catch {
        return 'gh not installed';
      }
    },
    setup: runConnectGitHub,
  },
  {
    name: 'jira',
    description: 'Atlassian Jira (issue tracking)',
    getStatus: (configDir) => loadJiraCredentials(configDir) ? 'connected' : 'not configured',
    setup: runConnectJira,
  },
];

async function runConnect() {
  const configDir = findConfigDir();
  if (!configDir) {
    console.error('[wok3] No config found. Run "wok3 init" first.');
    process.exit(1);
  }

  // If integration name passed directly, skip the picker
  const integration = process.argv[3];
  if (integration) {
    const match = INTEGRATIONS.find((i) => i.name === integration);
    if (!match) {
      console.error(`[wok3] Unknown integration: ${integration}`);
      console.log(`Available: ${INTEGRATIONS.map((i) => i.name).join(', ')}`);
      process.exit(1);
    }
    await match.setup();
    return;
  }

  const items = INTEGRATIONS.map((i) => ({
    ...i,
    status: i.getStatus(configDir),
  }));

  const chosen = await select({
    message: 'Select integration to set up',
    choices: items.map((item) => {
      const marker = item.status === 'connected' ? '✓' : '○';
      return {
        name: `${marker} ${item.name} — ${item.description} (${item.status})`,
        value: item.name,
      };
    }),
  });

  const match = items.find((i) => i.name === chosen)!;
  await match.setup();
}

async function runConnectGitHub() {
  console.log('[wok3] GitHub Integration\n');

  const installed = await checkGhInstalled();
  if (!installed) {
    console.log('  The GitHub CLI (gh) is not installed.\n');
    console.log('  Install it:');
    console.log('    macOS:   brew install gh');
    console.log('    Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md');
    console.log('    Windows: winget install --id GitHub.cli\n');
    console.log('  Then run: gh auth login');
    return;
  }

  console.log('  ✓ gh CLI installed');

  const authenticated = await checkGhAuth();
  if (!authenticated) {
    console.log('  ✗ Not authenticated\n');
    console.log('  Run: gh auth login');
    return;
  }

  console.log('  ✓ Authenticated');

  try {
    const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const repo = await getRepoInfo(gitRoot);
    if (repo) {
      console.log(`  ✓ Repository: ${repo.owner}/${repo.repo} (default branch: ${repo.defaultBranch})`);
    } else {
      console.log('  ✗ Could not detect repository. Make sure this is a GitHub repo.');
      return;
    }
  } catch {
    console.log('  ✗ Not inside a git repository.');
    return;
  }

  console.log('\n[wok3] GitHub is ready! PR detection, commit, and push will work automatically.');
}

async function runConnectJira() {
  const configDir = findConfigDir();
  if (!configDir) {
    console.error('[wok3] No config found. Run "wok3 init" first.');
    process.exit(1);
  }

  console.log('[wok3] Connect to Jira\n');

  const authMethod = await select({
    message: 'Authentication method',
    choices: [
      {
        name: 'OAuth 2.0 (recommended)',
        value: 'oauth' as const,
        description: 'Requires creating an OAuth app at developer.atlassian.com',
      },
      {
        name: 'API Token',
        value: 'api-token' as const,
        description: 'Simpler setup, no app registration needed',
      },
    ],
  });

  let creds: JiraCredentials;

  if (authMethod === 'api-token') {
    console.log('\n[wok3] API Token setup');
    console.log('Create a token at: https://id.atlassian.com/manage-profile/security/api-tokens\n');

    const baseUrl = (await input({
      message: 'Jira site URL',
      required: true,
      validate: (v) => v.trim() ? true : 'URL is required.',
    })).replace(/\/$/, '');

    const email = await input({
      message: 'Email',
      required: true,
      validate: (v) => v.trim() ? true : 'Email is required.',
    });

    const token = await password({
      message: 'API Token',
      validate: (v) => v.trim() ? true : 'Token is required.',
    });

    creds = {
      authMethod: 'api-token',
      apiToken: { baseUrl, email, token },
    };
  } else {
    console.log('\n[wok3] OAuth 2.0 setup');
    console.log('Create an OAuth app at: https://developer.atlassian.com/console\n');

    const clientId = await input({
      message: 'Client ID',
      required: true,
      validate: (v) => v.trim() ? true : 'Client ID is required.',
    });

    const clientSecret = await password({
      message: 'Client Secret',
      validate: (v) => v.trim() ? true : 'Client Secret is required.',
    });

    console.log('[wok3] Starting OAuth flow...');

    const tokens = await runOAuthFlow(clientId, clientSecret);
    const { cloudId, siteUrl } = await discoverCloudId(tokens.accessToken);

    creds = {
      authMethod: 'oauth',
      oauth: {
        clientId,
        clientSecret,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
        cloudId,
        siteUrl,
      },
    };
  }

  const defaultProjectKey = await input({
    message: 'Default project key (e.g. PROJ, optional)',
  });

  saveJiraCredentials(configDir, creds);

  if (defaultProjectKey) {
    saveJiraProjectConfig(configDir, { defaultProjectKey: defaultProjectKey.toUpperCase() });
  }

  // Test connection
  console.log('\n[wok3] Testing connection...');
  try {
    const user = await testConnection(creds, configDir);
    console.log(`[wok3] Connected as: ${user}`);
  } catch (err) {
    console.error(`[wok3] Connection test failed: ${err}`);
    process.exit(1);
  }

  console.log('\n[wok3] Jira connected successfully!');
  console.log('[wok3] Credentials saved to .wok3/credentials.json (make sure it\'s gitignored)');
}

function copyEnvFilesForTask(sourceDir: string, targetDir: string, worktreesDir: string): void {
  const copyEnvRecursive = (src: string, dest: string, relPath = '') => {
    try {
      const entries = readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        const displayPath = relPath ? `${relPath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          if (entry.name === path.basename(worktreesDir)) continue;
          copyEnvRecursive(srcPath, destPath, displayPath);
        } else if (entry.isFile() && entry.name.startsWith('.env')) {
          if (!existsSync(destPath)) {
            const destDir = path.dirname(destPath);
            if (!existsSync(destDir)) {
              mkdirSync(destDir, { recursive: true });
            }
            copyFileSync(srcPath, destPath);
            console.log(`[wok3] Copied ${displayPath} to worktree`);
          }
        }
      }
    } catch {
      // Directory may not exist or be unreadable
    }
  };

  copyEnvRecursive(sourceDir, targetDir);
}

async function runTask(taskId: string) {
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
    const configContent = JSON.parse(readFileSync(configPath, 'utf-8'));
    const { getApiBase, getAuthHeaders } = await import('./jira/client');
    const base = getApiBase(creds);
    const headers = await getAuthHeaders(creds, configDir);

    const resp = await fetch(`${base}/issue/${encodeURIComponent(key)}?fields=attachment`, { headers });
    if (resp.ok) {
      const issue = (await resp.json()) as { fields: { attachment: Array<{ filename: string; content: string; mimeType: string; size: number }> } };
      const { downloadAttachments } = await import('./jira/client');
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

  const worktreesDir = path.isAbsolute(config.worktreesDir)
    ? config.worktreesDir
    : path.join(configDir, config.worktreesDir);

  if (!existsSync(worktreesDir)) {
    mkdirSync(worktreesDir, { recursive: true });
  }

  const worktreePath = path.join(worktreesDir, branchName);

  if (existsSync(worktreePath)) {
    console.log(`[wok3] Worktree directory already exists: ${worktreePath}`);
    console.log('[wok3] Linking to existing worktree instead.');
    taskData.linkedWorktree = branchName;
    saveTaskData(taskData as import('./jira/types').JiraTaskData, tasksDir);
    return;
  }

  console.log(`[wok3] Creating worktree at ${worktreePath} (branch: ${branchName})...`);

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
  copyEnvFilesForTask(configDir, worktreePath, worktreesDir);

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
  saveTaskData(taskData as import('./jira/types').JiraTaskData, tasksDir);
  console.log(`[wok3] Worktree linked to task ${taskData.key}`);
}

async function linkWorktreeToTask(
  taskData: { key: string; linkedWorktree: string | null },
  configDir: string,
  tasksDir: string,
) {
  const { config } = loadConfig();
  const worktreesDir = path.isAbsolute(config.worktreesDir)
    ? config.worktreesDir
    : path.join(configDir, config.worktreesDir);

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
  saveTaskData(taskData as import('./jira/types').JiraTaskData, tasksDir);
  console.log(`[wok3] Task ${taskData.key} linked to worktree: ${chosen}`);
}

async function main() {
  const subcommand = process.argv[2];

  if (subcommand === 'init') {
    await runInit();
    return;
  }

  if (subcommand === 'connect') {
    await runConnect();
    return;
  }

  if (subcommand === 'task') {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('[wok3] Usage: wok3 task <TASK_ID>');
      process.exit(1);
    }
    await runTask(taskId);
    return;
  }

  console.log('[wok3] Starting...');

  const { config, configPath } = loadConfig();

  console.log('[wok3] Configuration:');
  console.log(`  Project directory: ${config.projectDir}`);
  console.log(`  Worktrees directory: ${config.worktreesDir}`);
  console.log(`  Start command: ${config.startCommand || '(not set)'}`);
  console.log(`  Install command: ${config.installCommand || '(not set)'}`);
  console.log(`  Base branch: ${config.baseBranch}`);
  console.log(
    `  Discovered ports: ${config.ports.discovered.length > 0 ? config.ports.discovered.join(', ') : '(none - run discovery)'}`,
  );
  console.log(`  Offset step: ${config.ports.offsetStep}`);
  const envMappingKeys = config.envMapping ? Object.keys(config.envMapping) : [];
  console.log(
    `  Env mappings: ${envMappingKeys.length > 0 ? envMappingKeys.join(', ') : '(none)'}`,
  );
  console.log(`  Server port: ${config.serverPort}`);
  console.log('');

  await startWorktreeServer(config, configPath);

  console.log('');
  console.log(
    `  Open http://localhost:${config.serverPort} to manage worktrees`,
  );
  console.log('');
}

main().catch((error) => {
  console.error('[wok3] Fatal error:', error);
  process.exit(1);
});
