# Hooks

## Overview

Hooks are automated checks and agent skills that run at defined points in a worktree's lifecycle. They provide a structured way to validate work, enforce quality standards, and extend agent behavior through shell commands and imported skills.

Hooks are organized by **trigger type** -- when they fire relative to agent work. Each trigger type can contain both **command steps** (shell commands) and **skill references** (agent skills from the registry).

The hooks system is configured through the web UI's Hooks view and stored in `.work3/.work3/hooks.json`.

## Trigger Types

Every hook belongs to one of four trigger types:

| Trigger | Description | Icon | Color |
|---------|-------------|------|-------|
| `pre-implementation` | Runs before agents start working on a task | ListChecks | sky-400 |
| `post-implementation` | Runs after agents finish implementing a task | CircleCheck | emerald-400 |
| `custom` | Agent decides when to run, based on a natural-language condition | MessageSquareText | violet-400 |
| `on-demand` | Manually triggered from the worktree detail panel | Hand | amber-400 |

Steps and skills default to `post-implementation` if no trigger is specified.

## Item Types

### Command Steps

Shell commands that run in the worktree directory and return pass/fail results.

- Executed via `execFile` with a 2-minute timeout.
- Pass/fail determined by exit code (zero = pass, non-zero = fail).
- stdout and stderr are captured and returned as step output.
- `FORCE_COLOR=0` is set to suppress ANSI codes in output.
- When running all hooks for a worktree, enabled steps matching the trigger run in parallel.

### Skill References

References to skills from the `~/.work3/skills/` registry. When hooks run, skill references tell the agent which skills to invoke.

- Skills are imported by name from the registry.
- Each skill reference can be individually enabled/disabled.
- The same skill can be used in multiple trigger types (e.g., a code-review skill in both `post-implementation` and `on-demand`).
- Skills are identified by the composite key `skillName + trigger`.
- Custom-trigger skills include a `condition` field -- a natural-language description of when the agent should invoke them.

### Per-Issue Skill Overrides

Individual issues can override the global enable/disable state of skills. Overrides are stored in the issue's notes (`hookSkills` field) and can be:

| Override | Behavior |
|----------|----------|
| `inherit` | Use the global enabled/disabled state (default) |
| `enable` | Force-enable for this issue's worktree |
| `disable` | Force-disable for this issue's worktree |

The `getEffectiveSkills()` method resolves overrides by looking up the worktree's linked issue.

## Configuration

Hooks configuration is stored in `.work3/.work3/hooks.json`:

```json
{
  "steps": [
    {
      "id": "step-1234567890-1",
      "name": "Type check",
      "command": "pnpm check-types",
      "enabled": true,
      "trigger": "post-implementation"
    },
    {
      "id": "step-1234567890-2",
      "name": "Lint on DB changes",
      "command": "pnpm check-lint",
      "enabled": true,
      "trigger": "custom",
      "condition": "When changes touch database models or migrations"
    }
  ],
  "skills": [
    {
      "skillName": "verify-code-review",
      "enabled": true,
      "trigger": "post-implementation"
    },
    {
      "skillName": "verify-code-review",
      "enabled": true,
      "trigger": "on-demand"
    },
    {
      "skillName": "verify-tests",
      "enabled": true,
      "trigger": "custom",
      "condition": "When changes add new API endpoints"
    }
  ]
}
```

### HookStep Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (auto-generated: `step-{timestamp}-{counter}`) |
| `name` | string | Human-readable name shown in the UI |
| `command` | string | Shell command to execute in the worktree directory |
| `enabled` | boolean | Whether this step is active (default: `true`) |
| `trigger` | HookTrigger | When this step runs (default: `post-implementation`) |
| `condition` | string | Natural-language condition for `custom` trigger type |

### HookSkillRef Fields

| Field | Type | Description |
|-------|------|-------------|
| `skillName` | string | Name of the skill in `~/.work3/skills/` |
| `enabled` | boolean | Whether this skill is active |
| `trigger` | HookTrigger | When this skill runs (default: `post-implementation`) |
| `condition` | string | Natural-language condition for `custom` trigger type |

## Running Hooks

### From the UI

The Hooks view (top navigation) is the configuration interface. Users can:

1. Add command steps or import skills into any trigger type section.
2. Toggle individual items on/off.
3. Edit command step names, commands, and conditions.
4. Remove items.

