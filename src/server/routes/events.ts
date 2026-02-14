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

        const unsubscribeWorktrees = manager.subscribe((updatedWorktrees) => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'worktrees',
                worktrees: updatedWorktrees,
              })}\n\n`,
            );
          } catch {
            unsubscribeWorktrees();
          }
        });

        const unsubscribeNotifications = manager.subscribeNotifications((notification) => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'notification',
                ...notification,
              })}\n\n`,
            );
          } catch {
            unsubscribeNotifications();
          }
        });

        const unsubscribeHookUpdates = manager.subscribeHookUpdates((worktreeId) => {
          try {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: 'hook-update',
                worktreeId,
              })}\n\n`,
            );
          } catch {
            unsubscribeHookUpdates();
          }
        });

        c.req.raw.signal.addEventListener('abort', () => {
          unsubscribeWorktrees();
          unsubscribeNotifications();
          unsubscribeHookUpdates();
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
