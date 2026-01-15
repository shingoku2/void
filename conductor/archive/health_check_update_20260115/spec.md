# Track Specification: Health Check & Updates

## Goal
Implement a utility to verify connectivity and model availability for local LLM providers (specifically Ollama) within the Void settings. Additionally, scan the codebase for potential dependency updates or deprecated patterns.

## Context
Void allows users to bring their own models. Ensuring these models are reachable and correctly configured is crucial for a smooth user experience. This track focuses on adding a "Test Connection" or "Health Check" button to the provider settings UI.

## Requirements
*   **Health Check UI:** Add a button in the Settings interface for the Ollama provider.
*   **Backend Logic:** Implement the logic in the main process to ping the local Ollama instance (default port 11434).
*   **Feedback:** Show a success message with the server version/status or an error message with troubleshooting hints.
*   **Dependency Scan:** Audit \package.json\ and \Cargo.toml\ for outdated major dependencies and list them for future tracks.

## Non-Goals
*   Automatically updating dependencies (only identification).
*   Supporting health checks for cloud providers (OpenAI/Anthropic) in this specific track.
