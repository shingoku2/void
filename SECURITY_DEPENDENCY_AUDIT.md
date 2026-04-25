# Security Dependency Audit

## Overview

This document tracks known security vulnerabilities in dependencies and the mitigation strategies applied.

## Active Mitigations

### 1. event-stream / flatmap-stream (2018 Supply Chain Attack)

**Issue**: event-stream 3.3.4 was involved in the [2018 flatmap-stream compromise](https://blog.npmjs.org/post/180565064195/ details). The malicious `flatmap-stream@0.0.1-security` was added to the dependency tree.

**Status**: Mitigated via npm override

**Mitigation Applied** (in `package.json` overrides):
```json
"flatmap-stream@<0.0.1-security": {
  "flatmap-stream": "0.0.1-security"
}
```

This forces any vulnerable `flatmap-stream` version to the secure security holding package.

**Note**: event-stream 3.3.5 removes the flatmap-stream dependency entirely and is the recommended safe version.

## Known Issues Requiring Attention

### 2. source-map 0.6.1 (RCE via Function Construction)

**Issue**: source-map <=0.6.1 is vulnerable to RCE through malicious source map files.

**Current State**: Direct devDependency at version 0.6.1. Used by istanbul-lib-source-maps and gulp-sourcemaps.

**Recommended Action**: Update to source-map@0.7.0 which contains the security fix.

**Note**: Cannot use npm override directly since source-map is a direct devDependency.

### 3. glob@5.0.15 (Deprecated)

**Issue**: glob v5 is deprecated. Modern alternatives are glob@7+ or glob@9+.

**Current State**: Direct devDependency at version 5.0.15.

**Recommended Action**: Update to glob@7.0.6 or higher. glob@10+ uses ESM.

### 4. ini@1.3.8 (DoS via nested-through-rc)

**Issue**: ini <=1.3.5 had a DoS vulnerability via nested configuration. Current version is 1.3.8 which has the fix, but older versions may be pulled transitively.

**Current State**: No direct dependency, but pulled transitively via rc@1.2.7.

**Recommended Action**: Monitor for transitive pulls of older ini versions. Current override targets any ini <1.3.6.

### 5. gulp-azure-storage

**Note**: No direct security vulnerability, but depends on event-stream. Should be audited for alternatives as gulp-azure-storage has not been updated since 2020.

## Related Files

- `package.json` - Contains npm overrides for dependency security
- `build/package.json` - Build-time dependencies

## Recommendations

1. **event-stream replacement**: Consider migrating gulp tasks from `event-stream` to modern alternatives like `through2` or Node.js native streams. event-stream is largely a compatibility wrapper around through2.

2. **source-map**: Update the direct devDependency from 0.6.1 to 0.7.0+ when possible.

3. **glob**: Plan migration from glob@5 to glob@7 or newer.

4. **Audit the build system**: The 20+ gulpfiles using event-stream represent significant migration effort. Prioritize if build security is a concern.
