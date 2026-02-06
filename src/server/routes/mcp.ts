import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import type { Hono } from 'hono';

import type { WorktreeManager } from '../manager';

type AgentId = 'claude' | 'gemini' | 'codex' | 'cursor' | 'vscode';
type Scope = 'global' | 'project';

interface ScopeSpec {
  configPath: string;
  format: 'json' | 'toml';
  jsonPath?: string[];
}

interface AgentSpec {
  global?: ScopeSpec;
  project?: ScopeSpec;
}

const WOK3_MCP_ENTRY = { command: 'wok3', args: ['mcp'] };

const AGENT_SPECS: Record<AgentId, AgentSpec> = {
  claude: {
    global: {
      configPath: '~/.claude/settings.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
    project: {
      configPath: '.mcp.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
  },
  gemini: {
    global: {
      configPath: '~/.gemini/settings.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
    project: {
      configPath: '.gemini/settings.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
  },
  codex: {
    global: {
      configPath: '~/.codex/config.toml',
      format: 'toml',
    },
    project: {
      configPath: '.codex/config.toml',
      format: 'toml',
    },
  },
  cursor: {
    global: {
      configPath: '~/.cursor/mcp.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
    project: {
      configPath: '.cursor/mcp.json',
      format: 'json',
      jsonPath: ['mcpServers'],
    },
  },
  vscode: {
    global: {
      configPath: '~/Library/Application Support/Code/User/settings.json',
      format: 'json',
      jsonPath: ['mcp', 'servers'],
    },
    project: {
      configPath: '.vscode/settings.json',
      format: 'json',
      jsonPath: ['mcp', 'servers'],
    },
  },
};

const VALID_AGENTS = new Set(Object.keys(AGENT_SPECS));

// Strip JSONC comments (// and /* */) while preserving strings
function stripJsonComments(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    // String literal — copy through unchanged
    if (text[i] === '"') {
      result += '"';
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') { result += text[i++]; } // skip escaped char
        if (i < text.length) { result += text[i++]; }
      }
      if (i < text.length) { result += text[i++]; } // closing quote
    // Line comment
    } else if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    // Block comment
    } else if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2; // skip */
    } else {
      result += text[i++];
    }
  }
  return result;
}

function parseJsonFile(filePath: string): { data: Record<string, unknown>; error?: string } | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return { data: JSON.parse(stripJsonComments(raw)) };
  } catch {
    return { data: {}, error: 'Failed to parse config file' };
  }
}

function resolveConfigPath(configPath: string, projectDir: string): string {
  if (configPath.startsWith('~')) {
    return path.join(os.homedir(), configPath.slice(2));
  }
  return path.join(projectDir, configPath);
}

function getScopeSpec(agent: AgentId, scope: Scope): ScopeSpec | null {
  return AGENT_SPECS[agent][scope] ?? null;
}

function isWok3Configured(filePath: string, spec: ScopeSpec): boolean {
  if (!existsSync(filePath)) return false;

  try {
    if (spec.format === 'toml') {
      return readFileSync(filePath, 'utf-8').includes('[mcp_servers.wok3]');
    }

    const parsed = parseJsonFile(filePath);
    if (!parsed || parsed.error) return false;
    let obj: unknown = parsed.data;
    for (const key of spec.jsonPath!) {
      obj = (obj as Record<string, unknown>)?.[key];
    }
    return (obj as Record<string, unknown>)?.wok3 != null;
  } catch {
    return false;
  }
}

function setupJsonConfig(filePath: string, jsonPath: string[]): { success: boolean; error?: string } {
  let json: Record<string, unknown> = {};

  const parsed = parseJsonFile(filePath);
  if (parsed) {
    if (parsed.error) return { success: false, error: parsed.error };
    json = parsed.data;
  }

  // Navigate/create nested path
  let obj: Record<string, unknown> = json;
  for (const key of jsonPath) {
    if (obj[key] == null || typeof obj[key] !== 'object') {
      obj[key] = {};
    }
    obj = obj[key] as Record<string, unknown>;
  }

  obj.wok3 = { ...WOK3_MCP_ENTRY };

  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  return { success: true };
}

function setupTomlConfig(filePath: string): { success: boolean; error?: string } {
  let content = '';

  if (existsSync(filePath)) {
    content = readFileSync(filePath, 'utf-8');
    if (content.includes('[mcp_servers.wok3]')) {
      return { success: true };
    }
  }

  const tomlBlock = `\n[mcp_servers.wok3]\ncommand = "wok3"\nargs = ["mcp"]\n`;

  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(filePath, content + tomlBlock);
  return { success: true };
}

function removeJsonConfig(filePath: string, jsonPath: string[]): { success: boolean; error?: string } {
  const parsed = parseJsonFile(filePath);
  if (!parsed) return { success: true }; // File doesn't exist
  if (parsed.error) return { success: false, error: parsed.error };

  const json = parsed.data;

  let obj: Record<string, unknown> = json;
  for (const key of jsonPath) {
    if (obj[key] == null || typeof obj[key] !== 'object') {
      return { success: true }; // Path doesn't exist, nothing to remove
    }
    obj = obj[key] as Record<string, unknown>;
  }

  delete obj.wok3;

  writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  return { success: true };
}

function removeTomlConfig(filePath: string): { success: boolean; error?: string } {
  if (!existsSync(filePath)) {
    return { success: true };
  }

  let content = readFileSync(filePath, 'utf-8');
  if (!content.includes('[mcp_servers.wok3]')) {
    return { success: true };
  }

  // Remove the [mcp_servers.wok3] block and its key-value lines
  content = content.replace(/\n?\[mcp_servers\.wok3\]\ncommand = "wok3"\nargs = \["mcp"\]\n?/, '');

  writeFileSync(filePath, content);
  return { success: true };
}

export function registerMcpRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/mcp/status', (c) => {
    const projectDir = manager.getConfigDir();

    // Return status for all agents, both scopes
    const statuses: Record<string, { global?: boolean; project?: boolean }> = {};
    for (const [id, spec] of Object.entries(AGENT_SPECS)) {
      const entry: { global?: boolean; project?: boolean } = {};
      if (spec.global) {
        const filePath = resolveConfigPath(spec.global.configPath, projectDir);
        entry.global = isWok3Configured(filePath, spec.global);
      }
      if (spec.project) {
        const filePath = resolveConfigPath(spec.project.configPath, projectDir);
        entry.project = isWok3Configured(filePath, spec.project);
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

      const filePath = resolveConfigPath(spec.configPath, manager.getConfigDir());

      const result = spec.format === 'json'
        ? setupJsonConfig(filePath, spec.jsonPath!)
        : setupTomlConfig(filePath);

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

      const filePath = resolveConfigPath(spec.configPath, manager.getConfigDir());

      const result = spec.format === 'json'
        ? removeJsonConfig(filePath, spec.jsonPath!)
        : removeTomlConfig(filePath);

      return c.json(result, result.success ? 200 : 500);
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove MCP config',
      }, 500);
    }
  });
}
