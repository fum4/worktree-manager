# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

work3 is a CLI tool + web UI (with optional Electron app) for managing multiple git worktrees with automatic port offsetting and Jira/Linear/GitHub integrations.

## Quick Reference

**Package manager**: pnpm

```bash
pnpm build         # Full build (tsup backend + vite frontend)
pnpm dev           # Dev mode (concurrent watchers)
pnpm check-types   # TypeScript type check
pnpm check-lint    # Lint
```

There is no test runner configured.

## Documentation

Comprehensive documentation lives in `/docs/`. **Always check the relevant docs before working on unfamiliar areas** — they contain architectural context, component patterns, and API details that will help you make correct changes.

**Keep docs up to date.** When making changes, check if any docs in `/docs/` need updating and update them. If a change introduces a new system or concept not covered by existing docs, create a new doc file in `/docs/` and add it to the table below and in `README.md`. Outdated docs are worse than no docs.

| Document | Covers | When to Read |
|----------|--------|--------------|
| [Architecture](docs/ARCHITECTURE.md) | System layers, components, data flow, build system | Understanding project structure |
| [Development](docs/DEVELOPMENT.md) | Build system, dev workflow, code organization, conventions | Before writing code |
| [Frontend](docs/FRONTEND.md) | UI architecture, views, theme, components | UI changes |
| [API Reference](docs/API.md) | REST API endpoints | New or modified endpoints |
| [CLI Reference](docs/CLI.md) | All CLI commands and options | CLI changes |
| [Configuration](docs/CONFIGURATION.md) | Config files, settings, data storage | Config changes |
| [MCP Tools](docs/MCP.md) | MCP integration and tool reference | MCP/agent tool changes |
| [Agents](docs/AGENTS.md) | Agent tooling, skills, plugins, git policy | Agent system changes |
| [Integrations](docs/INTEGRATIONS.md) | Jira, Linear, GitHub setup | Integration changes |
| [Port Mapping](docs/PORT-MAPPING.md) | Port discovery, offset algorithm, runtime hook | Port system changes |
| [Hooks](docs/HOOKS.md) | Hooks system (trigger types, commands, skills) | Hooks changes |
| [Electron](docs/ELECTRON.md) | Desktop app, deep linking, multi-project | Electron changes |
