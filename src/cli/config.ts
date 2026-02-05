import { existsSync, readFileSync } from 'fs';
import path from 'path';

import type { PortConfig, WorktreeConfig } from '../server/types';

export const CONFIG_DIR_NAME = '.wok3';
export const CONFIG_FILE_NAME = 'config.json';

export interface ConfigFile {
  projectDir?: string;
  worktreesDir?: string;
  startCommand?: string;
  installCommand?: string;
  baseBranch?: string;
  ports?: Partial<PortConfig>;
  envMapping?: Record<string, string>;
  serverPort?: number;
}

export function findConfigFile(): string | null {
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

export function loadConfig(): { config: WorktreeConfig; configPath: string | null } {
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
    serverPort: 6969,
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

export function findConfigDir(): string | null {
  const configPath = findConfigFile();
  if (!configPath) return null;
  // configPath is like /path/to/project/.wok3/config.json → project dir is two levels up
  return path.dirname(path.dirname(configPath));
}
