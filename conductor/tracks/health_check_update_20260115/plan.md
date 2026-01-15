# Track Plan: Health Check & Updates

## Phase 1: Dependency & Update Analysis [checkpoint: 6409938]
- [x] Task: Audit `package.json` and `Cargo.toml` for outdated dependencies. 7850f2b
    - [ ] Subtask: Run \
pm outdated\ and \cargo outdated\ (if available) or check versions manually.
    - [ ] Subtask: Document findings in a new file \conductor/audit_report.md\.
- [ ] Task: Conductor - User Manual Verification 'Dependency & Update Analysis' (Protocol in workflow.md)

## Phase 2: Backend Implementation (Health Check) [checkpoint: 127954f]
- [x] Task: Implement \`checkOllamaConnection\` function in the main process. 0ba379f
    - [x] Subtask: Write unit test for the connection logic (mocking the HTTP request). 0ba379f
    - [x] Subtask: Implement the function to hit \http://localhost:11434/api/tags\ (or root) to verify status. 0ba379f
- [x] Task: Expose the health check via IPC to the renderer. 0ba379f
    - [x] Subtask: Write unit test for the IPC handler. 0ba379f
    - [x] Subtask: Register the IPC handler in \electron-main\. 0ba379f
- [ ] Task: Conductor - User Manual Verification 'Backend Implementation (Health Check)' (Protocol in workflow.md)

## Phase 3: Frontend Implementation (UI) [checkpoint: c592e5b]
- [x] Task: Add "Test Connection" button to Ollama settings. 0ede56a
    - [x] Subtask: Write component test for the button interaction. 0ede56a
    - [x] Subtask: Add the button to the React settings component. 0ede56a
- [x] Task: Display connection status/toast notification. 0ede56a
    - [x] Subtask: Write test for status display state. 0ede56a
    - [x] Subtask: Implement logic to call the backend IPC and show success/error state. 0ede56a
- [ ] Task: Conductor - User Manual Verification 'Frontend Implementation (UI)' (Protocol in workflow.md)
