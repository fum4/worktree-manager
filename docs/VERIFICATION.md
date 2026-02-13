# Verification Pipeline

## Overview

The verification pipeline is a configurable pre-merge validation system that runs checks on worktree changes before they are merged. It provides a structured sequence of verification steps -- some executed as shell commands, others delegated to an AI agent -- to catch issues, generate documentation, and enforce quality standards.

The pipeline is designed to be driven by MCP tools so that any connected AI agent can run verification, but it can also be triggered from the web UI's worktree detail panel.

## Step Types

Every verification step belongs to one of three categories:

### Command Steps

Command steps run shell commands in the worktree directory and return results inline.

- Executed via `execFile` with a 2-minute timeout per command.
- Pass/fail is determined by exit code (zero = pass, non-zero = fail).
- stdout and stderr are captured and returned as the step output.
- Multiple commands run sequentially; by default, the pipeline stops on the first failure (configurable with `continueOnFailure`).

The only built-in command step is **Pipeline Checks** (`pipelineChecks`).

### Agent-Driven Steps

Agent-driven steps return instructions and context to the AI agent rather than executing anything directly. The agent performs the requested task (reviewing code, writing tests, etc.) and then reports the result back.

- The pipeline prepares context by running `git diff HEAD` in the worktree to collect the diff and list of changed files.
- The response includes `type: "agent-task"`, natural-language instructions, and a context payload.
- The agent follows the instructions and calls `report_verification_result` with a success/failure flag and markdown output.
- The result is persisted as an artifact in `.work3/worktrees/<id>/verification/artifacts/<stepName>.md`.

Agent-driven steps: **Changes Summary**, **Code Review**, **Manual Test Instructions**, **Test Writing**.

### Infrastructure Steps

Infrastructure steps check whether external tooling (browser testing, request mocking) is set up. They currently report a "not-configured" status with a setup prompt. These steps are placeholders for deeper plugin integration.

Infrastructure steps: **Agent Testing**, **Request Mocking**.

## Available Steps

Steps always run in the following fixed order. Disabled or unconfigured steps are skipped.

| Step Name               | Label                    | Type           | Description                                                      |
|-------------------------|--------------------------|----------------|------------------------------------------------------------------|
| `changesSummary`        | Changes Summary          | agent-driven   | Agent generates a concise summary of what changed, including files modified, key changes, and potential impact areas. |
| `pipelineChecks`        | Pipeline Checks          | command        | Runs configured shell commands (lint, typecheck, build, etc.) in the worktree directory. |
| `codeReview`            | Code Review              | agent-driven   | Agent reviews the diff for bugs, logic errors, security issues, and code quality. Reports findings with severity levels (critical, warning, info). |
| `manualTestInstructions`| Manual Test Instructions | agent-driven   | Agent generates step-by-step manual testing instructions, including prerequisites, test steps, expected outcomes, and edge cases. |
| `testWriting`           | Test Writing             | agent-driven   | Agent writes automated tests following existing test patterns in the project. Supports configuring test types (unit, integration, e2e) and framework. |
| `agentTesting`          | Agent Testing            | infrastructure | Browser and API testing via Playwright MCP. Requires plugin installation. |
| `requestMocking`        | Request Mocking          | infrastructure | Mock external API dependencies via MSW. Requires plugin installation. |

## Configuration

