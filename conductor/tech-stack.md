# Tech Stack - Void

## Languages & Runtimes
*   **TypeScript/JavaScript:** The primary languages for the VS Code workbench, extensions, and the Void UI components.
*   **Rust:** Used for the high-performance CLI component (cli/ directory).
*   **Electron & Node.js:** The core runtime environment for the desktop application, providing access to system APIs and the main/browser process architecture.

## Frontend
*   **React:** Utilized for building custom AI-specific UI components (Chat, Sidebar, Settings).
*   **Tailwind CSS:** Used for styling custom React components with a utility-first approach.
*   **VS Code Workbench:** The foundational UI framework, providing the editor, panels, and sidebars.

## AI & LLM Integration
*   **Provider SDKs:** Integration with major LLM providers via @anthropic-ai/sdk, openai, @google/genai, and mistralai.
*   **Local Models:** Native support for ollama for running models locally.
*   **MCP (Model Context Protocol):** Support for the Model Context Protocol via @modelcontextprotocol/sdk.

## Build & Infrastructure
*   **Gulp:** The primary build orchestrator for compiling the VS Code source and managing development tasks.
*   **Webpack/TSUP:** Used for bundling React components and CLI logic.
*   **Cargo:** Rust package manager for the CLI component.

## Testing
*   **Mocha:** The primary unit testing framework for Node.js and browser-side logic.
*   **Playwright:** Used for automated browser/UI testing.
*   **VS Code Test CLI:** Specifically for testing editor integrations and extensions.
