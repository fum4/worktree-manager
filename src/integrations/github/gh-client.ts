import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

import type { GitHubConfig, GitStatusInfo, PRInfo } from './types';

const execFile = promisify(execFileCb);

export async function checkGhInstalled(): Promise<boolean> {
  try {
    await execFile('which', ['gh']);
    return true;
  } catch {
    return false;
  }
}

export async function checkGhAuth(): Promise<boolean> {
  try {
    await execFile('gh', ['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}

export async function getGhUsername(): Promise<string | null> {
  try {
    const { stdout } = await execFile('gh', ['api', 'user', '--jq', '.login'], { encoding: 'utf-8' });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function getRepoInfo(cwd: string): Promise<GitHubConfig | null> {
  try {
    const { stdout } = await execFile(
      'gh',
      ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'],
      { cwd, encoding: 'utf-8' },
    );
    const data = JSON.parse(stdout);
    const [owner, repo] = (data.nameWithOwner as string).split('/');
    const defaultBranch = data.defaultBranchRef?.name || 'main';
    return { owner, repo, defaultBranch };
  } catch {
    return null;
  }
}

export async function findPRForBranch(
  owner: string,
  repo: string,
  branch: string,
): Promise<PRInfo | null> {
  try {
    const { stdout } = await execFile(
      'gh',
      [
        'api',
        `repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all&per_page=1`,
      ],
      { encoding: 'utf-8' },
    );
    const prs = JSON.parse(stdout);
    if (!Array.isArray(prs) || prs.length === 0) return null;
    const pr = prs[0];
    return {
      url: pr.html_url,
      number: pr.number,
      state: pr.state === 'closed' && pr.merged_at ? 'merged' : pr.state,
      isDraft: pr.draft ?? false,
      title: pr.title,
    };
  } catch {
    return null;
  }
}

export async function getGitStatus(worktreePath: string): Promise<GitStatusInfo> {
  let hasUncommitted = false;
  let ahead = 0;
  let behind = 0;

  try {
    const { stdout } = await execFile('git', ['status', '--porcelain'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    });
    hasUncommitted = stdout.trim().length > 0;
  } catch {
    // Ignore
  }

  try {
    const { stdout } = await execFile(
      'git',
      ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'],
      { cwd: worktreePath, encoding: 'utf-8' },
    );
    const parts = stdout.trim().split(/\s+/);
    ahead = parseInt(parts[0], 10) || 0;
    behind = parseInt(parts[1], 10) || 0;
  } catch {
    // No upstream configured — treat as unpushed if there are commits
    try {
      const { stdout } = await execFile('git', ['log', '--oneline', '-1'], {
        cwd: worktreePath,
        encoding: 'utf-8',
      });
      if (stdout.trim().length > 0) {
        ahead = 1; // Signal that branch has no upstream
      }
    } catch {
      // Ignore
    }
  }

  return { hasUncommitted, ahead, behind };
}

export async function commitAll(
  worktreePath: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFile('git', ['add', '-A'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    });
    await execFile('git', ['commit', '-m', message], {
      cwd: worktreePath,
      encoding: 'utf-8',
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Commit failed',
    };
  }
}

export async function pushBranch(
  worktreePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await execFile('git', ['push', '--set-upstream', 'origin', 'HEAD'], {
      cwd: worktreePath,
      encoding: 'utf-8',
    });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Push failed',
    };
  }
}

export async function createPR(
  worktreePath: string,
  title: string,
  body?: string,
  baseBranch?: string,
): Promise<{ success: boolean; pr?: PRInfo; error?: string }> {
  try {
    const args = ['pr', 'create', '--title', title];
    if (body) args.push('--body', body);
    if (baseBranch) args.push('--base', baseBranch);

    const { stdout } = await execFile('gh', args, {
      cwd: worktreePath,
      encoding: 'utf-8',
    });

    // gh pr create outputs the PR URL on stdout
    const url = stdout.trim();
    const numberMatch = url.match(/\/pull\/(\d+)/);
    const number = numberMatch ? parseInt(numberMatch[1], 10) : 0;

    return {
      success: true,
      pr: {
        url,
        number,
        state: 'OPEN',
        isDraft: false,
        title,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create PR',
    };
  }
}
