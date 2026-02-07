import { Hono } from 'hono';

import type { IssueSource, NotesManager } from '../notes-manager';

export function registerNotesRoutes(app: Hono, notesManager: NotesManager) {
  // Get notes for an issue
  app.get('/api/notes/:source/:id', (c) => {
    const source = c.req.param('source') as IssueSource;
    const id = c.req.param('id');

    if (!['jira', 'linear', 'local'].includes(source)) {
      return c.json({ error: 'Invalid source' }, 400);
    }

    const notes = notesManager.loadNotes(source, id);
    return c.json(notes);
  });

  // Update a notes section
  app.put('/api/notes/:source/:id', async (c) => {
    const source = c.req.param('source') as IssueSource;
    const id = c.req.param('id');

    if (!['jira', 'linear', 'local'].includes(source)) {
      return c.json({ error: 'Invalid source' }, 400);
    }

    const body = await c.req.json<{ section: string; content: string }>();
    if (!body.section || !['personal', 'aiContext'].includes(body.section)) {
      return c.json({ error: 'Invalid section (must be "personal" or "aiContext")' }, 400);
    }
    if (typeof body.content !== 'string') {
      return c.json({ error: 'Content must be a string' }, 400);
    }

    const notes = notesManager.updateSection(source, id, body.section as 'personal' | 'aiContext', body.content);
    return c.json(notes);
  });
}
