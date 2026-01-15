# Track Plan: Health Check & Updates

## Phase 1: Dependency & Update Analysis [checkpoint: 6409938]
- [x] Task: Audit `package.json` and `Cargo.toml` for outdated dependencies. 7850f2b
    - [ ] Subtask: Run \
pm outdated\ and \cargo outdated\ (if available) or check versions manually.
    - [ ] Subtask: Document findings in a new file \conductor/audit_report.md\.
- [ ] Task: Conductor - User Manual Verification 'Dependency & Update Analysis' (Protocol in workflow.md)

## Phase 2: Backend Implementation (Health Check)
- [ ] Task: Implement \checkOllamaConnection\ function in the main process.
    - [ ] Subtask: Write unit test for the connection logic (mocking the HTTP request).
    - [ ] Subtask: Implement the function to hit \http://localhost:11434/api/tags\ (or root) to verify status.
- [ ] Task: Expose the health check via IPC to the renderer.
    - [ ] Subtask: Write unit test for the IPC handler.
    - [ ] Subtask: Register the IPC handler in \electron-main\.
- [ ] Task: Conductor - User Manual Verification 'Backend Implementation (Health Check)' (Protocol in workflow.md)

## Phase 3: Frontend Implementation (UI)
- [ ] Task: Add "Test Connection" button to Ollama settings.
    - [ ] Subtask: Write component test for the button interaction.
    - [ ] Subtask: Add the button to the React settings component.
- [ ] Task: Display connection status/toast notification.
    - [ ] Subtask: Write test for status display state.
    - [ ] Subtask: Implement logic to call the backend IPC and show success/error state.
- [ ] Task: Conductor - User Manual Verification 'Frontend Implementation (UI)' (Protocol in workflow.md)
