#!/usr/bin/env node

import { execFile } from 'child_process';

import { startWorktreeServer } from '../server/index';
import { loadConfig } from './config';

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  execFile(cmd, [url], () => {});
}

async function main() {
  const subcommand = process.argv[2];

  if (subcommand === 'init') {
    const { runInit } = await import('./init');
    await runInit();
    return;
  }

  if (subcommand === 'connect') {
    const { runConnect } = await import('./connect');
    await runConnect();
    return;
  }

  if (subcommand === 'mcp') {
    const { config, configPath } = loadConfig();
    const { startMcpServer } = await import('../mcp');
    await startMcpServer(config, configPath);
    return;
  }

  if (subcommand === 'task') {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('[wok3] Usage: wok3 task <TASK_ID>');
      process.exit(1);
    }
    const { runTask } = await import('./task');
    await runTask(taskId);
    return;
  }

  console.log('[wok3] Starting...');

  const { config, configPath } = loadConfig();

  console.log('[wok3] Configuration:');
  console.log(`  Project directory: ${config.projectDir}`);
  console.log(`  Worktrees directory: ${config.worktreesDir}`);
  console.log(`  Start command: ${config.startCommand || '(not set)'}`);
  console.log(`  Install command: ${config.installCommand || '(not set)'}`);
  console.log(`  Base branch: ${config.baseBranch}`);
  console.log(
    `  Discovered ports: ${config.ports.discovered.length > 0 ? config.ports.discovered.join(', ') : '(none - run discovery)'}`,
  );
  console.log(`  Offset step: ${config.ports.offsetStep}`);
  const envMappingKeys = config.envMapping ? Object.keys(config.envMapping) : [];
  console.log(
    `  Env mappings: ${envMappingKeys.length > 0 ? envMappingKeys.join(', ') : '(none)'}`,
  );
  console.log(`  Server port: ${config.serverPort}`);
  console.log('');

  await startWorktreeServer(config, configPath);

  const url = `http://localhost:${config.serverPort}`;
  console.log('');
  console.log(`  Opening ${url}`);
  console.log('');
  openBrowser(url);
}

main().catch((error) => {
  console.error('[wok3] Fatal error:', error);
  process.exit(1);
});
