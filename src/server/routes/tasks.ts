import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { Hono } from 'hono';
import path from 'path';

import type { WorktreeManager } from '../manager';
import type { NotesManager } from '../notes-manager';

interface CustomTask {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'high' | 'medium' | 'low';
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

function getTasksDir(configDir: string): string {
  return path.join(configDir, '.wok3', 'issues', 'local');
}

function ensureTasksDir(configDir: string): string {
  const dir = getTasksDir(configDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function getNextIdentifier(configDir: string): string {
  const counterFile = path.join(ensureTasksDir(configDir), '.counter');
  let counter = 0;
  if (existsSync(counterFile)) {
    counter = parseInt(readFileSync(counterFile, 'utf-8').trim(), 10) || 0;
  }
  counter++;
  writeFileSync(counterFile, String(counter));
  return `LOCAL-${counter}`;
}

function loadTask(configDir: string, id: string): CustomTask | null {
  const filePath = path.join(getTasksDir(configDir), id, 'task.json');
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8')) as CustomTask;
}

function saveTask(configDir: string, task: CustomTask): void {
  const dir = path.join(ensureTasksDir(configDir), task.id);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'task.json'), JSON.stringify(task, null, 2));
}

function loadAllTasks(configDir: string): CustomTask[] {
  const dir = getTasksDir(configDir);
  if (!existsSync(dir)) return [];

  const tasks: CustomTask[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const task = loadTask(configDir, entry.name);
    if (task) tasks.push(task);
  }

  return tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function registerTaskRoutes(app: Hono, manager: WorktreeManager, notesManager: NotesManager) {
  const configDir = manager.getConfigDir();

  // List all custom tasks — enrich with linkedWorktreeId from notes
  app.get('/api/tasks', (c) => {
    const tasks = loadAllTasks(configDir);
    const enriched = tasks.map((task) => {
      const notes = notesManager.loadNotes('local', task.id);
      return { ...task, linkedWorktreeId: notes.linkedWorktreeId };
    });
    return c.json({ tasks: enriched });
  });

  // Get single task — enrich with linkedWorktreeId from notes
  app.get('/api/tasks/:id', (c) => {
    const task = loadTask(configDir, c.req.param('id'));
    if (!task) return c.json({ error: 'Task not found' }, 404);
    const notes = notesManager.loadNotes('local', task.id);
    return c.json({ task: { ...task, linkedWorktreeId: notes.linkedWorktreeId } });
  });

  // Create task
  app.post('/api/tasks', async (c) => {
    const body = await c.req.json<{
      title?: string;
      description?: string;
      priority?: string;
      labels?: string[];
    }>();

    if (!body.title?.trim()) {
      return c.json({ success: false, error: 'Title is required' }, 400);
    }

    const now = new Date().toISOString();
    const task: CustomTask = {
      id: randomUUID(),
      identifier: getNextIdentifier(configDir),
      title: body.title.trim(),
      description: body.description?.trim() ?? '',
      status: 'todo',
      priority: (['high', 'medium', 'low'].includes(body.priority ?? '') ? body.priority : 'medium') as CustomTask['priority'],
      labels: Array.isArray(body.labels) ? body.labels.map((l) => String(l).trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };

    saveTask(configDir, task);
    // Create empty notes.json alongside
    notesManager.saveNotes('local', task.id, {
      linkedWorktreeId: null,
      personal: null,
      aiContext: null,
    });
    return c.json({ success: true, task: { ...task, linkedWorktreeId: null } });
  });

  // Update task
  app.patch('/api/tasks/:id', async (c) => {
    const task = loadTask(configDir, c.req.param('id'));
    if (!task) return c.json({ success: false, error: 'Task not found' }, 404);

    const body = await c.req.json<Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      labels: string[];
    }>>();

    if (body.title !== undefined) task.title = body.title.trim();
    if (body.description !== undefined) task.description = body.description;
    if (body.status !== undefined && ['todo', 'in-progress', 'done'].includes(body.status)) {
      task.status = body.status as CustomTask['status'];
    }
    if (body.priority !== undefined && ['high', 'medium', 'low'].includes(body.priority)) {
      task.priority = body.priority as CustomTask['priority'];
    }
    if (body.labels !== undefined) {
      task.labels = body.labels.map((l) => String(l).trim()).filter(Boolean);
    }

    task.updatedAt = new Date().toISOString();
    saveTask(configDir, task);

    const notes = notesManager.loadNotes('local', task.id);
    return c.json({ success: true, task: { ...task, linkedWorktreeId: notes.linkedWorktreeId } });
  });

  // Delete task
  app.delete('/api/tasks/:id', (c) => {
    const id = c.req.param('id');
    const taskDir = path.join(getTasksDir(configDir), id);
    if (!existsSync(taskDir)) return c.json({ success: false, error: 'Task not found' }, 404);

    rmSync(taskDir, { recursive: true });
    return c.json({ success: true });
  });

  // Create worktree from custom task
  app.post('/api/tasks/:id/create-worktree', async (c) => {
    const task = loadTask(configDir, c.req.param('id'));
    if (!task) return c.json({ success: false, error: 'Task not found' }, 404);

    const body = await c.req.json<{ branch?: string }>().catch(() => ({ branch: undefined }));

    // Use identifier (e.g. LOCAL-5) as default branch name
    const branchName = body.branch || task.identifier.toLowerCase();

    try {
      const result = await manager.createWorktree({ branch: branchName, name: task.identifier });

      if (result.success) {
        const worktreeId = task.identifier;
        // Link worktree via notes.json
        notesManager.setLinkedWorktreeId('local', task.id, worktreeId);
      }

      return c.json(result);
    } catch (err) {
      return c.json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create worktree',
      });
    }
  });
}
