import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { actions, MCP_INSTRUCTIONS } from './actions';
import type { ActionContext } from './actions';
import { APP_NAME } from './constants';
import { WorktreeManager } from './server/manager';
import { NotesManager } from './server/notes-manager';
import type { WorktreeConfig } from './server/types';

function buildJsonSchema(params: Record<string, { type: string; description: string; required?: boolean }>) {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(params)) {
    properties[key] = { type: param.type, description: param.description };
    if (param.required) required.push(key);
  }

  return { properties, required };
}

export async function startMcpServer(config: WorktreeConfig, configFilePath: string | null) {
  const manager = new WorktreeManager(config, configFilePath);
  await manager.initGitHub();

  const notesManager = new NotesManager(manager.getConfigDir());
  const ctx: ActionContext = { manager, notesManager };

  const server = new McpServer(
    { name: APP_NAME, version: '0.1.0' },
    { instructions: MCP_INSTRUCTIONS },
  );

  for (const action of actions) {
    const schema = buildJsonSchema(action.params);

    server.tool(
      action.name,
      action.description,
      schema.properties,
      async (params) => {
        try {
          const result = await action.handler(ctx, params as Record<string, unknown>);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (err) {
          return {
            isError: true,
            content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
          };
        }
      },
    );
  }

  server.prompt(
    'work-on-task',
    'Create a worktree from an issue and start working on it',
    { issueId: z.string().describe('Issue ID (e.g., PROJ-123, ENG-42, or just a number)') },
    async ({ issueId }) => ({
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Use the wok3 MCP server tools to create a worktree for issue "${issueId}". Follow this workflow:
1. Determine the issue type and call the appropriate wok3 tool: create_from_jira or create_from_linear
2. The response will include full task context and the worktree path
3. Poll the wok3 list_worktrees tool until the worktree status is 'stopped' (creation complete)
4. Navigate to the worktree directory
5. Read TASK.md for full context
6. Start implementing the task`,
        },
      }],
    }),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const cleanup = async () => {
    await manager.stopAll();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
