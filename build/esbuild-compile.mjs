/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Standalone esbuild-based compile script
 *
 * This script replaces the gulp compile flow with direct esbuild calls.
 * It can be run with: node build/esbuild-compile.mjs
 *
 * Currently supports:
 * - Monaco.d.ts generation (via monaco-api compiled output)
 * - esbuild transpilation (TypeScript → JavaScript)
 *
 * TODO: NLS processing, mangling, full API proposal names
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// build/esbuild-compile.mjs -> build/ -> repo root
const REPO_ROOT = path.join(__dirname, '..');
const PROD_UNSAFE_TASKS = new Set(['monaco', 'transpile', 'watch', 'all']);

function isExperimentalOptIn(args) {
	return args.includes('--experimental') || process.env['VOID_ALLOW_EXPERIMENTAL_ESBUILD_COMPILE'] === '1';
}

function assertTaskIsAllowed(task, args) {
	if (!PROD_UNSAFE_TASKS.has(task)) {
		return;
	}

	if (isExperimentalOptIn(args)) {
		console.warn('[esbuild-compile] WARNING: running experimental task outside production compile flow.');
		return;
	}

	const msg = [
		`[esbuild-compile] Refusing to run "${task}" without explicit opt-in.`,
		'[esbuild-compile] This script does not yet have feature parity with gulp compile.',
		'[esbuild-compile] Use `npm run compile` for production outputs.',
		'[esbuild-compile] To run anyway, pass --experimental or set VOID_ALLOW_EXPERIMENTAL_ESBUILD_COMPILE=1.',
	].join('\n');
	throw new Error(msg);
}

/**
 * Generate monaco.d.ts by running the existing TypeScript-based generator
 * then transforming with esbuild
 */
async function generateMonacoTypes() {
	console.log('[esbuild-compile] Generating monaco.d.ts...');

	// The MonacoGenerator is part of compilation.ts - use gulp to generate once
	// Then we can use esbuild for subsequent changes
	console.log('[esbuild-compile] Monaco types generation requires gulp integration');
	console.log('[esbuild-compile] Skipping for now - gulp compile handles this');
}

/**
 * Generate extensionsApiProposals.ts
 */
async function compileApiProposalNames() {
	console.log('[esbuild-compile] Generating extensionsApiProposals.ts...');

	const pattern = /vscode\.proposed\.([a-zA-Z\d]+)\.d\.ts$/;
	const versionPattern = /^\s*\/\/\s*version\s*:\s*(\d+)\s*$/mi;

	const vscodeDtsPath = path.join(REPO_ROOT, 'src/vscode-dts');
	const files = fs.readdirSync(vscodeDtsPath);

	const proposals = new Map();
	for (const file of files) {
		if (!pattern.test(file)) continue;

		const match = pattern.exec(file);
		const proposalName = match[1];
		const contents = fs.readFileSync(path.join(vscodeDtsPath, file), 'utf8');
		const versionMatch = versionPattern.exec(contents);

		proposals.set(proposalName, {
			proposal: `https://raw.githubusercontent.com/microsoft/vscode/main/src/vscode-dts/vscode.proposed.${proposalName}.d.ts`,
			version: versionMatch ? versionMatch[1] : undefined
		});
	}

	const names = [...proposals.keys()].sort();
	const eol = '\n';
	const contents = [
		'/*---------------------------------------------------------------------------------------------',
		' *  Copyright (c) Microsoft Corporation. All rights reserved.',
		' *  Licensed under the MIT License. See License.txt in the project root for license information.',
		' *--------------------------------------------------------------------------------------------*/',
		'',
		'// THIS IS A GENERATED FILE. DO NOT EDIT DIRECTLY.',
		'',
		'const _allApiProposals = {',
		names.map(proposalName => {
			const prop = proposals.get(proposalName);
			return `\t${proposalName}: {${eol}\t\tproposal: '${prop.proposal}',${eol}${prop.version ? `\t\tversion: ${prop.version}${eol}` : ''}\t}`;
		}).join(`,${eol}`),
		'};',
		'export const allApiProposals = Object.freeze<{ [proposalName: string]: Readonly<{ proposal: string; version?: number }> }>(_allApiProposals);',
		'export type ApiProposalName = keyof typeof _allApiProposals;',
		'',
	].join(eol);

	fs.writeFileSync(
		path.join(REPO_ROOT, 'src/vs/platform/extensions/common/extensionsApiProposals.ts'),
		contents
	);
	console.log('[esbuild-compile] ExtensionsApiProposals generated');
}

