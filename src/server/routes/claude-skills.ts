import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
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
  agent: string;
  model: string;
  argumentHint: string;
  disableModelInvocation: boolean;
  userInvocable: boolean;
  mode: boolean;
}

const EMPTY_FRONTMATTER: SkillFrontmatter = {
  name: '', description: '', allowedTools: '', context: '',
  agent: '', model: '', argumentHint: '',
  disableModelInvocation: false, userInvocable: true, mode: false,
};

function parseBool(value: string, defaultValue: boolean): boolean {
  const v = value.toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return defaultValue;
}

function parseSkillMd(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const fm: SkillFrontmatter = { ...EMPTY_FRONTMATTER };

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
      case 'agent': fm.agent = value; break;
      case 'model': fm.model = value; break;
      case 'argument-hint': fm.argumentHint = value; break;
      case 'disable-model-invocation': fm.disableModelInvocation = parseBool(value, false); break;
      case 'user-invocable': fm.userInvocable = parseBool(value, true); break;
      case 'mode': fm.mode = parseBool(value, false); break;
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
  if (frontmatter.agent) lines.push(`agent: ${frontmatter.agent}`);
  if (frontmatter.model) lines.push(`model: ${frontmatter.model}`);
  if (frontmatter.argumentHint) lines.push(`argument-hint: ${frontmatter.argumentHint}`);
  if (frontmatter.disableModelInvocation) lines.push(`disable-model-invocation: true`);
  if (!frontmatter.userInvocable) lines.push(`user-invocable: false`);
  if (frontmatter.mode) lines.push(`mode: true`);
  lines.push('---');
  if (body) lines.push('', body);
  return lines.join('\n') + '\n';
}

// ─── Registry ───────────────────────────────────────────────────

function getRegistryDir(): string {
  return path.join(os.homedir(), '.wok3', 'skills');
}

function getGlobalDeployDir(): string {
  return path.join(os.homedir(), '.claude', 'skills');
}

function getProjectDeployDir(projectDir: string): string {
  return path.join(projectDir, '.claude', 'skills');
}

interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  path: string;
}

function listRegistrySkills(): SkillInfo[] {
  const dir = getRegistryDir();
  if (!existsSync(dir)) return [];

  const skills: SkillInfo[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
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
          path: path.join(dir, entry.name),
        });
      } catch {
        // Skip unreadable
      }
    }
  } catch {
    // Dir not readable
  }
  return skills;
}

// ─── Deploy helpers ─────────────────────────────────────────────

function isSymlinkToRegistry(deployDir: string, skillName: string): boolean {
  const linkPath = path.join(deployDir, skillName);
  const expectedTarget = path.join(getRegistryDir(), skillName);
  try {
    const stat = lstatSync(linkPath);
    if (!stat.isSymbolicLink()) return false;
    const target = readlinkSync(linkPath);
    const resolved = path.resolve(path.dirname(linkPath), target);
    return resolved === expectedTarget || target === expectedTarget;
  } catch {
    return false;
  }
}

function createDeploy(deployDir: string, skillName: string): { success: boolean; error?: string } {
  const linkPath = path.join(deployDir, skillName);
  const targetPath = path.join(getRegistryDir(), skillName);

  if (!existsSync(targetPath)) {
    return { success: false, error: 'Skill not found in registry' };
  }

  try {
    mkdirSync(deployDir, { recursive: true });

    // Remove existing symlink if present
    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(linkPath);
      } else if (stat.isDirectory()) {
        return { success: false, error: 'A non-symlink directory already exists at the deploy path' };
      }
    } catch {
      // ENOENT — nothing there, fine
    }

    symlinkSync(targetPath, linkPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to create symlink' };
  }
}

function removeDeploy(deployDir: string, skillName: string): { success: boolean; error?: string } {
  const linkPath = path.join(deployDir, skillName);
  try {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      unlinkSync(linkPath);
    } else if (stat.isDirectory()) {
      rmSync(linkPath, { recursive: true });
    } else {
      return { success: false, error: 'Target is not a skill deployment managed by wok3' };
    }
    return { success: true };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return { success: true };
    return { success: false, error: err.message ?? 'Failed to remove deployment' };
  }
}

// ─── Recursive copy ─────────────────────────────────────────────

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
    }
  }
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
  alreadyInRegistry: boolean;
}

