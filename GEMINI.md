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
    *   **UI (React):** Void uses React for its specific UI components, bundled specifically for the browser environment (`src/vs/workbench/contrib/void/browser/react/`).
    *   **LLM Pipeline:** Messages flow from Sidebar (React) -> `LLMMessageService` (Browser) -> `LLMMessageService` (Main) -> Provider. This avoids CSP issues and allows secure API key handling.

## Key Services (Void)
*   `voidSettingsService`: Central store for models, providers, and global settings.
*   `voidModelService`: Handles writing to files (text models) without needing to manually load/save.
*   `editCodeService`: Manages "Apply" logic (Fast Apply using search/replace blocks, Slow Apply for full rewrites) and diff visualization.

## Build & Run
**Prerequisites:** Node.js (check `.nvmrc` or `package.json` engines), Yarn/NPM, Python (for build tools).

**Key Scripts:**
*   `npm run watch`: Main command to watch and build the standard VS Code client and extensions.
*   `npm run buildreact`: Builds the specific Void React UI components.
*   `npm run watchreact`: Watches and rebuilds the Void React UI.
*   `scripts/code-server`: Likely used to run the web version or server component.
*   `./scripts/code.bat` or `code.sh`: (Inferred) Standard VS Code launch scripts usually exist in `scripts/`.

*Note: For a full production build, refer to the external `void-builder` repository as mentioned in the project documentation.*

## Development Conventions
*   **Service Injection:** Uses VS Code's dependency injection pattern (decorators like `@IServiceName`).
*   **Disposables:** Heavy use of the Disposable pattern for resource management.
*   **React Integration:** React code is bundled separately and mounted within the VS Code workbench structure.
*   **Testing:**
    *   `npm run test`: General test entry point.
    *   `npm run test-browser`: Browser-based tests.
    *   `npm run test-node`: Node.js tests.

## Key Documentation
*   `VOID_CODEBASE_GUIDE.md`: **Crucial.** Contains detailed diagrams and explanations of the internal architecture, specifically for Void's additions.
*   `HOW_TO_CONTRIBUTE.md`: Guidelines for contributors (though active review is paused).
