import path from 'path';
import { Hono } from 'hono';

import { CONFIG_DIR_NAME } from '../../constants';
import type { WorktreeManager } from '../manager';
import type { IssueSource, NotesManager } from '../notes-manager';
import { regenerateTaskMd } from '../task-context';

export function registerNotesRoutes(app: Hono, manager: WorktreeManager, notesManager: NotesManager) {
  const configDir = manager.getConfigDir();
  const worktreesPath = path.join(configDir, CONFIG_DIR_NAME, 'worktrees');

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

    // Regenerate TASK.md in linked worktree when aiContext changes
    if (body.section === 'aiContext' && notes.linkedWorktreeId) {
      try {
        regenerateTaskMd(source, id, notes.linkedWorktreeId, notesManager, configDir, worktreesPath);
      } catch {
        // Non-critical — don't fail the notes update
      }
    }

    return c.json(notes);
  });
}
