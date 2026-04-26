# build/lib/extensions.ts — Extension Bundling and Stream Management

This module provides gulp tasks for bundling ESM extensions and managing multi-stream composition.

## Public API

### `bundleESMTask(opts: IBundleESMTaskOpts): NodeJS.ReadWriteStream`

Bundles ESM entry points using esbuild. Returns a stream of vinyl files (bundled JS/CSS and resources).

**Options:**

```typescript
interface IBundleESMTaskOpts {
  src: string;                          // Source folder
  entryPoints: Array<IEntryPoint | string>;  // Entry points to bundle
  resources?: string[];                 // Additional resources (SVG, etc.)
  fileContentMapper?: (path: string) => (contents: string) => Promise<string> | string;
  skipTSBoilerplateRemoval?: (entryPointName: string) => boolean;
}
```

**Error Handling:**
- esbuild failures are caught and emitted as stream errors on the returned stream
- The internal `bundleAsync` promise rejection is caught and forwarded via `result.emit('error', err)`
- This prevents unhandled promise rejections while ensuring errors reach the gulp pipeline

**Internal: `bundleAsync`**

An async function that:
1. Iterates over entry points
2. Configures esbuild with TSLib boilerplate removal and file content mapping
3. Resolves external modules except `minimist` (inlined at startup)
4. Returns `{ files: VinylFile[] }` for stream emission

### `combineStreams(streams: Stream[]): Stream`

Merges multiple streams into one with proper error aggregation and end-of-stream handling.

**Behavior:**
- Creates a `PassThrough` output stream
- Tracks `pending` count (number of input streams)
- On any stream error: sets `failed = true`, emits error on output, calls `endOutput()`
- On stream end/close/finish: decrements `pending`, when `pending === 0` calls `endOutput()`
- If `pending === 0` immediately, calls `endOutput()` synchronously
- Pipes each input to output with `{ end: false }` to prevent premature closing

**`endOutput` guard:** Checks `ended || output.writableEnded || output.destroyed` before ending, preventing double-end errors.

### `endOutput()`

Internal helper that safely ends the combined output stream. Only executes once due to the `ended` guard flag.

## Usage

```typescript
import { bundleTask, packageNonNativeLocalExtensionsStream } from './extensions';

// Bundle ESM modules
const bundle = bundleTask({ out: 'dist', esm: { src: 'src', entryPoints: ['main'] } });
gulp.task('bundle', bundle);

// Package local extensions (uses combineStreams internally)
const stream = packageNonNativeLocalExtensionsStream(false, false);
```

## Stream Error Propagation

Both `bundleESMTask` and `combineStreams` forward errors to the returned stream rather than throwing:

```typescript
// bundleESMTask pattern
bundleAsync().then(output => {
  stream.Readable.from(output.files).pipe(bundlesStream);
}).catch(err => {
  result.emit('error', err);  // Forward as stream error
});

// combineStreams pattern
const fail = (err: Error) => {
  failed = true;
  output.emit('error', err);
  endOutput();
};
```

This ensures gulp's error handling catches all failures.
