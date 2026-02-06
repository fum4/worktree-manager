import { execFile } from 'child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import path from 'path';

import { CONFIG_DIR_NAME } from '../../constants';
import type { JiraCredentials, JiraProjectConfig } from './types';

const CREDENTIALS_FILE = 'credentials.json';
const CONFIG_FILE = 'config.json';

function ensureCredentialsGitignored(configDir: string): void {
  const wok3Dir = path.join(configDir, '.wok3');
  const gitignorePath = path.join(wok3Dir, '.gitignore');

  // Use whitelist approach: ignore everything except config.json and .gitignore
  const expectedContent = `# Ignore everything in .wok3 by default
*

# Except these files (tracked/shared)
!.gitignore
!config.json
`;

  try {
    // Only create if missing (init.ts should have created it)
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, expectedContent);
      // Stage the gitignore so it gets committed and appears in all worktrees
      execFile('git', ['add', gitignorePath], { cwd: configDir }, () => {
        // Ignore errors - user can commit manually
      });
    }
  } catch {
    // Ignore errors - not critical, user was warned
  }
}

export function loadJiraCredentials(configDir: string): JiraCredentials | null {
  const credPath = path.join(configDir, CONFIG_DIR_NAME, CREDENTIALS_FILE);
  if (!existsSync(credPath)) return null;
  try {
    const data = JSON.parse(readFileSync(credPath, 'utf-8'));
    return data.jira ?? null;
  } catch {
    return null;
  }
}

export function saveJiraCredentials(configDir: string, creds: JiraCredentials): void {
  const wok3Dir = path.join(configDir, '.wok3');
  const credPath = path.join(wok3Dir, CREDENTIALS_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(credPath)) {
    try {
      existing = JSON.parse(readFileSync(credPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  existing.jira = creds;
  writeFileSync(credPath, JSON.stringify(existing, null, 2) + '\n');

  // Ensure credentials file is gitignored
  ensureCredentialsGitignored(configDir);
}

export function loadJiraProjectConfig(configDir: string): JiraProjectConfig {
  const configPath = path.join(configDir, CONFIG_DIR_NAME, CONFIG_FILE);
  if (!existsSync(configPath)) return {};
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    return data.jira ?? {};
  } catch {
    return {};
  }
}

export function saveJiraProjectConfig(configDir: string, config: JiraProjectConfig): void {
  const configPath = path.join(configDir, CONFIG_DIR_NAME, CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  existing.jira = config;
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
}
