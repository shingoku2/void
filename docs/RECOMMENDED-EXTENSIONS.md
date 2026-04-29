# Recommended Extensions for Void

Void ships with a curated set of built-in extensions. This document lists what was removed and what we recommend instead.

## What Was Removed

The following extensions were removed from Void to reduce bundle size and remove cloud/telemetry dependencies:

### Test-Only (Never Shipped)
- `vscode-api-tests`
- `vscode-colorize-tests`
- `vscode-colorize-perf-tests`
- `vscode-test-resolver`
- `ms-vscode.node-debug`
- `ms-vscode.node-debug2`

### Niche Languages (Install What You Need)
If you need these languages, install them from the marketplace:
- `bat` — Batch file support
- `clojure` — Clojure/LISP
- `coffeescript` — CoffeeScript
- `fsharp` — F# (try **Ionide** instead)
- `groovy` — Groovy
- `julia` — Julia (try **Julia** extension)
- `latex` — LaTeX (try **LaTeX Workshop**)
- `lua` — Lua (try **Lua Language Server**)
- `objective-c` — Objective-C (macOS/iOS development)
- `perl` — Perl
- `pug` — Pug/Jade templates
- `ruby` — Ruby (try **Ruby LSP** or **solargraph**)
- `shaderlab` — Unity shaders (Unity installs its own)

### Cloud/Telemetry (Never Shipped)
- `microsoft-authentication` — Entra/SSO (use token-based auth)
- `npm` — Npm UI (use terminal + npm CLI)
- `open-remote-ssh` — Remote SSH (use native SSH)
- `open-remote-wsl` — WSL remoting (use native WSL)
- `tunnel-forwarding` — Azure tunneling (use **cloudflared** or **ngrok**)

---

## Recommended Replacements

### Git
| Instead of | Use | Why |
|------------|-----|-----|
| Built-in `git` | **GitLens** (`gitlens.gitlens`) | Much richer Git UI, inline blame, history, search |

### Languages

| Language | Use Instead | Install Command |
|----------|------------|----------------|
| **Rust** | **rust-analyzer** (`rust-lang.rust-analyzer`) | Better than Microsoft Rust |
| **Go** | **gopls** (official Go LSP) | `go install golang.org/x/tools/gopls@latest` |
| **Python** | **Pylance** (`ms-python.vscode-pylance`) or **Pyright** | Industry standard |
| **C/C++** | **clangd** (LLVM) | Better than Microsoft C++ |
| **C#** | **OmniSharp** (`ms-dotnettools.csharp`) | Open source, cross-platform |
| **Java** | **Language Support for Java** (Red Hat) | Open source |
| **PHP** | **Intelephense** (`bmewburn.vscode-intelephense`) | Much faster than Microsoft PHP |
| **Dart/Flutter** | **Dart-Code** (`dart-code.flutter`) | Official Flutter support |

### Containers

| Instead of | Use |
|-----------|-----|
| `docker` (built-in) | **Docker** (`ms-azuretools.vscode-docker`) — already built-in, fine to keep |

### Debugging

| Instead of | Use |
|-----------|-----|
| `debug-auto-launch` | Use `launch.json` manually or **vscode-debugger** |

---

## Built-In Extensions (Kept)

These extensions ship with Void and cover core functionality:

### Core Editors
- `typescript-language-features` — TypeScript/JavaScript IntelliSense
- `javascript` — JavaScript support
- `json`, `yaml`, `xml` — Data formats
- `html`, `css`, `scss`, `less` — Web languages
- `diff` — Diff viewer
- `emmet` — Emmet abbreviations
- `ini` — INI/config files
- `log` — Log file highlighting
- `markdown-language-features` — Markdown with math support
- `handlebars`, `razor`, `pug` — Template languages
- `sql` — SQL queries

### Themes
- `theme-defaults` — Default light/dark themes
- `theme-monokai`, `theme-quietlight`, etc. — Syntax themes

### Utilities
- `debug-server-ready` — Debug helper
- `merge-conflict` — Git merge conflict highlighting
- `media-preview` — Image preview
- `references-view` — Find references pane
- `simple-browser` — Embedded browser

---

## Installing Extensions

Void supports the standard VSCode Marketplace. To install:

1. Open Void
2. Press `Ctrl+Shift+X` to open Extensions view
3. Search for the extension by name
4. Click Install

Or install from command line:
```bash
code --install-extension publisher.extension-name
```
