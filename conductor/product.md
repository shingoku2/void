# Initial Concept
Void is an open-source alternative to Cursor, designed as an AI-powered code editor forked from VS Code.

## Project Overview
Void is the open-source alternative to Cursor, providing a powerful, privacy-focused, and highly extensible AI-powered code editor. By forking VS Code, Void offers a familiar environment enhanced with deep AI integration that puts the user in control of their data and model choices.

### Target Users
*   **Individual Developers:** Those seeking the productivity of AI-integrated editors like Cursor without the proprietary lock-in.
*   **Privacy-Conscious Users:** Developers and teams who require their AI communications to go directly to providers without third-party data retention.
*   **Customization Enthusiasts:** Developers who want to use specific LLM providers or host their own models locally.

### Key Goals
*   **Deep AI Integration:** Seamlessly integrate Sidebar Chat, Inline Edits (Ctrl+K), and smart code application (Apply) into the developer workflow.
*   **Privacy First:** Messages are sent directly from the client to the LLM provider, ensuring no data is retained by Void.
*   **Model Flexibility:** Support for a wide range of cloud providers (OpenAI, Anthropic, Mistral) and local hosting solutions (Ollama).
*   **Open Source & Extensible:** Maintain a transparent codebase that encourages community forks, contributions, and custom extensions.

### Core Features
*   **Sidebar Chat:** A dedicated interface for multi-turn conversations about the codebase, context-aware file references, and architectural questions.
*   **Inline Edit (Ctrl+K):** Real-time code generation and modification directly within the editor buffer.
*   **Fast Apply:** An optimized mechanism using search/replace blocks to instantly apply LLM suggestions to large files.
*   **Void Settings Service:** A central hub for managing diverse LLM providers and model configurations.

### Current Priorities
*   **Stability:** Maintaining the integrity of the VS Code fork while layering AI features.
*   **Apply Performance:** Enhancing the speed and accuracy of code modifications through improved diffing and application logic.
*   **Provider Ecosystem:** Continually expanding the list of supported LLM backends and improving local model integration.
