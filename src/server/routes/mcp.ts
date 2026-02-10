import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Hono } from 'hono';

import { CONFIG_DIR_NAME } from '../../constants';
import type { WorktreeManager } from '../manager';
import { deployAgentInstructions, removeAgentInstructions } from '../lib/builtin-instructions';
import {
  type AgentId,
  type McpServerEntry,
  type Scope,
  AGENT_SPECS,
  VALID_AGENTS,
  getScopeSpec,
  resolveConfigPath,
  isServerConfigured,
  writeServerToConfig,
  removeServerFromConfig,
} from '../lib/tool-configs';

function deriveServerUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

function getServerUrl(projectDir: string): string | null {
  const serverJsonPath = path.join(projectDir, CONFIG_DIR_NAME, 'server.json');
  if (!existsSync(serverJsonPath)) return null;
  try {
    const data = JSON.parse(readFileSync(serverJsonPath, 'utf-8'));
    return data.url ?? null;
  } catch {
    return null;
  }
}

export function registerMcpRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/mcp/status', (c) => {
    const projectDir = manager.getConfigDir();

    const statuses: Record<string, { global?: boolean; project?: boolean }> = {};
    for (const [id, spec] of Object.entries(AGENT_SPECS)) {
      const entry: { global?: boolean; project?: boolean } = {};
      if (spec.global) {
        const filePath = resolveConfigPath(spec.global.configPath, projectDir);
        entry.global = isServerConfigured(filePath, spec.global, 'wok3');
      }
      if (spec.project) {
        const filePath = resolveConfigPath(spec.project.configPath, projectDir);
        entry.project = isServerConfigured(filePath, spec.project, 'wok3');
      }
      statuses[id] = entry;
    }
    return c.json({ statuses });
  });

  app.post('/api/mcp/setup', async (c) => {
    try {
      const body = await c.req.json();
      const agent = body.agent as AgentId;
      const scope = (body.scope as Scope) ?? 'global';

      if (!agent || !VALID_AGENTS.has(agent)) {
        return c.json({ success: false, error: 'Invalid agent' }, 400);
      }

      const spec = getScopeSpec(agent, scope);
      if (!spec) {
        return c.json({ success: false, error: `${scope} scope not supported for this agent` }, 400);
      }

      const projectDir = manager.getConfigDir();
      let mcpEntry: McpServerEntry;
      if (scope === 'project') {
        // Project scope is versioned — use command entry (portable, no local port)
        mcpEntry = { command: 'wok3', args: ['mcp'] };
      } else {
        // Global scope is local — use URL entry (shared state with running server)
        const serverUrl = getServerUrl(projectDir) ?? deriveServerUrl(c.req.url);
        mcpEntry = { type: 'http', url: `${serverUrl}/mcp` };
      }
      const filePath = resolveConfigPath(spec.configPath, projectDir);
      const result = writeServerToConfig(filePath, spec, 'wok3', mcpEntry);

      if (result.success) {
        deployAgentInstructions(agent, projectDir, scope);
      }

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup MCP',
      }, 500);
    }
  });

  app.post('/api/mcp/remove', async (c) => {
    try {
      const body = await c.req.json();
      const agent = body.agent as AgentId;
      const scope = (body.scope as Scope) ?? 'global';

      if (!agent || !VALID_AGENTS.has(agent)) {
        return c.json({ success: false, error: 'Invalid agent' }, 400);
      }

      const spec = getScopeSpec(agent, scope);
      if (!spec) {
        return c.json({ success: false, error: `${scope} scope not supported for this agent` }, 400);
      }

      const projectDir = manager.getConfigDir();
      const filePath = resolveConfigPath(spec.configPath, projectDir);
      const result = removeServerFromConfig(filePath, spec, 'wok3');

      if (result.success) {
        removeAgentInstructions(agent, projectDir, scope);
      }

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove MCP config',
      }, 500);
    }
  });
}
