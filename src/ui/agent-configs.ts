export type AgentId = 'claude' | 'gemini' | 'codex' | 'cursor' | 'vscode';
export type McpScope = 'global' | 'project';

export interface ScopeConfig {
  config: string;
  configPath: string;
}

export interface AgentConfig {
  id: AgentId;
  name: string;
  docsUrl?: string;
  global?: ScopeConfig;
  project?: ScopeConfig;
}

// -- Command-based snippets (for project scope — versionable, no local port) --

const PROJECT_JSON_SNIPPET = `{
  "mcpServers": {
    "wok3": {
      "command": "wok3",
      "args": ["mcp"]
    }
  }
}`;

const PROJECT_TOML_SNIPPET = `[mcp_servers.wok3]\ncommand = "wok3"\nargs = ["mcp"]`;

const PROJECT_VSCODE_SNIPPET = `{
  "mcp": {
    "servers": {
      "wok3": {
        "command": "wok3",
        "args": ["mcp"]
      }
    }
  }
}`;

// -- URL-based snippets (for global scope — local only, shared state) --

function globalJsonSnippet(serverUrl: string) {
  return `{
  "mcpServers": {
    "wok3": {
      "type": "http",
      "url": "${serverUrl}/mcp"
    }
  }
}`;
}

function globalTomlSnippet(serverUrl: string) {
  return `[mcp_servers.wok3]\ntype = "http"\nurl = "${serverUrl}/mcp"`;
}

function globalVscodeSnippet(serverUrl: string) {
  return `{
  "mcp": {
    "servers": {
      "wok3": {
        "type": "http",
        "url": "${serverUrl}/mcp"
      }
    }
  }
}`;
}

export function buildAgentConfigs(serverUrl: string): AgentConfig[] {
  return [
    {
      id: 'claude',
      name: 'Claude Code',
      docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
      global: { config: globalJsonSnippet(serverUrl), configPath: '~/.claude/settings.json' },
      project: { config: PROJECT_JSON_SNIPPET, configPath: '.mcp.json' },
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      docsUrl: 'https://geminicli.com/docs/tools/mcp-server/',
      global: { config: globalJsonSnippet(serverUrl), configPath: '~/.gemini/settings.json' },
      project: { config: PROJECT_JSON_SNIPPET, configPath: '.gemini/settings.json' },
    },
    {
      id: 'codex',
      name: 'OpenAI Codex',
      docsUrl: 'https://developers.openai.com/codex/mcp/',
      global: { config: globalTomlSnippet(serverUrl), configPath: '~/.codex/config.toml' },
      project: { config: PROJECT_TOML_SNIPPET, configPath: '.codex/config.toml' },
    },
    {
      id: 'cursor',
      name: 'Cursor',
      docsUrl: 'https://docs.cursor.com/context/model-context-protocol',
      global: { config: globalJsonSnippet(serverUrl), configPath: '~/.cursor/mcp.json' },
      project: { config: PROJECT_JSON_SNIPPET, configPath: '.cursor/mcp.json' },
    },
    {
      id: 'vscode',
      name: 'VS Code',
      docsUrl: 'https://code.visualstudio.com/docs/copilot/chat/mcp-servers',
      global: { config: globalVscodeSnippet(serverUrl), configPath: '~/Library/Application Support/Code/User/settings.json' },
      project: { config: PROJECT_VSCODE_SNIPPET, configPath: '.vscode/settings.json' },
    },
  ];
}

// Static fallback for cases where serverUrl isn't available yet
export const AGENT_CONFIGS = buildAgentConfigs('http://localhost:6969');
