# build/lib/compilation.ts — Extension Packaging

This module handles packaging of VS Code extensions from various sources (local, marketplace, GitHub, VSIX).

## Public API

### Extension Packaging Streams

#### `packageNonNativeLocalExtensionsStream(forWeb: boolean, disableMangle: boolean): Stream`
Packages local extensions without native dependencies.

#### `packageNativeLocalExtensionsStream(forWeb: boolean, disableMangle: boolean): Stream`
Packages local extensions known to have native dependencies. Must be built on the target platform.

#### `packageAllLocalExtensionsStream(forWeb: boolean, disableMangle: boolean): Stream`
Packages both native and non-native local extensions.

### Source Functions

#### `fromLocal(extensionPath: string, forWeb: boolean, disableMangle: boolean): Stream`
Packages a local extension. Uses webpack if a webpack config exists, otherwise uses `vsce list-files`.

#### `fromMarketplace(serviceUrl: string, extension: IExtensionDefinition): Stream`
Downloads and packages an extension from the VS Code marketplace.

#### `fromVsix(vsixPath: string, extension: IExtensionDefinition): Stream`
Packages a local VSIX file. Validates SHA-256 checksum before extraction.

#### `fromGithub(extension: IExtensionDefinition): Stream`
Downloads and packages an extension from a GitHub repository.

### Scanning

#### `scanBuiltinExtensions(extensionsRoot: string, exclude?: string[]): IScannedBuiltinExtension[]`
Scans for built-in web extensions. Returns metadata including `packageJSON`, `packageNLS`, `readmePath`, `changelogPath`.

### Utilities

#### `translatePackageJSON(packageJSON: string, packageNLSPath: string)`
Translates `%key%` placeholders in package.json using an NLS file.

#### `webpackExtensions(taskName: string, isWatch: boolean, configLocations: { configPath: string; outputRoot?: string }[]): Promise<void>`
Runs webpack for extension webviews and bundling.

#### `buildExtensionMedia(isWatch: boolean, outputRoot?: string): Promise<void>`
Runs esbuild scripts for extension media (markdown preview, notebook renderers, etc.).

## Internal Stream Helpers

### `combineStreams(streams: Stream[]): Stream`

**Behavior:**
- Merges multiple input streams into one output
- Tracks `pending` count; ends output when all streams finish
- First error wins: sets `failed = true`, emits error, then ends
- Safe against double-end: checks `ended || output.writableEnded || output.destroyed`

**`endOutput` logic:**
```typescript
const endOutput = () => {
  if (ended || output.writableEnded || output.destroyed) return;
  ended = true;
  output.end();
};
```

### `extractVsix(): NodeJS.ReadWriteStream`

Extracts VSIX/ZIP contents using yauzl. Emits vinyl files for each entry, skipping directories.

**Error Handling:**
- Non-buffer files emit error
- yauzl errors propagate through callback
- Handles null zipfile gracefully

### `minifyExtensionResources(input: Stream): Stream`

Minifies JSON files and code snippets by parsing and re-stringifying (drops whitespace/comments).

### `updateExtensionPackageJSON(input: Stream, update: (data: any) => any): Stream`

Filters for `extensions/*/package.json`, applies an update function, and writes back.

## Error Handling Patterns

### Stream Error Forwarding

All stream-based functions forward errors via `result.emit('error', err)`:

```typescript
// fromLocalWebpack pattern
const webpackDone = (err, stats) => {
  if (err) result.emit('error', err);
  if (compilation.errors.length > 0) result.emit('error', compilation.errors.join('\n'));
};

// fromLocalNormal pattern
.catch(err => result.emit('error', err));
```

### Checksum Validation (fromVsix)

```typescript
.pipe(through2.obj((f, enc, callback) => {
  const hash = crypto.createHash('sha256');
  hash.update(f.contents);
  const checksum = hash.digest('hex');
  if (checksum !== sha256) {
    callback(new Error(`Checksum mismatch for ${vsixPath}`));
  } else {
    callback(null, f);
  }
}));
```

## Usage

```typescript
import { packageAllLocalExtensionsStream, fromLocal } from './compilation';

// Package all local extensions
const stream = packageAllLocalExtensionsStream(false, false);
stream.pipe(gulp.dest('extensions-out'));

// Package single extension
const single = fromLocal('extensions/my-extension', false, false);
```
