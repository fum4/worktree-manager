import { execFile as execFileCb, execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

import { copyEnvFiles } from '../core/env-files';
import { getGitRoot, getWorktreeBranch, validateBranchName } from '../core/git';
import { GitHubManager } from '../integrations/github/github-manager';
import {
  loadJiraCredentials,
  loadJiraProjectConfig,
} from '../integrations/jira/credentials';
import {
  fetchIssue,
  resolveTaskKey,
  saveTaskData,
} from '../integrations/jira/api';
import {
  loadLinearCredentials,
  loadLinearProjectConfig,
} from '../integrations/linear/credentials';
import {
  fetchIssue as fetchLinearIssue,
  resolveIdentifier as resolveLinearIdentifier,
  saveTaskData as saveLinearTaskData,
} from '../integrations/linear/api';
import type { LinearTaskData } from '../integrations/linear/types';

import { PortManager } from './port-manager';
import type {
  RunningProcess,
  WorktreeConfig,
  WorktreeCreateRequest,
  WorktreeInfo,
  WorktreeRenameRequest,
} from './types';

const MAX_LOG_LINES = 100;

// ANSI color helpers for terminal log prefixes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Distinct colors for worktree names (bright, easy to distinguish)
const WORKTREE_COLORS = [
  '\x1b[36m', // cyan
  '\x1b[33m', // yellow
  '\x1b[35m', // magenta
  '\x1b[32m', // green
  '\x1b[34m', // blue
  '\x1b[91m', // bright red
  '\x1b[96m', // bright cyan
  '\x1b[93m', // bright yellow
  '\x1b[95m', // bright magenta
  '\x1b[92m', // bright green
];

let worktreeColorIndex = 0;
const worktreeColorMap = new Map<string, string>();

function getWorktreeColor(id: string): string {
  let color = worktreeColorMap.get(id);
  if (!color) {
    color = WORKTREE_COLORS[worktreeColorIndex % WORKTREE_COLORS.length];
    worktreeColorIndex++;
    worktreeColorMap.set(id, color);
  }
  return color;
}

export class WorktreeManager {
  private config: WorktreeConfig;

  private configDir: string;

  private configFilePath: string | null;

  private portManager: PortManager;

  private runningProcesses: Map<string, RunningProcess> = new Map();

  private creatingWorktrees: Map<string, WorktreeInfo> = new Map();

  private githubManager: GitHubManager | null = null;

  private eventListeners: Set<(worktrees: WorktreeInfo[]) => void> = new Set();

  constructor(config: WorktreeConfig, configFilePath: string | null = null) {
    this.config = config;
    this.configFilePath = configFilePath;
    this.configDir = configFilePath ? path.dirname(path.dirname(configFilePath)) : process.cwd();
    this.portManager = new PortManager(config, configFilePath);

    const worktreesPath = this.getWorktreesAbsolutePath();
    if (!existsSync(worktreesPath)) {
      mkdirSync(worktreesPath, { recursive: true });
    }
  }

  // Reload config from disk (after initialization via UI)
  reloadConfig(): void {
    // Determine the config file path
    const configPath = this.configFilePath ?? path.join(this.configDir, '.wok3', 'config.json');

    if (!existsSync(configPath)) {
      return;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(content);

      // Update the config
      this.config = {
        projectDir: fileConfig.projectDir ?? this.config.projectDir,
        startCommand: fileConfig.startCommand ?? this.config.startCommand,
        installCommand: fileConfig.installCommand ?? this.config.installCommand,
        baseBranch: fileConfig.baseBranch ?? this.config.baseBranch,
        ports: {
          discovered: fileConfig.ports?.discovered ?? this.config.ports.discovered,
          offsetStep: fileConfig.ports?.offsetStep ?? this.config.ports.offsetStep,
        },
        envMapping: fileConfig.envMapping ?? this.config.envMapping,
        serverPort: fileConfig.serverPort ?? this.config.serverPort,
      };

      // Update the config file path for future reloads
      this.configFilePath = configPath;

      // Recreate port manager with new config
      this.portManager = new PortManager(this.config, configPath);

      // Ensure worktrees directory exists
      const worktreesPath = this.getWorktreesAbsolutePath();
      if (!existsSync(worktreesPath)) {
        mkdirSync(worktreesPath, { recursive: true });
      }
    } catch (error) {
      console.error('[wok3] Failed to reload config:', error);
    }
  }

  private getWorktreesAbsolutePath(): string {
    return path.join(this.configDir, '.wok3', 'worktrees');
  }

  getPortManager(): PortManager {
    return this.portManager;
  }

  getGitHubManager(): GitHubManager | null {
    return this.githubManager;
  }

  async initGitHub(): Promise<void> {
    this.githubManager = new GitHubManager();
    try {
      await this.githubManager.initialize(this.getGitRoot());
      this.githubManager.startPolling(
        () => this.getWorktrees(),
        () => this.notifyListeners(),
      );
      const status = this.githubManager.getStatus();
      if (status.repo) {
        console.log(`[wok3] GitHub: connected to ${status.repo}`);
      } else if (!status.installed) {
        console.log('[wok3] GitHub: gh CLI not found, GitHub features disabled');
      } else if (!status.authenticated) {
        console.log('[wok3] GitHub: not authenticated, run "gh auth login"');
      }
    } catch {
      console.log('[wok3] GitHub: initialization failed, features disabled');
      this.githubManager = null;
    }
  }

  subscribe(listener: (worktrees: WorktreeInfo[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notifyListeners(): void {
    const worktrees = this.getWorktrees();
    this.eventListeners.forEach((listener) => listener(worktrees));
  }

  getGitRoot(): string {
    return getGitRoot(this.getWorktreesAbsolutePath());
  }

  getWorktrees(): WorktreeInfo[] {
    const worktrees: WorktreeInfo[] = [];
    const worktreesPath = this.getWorktreesAbsolutePath();

    if (!existsSync(worktreesPath)) {
      return worktrees;
    }

    const entries = readdirSync(worktreesPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const worktreePath = path.join(worktreesPath, entry.name);
      const gitPath = path.join(worktreePath, '.git');

      if (!existsSync(gitPath)) continue;

      // Skip entries that are still being created (they appear via creatingWorktrees)
      if (this.creatingWorktrees.has(entry.name)) continue;

      const branch = getWorktreeBranch(worktreePath);
      const runningInfo = this.runningProcesses.get(entry.name);

      const info: WorktreeInfo = {
        id: entry.name,
        path: worktreePath,
        branch: branch || 'unknown',
        status: runningInfo ? 'running' : 'stopped',
        ports: runningInfo?.ports ?? [],
        offset: runningInfo?.offset ?? null,
        pid: runningInfo?.pid ?? null,
        lastActivity: runningInfo?.lastActivity,
        logs: runningInfo?.logs ?? [],
      };

      // Check for linked task (Jira or Linear)
      const taskFile = path.join(this.configDir, '.wok3', 'tasks', entry.name, 'task.json');
      if (existsSync(taskFile)) {
        try {
          const taskData = JSON.parse(readFileSync(taskFile, 'utf-8'));
          if (taskData.source === 'linear') {
            if (taskData.url) info.linearUrl = taskData.url;
            if (taskData.status) info.linearStatus = taskData.status;
          } else {
            // Jira (default for backward compat)
            if (taskData.url) info.jiraUrl = taskData.url;
            if (taskData.status) info.jiraStatus = taskData.status;
          }
        } catch {
          // Ignore corrupt task files
        }
      }

      // Populate GitHub info from cache
      if (this.githubManager) {
        const pr = this.githubManager.getCachedPR(entry.name);
        if (pr) {
          info.githubPrUrl = pr.url;
          info.githubPrState = pr.isDraft ? 'draft' : pr.state;
        }
        const git = this.githubManager.getCachedGitStatus(entry.name);
        if (git) {
          info.hasUncommitted = git.hasUncommitted;
          info.hasUnpushed = git.ahead > 0 || git.noUpstream;
          info.commitsAhead = git.noUpstream ? 0 : git.ahead;
        }
      }

      worktrees.push(info);
    }

    // Append in-progress creations
    for (const creating of this.creatingWorktrees.values()) {
      worktrees.push(creating);
    }

    return worktrees;
  }

  private copyWorktreeEnvFiles(worktreePath: string): void {
    copyEnvFiles(this.configDir, worktreePath, this.getWorktreesAbsolutePath());
  }

  async startWorktree(
    id: string,
  ): Promise<{
    success: boolean;
    ports?: number[];
    pid?: number;
    error?: string;
  }> {
    if (this.runningProcesses.has(id)) {
      const info = this.runningProcesses.get(id)!;
      return { success: true, ports: info.ports, pid: info.pid };
    }

    const worktreesPath = this.getWorktreesAbsolutePath();
    const worktreePath = path.join(worktreesPath, id);
    if (!existsSync(worktreePath)) {
      return { success: false, error: `Worktree "${id}" not found` };
    }

    const workingDir =
      this.config.projectDir && this.config.projectDir !== '.'
        ? path.join(worktreePath, this.config.projectDir)
        : worktreePath;

    if (!existsSync(workingDir)) {
      return {
        success: false,
        error: `Project directory "${this.config.projectDir}" not found in worktree`,
      };
    }

    try {
      const [cmd, ...args] = this.config.startCommand.split(' ');

      // Allocate a port offset for this worktree
      const offset = this.portManager.allocateOffset();
      const portEnv = this.portManager.getEnvForOffset(offset);
      const ports = this.portManager.getPortsForOffset(offset);

      const portsDisplay =
        ports.length > 0 ? ports.join(', ') : `offset=${offset}`;
      console.log(
        `[wok3] Starting ${id} at ${workingDir} (ports: ${portsDisplay})`,
      );

      const childProcess = spawn(cmd, args, {
        cwd: workingDir,
        env: { ...process.env, ...portEnv, FORCE_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        detached: false,
      });

      const pid = childProcess.pid!;
      const logs: string[] = [];

      this.runningProcesses.set(id, {
        pid,
        ports,
        offset,
        process: childProcess,
        lastActivity: Date.now(),
        logs,
      });

      childProcess.on('exit', (code) => {
        console.log(
          `[wok3] Worktree "${id}" exited with code ${code}`,
        );
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          this.portManager.releaseOffset(processInfo.offset);
        }
        this.runningProcesses.delete(id);
        this.notifyListeners();
      });

      const wtColor = getWorktreeColor(id);
      const coloredName = `${BOLD}${wtColor}${id}${RESET}`;
      const linePrefix = `${DIM}[${RESET}${coloredName}${DIM}]${RESET}`;

      const scheduleLogNotify = () => {
        const info = this.runningProcesses.get(id);
        if (info) {
          if (info.logNotifyTimer) clearTimeout(info.logNotifyTimer);
          info.logNotifyTimer = setTimeout(() => {
            info.logNotifyTimer = undefined;
            this.notifyListeners();
          }, 250);
        }
      };

      childProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((l: string) => l.trim());
        lines.forEach((line: string) =>
          process.stdout.write(`${linePrefix} ${line}\n`),
        );
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          processInfo.logs.push(...lines);
          if (processInfo.logs.length > MAX_LOG_LINES) {
            processInfo.logs.splice(0, processInfo.logs.length - MAX_LOG_LINES);
          }
        }
        scheduleLogNotify();
      });

      childProcess.stderr?.on('data', (data) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((l: string) => l.trim());
        lines.forEach((line: string) =>
          process.stderr.write(`${linePrefix} ${line}\n`),
        );
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          processInfo.logs.push(...lines);
          if (processInfo.logs.length > MAX_LOG_LINES) {
            processInfo.logs.splice(0, processInfo.logs.length - MAX_LOG_LINES);
          }
        }
        scheduleLogNotify();
      });

      this.notifyListeners();
      return { success: true, ports, pid };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to start process',
      };
    }
  }

  async stopWorktree(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    const processInfo = this.runningProcesses.get(id);
    if (!processInfo) {
      return { success: true };
    }

    this.portManager.releaseOffset(processInfo.offset);

    try {
      process.kill(-processInfo.pid, 'SIGTERM');
    } catch {
      try {
        processInfo.process.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
    }

    this.runningProcesses.delete(id);
    this.notifyListeners();

    return { success: true };
  }


  async createWorktree(
    request: WorktreeCreateRequest,
  ): Promise<{ success: boolean; worktree?: WorktreeInfo; error?: string; code?: string; worktreeId?: string }> {
    const { branch, id } = request;

    if (!validateBranchName(branch)) {
      return { success: false, error: 'Invalid branch name' };
    }

    const worktreeId =
      request.name ||
      id ||
      branch
        .replace(/^(feature|fix|chore)\//, '')
        .replace(/[^a-zA-Z0-9-]/g, '-');

    if (!/^[a-zA-Z0-9-]+$/.test(worktreeId)) {
      return { success: false, error: 'Invalid worktree ID' };
    }

    const worktreesPath = this.getWorktreesAbsolutePath();
    const worktreePath = path.join(worktreesPath, worktreeId);

    // Check if worktree directory exists OR if git has a stale worktree entry
    const gitRoot = this.getGitRoot();
    const worktreeExistsOnDisk = existsSync(worktreePath);
    let gitWorktreeExists = false;

    try {
      const { stdout } = await execFile('git', ['worktree', 'list', '--porcelain'], {
        cwd: gitRoot,
        encoding: 'utf-8',
      });
      gitWorktreeExists = stdout.includes(worktreePath);
    } catch {
      // Ignore - assume no conflict
    }

    if (worktreeExistsOnDisk || gitWorktreeExists) {
      return {
        success: false,
        error: `Worktree "${worktreeId}" already exists`,
        code: 'WORKTREE_EXISTS',
        worktreeId,
      };
    }

    if (this.creatingWorktrees.has(worktreeId)) {
      return {
        success: false,
        error: `Worktree "${worktreeId}" is already being created`,
      };
    }

    // Check if repo has any commits BEFORE starting async creation
    // This allows the frontend to show the setup modal
    try {
      execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      return {
        success: false,
        error: 'Repository has no commits yet. Create an initial commit from the Integrations panel or run: git add . && git commit -m "Initial commit"',
      };
    }

    // Create placeholder entry for immediate UI feedback
    const placeholder: WorktreeInfo = {
      id: worktreeId,
      path: worktreePath,
      branch,
      status: 'creating',
      statusMessage: 'Fetching branch...',
      ports: [],
      offset: null,
      pid: null,
    };

    this.creatingWorktrees.set(worktreeId, placeholder);
    this.notifyListeners();

    // Run the actual creation async — don't block the HTTP response
    this.runCreateWorktree(worktreeId, branch, worktreePath).catch(() => {
      // Error handling is done inside runCreateWorktree
    });

    return { success: true, worktree: placeholder };
  }

  private async runCreateWorktree(
    worktreeId: string,
    branch: string,
    worktreePath: string,
  ): Promise<void> {
    const updateStatus = (statusMessage: string) => {
      const entry = this.creatingWorktrees.get(worktreeId);
      if (entry) {
        entry.statusMessage = statusMessage;
        this.notifyListeners();
      }
    };

    try {
      const gitRoot = this.getGitRoot();

      // Step 1: Fetch
      try {
        await execFile('git', ['fetch', 'origin', branch], {
          cwd: gitRoot,
          encoding: 'utf-8',
        });
      } catch {
        // Branch might not exist on remote
      }

      // Step 2: Create worktree
      updateStatus('Creating worktree...');

      // Determine the best base ref to use
      let baseRef = this.config.baseBranch;
      let baseRefValid = false;
      try {
        // Check if configured baseBranch exists
        await execFile('git', ['rev-parse', '--verify', baseRef], {
          cwd: gitRoot,
          encoding: 'utf-8',
        });
        baseRefValid = true;
      } catch {
        // baseBranch doesn't exist - try fallbacks
      }

      if (!baseRefValid) {
        const fallbacks = ['main', 'master', 'HEAD'];
        for (const fallback of fallbacks) {
          try {
            await execFile('git', ['rev-parse', '--verify', fallback], {
              cwd: gitRoot,
              encoding: 'utf-8',
            });
            baseRef = fallback;
            baseRefValid = true;
            break;
          } catch {
            // Try next fallback
          }
        }
      }

      if (!baseRefValid) {
        throw new Error(`No valid base branch found. Configure baseBranch in settings.`);
      }

      // Prune stale worktree references before creating
      try {
        await execFile('git', ['worktree', 'prune'], { cwd: gitRoot, encoding: 'utf-8' });
      } catch {
        // Ignore prune errors - not critical
      }

      // Try to create the worktree with various strategies
      try {
        // New branch from baseRef (e.g. origin/develop)
        await execFile(
          'git',
          ['worktree', 'add', worktreePath, '-b', branch, baseRef],
          { cwd: gitRoot, encoding: 'utf-8' },
        );
      } catch {
        try {
          // Branch already exists locally — check it out
          await execFile('git', ['worktree', 'add', worktreePath, branch], {
            cwd: gitRoot,
            encoding: 'utf-8',
          });
        } catch {
          // Branch exists but is conflicting — force-reset from baseRef
          await execFile(
            'git',
            ['worktree', 'add', worktreePath, '-B', branch, baseRef],
            { cwd: gitRoot, encoding: 'utf-8' },
          );
        }
      }

      // Step 2.5: Copy .env* files from main project to worktree
      this.copyWorktreeEnvFiles(worktreePath);

      // Step 3: Install dependencies
      updateStatus('Installing dependencies...');
      console.log(
        `[wok3] Installing dependencies in ${worktreeId}...`,
      );
      const [installCmd, ...installArgs] = this.config.installCommand.split(' ');
      await execFile(installCmd, installArgs, {
        cwd: worktreePath,
        encoding: 'utf-8',
      });

      // Done — remove from creating map; getWorktrees() will pick it up from filesystem
      this.creatingWorktrees.delete(worktreeId);
      this.notifyListeners();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create worktree';
      console.error(`[wok3] Failed to create ${worktreeId}: ${message}`);
      updateStatus(`Error: ${message}`);

      // Remove after a delay so the user can see the error
      setTimeout(() => {
        this.creatingWorktrees.delete(worktreeId);
        this.notifyListeners();
      }, 5000);
    }
  }

  async renameWorktree(
    currentId: string,
    request: WorktreeRenameRequest,
  ): Promise<{ success: boolean; error?: string }> {
    if (this.runningProcesses.has(currentId)) {
      return {
        success: false,
        error: 'Cannot rename a running worktree. Stop it first.',
      };
    }

    const worktreesPath = this.getWorktreesAbsolutePath();
    const currentPath = path.join(worktreesPath, currentId);

    if (!existsSync(currentPath)) {
      return { success: false, error: `Worktree "${currentId}" not found` };
    }

    if (!request.name && !request.branch) {
      return { success: false, error: 'Nothing to rename' };
    }

    try {
      const gitRoot = this.getGitRoot();

      // Rename directory (worktree name)
      if (request.name && request.name !== currentId) {
        if (!/^[a-zA-Z0-9-]+$/.test(request.name)) {
          return { success: false, error: 'Invalid worktree name' };
        }

        const newPath = path.join(worktreesPath, request.name);
        if (existsSync(newPath)) {
          return {
            success: false,
            error: `Worktree "${request.name}" already exists`,
          };
        }

        execFileSync('git', ['worktree', 'move', currentPath, newPath], {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        // Update color map
        const color = worktreeColorMap.get(currentId);
        if (color) {
          worktreeColorMap.delete(currentId);
          worktreeColorMap.set(request.name, color);
        }
      }

      // Rename branch
      if (request.branch) {
        if (!validateBranchName(request.branch)) {
          return { success: false, error: 'Invalid branch name' };
        }

        const worktreeCwd = request.name
          ? path.join(worktreesPath, request.name)
          : currentPath;

        const currentBranch = getWorktreeBranch(worktreeCwd);
        if (currentBranch && currentBranch !== request.branch) {
          execFileSync(
            'git',
            ['branch', '-m', currentBranch, request.branch],
            {
              cwd: worktreeCwd,
              encoding: 'utf-8',
              stdio: 'pipe',
            },
          );
        }
      }

      this.notifyListeners();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to rename worktree',
      };
    }
  }

  async removeWorktree(
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return { success: false, error: 'Invalid worktree ID' };
    }

    await this.stopWorktree(id);

    const worktreesPath = this.getWorktreesAbsolutePath();
    const worktreePath = path.join(worktreesPath, id);
    if (!existsSync(worktreePath)) {
      return { success: true };
    }

    try {
      const gitRoot = this.getGitRoot();

      try {
        execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch {
        // Git doesn't recognize it as a worktree — remove the directory directly
        execFileSync('rm', ['-rf', worktreePath], {
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        // Clean up any stale worktree references
        try {
          execFileSync('git', ['worktree', 'prune'], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          // Ignore prune failures
        }
      }

      this.notifyListeners();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to remove worktree',
      };
    }
  }

  async recoverWorktree(
    worktreeId: string,
    action: 'reuse' | 'recreate',
    branch?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const worktreesPath = this.getWorktreesAbsolutePath();
    const worktreePath = path.join(worktreesPath, worktreeId);
    const gitRoot = this.getGitRoot();
    const branchName = branch || worktreeId;

    try {
      if (action === 'recreate') {
        // First, forcefully remove the existing worktree
        try {
          execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          // Directory might not exist in git's view, try direct removal
        }

        // Remove the directory if it still exists
        if (existsSync(worktreePath)) {
          execFileSync('rm', ['-rf', worktreePath], {
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        }

        // Prune stale worktree entries
        try {
          execFileSync('git', ['worktree', 'prune'], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          // Ignore prune failures
        }

        // Delete the branch if it exists (start completely fresh)
        try {
          execFileSync('git', ['branch', '-D', branchName], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          // Branch might not exist, that's fine
        }

        // Now create the worktree fresh
        return this.createWorktree({ branch: branchName, name: worktreeId });
      } else {
        // Reuse: preserve existing branch and its commits

        // Prune stale worktree entries first
        try {
          execFileSync('git', ['worktree', 'prune'], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          // Ignore prune failures
        }

        // Check if the directory already exists and is valid
        if (existsSync(worktreePath)) {
          try {
            execFileSync('git', ['rev-parse', '--git-dir'], {
              cwd: worktreePath,
              encoding: 'utf-8',
              stdio: 'pipe',
            });
            // Directory exists and is valid, just notify and return
            this.notifyListeners();
            return { success: true };
          } catch {
            // Directory exists but is not a valid worktree, remove it
            execFileSync('rm', ['-rf', worktreePath], {
              encoding: 'utf-8',
              stdio: 'pipe',
            });
          }
        }

        // Directory doesn't exist - check if branch exists so we can restore
        let branchExists = false;
        try {
          execFileSync('git', ['rev-parse', '--verify', branchName], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
          branchExists = true;
        } catch {
          branchExists = false;
        }

        if (!branchExists) {
          return {
            success: false,
            error: `Branch "${branchName}" does not exist. Choose "Recreate" to create a new branch.`,
          };
        }

        // Branch exists - create worktree directory pointing to it
        try {
          execFileSync('git', ['worktree', 'add', worktreePath, branchName], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch (err) {
          return {
            success: false,
            error: `Failed to restore worktree: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        this.notifyListeners();
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to recover worktree',
      };
    }
  }

  getLogs(id: string): string[] {
    const processInfo = this.runningProcesses.get(id);
    return processInfo?.logs ?? [];
  }

  async stopAll(): Promise<void> {
    this.githubManager?.stopPolling();
    const stopPromises = Array.from(this.runningProcesses.keys()).map((id) =>
      this.stopWorktree(id),
    );
    await Promise.all(stopPromises);
  }

  getProjectName(): string | null {
    try {
      const pkgPath = path.join(this.configDir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.name || null;
    } catch {
      return null;
    }
  }

  getConfig(): WorktreeConfig {
    return this.config;
  }

  getConfigDir(): string {
    return this.configDir;
  }

  updateConfig(partial: Partial<WorktreeConfig>): { success: boolean; error?: string } {
    const configPath = path.join(this.configDir, '.wok3', 'config.json');

    try {
      let existing: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        existing = JSON.parse(readFileSync(configPath, 'utf-8'));
      }

      // Merge allowed top-level fields
      const allowedKeys = [
        'startCommand', 'installCommand', 'baseBranch',
        'projectDir', 'serverPort',
      ] as const;

      for (const key of allowedKeys) {
        if (key in partial && partial[key] !== undefined) {
          existing[key] = partial[key];
          (this.config as unknown as Record<string, unknown>)[key] = partial[key];
        }
      }

      // Handle nested ports.offsetStep
      if (partial.ports?.offsetStep !== undefined) {
        const ports = (existing.ports ?? {}) as Record<string, unknown>;
        ports.offsetStep = partial.ports.offsetStep;
        existing.ports = ports;
        this.config.ports.offsetStep = partial.ports.offsetStep;
      }

      // Handle envMapping
      if (partial.envMapping !== undefined) {
        existing.envMapping = partial.envMapping;
        this.config.envMapping = partial.envMapping;
      }

      writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update config',
      };
    }
  }

  async createWorktreeFromJira(
    issueKey: string,
    branch?: string,
  ): Promise<{
    success: boolean;
    task?: { key: string; summary: string; status: string; type: string; url: string };
    error?: string;
    code?: string;
    worktreeId?: string;
  }> {
    const creds = loadJiraCredentials(this.configDir);
    if (!creds) {
      return { success: false, error: 'Jira credentials not configured' };
    }

    const projectConfig = loadJiraProjectConfig(this.configDir);
    let resolvedKey: string;
    try {
      resolvedKey = resolveTaskKey(issueKey, projectConfig);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Invalid task key',
      };
    }

    let taskData;
    try {
      taskData = await fetchIssue(resolvedKey, creds, this.configDir);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch issue',
      };
    }

    // Save task data locally
    const tasksDir = path.join(this.configDir, '.wok3', 'tasks');
    saveTaskData(taskData, tasksDir);

    // Create worktree using custom branch or issue key as branch name
    const worktreeBranch = branch?.trim() || resolvedKey;
    const result = await this.createWorktree({ branch: worktreeBranch, name: resolvedKey });

    if (!result.success) {
      return { success: false, error: result.error, code: result.code, worktreeId: result.worktreeId };
    }

    return {
      success: true,
      task: {
        key: taskData.key,
        summary: taskData.summary,
        status: taskData.status,
        type: taskData.type,
        url: taskData.url,
      },
    };
  }

  async createWorktreeFromLinear(
    identifier: string,
    branch?: string,
  ): Promise<{
    success: boolean;
    task?: { identifier: string; title: string; status: string; url: string };
    error?: string;
    code?: string;
    worktreeId?: string;
  }> {
    const creds = loadLinearCredentials(this.configDir);
    if (!creds) {
      return { success: false, error: 'Linear credentials not configured' };
    }

    const projectConfig = loadLinearProjectConfig(this.configDir);
    let resolvedId: string;
    try {
      resolvedId = resolveLinearIdentifier(identifier, projectConfig);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Invalid identifier',
      };
    }

    let issueDetail;
    try {
      issueDetail = await fetchLinearIssue(resolvedId, creds);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch issue',
      };
    }

    // Save task data locally
    const tasksDir = path.join(this.configDir, '.wok3', 'tasks');
    const taskData: LinearTaskData = {
      source: 'linear',
      identifier: issueDetail.identifier,
      title: issueDetail.title,
      description: issueDetail.description,
      status: issueDetail.state.name,
      priority: issueDetail.priority,
      assignee: issueDetail.assignee,
      labels: issueDetail.labels,
      createdAt: issueDetail.createdAt,
      updatedAt: issueDetail.updatedAt,
      comments: issueDetail.comments,
      linkedWorktree: null,
      fetchedAt: new Date().toISOString(),
      url: issueDetail.url,
    };
    saveLinearTaskData(taskData, tasksDir);

    // Create worktree using custom branch or identifier as branch name
    const worktreeBranch = branch?.trim() || resolvedId;
    const result = await this.createWorktree({ branch: worktreeBranch, name: resolvedId });

    if (!result.success) {
      return { success: false, error: result.error, code: result.code, worktreeId: result.worktreeId };
    }

    return {
      success: true,
      task: {
        identifier: issueDetail.identifier,
        title: issueDetail.title,
        status: issueDetail.state.name,
        url: issueDetail.url,
      },
    };
  }
}
