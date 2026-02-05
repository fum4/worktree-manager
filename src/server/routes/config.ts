import { existsSync } from 'fs';
import path from 'path';
import type { Hono } from 'hono';

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
}
