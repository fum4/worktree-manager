import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

import { PortManager } from './port-manager';
import type {
  RunningProcess,
  WorktreeConfig,
  WorktreeCreateRequest,
  WorktreeInfo,
} from './types';

const MAX_LOG_LINES = 100;

export class WorktreeManager {
  private config: WorktreeConfig;

  private portManager: PortManager;

  private runningProcesses: Map<string, RunningProcess> = new Map();

  private eventListeners: Set<(worktrees: WorktreeInfo[]) => void> = new Set();

  constructor(config: WorktreeConfig, configFilePath: string | null = null) {
    this.config = config;
    this.portManager = new PortManager(config, configFilePath);

    const worktreesPath = this.getWorktreesAbsolutePath();
    if (!existsSync(worktreesPath)) {
      mkdirSync(worktreesPath, { recursive: true });
    }
  }

  private getWorktreesAbsolutePath(): string {
    if (path.isAbsolute(this.config.worktreesDir)) {
      return this.config.worktreesDir;
    }
    return path.join(process.cwd(), this.config.worktreesDir);
  }

  getPortManager(): PortManager {
    return this.portManager;
  }

  subscribe(listener: (worktrees: WorktreeInfo[]) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private notifyListeners(): void {
    const worktrees = this.getWorktrees();
    this.eventListeners.forEach((listener) => listener(worktrees));
  }

  private getGitRoot(): string {
    const worktreesPath = this.getWorktreesAbsolutePath();
    try {
      return execFileSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        cwd: worktreesPath,
      }).trim();
    } catch {
      return execFileSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        cwd: process.cwd(),
      }).trim();
    }
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

      const branch = this.getWorktreeBranch(worktreePath);
      const runningInfo = this.runningProcesses.get(entry.name);

      worktrees.push({
        id: entry.name,
        path: worktreePath,
        branch: branch || 'unknown',
        status: runningInfo ? 'running' : 'stopped',
        ports: runningInfo?.ports ?? [],
        offset: runningInfo?.offset ?? null,
        pid: runningInfo?.pid ?? null,
        lastActivity: runningInfo?.lastActivity,
        logs: runningInfo?.logs ?? [],
      });
    }

    return worktrees;
  }

  private getWorktreeBranch(worktreePath: string): string | null {
    try {
      const headPath = path.join(worktreePath, '.git');
      if (!existsSync(headPath)) return null;

      const gitContent = readFileSync(headPath, 'utf-8').trim();
      const gitDirMatch = gitContent.match(/^gitdir: (.+)$/);
      if (!gitDirMatch) return null;

      const [, gitDir] = gitDirMatch;
      const headRefPath = path.join(gitDir, 'HEAD');

      if (!existsSync(headRefPath)) return null;

      const headRef = readFileSync(headRefPath, 'utf-8').trim();
      const branchMatch = headRef.match(/^ref: refs\/heads\/(.+)$/);

      return branchMatch ? branchMatch[1] : headRef.slice(0, 7);
    } catch {
      return null;
    }
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

    if (this.runningProcesses.size >= this.config.maxInstances) {
      return {
        success: false,
        error: `Maximum instances (${this.config.maxInstances}) reached. Stop another worktree first.`,
      };
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
        `[worktree-manager] Starting ${id} at ${workingDir} (ports: ${portsDisplay})`,
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
          `[worktree-manager] Worktree "${id}" exited with code ${code}`,
        );
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          this.portManager.releaseOffset(processInfo.offset);
        }
        this.runningProcesses.delete(id);
        this.notifyListeners();
      });

      childProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        const lines = output.split('\n').filter((l: string) => l.trim());
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          processInfo.logs.push(...lines);
          if (processInfo.logs.length > MAX_LOG_LINES) {
            processInfo.logs.splice(0, processInfo.logs.length - MAX_LOG_LINES);
          }
        }
        if (output.includes('ready in') || output.includes('Local:')) {
          this.notifyListeners();
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const lines = data
          .toString()
          .split('\n')
          .filter((l: string) => l.trim());
        const processInfo = this.runningProcesses.get(id);
        if (processInfo) {
          processInfo.logs.push(...lines);
          if (processInfo.logs.length > MAX_LOG_LINES) {
            processInfo.logs.splice(0, processInfo.logs.length - MAX_LOG_LINES);
          }
        }
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

  private validateBranchName(branch: string): boolean {
    const validBranchRegex = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;
    return validBranchRegex.test(branch) && !branch.includes('..');
  }

  async createWorktree(
    request: WorktreeCreateRequest,
  ): Promise<{ success: boolean; worktree?: WorktreeInfo; error?: string }> {
    const { branch, id } = request;

    if (!this.validateBranchName(branch)) {
      return { success: false, error: 'Invalid branch name' };
    }

    const worktreeId =
      id ||
      branch
        .replace(/^(feature|fix|chore)\//, '')
        .replace(/[^a-zA-Z0-9-]/g, '-');

    if (!/^[a-zA-Z0-9-]+$/.test(worktreeId)) {
      return { success: false, error: 'Invalid worktree ID' };
    }

    const worktreesPath = this.getWorktreesAbsolutePath();
    const worktreePath = path.join(worktreesPath, worktreeId);

    if (existsSync(worktreePath)) {
      return {
        success: false,
        error: `Worktree "${worktreeId}" already exists`,
      };
    }

    try {
      const gitRoot = this.getGitRoot();

      try {
        execFileSync('git', ['fetch', 'origin', branch], {
          cwd: gitRoot,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
      } catch {
        // Branch might not exist on remote
      }

      try {
        execFileSync(
          'git',
          ['worktree', 'add', worktreePath, '-b', branch, this.config.baseBranch],
          {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          },
        );
      } catch {
        try {
          execFileSync('git', ['worktree', 'add', worktreePath, branch], {
            cwd: gitRoot,
            encoding: 'utf-8',
            stdio: 'pipe',
          });
        } catch {
          execFileSync(
            'git',
            ['worktree', 'add', worktreePath, '-B', branch, `origin/${branch}`],
            {
              cwd: gitRoot,
              encoding: 'utf-8',
              stdio: 'pipe',
            },
          );
        }
      }

      console.log(
        `[worktree-manager] Installing dependencies in ${worktreeId}...`,
      );
      execFileSync('yarn', ['install'], {
        cwd: worktreePath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const worktree: WorktreeInfo = {
        id: worktreeId,
        path: worktreePath,
        branch,
        status: 'stopped',
        ports: [],
        offset: null,
        pid: null,
      };

      this.notifyListeners();
      return { success: true, worktree };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create worktree',
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

      execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: gitRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

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

  getLogs(id: string): string[] {
    const processInfo = this.runningProcesses.get(id);
    return processInfo?.logs ?? [];
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.runningProcesses.keys()).map((id) =>
      this.stopWorktree(id),
    );
    await Promise.all(stopPromises);
  }

  getConfig(): WorktreeConfig {
    return this.config;
  }
}