Verification configuration is stored in `.work3/.work3/verification.json` (inside the project's `.work3` config directory). It is separate from the main `.work3/config.json`.

### Structure

```json
{
  "enabled": false,
  "steps": {
    "changesSummary": {
      "enabled": true
    },
    "pipelineChecks": {
      "enabled": true,
      "config": {
        "commands": ["pnpm check-types", "pnpm check-lint"],
        "continueOnFailure": false
      }
    },
    "codeReview": {
      "enabled": true,
      "config": {
        "focus": ["security", "performance"],
        "guidelines": "Follow project coding standards"
      }
    },
    "manualTestInstructions": {
      "enabled": false
    },
    "testWriting": {
      "enabled": true,
      "config": {
        "types": ["unit", "integration"],
        "framework": "vitest"
      }
    },
    "agentTesting": {
      "enabled": false,
      "config": {
        "browser": { "baseUrl": "http://localhost:3000" },
        "api": { "baseUrl": "http://localhost:4000" }
      }
    },
    "requestMocking": {
      "enabled": false,
      "config": {
        "services": [
          { "name": "payment-api", "baseUrl": "https://api.stripe.com" }
        ]
      }
    }
  }
}
```

### Top-Level Fields

- **`enabled`** (boolean) -- Master toggle. When `false`, calling `run_verification` returns a failure immediately. All steps are disabled regardless of their individual settings.
- **`steps`** (object) -- Per-step configuration. Each key corresponds to a step name from the table above.

### Per-Step Fields

- **`enabled`** (boolean) -- Whether this step runs when the pipeline is triggered.
- **`config`** (object, optional) -- Step-specific settings. Only meaningful for certain steps:
  - `pipelineChecks.config.commands` -- Array of shell commands to run.
  - `pipelineChecks.config.continueOnFailure` -- If `true`, run all commands even if earlier ones fail. Also controls whether the entire pipeline continues past a failed Pipeline Checks step.
  - `codeReview.config.focus` -- Optional focus areas for the review.
  - `codeReview.config.guidelines` -- Optional custom guidelines string.
  - `testWriting.config.types` -- Array of test types: `"unit"`, `"integration"`, `"e2e"`.
  - `testWriting.config.framework` -- Test framework name (e.g. `"vitest"`, `"jest"`). If omitted, the agent auto-detects.

## Running Verification

### From the UI

1. Open the detail panel for a worktree by selecting it in the sidebar.
2. Switch to the **Verify** tab.
3. If the pipeline is not enabled, a message prompts you to enable it in the Verification settings view (accessible from the top navigation).
4. Click **Run Verification** to start. The panel shows a progress bar and per-step results.
5. Each step displays its status (passed, failed, skipped, pending, running) with an expandable output section.
6. For agent-driven steps that returned a pending `agent-task` response, the output area displays the instructions and changed files list.
7. After a run completes, click **Re-run** to start a fresh run.

### From MCP Tools

The full verification workflow from an AI agent perspective:

#### 1. Check configuration

```
get_verification_config
```

Returns the current `VerificationConfig` object so the agent knows which steps are enabled and how they are configured.

#### 2. Start the pipeline

```
run_verification
  worktreeId: "PROJ-123"
  steps: "pipelineChecks,codeReview"   (optional -- omit to run all enabled steps)
```

Returns a `PipelineRun` object containing results for each step. The `steps` parameter accepts a comma-separated list of step names to selectively run; if omitted, all enabled steps run in order.

#### 3. Process command step results

For steps with `type: "command"` (i.e., `pipelineChecks`), the result is returned inline in the `PipelineRun` response:

- `status: "passed"` -- all commands succeeded.
- `status: "failed"` -- one or more commands failed. The `output` field contains the combined stdout/stderr with pass/fail markers per command.
- `status: "skipped"` -- step was disabled or had no commands configured.

#### 4. Complete agent-driven steps

For steps with `type: "agent-driven"`, the result `output` is a JSON string with the following structure:

```json
{
  "type": "agent-task",
  "instructions": "Review the code changes for bugs, logic errors, security issues...",
  "context": {
    "worktreeId": "PROJ-123",
    "worktreePath": "/path/to/.work3/worktrees/PROJ-123",
    "changedFiles": ["src/foo.ts", "src/bar.ts"],
    "diff": "diff --git a/src/foo.ts b/src/foo.ts\n...",
    "stepConfig": {}
  },
  "reportStepId": "PROJ-123:codeReview"
}
```

The agent should:

1. Read the `instructions` field.
2. Use the `context.diff` and `context.changedFiles` to understand the changes.
3. Perform the requested task (write a summary, review the code, generate tests, etc.).
4. Report the result:

```
report_verification_result
  worktreeId: "PROJ-123"
  stepName: "codeReview"
  success: true
  result: "## Code Review\n\nNo critical issues found. Minor suggestions:\n- ..."
```

The `result` parameter should be markdown content. It is saved as an artifact file and a truncated version (up to 5,000 characters) is stored in the pipeline run record.

#### 5. Check progress

```
get_verification_status
  worktreeId: "PROJ-123"
```

Returns the latest `PipelineRun` for the worktree, or `null` if no run has been executed. Use this to check whether all steps have completed and whether the overall pipeline passed or failed.

## Agent-Driven Steps Workflow

The following describes the full lifecycle of an agent-driven verification step in detail.

1. **Agent calls `run_verification`** with a worktree ID. The `VerificationManager` iterates through enabled steps in order.

2. **For each agent-driven step**, the manager:
   - Runs `git diff HEAD` in the worktree directory to capture the current diff (truncated to 50,000 characters).
   - Runs `git diff --name-only HEAD` to get the list of changed files.
   - Returns a `StepResult` with `status: "pending"` and `output` containing a JSON payload of type `agent-task`.

3. **The agent receives the response** and finds the pending step. The `instructions` field tells the agent what to do (e.g., "Review the code changes for bugs..."). The `context` object provides all necessary data.

4. **The agent performs the task.** For example:
   - `changesSummary`: Read the diff, summarize files modified, key changes, and impact areas.
   - `codeReview`: Analyze the diff for bugs, security issues, and code quality; report findings with severity levels.
   - `manualTestInstructions`: Generate step-by-step testing instructions with prerequisites, steps, expected outcomes, and edge cases.
   - `testWriting`: Write automated tests following existing project patterns.

5. **The agent calls `report_verification_result`** with:
   - `worktreeId` -- the worktree being verified.
   - `stepName` -- the name of the step being completed (e.g., `"codeReview"`).
   - `success` -- `true` if the step passes, `false` if issues were found that constitute a failure.
   - `result` -- markdown content with the full output (review findings, generated tests, etc.).

6. **The manager persists the result.** The markdown is saved to `.work3/worktrees/<id>/verification/artifacts/<stepName>.md`. The `latest-run.json` file is updated: the step's status changes from `"pending"` to `"passed"` or `"failed"`, and if all steps are complete, the overall pipeline status is finalized.

7. **The pipeline continues** to the next step. If `pipelineChecks` fails and `continueOnFailure` is `false`, remaining steps are marked as `"skipped"`.

## Pipeline Run Behavior

- Steps run sequentially in the fixed order defined by `STEP_ORDER`.
- If the `pipelineChecks` step fails and `continueOnFailure` is not enabled in its config, all subsequent steps are immediately marked as `"skipped"` and the pipeline stops.
- Each command within `pipelineChecks` runs with `FORCE_COLOR=0` to suppress ANSI color codes in output.
- Commands have a 120-second timeout; git diff operations have a 30-second timeout.
- The pipeline run is persisted to `.work3/worktrees/<id>/verification/latest-run.json` after completion.

## Data Storage

All verification data lives under the `.work3` config directory:

```
.work3/
  .work3/
    verification.json                          # Pipeline configuration
    worktrees/
      <worktreeId>/
        verification/
          latest-run.json                      # Most recent pipeline run
          artifacts/
            changesSummary.md                  # Agent-generated summary
            codeReview.md                      # Agent-generated review
            manualTestInstructions.md          # Agent-generated test plan
            testWriting.md                     # Agent-generated tests
```

## Nudges System

The nudges system provides context-aware recommendations for setting up and improving the verification pipeline. Call `get_verification_nudges` to retrieve suggestions.

Each nudge has:

- **`type`** -- `"info"`, `"warning"`, or `"suggestion"`.
- **`message`** -- Human-readable recommendation.
- **`action`** (optional) -- A suggested action or tool call.

### Built-In Nudges

| Condition | Type | Message |
|-----------|------|---------|
| Pipeline disabled | info | "Verification pipeline is disabled. Enable it to validate agent changes before merging." |
| No steps enabled | info | "No verification steps are enabled. Configure at least Pipeline Checks to catch common issues." |
| Pipeline Checks enabled but no commands | warning | "Pipeline Checks is enabled but has no commands configured. Add lint, typecheck, or build commands." |
| Code review or test writing enabled without agent testing | suggestion | "Code review and test writing work best with browser testing. Enable Agent Testing and install Playwright MCP." |
| Changes Summary not enabled | suggestion | "Enable Changes Summary to get a quick overview of what the agent modified before reviewing." |

## Plugin Installation

The `install_verification_plugin` MCP tool handles installing external dependencies needed by infrastructure steps.

### Supported Plugins

#### Playwright

Used by the **Agent Testing** step for browser-based verification.

```
install_verification_plugin
  pluginName: "playwright"
```

What it does:
1. Checks if `@playwright/test` is already installed via `npm ls`.
2. If not, runs `npm install --save-dev @playwright/test`.
3. Downloads the Chromium browser via `npx playwright install chromium`.
4. Returns a success message or an error with details.

#### MSW (Mock Service Worker)

Used by the **Request Mocking** step for mocking external API dependencies during testing.

```
install_verification_plugin
  pluginName: "msw"
```

What it does:
1. Checks if `msw` is already installed via `npm ls`.
2. If not, runs `npm install --save-dev msw`.
3. Returns a success message prompting the user to configure mock handlers.

### Error Handling

If the plugin name is not recognized, the tool returns:

```json
{
  "success": false,
  "message": "Unknown plugin \"<name>\". Available plugins: playwright, msw"
}
```

## REST API Reference

The verification pipeline exposes the following HTTP endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/verification/config` | Get current verification configuration |
| `PATCH`| `/api/verification/config` | Update verification configuration (partial merge) |
| `POST` | `/api/worktrees/:id/verify` | Start a pipeline run for a worktree. Body: `{ steps?: string[] }` |
| `POST` | `/api/worktrees/:id/verify/report` | Report an agent step result. Body: `{ stepName, success, result }` |
| `GET`  | `/api/worktrees/:id/verify/status` | Get the latest pipeline run status for a worktree |

## MCP Tool Reference

| Tool | Description |
|------|-------------|
| `get_verification_config` | Returns the full `VerificationConfig` object |
| `run_verification` | Starts the pipeline; params: `worktreeId` (required), `steps` (optional, comma-separated) |
| `report_verification_result` | Reports agent step result; params: `worktreeId`, `stepName`, `success`, `result` (all required) |
| `get_verification_status` | Returns latest `PipelineRun` for a worktree; param: `worktreeId` (required) |
| `get_verification_nudges` | Returns setup recommendations as an array of nudge objects |
| `install_verification_plugin` | Installs a plugin; param: `pluginName` (required, `"playwright"` or `"msw"`) |
