import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import type { Hono } from 'hono';

import type { WorktreeManager } from '../manager';

// ─── SKILL.md parsing ───────────────────────────────────────────

interface SkillFrontmatter {
  name: string;
  description: string;
  allowedTools: string;
  context: string;
}

function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fm: SkillFrontmatter = { name: '', description: '', allowedTools: '', context: '' };

  // Split on --- fences
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: fm, body: content };
  }

  const yamlBlock = match[1];
  const body = match[2];

  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case 'name': fm.name = value; break;
      case 'description': fm.description = value; break;
      case 'allowed-tools': fm.allowedTools = value; break;
      case 'context': fm.context = value; break;
    }
  }

  return { frontmatter: fm, body };
}

function buildSkillMd(frontmatter: SkillFrontmatter, body: string): string {
  const lines = ['---'];
  if (frontmatter.name) lines.push(`name: ${frontmatter.name}`);
  if (frontmatter.description) lines.push(`description: ${frontmatter.description}`);
  if (frontmatter.allowedTools) lines.push(`allowed-tools: ${frontmatter.allowedTools}`);
  if (frontmatter.context) lines.push(`context: ${frontmatter.context}`);
  lines.push('---');
  if (body) lines.push('', body);
  return lines.join('\n') + '\n';
}

// ─── Skill discovery ────────────────────────────────────────────

interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  location: 'global' | 'project';
  path: string;
}

function getGlobalSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

function getProjectSkillsDir(projectDir: string): string {
  return path.join(projectDir, '.claude', 'skills');
}

function discoverSkills(dir: string, location: 'global' | 'project'): SkillInfo[] {
  if (!existsSync(dir)) return [];

  const skills: SkillInfo[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = path.join(dir, entry.name, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      try {
        const content = readFileSync(skillMdPath, 'utf-8');
        const { frontmatter } = parseSkillMd(content);

        skills.push({
          name: entry.name,
          displayName: frontmatter.name || entry.name,
          description: frontmatter.description || '',
          location,
          path: path.join(dir, entry.name),
        });
      } catch {
        // Skip unreadable skill files
      }
    }
  } catch {
    // Dir not readable
  }
  return skills;
}

// ─── Plugins from settings.json ─────────────────────────────────

interface PluginInfo {
  name: string;
  enabled: boolean;
}

function loadPlugins(): PluginInfo[] {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!existsSync(settingsPath)) return [];

  try {
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const plugins = settings.plugins;
    if (!plugins || typeof plugins !== 'object') return [];

    // plugins can be { "plugin-name": true/false } or an array
    if (Array.isArray(plugins)) {
      return plugins.map((p: string | { name: string; enabled?: boolean }) => {
        if (typeof p === 'string') return { name: p, enabled: true };
        return { name: p.name, enabled: p.enabled !== false };
      });
    }

    return Object.entries(plugins).map(([name, value]) => ({
      name,
      enabled: value !== false,
    }));
  } catch {
    return [];
  }
}

// ─── Scan for skills in filesystem ──────────────────────────────

interface SkillScanResult {
  name: string;
  displayName: string;
  description: string;
  skillPath: string;
  type: 'skill';
}

function scanForSkills(roots: string[], maxDepth: number): SkillScanResult[] {
  const results: SkillScanResult[] = [];
  const seen = new Set<string>();

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;

        // Skip heavy dirs
        if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') continue;

        const fullPath = path.join(dir, name);

        // Check if this is a .claude/skills directory
        if (name === '.claude') {
          const skillsDir = path.join(fullPath, 'skills');
          if (existsSync(skillsDir)) {
            try {
              const skillEntries = readdirSync(skillsDir, { withFileTypes: true });
              for (const skillEntry of skillEntries) {
                if (!skillEntry.isDirectory()) continue;
                const skillMdPath = path.join(skillsDir, skillEntry.name, 'SKILL.md');
                if (!existsSync(skillMdPath)) continue;

                const key = `${skillEntry.name}:${skillMdPath}`;
                if (seen.has(key)) continue;
                seen.add(key);

                try {
                  const content = readFileSync(skillMdPath, 'utf-8');
                  const { frontmatter } = parseSkillMd(content);
                  results.push({
                    name: skillEntry.name,
                    displayName: frontmatter.name || skillEntry.name,
                    description: frontmatter.description || '',
                    skillPath: path.join(skillsDir, skillEntry.name),
                    type: 'skill',
                  });
                } catch {
                  // Skip unreadable
                }
              }
            } catch {
              // Skills dir not readable
            }
          }
          continue; // Don't recurse further into .claude
        }

        walk(fullPath, depth + 1);
      }
    } catch {
      // Dir not readable
    }
  }

  for (const root of roots) {
    walk(root, 0);
  }

  return results;
}

// ─── Routes ─────────────────────────────────────────────────────

