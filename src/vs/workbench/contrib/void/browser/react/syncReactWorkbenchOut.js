/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Electron loads workbench from `out/`; tsup writes to `src/.../react/out`. Keep them in sync after every bundle. */
export function syncReactOutToWorkbenchOut() {
	const srcBundleDir = path.join(__dirname, 'out');
	const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
	const destBundleDir = path.join(repoRoot, 'out', 'vs', 'workbench', 'contrib', 'void', 'browser', 'react', 'out');
	const destParent = path.dirname(destBundleDir);
	if (!fs.existsSync(srcBundleDir)) {
		return;
	}
	if (!fs.existsSync(destParent)) {
		console.log('[void-react] Skip sync: out/vs/workbench/... not found (run npm run compile first).');
		return;
	}
	fs.cpSync(srcBundleDir, destBundleDir, { recursive: true });
	console.log('[void-react] Synced react/out → out/vs/workbench/contrib/void/browser/react/out');
}
