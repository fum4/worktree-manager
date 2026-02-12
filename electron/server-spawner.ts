import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// In dev mode, we're in electron/ directory
// In prod, we're in dist/electron/ directory
const isDev = currentDir.includes('/electron') && !currentDir.includes('/dist/');
const projectRoot = isDev
  ? path.resolve(currentDir, '..')
  : path.resolve(currentDir, '..', '..');

export function spawnServer(
  projectDir: string,
  port: number,
): ChildProcess {
  // Path to the CLI entry point
  const cliPath = isDev
    ? path.join(projectRoot, 'dist', 'cli', 'index.js')
    : path.join(projectRoot, 'dist', 'cli', 'index.js');

  // --no-open: don't open browser/electron
  const args = ['--no-open'];

  const child = spawn('node', [cliPath, ...args], {
    cwd: projectDir,
    env: {
      ...process.env,
      WORK3_PORT: String(port),
      WORK3_NO_OPEN: '1',
    },
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Log server output for debugging
  child.stdout?.on('data', (data: Buffer) => {
    console.log(`[server:${port}] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[server:${port}] ${data.toString().trim()}`);
  });

  return child;
}

export async function waitForServerReady(
  port: number,
  timeout = 30000
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}/api/config`);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

export async function stopServer(process: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (!process || process.killed) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      // Force kill if graceful shutdown takes too long
      process.kill('SIGKILL');
      resolve();
    }, 5000);

    process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    // Send graceful shutdown signal
    process.kill('SIGTERM');
  });
}
