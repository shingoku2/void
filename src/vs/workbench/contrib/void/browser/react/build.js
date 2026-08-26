/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import postcssNesting from 'postcss-nesting';
import { syncReactOutToWorkbenchOut } from './syncReactWorkbenchOut.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, 'src');
const src2Dir = path.join(__dirname, 'src2');

function doesPathExist(filePath) {
	try {
		const stats = fs.statSync(filePath);
		return stats.isFile();
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}
}

function ensureDirExists(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

// Find all CSS files in src directory recursively
function findCssFiles(dir, files = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			findCssFiles(fullPath, files);
		} else if (entry.name.endsWith('.css')) {
			files.push(fullPath);
		}
	}
	return files;
}

// Copy non-CSS files from src to src2
function copyNonCssFiles(srcPath, destPath) {
	const entries = fs.readdirSync(srcPath, { withFileTypes: true });
	ensureDirExists(destPath);

	for (const entry of entries) {
		const srcFile = path.join(srcPath, entry.name);
		const destFile = path.join(destPath, entry.name);

		if (entry.isDirectory()) {
			copyNonCssFiles(srcFile, destFile);
		} else if (!entry.name.endsWith('.css')) {
			fs.copyFileSync(srcFile, destFile);
		}
	}
}

// Custom PostCSS plugin to wrap all rules in .void-scope
function voidScopeWrap() {
	return {
		postcssPlugin: 'void-scope-wrap',
		Rule(rule) {
			// Skip if already wrapped
			if (rule.selector && rule.selector.includes('.void-scope')) {
				return;
			}
			// Split by comma for multiple selectors and wrap each
			const selectors = rule.selector.split(',').map(s => `.void-scope ${s.trim()}`);
			rule.selector = selectors.join(',\n');
		}
	};
}
voidScopeWrap.postcss = true;

// Process a CSS file with Tailwind + scoping
async function processCssFile(cssFilePath) {
	const css = fs.readFileSync(cssFilePath, 'utf8');

	// Process with Tailwind and nesting, then wrap in .void-scope
	const result = await postcss([
		postcssNesting(),
		tailwindcss('./tailwind.config.js'),
		voidScopeWrap()
	]).process(css, { from: cssFilePath });

	return result.css;
}

// Build CSS files from src to src2
async function buildCss() {
	ensureDirExists(src2Dir);

	const cssFiles = findCssFiles(srcDir);

	for (const cssFile of cssFiles) {
		const relativePath = path.relative(srcDir, cssFile);
		const outputPath = path.join(src2Dir, relativePath);

		// Ensure output directory exists
		const outputDir = path.dirname(outputPath);
		ensureDirExists(outputDir);

		console.log(`Processing ${relativePath}...`);
		const processedCss = await processCssFile(cssFile);
		fs.writeFileSync(outputPath, processedCss, 'utf8');
	}
}

// Copy non-CSS files
function copyAssets() {
	copyNonCssFiles(srcDir, src2Dir);
}

// Hack to refresh styles automatically
function saveStylesFile() {
	setTimeout(() => {
		try {
			const pathToCssFile = path.join(src2Dir, 'styles.css');
			if (!doesPathExist(pathToCssFile)) {
				console.error('[void-css] Error finding styles.css');
				return;
			}
			const content = fs.readFileSync(pathToCssFile, 'utf8');
			fs.writeFileSync(pathToCssFile, content, 'utf8');
			console.log('[void-css] Force-saved styles.css');
		} catch (err) {
			console.error('[void-css] Error saving styles.css:', err);
		}
	}, 6000);
}

const args = process.argv.slice(2);
const isWatch = args.includes('--watch') || args.includes('-w');

async function runBuild() {
	// Copy non-CSS files first
	copyAssets();

	// Build CSS
	await buildCss();
}

if (isWatch) {
	// Initial build if src2 doesn't exist
	if (!fs.existsSync(src2Dir)) {
		try {
			console.log('Running initial void-css build to create src2 folder...');
			await runBuild();
			console.log('src2/ created successfully.');
		} catch (err) {
			console.error('Error running initial void-css build:', err);
			process.exit(1);
		}
	}

	const npxCommand = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
	
	// Watch mode using nodemon
	const cssWatcher = spawn(npxCommand, [
		'nodemon',
		'--watch', 'src',
		'--ext', 'ts,tsx,css',
		'--exec', 'node',
		'--', 'build.js'
	], { stdio: 'inherit', cwd: __dirname, shell: os.platform() === 'win32' });

	const tsupWatcher = spawn(npxCommand, [
		'tsup',
		'--watch'
	], { stdio: 'inherit', cwd: __dirname, shell: os.platform() === 'win32' });

	// Handle process termination
	process.on('SIGINT', () => {
		cssWatcher.kill();
		tsupWatcher.kill();
		process.exit();
	});

	console.log('Watchers started! Press Ctrl+C to stop both watchers.');
} else {
	// Build mode
	console.log('Building...');

	try {
		await runBuild();
	} catch (err) {
		console.error('Error building CSS:', err);
		process.exit(1);
	}

	// Run tsup once (onSuccess in tsup.config.js copies bundle into workbench `out/`)
	execSync('npx tsup', { stdio: 'inherit', cwd: __dirname });

	console.log('Build complete!');
}
