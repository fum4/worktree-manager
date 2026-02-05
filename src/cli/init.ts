import { execFileSync } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import { PortManager } from '../server/port-manager';
import type { PortConfig, WorktreeConfig } from '../server/types';
import { findConfigFile, CONFIG_DIR_NAME, CONFIG_FILE_NAME, type ConfigFile } from './config';

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
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

function detectPackageManager(projectDir: string): string | null {
  if (existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(projectDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(path.join(projectDir, 'package-lock.json'))) return 'npm';
  if (existsSync(path.join(projectDir, 'bun.lockb'))) return 'bun';
  return null;
}

function detectInstallCommand(projectDir: string): string | null {
  const pm = detectPackageManager(projectDir);
  return pm ? `${pm} install` : null;
}

function detectStartCommand(projectDir: string): string | null {
  const pm = detectPackageManager(projectDir);
  if (!pm) return null;
  // yarn and pnpm can run scripts directly, npm needs "run"
  return pm === 'npm' ? 'npm run dev' : `${pm} dev`;
}

export async function runInit() {
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

  const detectedStartCommand = detectStartCommand(resolvedProjectDir);
  let startCommand = '';
  while (!startCommand) {
    startCommand = (await prompt(
      rl,
      detectedStartCommand
        ? `Dev start command [${detectedStartCommand}]: `
        : 'Dev start command: ',
    )) || detectedStartCommand || '';
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
    (await prompt(rl, 'Manager UI port [6969]: ')) || '6969',
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

  // Create .gitignore to protect local/sensitive files
  // Use whitelist approach: ignore everything except config.json and .gitignore
  const gitignorePath = path.join(configDirPath, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `# Ignore everything in .wok3 by default
*

# Except these files (tracked/shared)
!.gitignore
!config.json
`);
    // Stage the gitignore so it gets committed
    try {
      execFileSync('git', ['add', gitignorePath], { cwd: resolvedProjectDir, stdio: 'pipe' });
    } catch {
      // Ignore - user can commit manually
    }
  }

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
