# Void Codebase Context

## Project Overview
**Void** is an open-source alternative to Cursor, designed as an AI-powered code editor. It is a fork of the official [VS Code repository](https://github.com/microsoft/vscode).

**Status:** Active development

## Architecture
Void inherits VS Code's Electron-based architecture with specific additions for AI capabilities:

*   **Electron Structure:**
    *   **Main Process:** Handles system-level operations, `node_modules` imports, and the backend of the LLM pipeline (`electron-main/`).
    *   **Browser Process:** Handles the UI/HTML (`browser/`).
    *   **Common:** Shared code (`common/`).
*   **Void Implementation:**
    *   Core Logic: Located in `src/vs/workbench/contrib/void/`.
    *   **UI (React):** Void uses React for its specific UI components (Sidebar, Chat, Settings), bundled using `tsup` and `TailwindCSS` for the browser environment (`src/vs/workbench/contrib/void/browser/react/`).
    *   **LLM Pipeline:** Messages flow from Sidebar (React) -> `sendLLMMessageService` (Browser) -> `sendLLMMessageService` (Main) -> Provider. This architecture avoids CSP issues and allows secure API key handling on the main process.
    *   **MCP Support:** Integrated support for Model Context Protocol (MCP) servers via `mcpService`.

## Key Services (Void)
*   `voidSettingsService`: Central store for models, providers, and global settings.
*   `voidModelService`: Handles writing to files (text models) without needing to manually load/save.
*   `editCodeService`: Manages "Apply" logic (Fast Apply using search/replace blocks, Slow Apply for full rewrites) and diff visualization.
*   `chatThreadService`: Manages persistent AI chat history and conversation threads.
*   `autocompleteService`: Powers AI-driven code completion and suggestion logic.
*   `mcpService`: Orchestrates connections and tool-calling with MCP servers.
*   `contextGatheringService`: Automates the gathering of codebase context for LLM prompts.

## Build & Run
**Prerequisites:** Node.js (v22.22.3 per `.nvmrc`), Yarn/NPM, Python (for build tools).
*   **Native Modules (Windows):** If native modules (like `spdlog`, `sqlite3`, `node-pty`) fail to build due to missing Spectre mitigation libraries in Visual Studio, you must patch their `binding.gyp` (or `.gyp`/`.gypi`) files to set `"SpectreMitigation": "false"` before running `npm rebuild --target=34.3.2 --arch=x64 --dist-url=https://electronjs.org/headers`.

**Key Scripts:**
*   `npm run watch`: Main command to watch and build the standard VS Code client and extensions.
*   `npm run buildreact`: Builds the Void React UI components into `out/`.
*   `npm run watchreact`: Watches and rebuilds the Void React UI.
*   `npm run watchreactd`: Runs `watchreact` wrapped in `deemon` for better process management.
*   `scripts/code.bat` (Windows) or `scripts/code.sh` (macOS/Linux): Launches the compiled Void editor in developer mode.
*   `scripts/code-server`: Used to run the web version or server component.

*Note: For a full production build, refer to the external `void-builder` repository.*

## Development Conventions
*   **Service Injection:** Uses VS Code's dependency injection pattern (decorators like `@IServiceName`).
*   **Disposables:** Heavy use of the `Disposable` pattern for resource management.
*   **React Integration:**
    *   React code is bundled separately and mounted within the VS Code workbench.
    *   **Strict rule:** Imports in React code MUST include the `.js` extension (e.g., `import { x } from './file.js'`).
    *   `src/` directory in React must remain shallow (max 1 folder deep) for proper external detection.
*   **Testing:**
    *   `npm run test-node`: Unit tests for Node-based logic.
    *   `npm run test-browser`: UI and browser-based tests (uses Playwright).
    *   `npm run smoketest`: Full end-to-end UI smoke tests.

## Key Documentation
*   `VOID_CODEBASE_GUIDE.md`: **Crucial.** Contains detailed diagrams and explanations of the internal architecture.
*   `VOID_SDKS.md`: Details supported LLM providers, model capabilities, and API key handling.
*   `AGENTS.md`: Repository guidelines, commit conventions, and project structure.
*   `conductor/`: Directory containing project management data, including `product.md` (vision), `tracks.md` (roadmap), and `workflow.md`.
*   `HOW_TO_CONTRIBUTE.md`: Guidelines for contributors.
