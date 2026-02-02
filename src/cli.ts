#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

import { startWorktreeServer, PortManager } from './server/index';
import type { PortConfig, WorktreeConfig } from './server/types';

const CONFIG_FILE_NAME = '.worktree-manager.json';

interface ConfigFile {
  projectDir?: string;
  worktreesDir?: string;
  startCommand?: string;
  baseBranch?: string;
  ports?: Partial<PortConfig>;
  envMapping?: Record<string, string>;
  maxInstances?: number;
  serverPort?: number;
}

function findConfigFile(): string | null {
  let currentDir = process.cwd();
  const { root } = path.parse(currentDir);

  while (currentDir !== root) {
    const configPath = path.join(currentDir, CONFIG_FILE_NAME);
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

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function runInit() {
  const existingConfig = findConfigFile();
  if (existingConfig) {
    console.log(`[worktree-manager] Config already exists at ${existingConfig}`);
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
    console.error('[worktree-manager] Not inside a git repository.');
    process.exit(1);
  }

  console.log('[worktree-manager] Initializing configuration...\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const projectDir = (await prompt(
    rl,
    `Project directory (absolute or relative to cwd) [.]: `,
  )) || '.';

  const resolvedProjectDir = path.resolve(process.cwd(), projectDir);

  if (!existsSync(resolvedProjectDir)) {
    console.error(`[worktree-manager] Directory "${resolvedProjectDir}" does not exist.`);
    rl.close();
    process.exit(1);
  }

  const detectedBranch = detectDefaultBranch();
  const baseBranch = (await prompt(
    rl,
    `Base branch for new worktrees [${detectedBranch}]: `,
  )) || detectedBranch;

  const startCommand = (await prompt(
    rl,
    'Dev start command [yarn dev]: ',
  )) || 'yarn dev';

  const serverPort = parseInt(
    (await prompt(rl, 'Manager UI port [3100]: ')) || '3100',
    10,
  );

  const maxInstances = parseInt(
    (await prompt(rl, 'Max concurrent worktrees [5]: ')) || '5',
    10,
  );

  const worktreesDir = (await prompt(
    rl,
    'Worktrees directory [.worktrees]: ',
  )) || '.worktrees';

  rl.close();

  const config: ConfigFile = {
    worktreesDir,
    startCommand,
    baseBranch,
    maxInstances,
    serverPort,
    ports: {
      discovered: [],
      offsetStep: 1,
    },
  };

  const configPath = path.join(resolvedProjectDir, CONFIG_FILE_NAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  console.log(`\n[worktree-manager] Config written to ${configPath}`);

  // Auto-detect env var mappings if ports are already known
  if (config.ports?.discovered && config.ports.discovered.length > 0) {
    const tempConfig: WorktreeConfig = {
      projectDir: projectDir,
      worktreesDir: worktreesDir,
      startCommand,
      baseBranch,
      ports: config.ports as PortConfig,
      maxInstances,
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
  console.log('  1. Run `worktree-manager` to start the manager UI');
  console.log('  2. Click "Discover Ports" in the UI to auto-detect all ports');
  console.log('  3. Create worktrees and start them — ports are offset automatically');
  console.log('');
}

function loadConfig(): { config: WorktreeConfig; configPath: string | null } {
  const configPath = findConfigFile();

  const defaults: WorktreeConfig = {
    projectDir: '.',
    worktreesDir: '.worktrees',
    startCommand: 'yarn dev',
    baseBranch: 'origin/main',
    ports: {
      discovered: [],
      offsetStep: 1,
    },
    maxInstances: 5,
    serverPort: 3100,
  };

  if (!configPath) {
    console.log(
      `[worktree-manager] No ${CONFIG_FILE_NAME} found, using defaults`,
    );
    console.log(
      `[worktree-manager] Run "worktree-manager init" to create a config file`,
    );
    return { config: defaults, configPath: null };
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const fileConfig: ConfigFile = JSON.parse(content);

    const configDir = path.dirname(configPath);
    if (configDir !== process.cwd()) {
      console.log(`[worktree-manager] Found config at ${configPath}`);
      process.chdir(configDir);
      console.log(
        `[worktree-manager] Changed working directory to ${configDir}`,
      );
    }

    const config: WorktreeConfig = {
      projectDir: fileConfig.projectDir ?? defaults.projectDir,
      worktreesDir: fileConfig.worktreesDir ?? defaults.worktreesDir,
      startCommand: fileConfig.startCommand ?? defaults.startCommand,
      baseBranch: fileConfig.baseBranch ?? defaults.baseBranch,
      ports: {
        discovered: fileConfig.ports?.discovered ?? defaults.ports.discovered,
        offsetStep: fileConfig.ports?.offsetStep ?? defaults.ports.offsetStep,
      },
      envMapping: fileConfig.envMapping,
      maxInstances: fileConfig.maxInstances ?? defaults.maxInstances,
      serverPort: fileConfig.serverPort ?? defaults.serverPort,
    };

    return { config, configPath };
  } catch (error) {
    console.error(
      `[worktree-manager] Failed to load config from ${configPath}:`,
      error,
    );
    return { config: defaults, configPath: null };
  }
}

async function main() {
  const subcommand = process.argv[2];

  if (subcommand === 'init') {
    await runInit();
    return;
  }

  console.log('[worktree-manager] Starting...');

  const { config, configPath } = loadConfig();

  console.log('[worktree-manager] Configuration:');
  console.log(`  Project directory: ${config.projectDir}`);
  console.log(`  Worktrees directory: ${config.worktreesDir}`);
  console.log(`  Start command: ${config.startCommand}`);
  console.log(`  Base branch: ${config.baseBranch}`);
  console.log(
    `  Discovered ports: ${config.ports.discovered.length > 0 ? config.ports.discovered.join(', ') : '(none - run discovery)'}`,
  );
  console.log(`  Offset step: ${config.ports.offsetStep}`);
  const envMappingKeys = config.envMapping ? Object.keys(config.envMapping) : [];
  console.log(
    `  Env mappings: ${envMappingKeys.length > 0 ? envMappingKeys.join(', ') : '(none)'}`,
  );
  console.log(`  Max instances: ${config.maxInstances}`);
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
  console.error('[worktree-manager] Fatal error:', error);
  process.exit(1);
});
