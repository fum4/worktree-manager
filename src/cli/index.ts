#!/usr/bin/env node

import { execFile, execFileSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { startWorktreeServer } from '../server/index';
import { findConfigFile, loadConfig } from './config';

const cliDir = path.dirname(fileURLToPath(import.meta.url));

function findElectron(): { type: 'app'; appPath: string } | { type: 'dev'; electronBin: string; projectRoot: string } | null {
  if (process.platform !== 'darwin') return null;

  // 1. Check for installed .app bundle
  try {
    const result = execFileSync('mdfind', [
      'kMDItemCFBundleIdentifier == "com.wok3.app"',
    ], { encoding: 'utf-8', timeout: 3000 });
    const appPath = result.trim().split('\n')[0];
    if (appPath && existsSync(appPath)) {
      return { type: 'app', appPath };
    }
  } catch { /* ignore */ }

  // 2. Check for electron binary in the wok3 project's node_modules
  //    (dev mode — cliDir is dist/cli or src/cli)
  const projectRoot = path.resolve(cliDir, '..', '..');
  const electronBin = path.join(projectRoot, 'node_modules', '.bin', 'electron');
  const electronMain = path.join(projectRoot, 'dist', 'electron', 'main.js');
  if (existsSync(electronBin) && existsSync(electronMain)) {
    return { type: 'dev', electronBin, projectRoot };
  }

  return null;
}

function openUI(port: number): void {
  const electron = findElectron();

  if (electron?.type === 'app') {
    console.log(`  Opening in wok3 app...`);
    execFile('open', [`wok3://open?port=${port}`], (err) => {
      if (err) {
        console.log(`  Falling back to browser...`);
        openBrowser(`http://localhost:${port}`);
      }
    });
  } else if (electron?.type === 'dev') {
    console.log(`  Opening in wok3 electron (dev)...`);
    const child = spawn(electron.electronBin, [electron.projectRoot, '--port', String(port)], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } else {
    openBrowser(`http://localhost:${port}`);
  }
}

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

  // Auto-run init if no config found
  if (!findConfigFile()) {
    console.log('[wok3] No configuration found. Starting setup wizard...');
    console.log('');
    const { runInit } = await import('./init');
    await runInit();
  }

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

  const noOpen = process.argv.includes('--no-open');
  if (!noOpen) {
    const url = `http://localhost:${config.serverPort}`;
    console.log('');
    console.log(`  Opening ${url}`);
    console.log('');
    openUI(config.serverPort);
  }
}

main().catch((error) => {
  console.error('[wok3] Fatal error:', error);
  process.exit(1);
});
