import { existsSync, mkdirSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

interface PredefinedSkill {
  dirName: string;
  frontmatter: string;
  body: string;
}

const PREDEFINED_SKILLS: PredefinedSkill[] = [
  {
    dirName: 'verify-changes-summary',
    frontmatter: [
      'name: verify-changes-summary',
      'description: Generate a summary of what changed in this worktree (diff-based)',
      'user-invocable: true',
    ].join('\n'),
    body: `You are a hook skill for the work3 worktree manager.

## Task

Generate a concise summary of all changes made in this worktree compared to the base branch.

## Steps

1. Call \`report_hook_status\` with just \`worktreeId\` and \`skillName\`: "verify-changes-summary" (no success/summary) to mark it running in the UI
2. Run \`git diff HEAD~..HEAD\` (or \`git diff main..HEAD\` if multiple commits) to see all changes
3. Analyze the diff and produce a structured summary:
   - **Files changed** — list of modified/added/deleted files
   - **What changed** — high-level description of the changes grouped by feature/area
   - **Key decisions** — any notable architectural or design choices visible in the diff
4. Call \`report_hook_status\` again with:
   - \`skillName\`: "verify-changes-summary"
   - \`success\`: true
   - \`summary\`: A one-line summary (e.g. "Added user auth with JWT + 3 new API endpoints")
   - \`content\`: The full markdown summary

Keep the summary factual and concise. Focus on what changed, not why.`,
  },
  {
    dirName: 'verify-code-review',
    frontmatter: [
      'name: verify-code-review',
      'description: Review own code for bugs, security issues, and quality problems',
      'user-invocable: true',
    ].join('\n'),
    body: `You are a hook skill for the work3 worktree manager.

## Task

Review the code changes in this worktree for bugs, security vulnerabilities, and quality issues.

## Steps

1. Call \`report_hook_status\` with just \`worktreeId\` and \`skillName\`: "verify-code-review" (no success/summary) to mark it running in the UI
2. Run \`git diff main..HEAD\` (adjust base branch as needed) to see all changes
3. Review each changed file for:
   - **Bugs** — logic errors, off-by-one, null/undefined issues, race conditions
   - **Security** — injection, XSS, auth bypasses, secrets in code, OWASP top 10
   - **Quality** — dead code, missing error handling, unclear naming, code duplication
4. Call \`report_hook_status\` again with:
   - \`skillName\`: "verify-code-review"
   - \`success\`: true if no critical issues found, false if there are blocking problems
   - \`summary\`: One-line verdict (e.g. "No critical issues. 2 minor suggestions.")
   - \`content\`: Full review in markdown with file:line references

Be honest and specific. Flag real issues, not style preferences.`,
  },
  {
    dirName: 'verify-test-instructions',
    frontmatter: [
      'name: verify-test-instructions',
      'description: Generate step-by-step manual testing instructions',
      'user-invocable: true',
    ].join('\n'),
    body: `You are a hook skill for the work3 worktree manager.

## Task

Generate step-by-step manual testing instructions for the changes in this worktree.

## Steps

1. Call \`report_hook_status\` with just \`worktreeId\` and \`skillName\`: "verify-test-instructions" (no success/summary) to mark it running in the UI
2. Run \`git diff main..HEAD\` to understand what changed
3. Read TASK.md to understand the intent of the changes
4. Create a testing document with:
   - **Prerequisites** — what needs to be running, env setup, test data
   - **Test scenarios** — numbered steps a QA person can follow
   - **Expected results** — what should happen at each step
   - **Edge cases** — boundary conditions to verify
5. Call \`report_hook_status\` again with:
   - \`skillName\`: "verify-test-instructions"
   - \`success\`: true
   - \`summary\`: "Generated N test scenarios covering [areas]"
   - \`content\`: The full testing document in markdown

Write for someone unfamiliar with the codebase. Be specific about clicks, URLs, and expected output.`,
  },
  {
    dirName: 'verify-test-writing',
    frontmatter: [
      'name: verify-test-writing',
      'description: Write unit/integration tests for the changes',
      'user-invocable: true',
    ].join('\n'),
    body: `You are a hook skill for the work3 worktree manager.

## Task

Write unit and/or integration tests for the changes in this worktree.

## Steps

1. Call \`report_hook_status\` with just \`worktreeId\` and \`skillName\`: "verify-test-writing" (no success/summary) to mark it running in the UI
2. Run \`git diff main..HEAD\` to understand what changed
3. Identify testable units — new functions, API endpoints, components, logic
4. Write tests following the project's existing test patterns and framework
5. If the project has no test runner, note this and write tests that could be added later
6. Call \`report_hook_status\` again with:
   - \`skillName\`: "verify-test-writing"
   - \`success\`: true if tests were written, false if nothing testable was found
   - \`summary\`: "Wrote N tests covering [areas]"
   - \`content\`: The test code in markdown code blocks with file paths

Match the project's testing conventions. Prefer real assertions over snapshot tests.`,
  },
  {
    dirName: 'verify-explain-like-im-5',
    frontmatter: [
      'name: verify-explain-like-im-5',
      'description: Explain what changed in this worktree like the reader is five years old',
      'user-invocable: true',
    ].join('\n'),
    body: `You are a hook skill for the work3 worktree manager.

## Task

Explain the changes in this worktree as if you're talking to a very smart five-year-old. Use simple words, fun analogies, and zero jargon.

## Steps

1. Call \`report_hook_status\` with just \`worktreeId\` and \`skillName\`: "verify-explain-like-im-5" (no success/summary) to mark it running in the UI
2. Run \`git diff main..HEAD\` to see all changes
3. Read through the diff and understand what happened
4. Write your explanation following these rules:
   - Use simple words a kid would understand
   - Compare code concepts to real-world things (buildings, toys, recipes, animals, etc.)
   - If something is deleted, say what went away. If something is added, say what's new.
   - Keep it short and fun — aim for "bedtime story about code" vibes
   - End with a one-sentence "so basically..." wrap-up
5. Call \`report_hook_status\` again with:
   - \`skillName\`: "verify-explain-like-im-5"
   - \`success\`: true
   - \`summary\`: A one-line kidspeak summary (e.g. "We taught the app a new trick and fixed a boo-boo")
   - \`content\`: The full ELI5 explanation in markdown

Have fun with it. Be playful, be clear, be honest.`,
  },
];

function getRegistryDir(): string {
  return path.join(os.homedir(), '.work3', 'skills');
}

function buildSkillMd(frontmatter: string, body: string): string {
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

export function ensurePredefinedHookSkills(): void {
  const registryDir = getRegistryDir();

  for (const skill of PREDEFINED_SKILLS) {
    const skillDir = path.join(registryDir, skill.dirName);
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    if (existsSync(skillMdPath)) continue;

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillMdPath, buildSkillMd(skill.frontmatter, skill.body));
  }
}

export function getPredefinedSkillNames(): string[] {
  return PREDEFINED_SKILLS.map((s) => s.dirName);
}
