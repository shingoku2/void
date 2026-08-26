# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Void is a fork of VSCode (Electron-based), serving as the open-source Cursor alternative. The project adds AI agent capabilities on top of VSCode's editor. Node version `22.22.3` is required (see `.nvmrc`).

## Build Commands

- `npm install` — Install dependencies (Yarn is not supported — use npm install)
- `npm run watch` — Build and watch client + extensions in dev mode
- `./scripts/code.bat` (Windows) or `./scripts/code.sh` (Mac/Linux) — Launch Developer Mode window
- `npm run compile` — One-time compile
- `npm run gulp <target>` — Build specific platform (e.g., `vscode-win32-x64`)

**React build step**: Void uses a separate React bundle. After any React changes, run `npm run buildreact` (or `npm run watchreact` for watch mode). This is required in addition to the standard build commands.

## Testing Commands

- `npm run test-node` — Node-based unit tests (mocha)
- `npm run test-browser` — Browser tests (requires Playwright installation)
- `npm run test-browser-no-install` — Run browser tests without installing Playwright
- `npm run smoketest` — End-to-end UI smoke tests

## Linting Commands

- `npm run eslint` — Run ESLint
- `npm run stylelint` — Run Stylelint
- `npm run hygiene` — Run hygiene checks

## Architecture

Void-specific code lives in `src/vs/workbench/contrib/void/`. The rest follows VSCode's architecture:

- **Main process** (`electron-main/`) — Node.js runtime, can import `node_modules`
- **Browser process** (`browser/`) — HTML/JS renderer, no direct `node_modules` access
- **Common** (`common/`) — Shared code usable by either process

Key concepts from VSCode:
- **Editor** — The container (holds multiple tabs/models)
- **Model** — Internal representation of a file's contents (shared between editors)
- **Services** — Singleton classes registered via `registerSingleton`, accessed via `@<Service>` decorator
- **Actions/Commands** — Registered functions callable via Command Palette or `commandService`

## Key Services

- `editCodeService` — Handles Apply (Fast Apply via Search/Replace blocks, Slow Apply via file rewrite)
- `voidModelService` — Handles writing to files via URI/ITextModel
- `voidSettingsService` — Stores Void settings (providers, models, etc.)

## Diff System

Apply creates **DiffZones** (line range with computed diffs). DiffZones can stream. Each DiffZone has an `llmCancelToken`. When the LLM calls Edit or user submits Cmd+K, it's the same code path as Apply.

## Development Notes

- Avoid paths with spaces to prevent build issues
- For clean dev data: `--user-data-dir ./.tmp/user-data --extensions-dir ./.tmp/extensions`
- Press `Ctrl+R` (or `Cmd+R`) in the Dev window to reload changes
- Windows: Visual Studio with "Desktop development with C++" workload is required for building. If you encounter errors about "Spectre-mitigated libraries are required", patch the `.gyp`/`.gypi`/`binding.gyp` files of the failing native modules (like `spdlog`, `sqlite3`, `node-pty`) to set `"SpectreMitigation": "false"` and run `npm rebuild --target=34.3.2 --arch=x64 --dist-url=https://electronjs.org/headers`

## Coding Rules (from .voidrules)

- Never cast to `any` lazily — find the correct type
- Do not add/remove semicolons
- Never modify files outside `src/vs/workbench/contrib/void/` without consulting user
- All maps should be named `bOfA` (e.g., `toolNameOfToolId`)

## Conductor Workflow

The `conductor/` folder contains workflow management. See `AGENTS.md` for commit conventions and project-specific guidelines.