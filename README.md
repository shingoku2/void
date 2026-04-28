# Welcome to Void.

<div align="center">
	<img
		src="./src/vs/workbench/browser/parts/editor/media/slice_of_void.png"
	 	alt="Void Welcome"
		width="300"
	 	height="300"
	/>
</div>

Void is the open-source Cursor alternative.

Use AI agents on your codebase, checkpoint and visualize changes, and bring any model or host locally. Void sends messages directly to providers without retaining your data.

This repo contains the full sourcecode for Void. If you're new, welcome!

- 🧭 [Website](https://voideditor.com)
- 👋 [Discord](https://discord.gg/RSNjgaugJs)
- 🚙 [Project Board](https://github.com/orgs/voideditor/projects/2)

## Quick Start

```bash
npm install           # Install dependencies (Node 20.18.2 required)
npm run watch         # Build and watch client + extensions in dev mode
npm run buildreact    # Build Void React bundle (required before first launch)
./scripts/code.bat    # Windows: Launch Developer Mode window
./scripts/code.sh     # macOS/Linux
```

**Important:** Run `npm run buildreact` at least once before first launch to build the UI bundle.

For clean dev data:
```bash
./scripts/code.bat --user-data-dir ./.tmp/user-data --extensions-dir ./.tmp/extensions
```

Press `Ctrl+R` (or `Cmd+R`) in the Dev window to reload changes.

## Testing Commands

- `npm run test-node` - Node-based unit tests (mocha)
- `npm run test-browser` - Browser tests (requires Playwright installation)
- `npm run test-browser-no-install` - Run browser tests without installing Playwright
- `npm run smoketest` - End-to-end UI smoke tests

## Architecture

Void-specific code lives in `src/vs/workbench/contrib/void/`. The rest follows VSCode's architecture:

- **Main process** (`electron-main/`) - Node.js runtime, can import `node_modules`
- **Browser process** (`browser/`) - HTML/JS renderer, no direct `node_modules` access
- **Common** (`common/`) - Shared code usable by either process

Key concepts:
- **Editor** - The container (holds multiple tabs/models)
- **Model** - Internal representation of a file's contents (shared between editors)
- **Services** - Singleton classes registered via `registerSingleton`, accessed via `@<Service>` decorator
- **Actions/Commands** - Registered functions callable via Command Palette or `commandService`

Key Void services:
- `editCodeService` - Handles Apply (Fast Apply via Search/Replace blocks, Slow Apply via file rewrite)
- `voidModelService` - Handles writing to files via URI/ITextModel
- `voidSettingsService` - Stores Void settings (providers, models, etc.)

## Known Issues

### Build Errors in extensions/typescript-language-features (99 errors)
TypeScript version mismatch and `esModuleInterop` issues. Not critical for running Void but will cause TypeScript language server extension to fail compilation.

### Supply Chain Risk: event-stream 3.3.4
The `event-stream` package version 3.3.4 remains in the dependency tree (used by `flatmap-stream`). This version has known supply chain vulnerabilities. Consider running `npm audit` to identify mitigation paths.

### License Issue: scope-tailwind
The `scope-tailwind` package uses AGPL-3.0 license, which may have licensing implications for the project.

### ES Version Drift
Source code in `src` is compiled for ES2022 but extensions are compiled for ES2020. This mismatch may cause issues with certain language features.

### Dependency: source-map updated to 0.7.0
The `source-map` package was updated from 0.6.1 to 0.7.0 to fix an RCE vulnerability (CVE in older versions). Ensure your build uses the updated version.

## Project Status

Void is actively maintained. Contributions and issues are welcome — reach out via [Discord](https://discord.gg/RSNjgaugJs) or [email](mailto:hello@voideditor.com).

## Reference

- [Void Codebase Guide](VOID_CODEBASE_GUIDE.md) - Architecture and internal workings
- [Contributing Guide](HOW_TO_CONTRIBUTE.md) - How to develop your own version of Void
- [void-builder repo](https://github.com/voideditor/void-builder) - Build pipeline documentation

## Support
You can always reach us in our Discord server or contact us via email: hello@voideditor.com.