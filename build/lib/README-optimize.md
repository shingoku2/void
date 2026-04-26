# build/lib/optimize.ts — NLS Patching Pipeline

This module handles National Language Support (NLS) patching of JavaScript files. It transforms `localize()` and `localize2()` calls to use numeric indices instead of string keys, enabling runtime localization lookup.

## Public API

### `nls(options: { preserveEnglish: boolean }): NodeJS.ReadWriteStream`

Returns a gulp transform stream that patches JavaScript files for NLS.

**Input:** Vinyl files with `.js` extension and source maps  
**Output:** Patched JavaScript files plus four metadata files:

- `nls.metadata.json` — Module-to-keys mapping
- `nls.messages.json` — All extracted messages
- `nls.keys.json` — All modules and their keys
- `nls.messages.js` — Global `globalThis._VSCODE_NLS_MESSAGES` bundle

**Behavior:**
- Files without source maps or non-JS files pass through unchanged
- For each JS file, extracts `localize` and `localize2` calls via TypeScript language service
- When `preserveEnglish: true`, replaces key with index but keeps message value
- When `preserveEnglish: false`, replaces key with index and sets value to `null`

## Internal Functions (module `_nls`)

### `patchFile(javascriptFile: File, typescript: string, options: { preserveEnglish: boolean }): File`

Patches a single JavaScript file by:
1. Using TypeScript language service to find `localize`/`localize2` calls
2. Building patches to replace string keys with numeric indices
3. Applying patches to the JavaScript content and adjusting source maps
4. Populating global accumulators (`moduleToNLSKeys`, `moduleToNLSMessages`, `allNLSMessages`)

### `analyze(ts, contents, functionName, options): ILocalizeAnalysisResult`

Finds all `localize` or `localize2` call expressions in TypeScript source. Uses the language service for accurate AST analysis, handling both namespace-style (`nls.localize()`) and named-import style (`localize()`) calls.

### `patchJavascript(patches: IPatch[], contents: string): string`

Applies ordered patches to a JavaScript string. Uses a `TextModel` to track lines and apply replacements without offset errors.

### `patchSourcemap(patches: IPatch[], rsm: RawSourceMap, smc: SourceMapConsumer): RawSourceMap`

Adjusts source map mappings to account for the character offset changes introduced by patching.

## Error Handling

- Missing source map content: passes file through unchanged
- TypeScript analysis errors: caught and reported, file passes through
- Invalid localize call arguments: skipped silently

## Usage

```typescript
import { nls } from './optimize';

pipeline
  .pipe(nls({ preserveEnglish: true }))
  .pipe(gulp.dest('out'));
```
