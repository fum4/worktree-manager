import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { actions } from "../actions";
import type { ActionContext, ActionParam } from "../actions";
import { APP_NAME } from "../constants";
import { MCP_INSTRUCTIONS, MCP_WORK_ON_TASK_PROMPT } from "../instructions";

function toZodType(param: ActionParam) {
  let schema: z.ZodTypeAny;
  switch (param.type) {
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    default:
      schema = z.string();
      break;
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
    { name: APP_NAME, version: "0.1.0" },
    { instructions: MCP_INSTRUCTIONS },
  );

  for (const action of actions) {
    const zodShape = buildZodShape(action.params);

    server.tool(action.name, action.description, zodShape, async (params) => {
      try {
        const result = await action.handler(ctx, params as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
          ],
        };
      }
    });
  }

  server.prompt(
    "work-on-task",
    "Create a worktree from an issue and start working on it",
    { issueId: z.string().describe("Issue ID (e.g., PROJ-123, ENG-42, or just a number)") },
    async ({ issueId }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: MCP_WORK_ON_TASK_PROMPT.replace("{{ISSUE_ID}}", issueId),
          },
        },
      ],
    }),
  );

  return server;
}