function scanForSkills(roots: string[], maxDepth: number, knownSkills: Set<string>): SkillScanResult[] {
  const results: SkillScanResult[] = [];
  const seen = new Set<string>();
  const registryDir = getRegistryDir();

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build' || name === '.wok3') continue;

        const fullPath = path.join(dir, name);

        if (name === '.claude') {
          const skillsDir = path.join(fullPath, 'skills');
          if (existsSync(skillsDir)) {
            try {
              for (const skillEntry of readdirSync(skillsDir, { withFileTypes: true })) {
                if (!skillEntry.isDirectory()) continue;

                // Skip symlinks pointing to our registry
                const entryPath = path.join(skillsDir, skillEntry.name);
                try {
                  const stat = lstatSync(entryPath);
                  if (stat.isSymbolicLink()) {
                    const target = readlinkSync(entryPath);
                    const resolved = path.resolve(skillsDir, target);
                    if (resolved.startsWith(registryDir)) continue;
                  }
                } catch { /* not a symlink */ }

                const skillMdPath = path.join(skillsDir, skillEntry.name, 'SKILL.md');
                if (!existsSync(skillMdPath)) continue;

                const key = path.resolve(skillsDir, skillEntry.name);
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
                    alreadyInRegistry: knownSkills.has(skillEntry.name),
                  });
                } catch {
                  // Skip unreadable
                }
              }
            } catch { /* skills dir not readable */ }
          }
          continue;
        }

        walk(fullPath, depth + 1);
      }
    } catch { /* dir not readable */ }
  }

  for (const root of roots) {
    walk(root, 0);
  }
  return results;
}

// ─── Routes ─────────────────────────────────────────────────────

