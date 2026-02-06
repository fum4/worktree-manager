#!/usr/bin/env node

import { execFile, execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { startWorktreeServer } from '../server/index';
import { findConfigFile, loadConfig } from './config';

const cliDir = path.dirname(fileURLToPath(import.meta.url));
const LOCK_FILE = path.join(os.homedir(), '.wok3', 'electron.lock');

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

function isElectronRunning(): boolean {
  try {
    if (!existsSync(LOCK_FILE)) return false;
    const data = JSON.parse(readFileSync(LOCK_FILE, 'utf-8'));
    // Check if the process is still running
    if (data.pid) {
      try {
        process.kill(data.pid, 0); // Signal 0 = check if process exists
        return true;
      } catch {
        return false;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function openProjectInElectron(projectDir: string): void {
  const encodedDir = encodeURIComponent(projectDir);
  const url = `wok3://open-project?dir=${encodedDir}`;

  if (process.platform === 'darwin') {
    execFile('open', [url], (err) => {
      if (err) {
        console.error('[wok3] Failed to open in Electron:', err.message);
      }
    });
  } else {
    // On other platforms, try xdg-open
    execFile('xdg-open', [url], () => {});
  }
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

  const noOpen = process.argv.includes('--no-open') || process.env.WOK3_NO_OPEN === '1';
  const autoInit = process.argv.includes('--auto-init') || process.env.WOK3_AUTO_INIT === '1';
  const portOverride = process.env.WOK3_PORT ? parseInt(process.env.WOK3_PORT, 10) : null;
  const projectDir = process.cwd();

  console.log('[wok3] Starting...');

  // Check if Electron app is already running
  // If so, open this project as a new tab instead of starting a new server
  if (!noOpen && isElectronRunning()) {
    console.log('[wok3] Electron app is already running.');
    console.log('[wok3] Opening project in existing window...');
    openProjectInElectron(projectDir);
    return;
  }

  // Auto-run init if no config found
  if (!findConfigFile()) {
    if (autoInit) {
      // Auto-initialize with default config for Electron spawned servers
      console.log('[wok3] No configuration found. Auto-initializing...');
      const { autoInitConfig } = await import('./init');
      await autoInitConfig(projectDir);
    } else {
      console.log('[wok3] No configuration found. Starting setup wizard...');
      console.log('');
      const { runInit } = await import('./init');
      await runInit();
    }
  }

  const { config, configPath } = loadConfig();

  // Apply port override if specified
  if (portOverride) {
    config.serverPort = portOverride;
  }

  console.log('[wok3] Configuration:');
  console.log(`  Project directory: ${config.projectDir}`);
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
