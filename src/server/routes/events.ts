import type { Hono } from 'hono';

import type { WorktreeManager } from '../manager';

export function registerEventRoutes(app: Hono, manager: WorktreeManager) {
  app.get('/api/events', (c) => {
    const stream = new ReadableStream({
      start(controller) {
        const worktrees = manager.getWorktrees();
        controller.enqueue(
          `data: ${JSON.stringify({ type: 'worktrees', worktrees })}\n\n`,
        );

        const unsubscribe = manager.subscribe((updatedWorktrees) => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'worktrees',
                worktrees: updatedWorktrees,
              })}\n\n`,
            );
          } catch {
            unsubscribe();
          }
        });

        c.req.raw.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
}
