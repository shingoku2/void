# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the application sources; Void-specific workbench code lives in
  `src/vs/workbench/contrib/void/`.
- `extensions/` contains built-in extensions and shared extension tooling.
- `test/` contains unit, integration, and smoke test suites.
- `build/` and `scripts/` host the build pipeline, gulp tasks, and helper scripts.
- `resources/` and `void_icons/` contain runtime assets and branding.
- `cli/` contains the Rust-based CLI.

## Build, Test, and Development Commands
- `npm install` installs dependencies (use Node `22.22.3` from `.nvmrc`).
- `npm run watch` builds and watches the client and extensions in dev mode.
- `./scripts/code.sh` (macOS/Linux) or `./scripts/code.bat` (Windows) launches a
  Developer Mode window for manual testing.
- `npm run buildreact` / `npm run watchreact` builds the Void React bundle.
- **Native Modules (Windows)**: If native compilation fails due to missing Spectre mitigation libraries, patch the `.gyp`/`.gypi`/`binding.gyp` files in the failing dependencies (e.g., `node-pty`, `spdlog`, `sqlite3`) to set `"SpectreMitigation": "false"` and rebuild using `npm rebuild --target=34.3.2 --arch=x64 --dist-url=https://electronjs.org/headers`.

## Coding Style & Naming Conventions
- Tabs are the default indentation; YAML and `package.json` use 2 spaces.
- Keep trailing whitespace trimmed per `.editorconfig`.
- Follow existing VS Code conventions in `src/vs` for naming and file layout.
- Use linting helpers when changing style-heavy areas:
  `npm run eslint`, `npm run stylelint`, `npm run hygiene`.

## Testing Guidelines
- Unit tests live in `test/unit`, integration tests in `test/integration`, and
  UI smoke tests in `test/smoke`.
- Common runners:
  - `npm run test-node` for Node-based unit tests.
  - `npm run test-browser` (installs Playwright) or `npm run test-browser-no-install`.
  - `npm run smoketest` for end-to-end UI coverage.
- The root `npm test` is a pointer; use the scripts above or `scripts/test.sh` /
  `scripts/test.bat` for larger suites.

## Commit & Pull Request Guidelines
- Recent history favors `type(scope): summary` (e.g., `feat(ui): ...`) and
  tool-scoped prefixes like `conductor(plan): ...`. Keep subjects short and
  imperative.
- Submit a PR for changes; an issue is optional unless the work is a new feature.
- Do not use AI to write the PR description.

## Development Notes
- Prefer paths without spaces to avoid build issues.
- For clean dev data, run the dev window with:
  `--user-data-dir ./.tmp/user-data --extensions-dir ./.tmp/extensions`.
