import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import type { Hono } from 'hono';

import { detectConfig } from '../../shared/detect-config';
import type { WorktreeManager } from '../manager';

export function registerConfigRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/config', (c) => {
    // Check if config file still exists (user may have deleted .wok3 folder)
    const configPath = path.join(manager.getConfigDir(), '.wok3', 'config.json');
    if (!existsSync(configPath)) {
      return c.json({ config: null, projectName: null });
    }

    const config = manager.getConfig();
    const projectName = manager.getProjectName();
    return c.json({ config, projectName });
  });

  app.patch('/api/config', async (c) => {
    try {
      const body = await c.req.json();
      const result = manager.updateConfig(body);
      return c.json(result, result.success ? 200 : 400);
    } catch (error) {
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid request' },
        400,
      );
    }
  });

  app.get('/api/ports', (c) => {
    const portManager = manager.getPortManager();
    return c.json({
      discovered: portManager.getDiscoveredPorts(),
      offsetStep: portManager.getOffsetStep(),
    });
  });

  app.post('/api/discover', async (c) => {
    const portManager = manager.getPortManager();
    const logs: string[] = [];

    const result = await portManager.discoverPorts((message) => {
      logs.push(message);
    });

    return c.json({
      success: result.ports.length > 0,
      ports: result.ports,
      logs,
      error: result.error,
    });
  });

  app.post('/api/detect-env', (c) => {
    const portManager = manager.getPortManager();
    const mapping = portManager.detectEnvMapping(portManager.getProjectDir());
    if (Object.keys(mapping).length > 0) {
      portManager.persistEnvMapping(mapping);
    }

    return c.json({
      success: true,
      envMapping: mapping,
    });
  });

  // Check if .wok3 config files need to be committed
  app.get('/api/config/setup-status', (c) => {
    const projectDir = manager.getConfigDir();
    const configPath = path.join(projectDir, '.wok3', 'config.json');

    if (!existsSync(configPath)) {
      return c.json({ needsCommit: false, files: [] });
    }

    try {
      // Check if .wok3/config.json has ever been committed
      // git log returns empty if file was never committed (even if staged)
      const logResult = execFileSync('git', ['log', '-1', '--', '.wok3/config.json'], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      // If no commits found for this file, it needs to be committed
      const needsCommit = logResult === '';

      return c.json({
        needsCommit,
        files: needsCommit ? ['.wok3/config.json', '.wok3/.gitignore'] : [],
      });
    } catch {
      return c.json({ needsCommit: false, files: [] });
    }
  });

  // Commit the .wok3 config files
  app.post('/api/config/commit-setup', async (c) => {
    const projectDir = manager.getConfigDir();
    const configPath = path.join(projectDir, '.wok3', 'config.json');
    const gitignorePath = path.join(projectDir, '.wok3', '.gitignore');

    try {
      const body = await c.req.json();
      const message = body.message || 'chore: add wok3 configuration';

      // Unstage all currently staged changes first
      try {
        execFileSync('git', ['reset', 'HEAD'], {
          cwd: projectDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // Ignore errors - may fail if nothing is staged or no commits yet
      }

      // Stage only the config files
      execFileSync('git', ['add', configPath, gitignorePath], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Commit
      execFileSync('git', ['commit', '-m', message], {
        cwd: projectDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return c.json({ success: true });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to commit',
      });
    }
  });

  // Get auto-detected config values without creating config
  app.get('/api/config/detect', (c) => {
    const projectDir = manager.getConfigDir();
    try {
      const detected = detectConfig(projectDir);
      return c.json({ success: true, config: detected });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to detect config',
      });
    }
  });

  // Initialize config with provided values (or auto-detected if not provided)
  app.post('/api/config/init', async (c) => {
    const projectDir = manager.getConfigDir();
    const configDirPath = path.join(projectDir, '.wok3');
    const configPath = path.join(configDirPath, 'config.json');
    const gitignorePath = path.join(configDirPath, '.gitignore');

    // Don't overwrite existing config
    if (existsSync(configPath)) {
      return c.json({ success: false, error: 'Config already exists' }, 400);
    }

    try {
      const body = await c.req.json().catch(() => ({}));
      const detected = detectConfig(projectDir);

      // Merge provided values with detected values
      const config = {
        startCommand: body.startCommand ?? detected.startCommand,
        installCommand: body.installCommand ?? detected.installCommand,
        baseBranch: body.baseBranch ?? detected.baseBranch,
        serverPort: body.serverPort ?? detected.serverPort,
        ports: {
          discovered: [],
          offsetStep: 1,
        },
      };

      // Create directory if needed
      if (!existsSync(configDirPath)) {
        mkdirSync(configDirPath, { recursive: true });
      }

      // Write config
      writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

      // Create .gitignore
      if (!existsSync(gitignorePath)) {
        writeFileSync(gitignorePath, `# Ignore everything in .wok3 by default
*

# Except these files (tracked/shared)
!.gitignore
!config.json
`);
      }

      // Stage the files
      try {
        execFileSync('git', ['add', gitignorePath, configPath], {
          cwd: projectDir,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch {
        // Ignore - user can commit manually
      }

      // Reload the manager's config
      manager.reloadConfig();

      return c.json({ success: true, config });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize config',
      }, 500);
    }
  });
}