export function registerClaudeSkillRoutes(app: Hono, manager: WorktreeManager) {
  const projectDir = manager.getConfigDir();

  // ── Static GET routes (before parameterized :name) ────────────

  // List all skills (registry + project-only)
  app.get('/api/claude/skills', (c) => {
    const registrySkills = listRegistrySkills();
    const registryNames = new Set(registrySkills.map((s) => s.name));

    // Also include project-only skills (non-symlink copies not in registry)
    const projectSkillsDir = getProjectDeployDir(projectDir);
    const projectOnlySkills: SkillInfo[] = [];
    if (existsSync(projectSkillsDir)) {
      try {
        for (const entry of readdirSync(projectSkillsDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (registryNames.has(entry.name)) continue;
          const entryPath = path.join(projectSkillsDir, entry.name);
          try { if (lstatSync(entryPath).isSymbolicLink()) continue; } catch { continue; }
          const skillMdPath = path.join(entryPath, 'SKILL.md');
          if (!existsSync(skillMdPath)) continue;
          try {
            const content = readFileSync(skillMdPath, 'utf-8');
            const { frontmatter } = parseSkillMd(content);
            projectOnlySkills.push({
              name: entry.name,
              displayName: frontmatter.name || entry.name,
              description: frontmatter.description || '',
              path: entryPath,
            });
          } catch { /* skip unreadable */ }
        }
      } catch { /* dir not readable */ }
    }

    return c.json({ skills: [...registrySkills, ...projectOnlySkills] });
  });

  // Deployment status for all skills
  app.get('/api/claude/skills/deployment-status', (c) => {
    const skills = listRegistrySkills();
    const globalDir = getGlobalDeployDir();
    const projectDeployDir = getProjectDeployDir(projectDir);
    const registryNames = new Set(skills.map((s) => s.name));

    const status: Record<string, { global: boolean; local: boolean; localIsSymlink: boolean; localIsCopy: boolean; inRegistry: boolean }> = {};
    for (const skill of skills) {
      const isLocalSymlink = isSymlinkToRegistry(projectDeployDir, skill.name);
      const localPath = path.join(projectDeployDir, skill.name);
      let isLocalCopy = false;
      if (!isLocalSymlink) {
        try {
          const stat = lstatSync(localPath);
          isLocalCopy = stat.isDirectory() && !stat.isSymbolicLink();
        } catch { /* doesn't exist */ }
      }
      status[skill.name] = {
        global: isSymlinkToRegistry(globalDir, skill.name),
        local: isLocalSymlink || isLocalCopy,
        localIsSymlink: isLocalSymlink,
        localIsCopy: isLocalCopy,
        inRegistry: true,
      };
    }

    // Include project-only skills (not in registry)
    if (existsSync(projectDeployDir)) {
      try {
        for (const entry of readdirSync(projectDeployDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (registryNames.has(entry.name)) continue;
          const entryPath = path.join(projectDeployDir, entry.name);
          try { if (lstatSync(entryPath).isSymbolicLink()) continue; } catch { continue; }
          if (!existsSync(path.join(entryPath, 'SKILL.md'))) continue;
          status[entry.name] = {
            global: false,
            local: true,
            localIsSymlink: false,
            localIsCopy: true,
            inRegistry: false,
          };
        }
      } catch { /* dir not readable */ }
    }

    return c.json({ status });
  });

  // List plugins (read-only)
  app.get('/api/claude/plugins', (c) => {
    return c.json({ plugins: loadPlugins() });
  });

  // Get skill detail (registry or local copy via ?location=local)
  app.get('/api/claude/skills/:name', (c) => {
    const name = c.req.param('name');
    const location = c.req.query('location');

    const skillDir = location === 'local'
      ? path.join(getProjectDeployDir(projectDir), name)
      : path.join(getRegistryDir(), name);
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

  // ── Static POST routes (before parameterized :name) ───────────

  // Create skill in registry (global) or directly in project (local)
  app.post('/api/claude/skills', async (c) => {
    const body = await c.req.json<{
      name: string;
      scope?: 'global' | 'local';
      description?: string;
      allowedTools?: string;
      context?: string;
      agent?: string;
      model?: string;
      argumentHint?: string;
      disableModelInvocation?: boolean;
      userInvocable?: boolean;
      mode?: boolean;
      instructions?: string;
    }>();

    if (!body.name?.trim()) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }

    const scope = body.scope ?? 'global';
    const dirName = body.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    const parentDir = scope === 'local'
      ? getProjectDeployDir(projectDir)
      : getRegistryDir();
    const skillDir = path.join(parentDir, dirName);

    if (existsSync(skillDir)) {
      return c.json({ success: false, error: `Skill "${dirName}" already exists` }, 409);
    }

    mkdirSync(skillDir, { recursive: true });

    const frontmatter: SkillFrontmatter = {
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      allowedTools: body.allowedTools?.trim() ?? '',
      context: body.context?.trim() ?? '',
      agent: body.agent?.trim() ?? '',
      model: body.model?.trim() ?? '',
      argumentHint: body.argumentHint?.trim() ?? '',
      disableModelInvocation: body.disableModelInvocation ?? false,
      userInvocable: body.userInvocable ?? true,
      mode: body.mode ?? false,
    };

    const content = buildSkillMd(frontmatter, body.instructions?.trim() ?? '');
    writeFileSync(path.join(skillDir, 'SKILL.md'), content);

    return c.json({
      success: true,
      skill: {
        name: dirName,
        displayName: frontmatter.name,
        description: frontmatter.description,
        path: skillDir,
      },
    });
  });

  // Scan for skills
  app.post('/api/claude/skills/scan', async (c) => {
    const body: { mode?: 'project' | 'folder' | 'device'; scanPath?: string } =
      await c.req.json().catch(() => ({}));

    const mode = body.mode ?? 'project';

    // Collect all already-known skill names: registry + project-deployed
    const knownSkills = new Set(listRegistrySkills().map((s) => s.name));
    const projectSkillsDir = getProjectDeployDir(projectDir);
    if (existsSync(projectSkillsDir)) {
      try {
        for (const entry of readdirSync(projectSkillsDir, { withFileTypes: true })) {
          if (entry.isDirectory()) knownSkills.add(entry.name);
        }
      } catch { /* dir not readable */ }
    }

    let scanRoots: string[];
    let maxDepth: number;

    if (mode === 'project') {
      scanRoots = [projectDir];
      maxDepth = 4;
    } else if (mode === 'folder' && body.scanPath) {
      scanRoots = [body.scanPath];
      maxDepth = 8;
    } else {
      scanRoots = [os.homedir()];
      maxDepth = 5;
    }

    const skills = scanForSkills(scanRoots, maxDepth, knownSkills);
    return c.json({ discovered: skills });
  });

  // Import scanned skills into registry
  app.post('/api/claude/skills/import', async (c) => {
    const body = await c.req.json<{
      skills: Array<{ name: string; skillPath: string }>;
    }>();

    if (!Array.isArray(body.skills)) {
      return c.json({ success: false, error: 'skills array is required' }, 400);
    }

    const registryDir = getRegistryDir();
    mkdirSync(registryDir, { recursive: true });
    const imported: string[] = [];

    for (const s of body.skills) {
      if (!s.name || !s.skillPath) continue;
      const targetDir = path.join(registryDir, s.name);
      if (existsSync(targetDir)) continue;
      if (!existsSync(s.skillPath)) continue;

      try {
        copyDir(s.skillPath, targetDir);
        imported.push(s.name);
      } catch {
        // Skip failed copies
      }
    }

    return c.json({ success: true, imported });
  });

  // ── Parameterized routes ──────────────────────────────────────

  // Update skill (registry or local copy via ?location=local)
  app.patch('/api/claude/skills/:name', async (c) => {
    const name = c.req.param('name');
    const location = c.req.query('location');
    const body = await c.req.json<{
      skillMd?: string;
      referenceMd?: string;
      examplesMd?: string;
      frontmatter?: Partial<SkillFrontmatter>;
    }>();

    const skillDir = location === 'local'
      ? path.join(getProjectDeployDir(projectDir), name)
      : path.join(getRegistryDir(), name);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (!existsSync(skillMdPath)) {
      return c.json({ success: false, error: 'Skill not found' }, 404);
    }

    // Handle frontmatter-only updates: merge into existing SKILL.md
    if (body.frontmatter && body.skillMd === undefined) {
      const current = readFileSync(skillMdPath, 'utf-8');
      const parsed = parseSkillMd(current);
      const merged = { ...parsed.frontmatter, ...body.frontmatter };
      writeFileSync(skillMdPath, buildSkillMd(merged, parsed.body));
    } else if (body.skillMd !== undefined) {
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

  // Delete skill from registry + cleanup symlinks
  app.delete('/api/claude/skills/:name', (c) => {
    const name = c.req.param('name');
    const registryDir = getRegistryDir();
    const skillDir = path.join(registryDir, name);

    if (!existsSync(skillDir)) {
      return c.json({ success: false, error: 'Skill not found' }, 404);
    }

    // Cleanup symlinks before deleting
    const globalDir = getGlobalDeployDir();
    const projectDeployDir = getProjectDeployDir(projectDir);
    if (isSymlinkToRegistry(globalDir, name)) {
      removeDeploy(globalDir, name);
    }
    if (isSymlinkToRegistry(projectDeployDir, name)) {
      removeDeploy(projectDeployDir, name);
    }

    rmSync(skillDir, { recursive: true });
    return c.json({ success: true });
  });

  // Deploy skill (create symlink)
  app.post('/api/claude/skills/:name/deploy', async (c) => {
    const name = c.req.param('name');
    const body = await c.req.json<{ scope: 'global' | 'local' }>();

    const deployDir = body.scope === 'local'
      ? getProjectDeployDir(projectDir)
      : getGlobalDeployDir();

    const result = createDeploy(deployDir, name);
    return c.json(result, result.success ? 200 : 500);
  });

  // Undeploy skill (remove symlink)
  app.post('/api/claude/skills/:name/undeploy', async (c) => {
    const name = c.req.param('name');
    const body = await c.req.json<{ scope: 'global' | 'local' }>();

    const deployDir = body.scope === 'local'
      ? getProjectDeployDir(projectDir)
      : getGlobalDeployDir();

    const result = removeDeploy(deployDir, name);
    return c.json(result, result.success ? 200 : 500);
  });

  // Duplicate skill to project (copy files instead of symlink)
  app.post('/api/claude/skills/:name/duplicate', async (c) => {
    const name = c.req.param('name');
    const registryDir = getRegistryDir();
    const sourcePath = path.join(registryDir, name);

    if (!existsSync(sourcePath)) {
      return c.json({ success: false, error: 'Skill not found in registry' }, 404);
    }

    const targetDir = getProjectDeployDir(projectDir);
    const targetPath = path.join(targetDir, name);

    // If it's a symlink, remove it first
    try {
      const stat = lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        unlinkSync(targetPath);
      } else if (stat.isDirectory()) {
        return c.json({ success: false, error: 'Project copy already exists' }, 409);
      }
    } catch {
      // ENOENT — nothing there, fine
    }

    mkdirSync(targetDir, { recursive: true });
    copyDir(sourcePath, targetPath);

    return c.json({ success: true });
  });

  // Create a global (registry) skill from a project copy
  app.post('/api/claude/skills/:name/create-global', async (c) => {
    const name = c.req.param('name');
    const body = await c.req.json<{ newName: string }>().catch(() => ({ newName: '' }));
    const newName = body.newName?.trim();

    if (!newName) {
      return c.json({ success: false, error: 'New name is required' }, 400);
    }

    // Source: project .claude/skills/<name>
    const projectSkillsDir = getProjectDeployDir(projectDir);
    const sourcePath = path.join(projectSkillsDir, name);

    if (!existsSync(sourcePath)) {
      return c.json({ success: false, error: 'Project skill not found' }, 404);
    }

    // Target: registry dir with sanitized new name
    const dirName = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    const registryDir = getRegistryDir();
    const targetPath = path.join(registryDir, dirName);

    if (existsSync(targetPath)) {
      return c.json({ success: false, error: `Skill "${dirName}" already exists in registry` }, 409);
    }

    mkdirSync(registryDir, { recursive: true });
    copyDir(sourcePath, targetPath);

    // Update the name in frontmatter if it differs
    const skillMdPath = path.join(targetPath, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const raw = readFileSync(skillMdPath, 'utf-8');
      const { frontmatter, body: mdBody } = parseSkillMd(raw);
      if (frontmatter.name !== newName) {
        frontmatter.name = newName;
        writeFileSync(skillMdPath, buildSkillMd(frontmatter, mdBody));
      }
    }

    return c.json({ success: true, name: dirName });
  });
}