/**
 * Transpile TypeScript with esbuild
 */
async function transpileWithEsbuild(src, outDir, options = {}) {
	const {
		target = ['es2022'],
		format = 'esm',
		minify = false,
		sourcemap = 'inline'
	} = options;

	console.log(`[esbuild-compile] Transpiling ${src} → ${outDir}...`);

	const startTime = Date.now();

	// Get all TypeScript files in src
	const allFiles = [];
	function walkDir(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				// Skip certain directories
				if (['node_modules', '.git', 'fixtures', 'test', 'tests'].includes(entry.name)) continue;
				walkDir(fullPath);
			} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
				allFiles.push(fullPath);
			}
		}
	}
	walkDir(src);

	console.log(`[esbuild-compile] Found ${allFiles.length} TypeScript files`);

	// Build with esbuild - process in batches for memory efficiency
	const batchSize = 100;
	let processed = 0;

	for (let i = 0; i < allFiles.length; i += batchSize) {
		const batch = allFiles.slice(i, i + batchSize);

		// When bundle: false, entryPoints must be an array of actual file paths
		// esbuild will output to outdir with relative paths preserved
		await esbuild.build({
			entryPoints: batch,
			outdir: outDir,
			target,
			format, // 'esm' or 'cjs'
			sourcemap,
			loader: { '.ts': 'ts' },
			logLevel: 'warning',
			// Don't bundle - transpile only (no import resolution)
			bundle: false,
			// Legal comments handling
			legalComments: 'none',
			// Minify if requested
			minify,
			// Source root for sourcemaps
			sourceRoot: src,
		});

		processed += batch.length;
		console.log(`[esbuild-compile] Processed ${processed}/${allFiles.length} files`);
	}

	const duration = Date.now() - startTime;
	console.log(`[esbuild-compile] Transpiled ${allFiles.length} files in ${duration}ms`);

	// Generate .d.ts files via tsc for types (esbuild doesn't emit declarations)
	console.log('[esbuild-compile] Note: esbuild does not emit .d.ts files. Run tsc for type checking.');
}

/**
 * Watch mode
 */
async function watchWithEsbuild(src, outDir) {
	console.log(`[esbuild-compile] Watching ${src} for changes...`);

	const ctx = await esbuild.context({
		entryPoints: [`${src}/**/*.ts`],
		outdir: outDir,
		target: ['es2022'],
		format: 'esm',
		sourcemap: 'inline',
		loader: { '.ts': 'ts' },
		logLevel: 'warning',
		bundle: false,
	});

	await ctx.watch();
	console.log('[esbuild-compile] Watching for changes...');

	// Keep process alive
	return new Promise(() => {});
}

async function main() {
	const args = process.argv.slice(2);
	const task = args.find(arg => !arg.startsWith('--')) || 'all';
	assertTaskIsAllowed(task, args);

	console.log('[esbuild-compile] Starting build...');
	console.log('[esbuild-compile] Task:', task);

	try {
		switch (task) {
			case 'monaco':
				await generateMonacoTypes();
				break;

			case 'api-proposals':
				await compileApiProposalNames();
				break;

			case 'transpile': {
				const srcDir = args[1] || 'src';
				const outDir = args[2] || 'out-build';
				await transpileWithEsbuild(srcDir, outDir);
				break;
			}

			case 'watch': {
				const srcDir = args[1] || 'src';
				const outDir = args[2] || 'out';
				await watchWithEsbuild(srcDir, outDir);
				break;
			}

			case 'all':
			default:
				await compileApiProposalNames();
				console.log('[esbuild-compile] Build complete!');
				break;
		}
	} catch (error) {
		console.error('[esbuild-compile] Error:', error);
		process.exit(1);
	}
}

main();
