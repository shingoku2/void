# build/lib/nls.ts — TypeScript Compilation Pipeline

This module provides the core TypeScript compilation tasks using gulp-tsb (TypeScript gulp build).

## Public API

### `createCompile(src: string, options: ICompileTaskOptions)`

Creates a compilation pipeline for a TypeScript source directory.

**Options:**

```typescript
interface ICompileTaskOptions {
  readonly build: boolean;           // Production build (vs dev)
  readonly emitError: boolean;       // Whether to emit errors
  readonly transpileOnly: boolean | { esbuild: boolean };
  readonly preserveEnglish: boolean;  // NLS preserveEnglish flag
}
```

**Pipeline stages:**
1. BOM preservation for UTF-8 test files
2. CSS processing via PostCSS (nesting)
3. TypeScript filter
4. Source map loading
5. TypeScript compilation (gulp-tsb)
6. NLS patching (via `nls.nls()`)
7. Source map writing
8. Reporter end

**Returns:** A pipeline function `(token?: ICancellationToken) => NodeJS.ReadWriteStream`

### `compileTask(src: string, out: string, build: boolean, options?): task.StreamTask`

Main compilation task for production builds.

**Options:**
```typescript
{
  disableMangle?: boolean;     // Skip mangler
  preserveEnglish?: boolean;   // NLS flag
}
```

**Behavior:**
- Checks for 4GB minimum RAM before proceeding
- Generates `monaco.d.ts` via `MonacoGenerator` (only for `src`)
- Optionally runs `Mangler` to mangle TypeScript exports (build mode only)
- Pipes through mangler stream, then MonacoGenerator stream, then compile stream

**Error Handling:**
- RAM check throws if insufficient memory
- Mangler errors propagate through the stream
- Compilation errors are reported via the `reporter`

### `transpileTask(src: string, out: string, esbuild: boolean): task.StreamTask`

One-time transpilation task (no watching).

**Behavior:**
- Uses `transpileOnly: { esbuild }` option
- Reads from `src/**` glob
- Outputs to `out` directory

### `watchTask(out: string, build: boolean, srcPath?: string): task.StreamTask`

Watch mode compilation task.

**Behavior:**
- Watches `srcPath/**` for changes
- Runs incremental compilation via `util.incremental()`
- Generates `monaco.d.ts` on each change

### `MonacoGenerator` (class)

Generates `monaco.d.ts` from TypeScript declarations.

**Key methods:**
- `execute()`: Runs declaration generation, writes files if changed
- `_run()`: Returns `IMonacoDeclarationResult | null`

**Error Handling:**
- In watch mode: emits error if `monaco.d.ts` is out of date after build
- In non-watch mode: throws if generation fails

## Error Handling

- `emitError: true` — Errors are reported to the reporter and cause task failure
- `emitError: false` — Errors are logged but do not fail the task (watch mode)
- Reporter errors are collected and emitted at pipeline end

## Internal: `pipeline(token?)`

The compilation pipeline with all stages:

```typescript
input
  .pipe(util.$if(isUtf8Test, bom()))           // BOM for test files
  .pipe(util.$if(!build && isRuntimeJs, util.appendOwnPathSourceURL()))
  .pipe(util.$if(isCSS, gulpPostcss(...)))
  .pipe(tsFilter)
  .pipe(util.loadSourcemaps())
  .pipe(compilation(token))                     // TypeScript compilation
  .pipe(noDeclarationsFilter)
  .pipe(util.$if(build, nls.nls({ preserveEnglish })))
  .pipe(util.$if(!transpileOnly, sourcemaps.write(...)))
  .pipe(reporter.end(!!emitError));
```
