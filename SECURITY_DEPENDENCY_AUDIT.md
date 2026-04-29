# Security Dependency Audit

**Last Updated:** 2026-04-28
**Audit Tool:** `npm audit`

## Overview

This document tracks known security vulnerabilities in dependencies and the mitigation strategies applied. The audit reveals **21 vulnerabilities (12 moderate, 9 high)** requiring attention.

## Active Mitigations

### 1. event-stream / flatmap-stream (2018 Supply Chain Attack)

**Issue**: event-stream 3.3.4 was involved in the [2018 flatmap-stream compromise](https://blog.npmjs.org/post/180565064195/). The malicious `flatmap-stream@0.0.1-security` was added to the dependency tree.

**Status**: Mitigated via npm override

**Mitigation Applied** (in `package.json` overrides):
```json
"flatmap-stream@<0.0.1-security": {
  "flatmap-stream": "0.0.1-security"
}
```

This forces any vulnerable `flatmap-stream` version to the secure security holding package.

**Note**: event-stream 3.3.5 removes the flatmap-stream dependency entirely and is the recommended safe version.

## High Severity Vulnerabilities

### 2. Electron <=39.8.4

**Issue**: Multiple high-severity vulnerabilities including:
- ASAR Integrity Bypass via resource modification (GHSA-vmqv-hx8q-j7mg)
- AppleScript injection on macOS (GHSA-5rqw-r77c-jp79)
- Service worker can spoof executeJavaScript IPC replies (GHSA-xj5x-m3f3-5x3h)
- Incorrect origin passed to permission request handler for iframe requests (GHSA-r5p7-gp4j-qhrx)
- Out-of-bounds read in second-instance IPC on macOS and Linux (GHSA-3c8v-cfp5-9885)
- nodeIntegrationInWorker not correctly scoped in shared renderer processes (GHSA-xwr5-m59h-vwqr)
- Use-after-free in offscreen child window paint callback (GHSA-532v-xpq5-8h95)
- Registry key path injection in app.setAsDefaultProtocolClient on Windows (GHSA-mwmh-mq4g-g6gr)
- Use-after-free in download save dialog callback (GHSA-9w97-2464-8783)
- Use-after-free in WebContents fullscreen, pointer-lock, and keyboard-lock permission callbacks (GHSA-8337-3p73-46f4)
- Use-after-free in PowerMonitor on Windows and macOS (GHSA-jjp3-mq3x-295m)
- Renderer command-line switch injection via undocumented commandLineSwitches webPreference (GHSA-9wfr-w7mm-pc7f)
- Unquoted executable path in app.setLoginItemSettings on Windows (GHSA-jfqx-fxh3-c62j)
- HTTP Response Header Injection in custom protocol handlers (GHSA-4p4r-m79c-wq3v)
- USB device selection not validated against filtered device list (GHSA-9899-m83m-qhpj)
- Use-after-free in offscreen shared texture release() callback (GHSA-8x5q-pvf5-64mp)
- Crash in clipboard.readImage() on malformed clipboard image data (GHSA-f37v-82c4-4x64)
- Named window.open targets not scoped to the opener's browsing context (GHSA-f3pv-wv63-48x8)

**Fix available**: `npm audit fix --force` would install electron@41.3.0, which is a **breaking change**.

**Recommended Action**: Plan Electron upgrade with full regression testing. Key areas to test:
- IPC communication between main and renderer processes
- WebContents fullscreen, pointer-lock, and keyboard-lock functionality
- Protocol handler registration
- Application move-to-Applications-folder behavior on macOS

### 3. Braces <3.0.3

**Issue**: Uncontrolled resource consumption in braces (GHSA-grv7-fg5c-xmjg)

**Dependency chain:**
```
gulp 4.0.0 - 4.0.2
  -> glob-watcher 5.0.0 - 5.0.5
       -> chokidar 1.3.0 - 2.1.8
            -> anymatch -> micromatch -> braces (vulnerable)
```

**Fix available**: `npm audit fix --force` would install gulp@5.0.1, which is a **breaking change**.

**Recommended Action**: Test all gulp tasks after upgrade, especially file watching and glob patterns.

### 4. Serialize-Javascript <=7.0.4

**Issue**:
- RCE via RegExp.flags and Date.prototype.toISOString() (GHSA-5c6j-r48x-rmvq)
- CPU Exhaustion Denial of Service via crafted array-like objects (GHSA-5c6j-r48x-rmvq)

**No fix available.** This vulnerability propagates through mocha -> @vscode/test-cli.

**Dependency chain:**
```
@vscode/test-cli
  -> mocha 8.0.0 - 12.0.0-beta-2
       -> serialize-javascript (vulnerable)
```

**Recommended Action**: Avoid running untrusted code through test fixtures. The vulnerability only affects the test framework, not production code.

## Moderate Severity Vulnerabilities

### 5. PostCSS <=8.5.9

**Issue**:
- Line return parsing error (GHSA-7fh5-64p2-3v2j)
- XSS via Unescaped </style> in CSS Stringify Output (GHSA-qx2v-qp2m-jg93)

**Dependency chain:**
```
gulp-sourcemaps
  -> @gulp-sourcemaps/identity-map
       -> postcss (vulnerable)
```

**Fix available**: `npm audit fix --force` would install gulp-sourcemaps@2.6.5, which is a **breaking change**.

**Recommended Action**: Test CSS processing in build pipeline after upgrade.

### 6. UUID <14.0.0

**Issue**: Missing buffer bounds check in v3/v5/v6 when buf is provided (GHSA-w5hq-g745-h8pq)

**Dependency chain:**
```
@vscode/deviceid
  -> uuid
gaxios 6.4.0 - 6.7.1
  -> uuid
```

**No fix available.**

**Recommended Action**: If using UUID generation with custom buffers, ensure bounds checking is implemented at the application layer.

## Legacy Issues (Previously Documented)

### 7. source-map 0.6.1 (RCE via Function Construction)

**Issue**: source-map <=0.6.1 is vulnerable to RCE through malicious source map files.

**Current State**: Direct devDependency at version 0.6.1. Used by istanbul-lib-source-maps and gulp-sourcemaps.

**Recommended Action**: Update to source-map@0.7.0 which contains the security fix.

### 8. glob@5.0.15 (Deprecated)

**Issue**: glob v5 is deprecated with no security patches.

**Current State**: Direct devDependency at version 5.0.15.

**Recommended Action**: Update to glob@7.0.6 or higher. glob@10+ uses ESM.

### 9. ini@1.3.8

**Issue**: ini <=1.3.5 had a DoS vulnerability via nested configuration.

**Current State**: No direct dependency, but pulled transitively via rc@1.2.7. Current override targets any ini <1.3.6.

## Summary Table

| Issue | Severity | Fix Available | Breaking Change |
|-------|----------|---------------|-----------------|
| Electron vulns | High | Yes (v41.3.0) | Yes |
| Braces | High | Yes (gulp@5.0.1) | Yes |
| serialize-javascript | High | **No** | N/A |
| PostCSS XSS | Moderate | Yes (gulp-sourcemaps@2.6.5) | Yes |
| UUID bounds check | Moderate | **No** | N/A |
| source-map RCE | High | Yes (v0.7.0) | No |
| glob@5 deprecated | Low | Yes (v7+) | Yes |

## Recommendations

1. **Immediate**: Review usage of serialize-javascript and UUID with custom buffers in application code.

2. **Short-term**: Plan Electron upgrade with dedicated regression testing sprint. The security fixes are significant but require breaking change validation.

3. **Medium-term**: When time permits, test gulp upgrades in isolation:
   - `npm audit fix --force` for braces/postcss
   - Validate all gulp tasks work correctly

4. **Long-term**: Consider migrating from `event-stream` to modern alternatives like `through2` or Node.js native streams.

## Related Files

- `package.json` - Contains npm overrides for dependency security
- `build/package.json` - Build-time dependencies

## References

- [Electron Security Advisories](https://github.com/advisories?scope=AppId&q=electron)
- [braces GHSA-grv7-fg5c-xmjg](https://github.com/advisories/GHSA-grv7-fg5c-xmjg)
- [serialize-javascript GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq)
- [postcss GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j)
- [uuid GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
