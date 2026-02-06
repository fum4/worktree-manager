import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { CONFIG_DIR_NAME } from '../../constants';
import type { LinearCredentials, LinearProjectConfig } from './types';

const CREDENTIALS_FILE = 'credentials.json';
const CONFIG_FILE = 'config.json';

export function loadLinearCredentials(configDir: string): LinearCredentials | null {
  const credPath = path.join(configDir, CONFIG_DIR_NAME, CREDENTIALS_FILE);
  if (!existsSync(credPath)) return null;
  try {
    const data = JSON.parse(readFileSync(credPath, 'utf-8'));
    return data.linear ?? null;
  } catch {
    return null;
  }
}

export function saveLinearCredentials(configDir: string, creds: LinearCredentials): void {
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

  existing.linear = creds;
  writeFileSync(credPath, JSON.stringify(existing, null, 2) + '\n');
}

export function loadLinearProjectConfig(configDir: string): LinearProjectConfig {
  const configPath = path.join(configDir, CONFIG_DIR_NAME, CONFIG_FILE);
  if (!existsSync(configPath)) return {};
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf-8'));
    return data.linear ?? {};
  } catch {
    return {};
  }
}

export function saveLinearProjectConfig(configDir: string, config: LinearProjectConfig): void {
  const configPath = path.join(configDir, CONFIG_DIR_NAME, CONFIG_FILE);

  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      // Start fresh
    }
  }

  existing.linear = config;
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + '\n');
}
