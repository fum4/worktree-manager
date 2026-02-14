import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { actions, MCP_INSTRUCTIONS } from '../actions';
import type { ActionContext, ActionParam } from '../actions';
import { APP_NAME } from '../constants';

function toZodType(param: ActionParam) {
  let schema: z.ZodTypeAny;
  switch (param.type) {
    case 'number': schema = z.number(); break;
    case 'boolean': schema = z.boolean(); break;
    default: schema = z.string(); break;
  }
  schema = schema.describe(param.description);
  if (!param.required) schema = schema.optional();
  return schema;
}

function buildZodShape(params: Record<string, ActionParam>): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, param] of Object.entries(params)) {
    shape[key] = toZodType(param);
  }
  return shape;
}

export function createMcpServer(ctx: ActionContext): McpServer {
  const server = new McpServer(
    { name: APP_NAME, version: '0.1.0' },
    { instructions: MCP_INSTRUCTIONS },
  );

  for (const action of actions) {
    const zodShape = buildZodShape(action.params);

    server.tool(
      action.name,
      action.description,
      zodShape,
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
          text: `Use the work3 MCP server tools to create a worktree for issue "${issueId}". Follow this workflow:
1. Determine the issue type and call the appropriate work3 tool: create_from_jira or create_from_linear
2. The response will include full task context and the worktree path
3. Poll the work3 list_worktrees tool until the worktree status is 'stopped' (creation complete)
4. Navigate to the worktree directory
5. Call get_hooks_config to discover all hooks — always inform the user before running hooks/skills/commands and summarize results after. For each skill: call report_hook_status BEFORE (without success/summary) to show loading, invoke the skill, then call it AGAIN with the result
6. Run any pre-implementation hooks before starting work
6. Read TASK.md to understand the task from the original issue details
7. Follow AI context directions and todo checklist — these are user-defined and take priority over the task description when they conflict
8. Start implementing the task
9. After completing all work and post-implementation hooks, call get_git_policy — if commit/push/create_pr are allowed, do them automatically. If the dev server is not already running, ask the user if they'd like to start it (via start_worktree)

Skill reports: For skills with detailed output (code review, changes summary, test instructions, explanations), write the full report to {worktreePath}/.work3-{skillName}.md and pass the path via filePath in report_hook_status.
Skill quality: Code review = thorough investigation (read code, trace logic, find bugs). Changes summary = technical, bullet points by area. Test writing = check for testing framework first, ask user if none found.`,
        },
      }],
    }),
  );

  return server;
}