The worktree detail panel's **Verify** tab triggers on-demand hook runs for a specific worktree.

### From MCP Tools

Agents interact with hooks through the following workflow:

1. Read hook configuration to understand what checks are expected.
2. Run `post-implementation` hooks after completing a task.
3. Report skill results back to work3.
4. Check run status to verify all steps passed.

### Execution

When hooks are triggered for a worktree:

1. The `HooksManager` filters steps by the target trigger type and enabled state.
2. All matching command steps run in parallel via `execFile` in the worktree directory.
3. Results are collected and persisted to `.work3/.work3/worktrees/{worktreeId}/hooks/latest-run.json`.
4. Skill results are reported separately by agents and stored at `.work3/.work3/worktrees/{worktreeId}/hooks/skill-results.json`.

## Data Storage

```
.work3/
  .work3/
    hooks.json                              # Global hooks configuration
    worktrees/
      <worktreeId>/
        hooks/
          latest-run.json                   # Most recent command step run
          skill-results.json                # Agent-reported skill results
```

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hooks/config` | Get hooks configuration |
| `PUT` | `/api/hooks/config` | Save full hooks configuration |
| `POST` | `/api/hooks/steps` | Add a command step (`{ name, command }`) |
| `PATCH` | `/api/hooks/steps/:stepId` | Update a step (`{ name?, command?, enabled?, trigger? }`) |
| `DELETE` | `/api/hooks/steps/:stepId` | Remove a step |
| `POST` | `/api/hooks/skills/import` | Import a skill (`{ skillName, trigger?, condition? }`) |
| `GET` | `/api/hooks/skills/available` | List available skills from registry |
| `PATCH` | `/api/hooks/skills/:name` | Toggle a skill (`{ enabled, trigger? }`) |
| `DELETE` | `/api/hooks/skills/:name` | Remove a skill (`?trigger=` query param) |
| `POST` | `/api/worktrees/:id/hooks/run` | Run all enabled steps for a worktree |
| `POST` | `/api/worktrees/:id/hooks/run/:stepId` | Run a single step |
| `GET` | `/api/worktrees/:id/hooks/status` | Get latest run status |
| `POST` | `/api/worktrees/:id/hooks/report` | Report a skill result (`{ skillName, success, summary, content? }`) |
| `GET` | `/api/worktrees/:id/hooks/skill-results` | Get skill results for a worktree |

## Backend

### HooksManager (`src/server/verification-manager.ts`)

The `HooksManager` class manages all hooks state and execution:

- **Config**: `getConfig()`, `saveConfig()`, `addStep()`, `removeStep()`, `updateStep()`
- **Skills**: `importSkill()`, `removeSkill()`, `toggleSkill()`, `ensureSkillsImported()`, `getEffectiveSkills()`
- **Execution**: `runAll()`, `runSingle()` -- command step execution with timeout
- **Skill results**: `reportSkillResult()`, `getSkillResults()` -- agent-reported results
- **Status**: `getStatus()` -- latest pipeline run for a worktree

### Routes (`src/server/routes/verification.ts`)

Registered via `registerHooksRoutes(app, manager, hooksManager)` in the server setup.

## Frontend

### HooksPanel (`src/ui/components/VerificationPanel.tsx`)

The top-level Hooks view. Displays four sections (one per trigger type), each containing:

- A header with icon, title, and description.
- Command step cards (editable, toggleable, removable).
- Skill cards (toggleable, removable).
- "Add command" and "Add skill" action buttons (mutually exclusive -- opening one closes the other).

Custom-trigger sections show an additional condition textarea for both command steps and skill imports.

### useHooksConfig (`src/ui/hooks/useHooks.ts`)

Hook for fetching and saving hooks configuration. Returns `{ config, isLoading, refetch, saveConfig }`.

### useHookSkillResults (`src/ui/hooks/useHooks.ts`)

Hook for fetching agent-reported skill results for a worktree.

### Issue Detail Panel: Hooks Tab

The Agents section in issue detail panels (Linear, Jira, Local) includes a Hooks tab that shows:

- Steps and skills grouped by trigger type (pre-implementation, post-implementation only -- on-demand hooks are not shown).
- Command steps displayed read-only (name + command).
- Skills with per-issue override toggles (Inherit / Enable / Disable).
