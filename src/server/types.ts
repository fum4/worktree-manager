import type { ChildProcess } from 'child_process';

export interface PortConfig {
  /** Ports discovered by running the dev command and monitoring with lsof */
  discovered: number[];
  /** How much to increment ports per worktree instance (default: 1) */
  offsetStep: number;
}

export interface WorktreeConfig {
  /** Subdirectory to cd into before running command (e.g., "apps/storefront") */
  projectDir: string;
  /** Directory where worktrees are stored (e.g., ".worktrees") */
  worktreesDir: string;
  /** Command to start dev server in each worktree */
  startCommand: string;
  /** Base branch to create worktrees from (e.g., "origin/develop", "origin/main") */
  baseBranch: string;
  /** Port configuration for multi-port offset */
  ports: PortConfig;
  /** Env var templates with port references, e.g. { "VITE_API_URL": "http://localhost:${4000}" } */
  envMapping?: Record<string, string>;
  /** Maximum concurrent running worktrees (default: 5) */
  maxInstances: number;
  /** Port for the manager server (default: 3100) */
  serverPort: number;
}

export interface WorktreeInfo {
  /** Unique identifier (typically ticket ID like ADH-1234) */
  id: string;
  /** Absolute path to worktree directory */
  path: string;
  /** Git branch name */
  branch: string;
  /** Current status */
  status: 'running' | 'stopped' | 'starting' | 'creating';
  /** Status message for in-progress operations like creation */
  statusMessage?: string;
  /** All offset ports if running */
  ports: number[];
  /** Port offset applied to this worktree */
  offset: number | null;
  /** Process ID if running, null if stopped */
  pid: number | null;
  /** Last activity timestamp */
  lastActivity?: number;
  /** Output logs */
  logs?: string[];
}

export interface WorktreeCreateRequest {
  /** Branch name to checkout */
  branch: string;
  /** Worktree ID (defaults to branch name sanitized) */
  id?: string;
  /** Explicit worktree name (display name / directory), falls back to sanitized branch */
  name?: string;
}

export interface WorktreeRenameRequest {
  /** New worktree name (renames directory) */
  name?: string;
  /** New branch name */
  branch?: string;
}

export interface WorktreeResponse {
  success: boolean;
  error?: string;
  worktree?: WorktreeInfo;
  ports?: number[];
  pid?: number;
}

export interface WorktreeListResponse {
  worktrees: WorktreeInfo[];
}

export interface RunningProcess {
  pid: number;
  ports: number[];
  offset: number;
  process: ChildProcess;
  lastActivity: number;
  logs: string[];
  logNotifyTimer?: ReturnType<typeof setTimeout>;
}
