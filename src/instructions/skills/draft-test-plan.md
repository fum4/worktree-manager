---
name: draft-test-plan
description: Generate step-by-step manual testing instructions
user-invocable: true
---

You are a hook skill for the dawg worktree manager.

## Task

Generate step-by-step manual testing instructions for the changes in this worktree.

## Steps

1. Call `report_hook_status` with just `worktreeId` and `skillName` (no `success`/`summary`) to mark it **running** in the UI

2. Run `git diff main..HEAD` to understand what changed

3. Read TASK.md to understand the intent of the changes

4. Create a testing document with:
   - **Prerequisites** — what needs to be running, env setup, test data
   - **Test scenarios** — numbered steps a QA person can follow
   - **Expected results** — what should happen at each step
   - **Edge cases** — boundary conditions to verify

5. Call `report_hook_status` again with the result:
   - `success`: `true`
   - `summary`: "Generated N test scenarios covering [areas]"
   - `content`: the full testing document in markdown

Write for someone unfamiliar with the codebase. Be specific about clicks, URLs, and expected output.
