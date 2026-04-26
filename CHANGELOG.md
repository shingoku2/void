# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.x.0] - 2026-04-26

### Security

- Fixed XSS vulnerability in chat markdown rendering (DOMPurify, blocked javascript:/data: URLs)
- Fixed command injection in MCP channel (command path whitelist validation)
- Fixed resource leaks in MCP channel (SSE/WebSocket connection leaks)
- Added workspace boundary enforcement in toolsService

### Fixed

- Timer memory leak in MarkerCheckService (setInterval not registered via _register())
- Memory leak in editCodeService (onModelRemoved cleanup, 150ms keystroke debounce)
- DeepClone performance issue (shallow copy instead since snapshot has only primitives)
- React dependency array issues (module-level Sets in useEffect)
- Extension transfer error handling
- ResizeObserver/RAF performance (debouncing)
- Stream memory leaks in build pipeline (event-stream → through2 + native streams)
- Stream backpressure in compilation (es.duplex() → callback-based transforms)
- VSIX extraction memory management (gulp-vinyl-zip → yauzl)

### Changed

- @modelcontextprotocol/sdk ^1.11.2 → ^1.29.0
- lightningcss added at ^1.32.0
- minimatch ^3.0.4 → ^9.0.0
- rimraf ^2.2.8 → ^5.0.0
- source-map 0.6.1 → ^0.7.0
- typescript ^5.8.0-dev.20250207 → ^5.8.3
- Replaced event-stream with through2 and native streams in build pipeline

### Added

- TypeScript type imports in sendLLMMessageService and sendLLMMessageChannel
- Settings type field (settingsOfProvider)
- Claude Code documentation (CLAUDE.md)
- SECURITY_DEPENDENCY_AUDIT.md
