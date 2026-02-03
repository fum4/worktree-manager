import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import type { JiraCredentials, JiraProjectConfig } from './types';

const CREDENTIALS_FILE = 'credentials.json';
const CONFIG_FILE = 'config.json';

export function loadJiraCredentials(configDir: string): JiraCredentials | null {
  const credPath = path.join(configDir, '.wok3', CREDENTIALS_FILE);
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
}

export function loadJiraProjectConfig(configDir: string): JiraProjectConfig {
  const configPath = path.join(configDir, '.wok3', CONFIG_FILE);
  if (!existsSync(configPath)) return {};
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    return data.jira ?? {};
  } catch {
    return {};
  }
}

export function saveJiraProjectConfig(configDir: string, config: JiraProjectConfig): void {
  const configPath = path.join(configDir, '.wok3', CONFIG_FILE);

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
