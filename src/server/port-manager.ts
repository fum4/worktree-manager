import { execFileSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { PortConfig, WorktreeConfig } from './types';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const DISCOVERY_STABILIZE_MS = 15_000;

export class PortManager {
  private config: WorktreeConfig;

  private usedOffsets: Set<number> = new Set();

  private configFilePath: string | null;

  constructor(config: WorktreeConfig, configFilePath: string | null = null) {
    this.config = config;
    this.configFilePath = configFilePath;
  }

  getDiscoveredPorts(): number[] {
    return [...this.config.ports.discovered];
  }

  getOffsetStep(): number {
    return this.config.ports.offsetStep;
  }

  allocateOffset(): number {
    const step = this.config.ports.offsetStep;
    let offset = step;
    while (this.usedOffsets.has(offset)) {
      offset += step;
    }
    this.usedOffsets.add(offset);
    return offset;
  }

  releaseOffset(offset: number): void {
    this.usedOffsets.delete(offset);
  }

  getPortsForOffset(offset: number): number[] {
    return this.config.ports.discovered.map((port) => port + offset);
  }

  getHookPath(): string {
    // In dist, the hook is at dist/runtime/port-hook.cjs
    // In dev/src, it's at src/runtime/port-hook.cjs
    const distHook = path.resolve(currentDir, '..', 'runtime', 'port-hook.cjs');
    if (existsSync(distHook)) {
      return distHook;
    }
    // Fallback: look relative to project root
    const srcHook = path.resolve(
      currentDir,
      '..',
      '..',
      'src',
      'runtime',
      'port-hook.cjs',
    );
    if (existsSync(srcHook)) {
      return srcHook;
    }
    return distHook;
  }

  getEnvForOffset(offset: number): Record<string, string> {
    if (this.config.ports.discovered.length === 0) {
      return {};
    }

    const hookPath = this.getHookPath();
    const existingNodeOptions = process.env.NODE_OPTIONS || '';
    const requireFlag = `--require ${hookPath}`;

    const nodeOptions = existingNodeOptions
      ? `${existingNodeOptions} ${requireFlag}`
      : requireFlag;

    return {
      NODE_OPTIONS: nodeOptions,
      __WM_PORT_OFFSET__: String(offset),
      __WM_KNOWN_PORTS__: JSON.stringify(this.config.ports.discovered),
    };
  }

  async discoverPorts(
    onLog?: (message: string) => void,
  ): Promise<{ ports: number[]; error?: string }> {
    const log = onLog || console.log;

    log('[port-discovery] Starting dev command to discover ports...');

    const [cmd, ...args] = this.config.startCommand.split(' ');
    const workingDir =
      this.config.projectDir && this.config.projectDir !== '.'
        ? path.resolve(process.cwd(), this.config.projectDir)
        : process.cwd();

    if (!existsSync(workingDir)) {
      return {
        ports: [],
        error: `Project directory "${workingDir}" not found`,
      };
    }

    const child = spawn(cmd, args, {
      cwd: workingDir,
      env: { ...process.env, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: true,
    });

    const pid = child.pid;
    if (!pid) {
      return { ports: [], error: 'Failed to spawn discovery process' };
    }

    log(`[port-discovery] Spawned process (PID: ${pid}), waiting for stabilization...`);

    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        log(`[port-discovery:stdout] ${line}`);
      }
    });

    child.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((l: string) => l.trim());
      for (const line of lines) {
        log(`[port-discovery:stderr] ${line}`);
      }
    });

    // Wait for processes to stabilize
    await new Promise((resolve) => {
      setTimeout(resolve, DISCOVERY_STABILIZE_MS);
    });

    log('[port-discovery] Scanning for listening ports...');

    let ports: number[] = [];
    try {
      // Get all child PIDs recursively
      const allPids = this.getProcessTree(pid);
      log(`[port-discovery] Process tree PIDs: ${allPids.join(', ')}`);

      if (allPids.length > 0) {
        ports = this.getListeningPorts(allPids);
        log(`[port-discovery] Discovered ports: ${ports.join(', ') || '(none)'}`);
      }
    } catch (err) {
      log(
        `[port-discovery] Error scanning ports: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Kill the discovery process tree
    log('[port-discovery] Cleaning up discovery process...');
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
    }

    // Wait a moment for cleanup
    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    // Force kill if still alive
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // Already dead
    }

    if (ports.length > 0) {
      this.config.ports.discovered = ports;
      this.persistDiscoveredPorts(ports);
    }

    return { ports };
  }

  private getProcessTree(rootPid: number): number[] {
    const pids: Set<number> = new Set([rootPid]);
    const queue = [rootPid];

    while (queue.length > 0) {
      const parentPid = queue.shift()!;
      try {
        const output = execFileSync(
          'pgrep',
          ['-P', String(parentPid)],
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim();

        if (output) {
          for (const line of output.split('\n')) {
            const childPid = parseInt(line.trim(), 10);
            if (!isNaN(childPid) && !pids.has(childPid)) {
              pids.add(childPid);
              queue.push(childPid);
            }
          }
        }
      } catch {
        // pgrep returns non-zero if no children found
      }
    }

    return Array.from(pids);
  }

  private getListeningPorts(pids: number[]): number[] {
    try {
      const pidList = pids.join(',');
      const output = execFileSync(
        'lsof',
        ['-P', '-n', '-iTCP', '-sTCP:LISTEN', '-a', '-p', pidList],
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );

      const ports: Set<number> = new Set();
      for (const line of output.split('\n')) {
        // Match lines like: node    12345 user   23u  IPv4 ... TCP *:3000 (LISTEN)
        const match = line.match(/:(\d+)\s+\(LISTEN\)/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!isNaN(port) && port !== this.config.serverPort) {
            ports.add(port);
          }
        }
      }

      return Array.from(ports).sort((a, b) => a - b);
    } catch {
      return [];
    }
  }

  private persistDiscoveredPorts(ports: number[]): void {
    if (!this.configFilePath) return;

    try {
      const content = readFileSync(this.configFilePath, 'utf-8');
      const config = JSON.parse(content);
      if (!config.ports) {
        config.ports = {};
      }
      config.ports.discovered = ports;
      writeFileSync(
        this.configFilePath,
        JSON.stringify(config, null, 2) + '\n',
      );
      console.log(
        `[port-discovery] Saved discovered ports to ${this.configFilePath}`,
      );
    } catch (err) {
      console.error(
        '[port-discovery] Failed to persist discovered ports:',
        err instanceof Error ? err.message : err,
      );
    }
  }
}