export function registerClaudeSkillRoutes(app: Hono, manager: WorktreeManager) {
  const projectDir = manager.getConfigDir();

  // List all skills (global + project)
  app.get('/api/claude/skills', (c) => {
    const globalSkills = discoverSkills(getGlobalSkillsDir(), 'global');
    const projectSkills = discoverSkills(getProjectSkillsDir(projectDir), 'project');
    return c.json({ skills: [...projectSkills, ...globalSkills] });
  });

  // Get skill detail
  app.get('/api/claude/skills/:name', (c) => {
    const name = c.req.param('name');
    const location = (c.req.query('location') ?? 'global') as 'global' | 'project';

    const skillsDir = location === 'project'
      ? getProjectSkillsDir(projectDir)
      : getGlobalSkillsDir();

    const skillDir = path.join(skillsDir, name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      return c.json({ error: 'Skill not found' }, 404);
    }

    const skillMd = readFileSync(skillMdPath, 'utf-8');
    const { frontmatter } = parseSkillMd(skillMd);

    const refPath = path.join(skillDir, 'reference.md');
    const examplesPath = path.join(skillDir, 'examples.md');
    const hasReference = existsSync(refPath);
    const hasExamples = existsSync(examplesPath);

    return c.json({
      skill: {
        name,
        displayName: frontmatter.name || name,
        description: frontmatter.description || '',
        location,
        path: skillDir,
        skillMd,
        frontmatter,
        hasReference,
        referenceMd: hasReference ? readFileSync(refPath, 'utf-8') : undefined,
        hasExamples,
        examplesMd: hasExamples ? readFileSync(examplesPath, 'utf-8') : undefined,
      },
    });
  });

  // Create skill
  app.post('/api/claude/skills', async (c) => {
    const body = await c.req.json<{
      name: string;
      description?: string;
      allowedTools?: string;
      context?: string;
      location?: 'global' | 'project';
      instructions?: string;
    }>();

    if (!body.name?.trim()) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }

    const dirName = body.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const location = body.location ?? 'global';
    const skillsDir = location === 'project'
      ? getProjectSkillsDir(projectDir)
      : getGlobalSkillsDir();

    const skillDir = path.join(skillsDir, dirName);

    if (existsSync(skillDir)) {
      return c.json({ success: false, error: `Skill "${dirName}" already exists` }, 409);
    }

    mkdirSync(skillDir, { recursive: true });

    const frontmatter: SkillFrontmatter = {
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      allowedTools: body.allowedTools?.trim() ?? '',
      context: body.context?.trim() ?? '',
    };

    const content = buildSkillMd(frontmatter, body.instructions?.trim() ?? '');
    writeFileSync(path.join(skillDir, 'SKILL.md'), content);

    return c.json({
      success: true,
      skill: {
        name: dirName,
        displayName: frontmatter.name,
        description: frontmatter.description,
        location,
        path: skillDir,
      },
    });
  });

  // Update skill
  app.patch('/api/claude/skills/:name', async (c) => {
    const name = c.req.param('name');
    const body = await c.req.json<{
      location?: 'global' | 'project';
      skillMd?: string;
      referenceMd?: string;
      examplesMd?: string;
    }>();

    const location = (body.location ?? c.req.query('location') ?? 'global') as 'global' | 'project';
    const skillsDir = location === 'project'
      ? getProjectSkillsDir(projectDir)
      : getGlobalSkillsDir();

    const skillDir = path.join(skillsDir, name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      return c.json({ success: false, error: 'Skill not found' }, 404);
    }

    if (body.skillMd !== undefined) {
      writeFileSync(skillMdPath, body.skillMd);
    }

    if (body.referenceMd !== undefined) {
      const refPath = path.join(skillDir, 'reference.md');
      if (body.referenceMd) {
        writeFileSync(refPath, body.referenceMd);
      } else if (existsSync(refPath)) {
        rmSync(refPath);
      }
    }

    if (body.examplesMd !== undefined) {
      const examplesPath = path.join(skillDir, 'examples.md');
      if (body.examplesMd) {
        writeFileSync(examplesPath, body.examplesMd);
      } else if (existsSync(examplesPath)) {
        rmSync(examplesPath);
      }
    }

    return c.json({ success: true });
  });

  // Delete skill
  app.delete('/api/claude/skills/:name', (c) => {
    const name = c.req.param('name');
    const location = (c.req.query('location') ?? 'global') as 'global' | 'project';

    const skillsDir = location === 'project'
      ? getProjectSkillsDir(projectDir)
      : getGlobalSkillsDir();

    const skillDir = path.join(skillsDir, name);

    if (!existsSync(skillDir)) {
      return c.json({ success: false, error: 'Skill not found' }, 404);
    }

    rmSync(skillDir, { recursive: true });
    return c.json({ success: true });
  });

  // List plugins (read-only)
  app.get('/api/claude/plugins', (c) => {
    return c.json({ plugins: loadPlugins() });
  });

  // Enhanced scan — also scan for skills
  app.post('/api/claude/skills/scan', async (c) => {
    const body: { mode?: 'project' | 'folder' | 'device'; scanPath?: string } =
      await c.req.json().catch(() => ({}));

    const mode = body.mode ?? 'project';

    let scanRoots: string[];
    let maxDepth: number;

    if (mode === 'project') {
      scanRoots = [projectDir];
      maxDepth = 4;
    } else if (mode === 'folder' && body.scanPath) {
      scanRoots = [body.scanPath];
      maxDepth = 8;
    } else {
      // Device scan — home dir
      scanRoots = [os.homedir()];
      maxDepth = 5;
    }

    const skills = scanForSkills(scanRoots, maxDepth);
    return c.json({ discovered: skills });
  });
}
