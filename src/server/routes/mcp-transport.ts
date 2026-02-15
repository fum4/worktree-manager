import type { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import type { WorktreeManager } from "../manager";
import type { NotesManager } from "../notes-manager";
import type { HooksManager } from "../verification-manager";
import type { ActionContext } from "../../actions";
import { createMcpServer } from "../mcp-server-factory";
import { log } from "../../logger";

export function registerMcpTransportRoute(
  app: Hono,
  {
    manager,
    notesManager,
    hooksManager,
  }: { manager: WorktreeManager; notesManager: NotesManager; hooksManager?: HooksManager },
) {
  const activityLog = manager.getActivityLog();
  const ctx: ActionContext = { manager, notesManager, hooksManager, activityLog };
  const mcpServer = createMcpServer(ctx);

  // Stateless transport — single-user local dev tool, no session tracking needed
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  mcpServer.connect(transport).catch((err) => {
    log.error(`Failed to connect MCP transport: ${err}`);
  });

  app.all("/mcp", async (c) => {
    try {
      return await transport.handleRequest(c.req.raw);
    } catch (err) {
      log.error(`MCP transport error: ${err}`);
      return c.json({ error: "MCP transport error" }, 500);
    }
  });
}
