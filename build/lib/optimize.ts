/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as stream from 'stream';
import through2 from 'through2';
import mergeStream from 'merge-stream';
import gulp from 'gulp';
import filter from 'gulp-filter';
import path from 'path';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import VinylFile from 'vinyl';
import * as bundle from './bundle';
import esbuild from 'esbuild';
import sourcemaps from 'gulp-sourcemaps';
import fancyLog from 'fancy-log';
import ansiColors from 'ansi-colors';

const REPO_ROOT_PATH = path.join(__dirname, '../..');

export interface IBundleESMTaskOpts {
	/**
	 * The folder to read files from.
	 */
	src: string;
	/**
	 * The entry points to bundle.
	 */
	entryPoints: Array<bundle.IEntryPoint | string>;
	/**
	 * Other resources to consider (svg, etc.)
	 */
	resources?: string[];
	/**
	 * File contents interceptor for a given path.
	 */
	fileContentMapper?: (path: string) => ((contents: string) => Promise<string> | string) | undefined;
	/**
	 * Allows to skip the removal of TS boilerplate. Use this when
	 * the entry point is small and the overhead of removing the
	 * boilerplate makes the file larger in the end.
	 */
	skipTSBoilerplateRemoval?: (entryPointName: string) => boolean;
}

const DEFAULT_FILE_HEADER = [
	'/*!--------------------------------------------------------',
	' * Copyright (C) Microsoft Corporation. All rights reserved.',
	' *--------------------------------------------------------*/'
].join('\n');

function bundleESMTask(opts: IBundleESMTaskOpts): NodeJS.ReadWriteStream {
	const resourcesStream = through2.obj(); // this stream will contain the resources
	const bundlesStream = through2.obj(); // this stream will contain the bundled files

	const entryPoints = opts.entryPoints.map(entryPoint => {
		if (typeof entryPoint === 'string') {
			return { name: path.parse(entryPoint).name };
		}

		return entryPoint;
	});

	const bundleAsync = async () => {
		const files: VinylFile[] = [];
		const tasks: Promise<any>[] = [];

		for (const entryPoint of entryPoints) {
			fancyLog(`Bundled entry point: ${ansiColors.yellow(entryPoint.name)}...`);

			// support for 'dest' via esbuild#in/out
			const dest = entryPoint.dest?.replace(/\.[^/.]+$/, '') ?? entryPoint.name;

			// banner contents
			const banner = {
				js: DEFAULT_FILE_HEADER,
				css: DEFAULT_FILE_HEADER
			};

			// TS Boilerplate
			if (!opts.skipTSBoilerplateRemoval?.(entryPoint.name)) {
				const tslibPath = path.join(require.resolve('tslib'), '../tslib.es6.js');
				banner.js += await fs.promises.readFile(tslibPath, 'utf-8');
			}

			const contentsMapper: esbuild.Plugin = {
				name: 'contents-mapper',
				setup(build) {
					build.onLoad({ filter: /\.(js|ts)$/ }, async ({ path: filePath }) => {
						const contents = await fs.promises.readFile(filePath, 'utf-8');
						const isTS = filePath.endsWith('.ts');

						// TS Boilerplate (only for .js files — .ts files are handled by esbuild)
						let newContents: string;
						if (!isTS && !opts.skipTSBoilerplateRemoval?.(entryPoint.name)) {
							newContents = bundle.removeAllTSBoilerplate(contents);
						} else {
							newContents = contents;
						}

						// File Content Mapper — normalize path and also try .js variant for .ts files
						let normalizedPath = filePath.replace(/\\/g, '/');
						let mapper = opts.fileContentMapper?.(normalizedPath);
						if (!mapper && isTS) {
							mapper = opts.fileContentMapper?.(normalizedPath.replace(/\.ts$/, '.js'));
						}
						if (mapper) {
							newContents = await mapper(newContents);
						}

						return { contents: newContents, loader: isTS ? 'ts' : 'js' };
					});
				}
			};

			const externalOverride: esbuild.Plugin = {
				name: 'external-override',
				setup(build) {
					// We inline selected modules that are we depend on on startup without
					// a conditional `await import(...)` by hooking into the resolution.
					build.onResolve({ filter: /^minimist$/ }, () => {
						return { path: path.join(REPO_ROOT_PATH, 'node_modules', 'minimist', 'index.js'), external: false };
					});
				},
			};

			const task = esbuild.build({
				bundle: true,
				packages: 'external', // "external all the things", see https://esbuild.github.io/api/#packages
				platform: 'neutral', // makes esm
				format: 'esm',
				sourcemap: 'external',
				plugins: [contentsMapper, externalOverride],
				target: ['es2022'],
				loader: {
					'.ttf': 'file',
					'.svg': 'file',
					'.png': 'file',
					'.sh': 'file',
				},
				assetNames: 'media/[name]', // moves media assets into a sub-folder "media"
				banner: entryPoint.name === 'vs/workbench/workbench.web.main' ? undefined : banner, // TODO@esm remove line when we stop supporting web-amd-esm-bridge
				entryPoints: [
					{
						in: path.join(REPO_ROOT_PATH, opts.src, `${entryPoint.name}.js`),
						out: dest,
					}
				],
				outdir: path.join(REPO_ROOT_PATH, opts.src),
				write: false, // enables res.outputFiles
				metafile: true, // enables res.metafile
				// minify: NOT enabled because we have a separate minify task that takes care of the TSLib banner as well
		}).then(async res => {
			for (const file of res.outputFiles) {
				let sourceMapFile: esbuild.OutputFile | undefined = undefined;
				if (file.path.endsWith('.js')) {
					sourceMapFile = res.outputFiles.find(f => f.path === `${file.path}.map`);
				}

				let contents = Buffer.from(file.contents);

				// Apply fileContentMapper post-bundling for .js output files.
				// The onLoad hook may not fire for entry points when esbuild
				// resolves .js -> .ts, so we apply the mapper here as a fallback.
				if (file.path.endsWith('.js') && opts.fileContentMapper) {
					const normalizedPath = file.path.replace(/\\/g, '/');
					const mapper = opts.fileContentMapper(normalizedPath);
					if (mapper) {
						const mapped = await mapper(contents.toString('utf-8'));
						contents = Buffer.from(mapped);
					}
				}

				const fileProps = {
					contents,
					sourceMap: sourceMapFile ? JSON.parse(sourceMapFile.text) : undefined, // support gulp-sourcemaps
					path: file.path,
					base: path.join(REPO_ROOT_PATH, opts.src)
				};
				files.push(new VinylFile(fileProps));
			}
		});

			tasks.push(task);
		}

		await Promise.all(tasks);
		return { files };
	};

	bundleAsync().then((output) => {

		// bundle output (JS, CSS, SVG...)
		stream.Readable.from(output.files).pipe(bundlesStream);

		// forward all resources
		gulp.src(opts.resources ?? [], { base: `${opts.src}`, allowEmpty: true }).pipe(resourcesStream);
	}).catch(err => {
		// Forward esbuild failures as stream errors to avoid unhandled promise rejection
		result.emit('error', err);
	});

	const result = mergeStream(
		bundlesStream,
		resourcesStream
	);

	return result
		.pipe(sourcemaps.write('./', {
			sourceRoot: undefined,
			addComment: true,
			includeContent: true
		}));
}

export interface IBundleESMTaskOpts {
	/**
	 * Destination folder for the bundled files.
	 */
	out: string;
	/**
	 * Bundle ESM modules (using esbuild).
	*/
	esm: IBundleESMTaskOpts;
}

export function bundleTask(opts: IBundleESMTaskOpts): () => NodeJS.ReadWriteStream {
	return function () {
		return bundleESMTask(opts.esm).pipe(gulp.dest(opts.out));
	};
}

export function minifyTask(src: string, sourceMapBaseUrl?: string): (cb: any) => void {
	const sourceMappingURL = sourceMapBaseUrl ? ((f: any) => `${sourceMapBaseUrl}/${f.relative}.map`) : undefined;

	return async cb => {
		const svgmin = require('gulp-svgmin') as typeof import('gulp-svgmin');

		const jsFilter = filter('**/*.js', { restore: true });
		const cssFilter = filter('**/*.css', { restore: true });
		const svgFilter = filter('**/*.svg', { restore: true });

		const srcStream = gulp.src([src + '/**', '!' + src + '/**/*.map']);
		const jsStream = srcStream
			.pipe(jsFilter)
			.pipe(sourcemaps.init({ loadMaps: true }));

		// Process JS files with esbuild
		const processedJsFiles: VinylFile[] = [];
		for await (const f of jsStream) {
			const jsFile = f as VinylFile;
			if (!jsFile.path.endsWith('.js')) {
				processedJsFiles.push(jsFile);
				continue;
			}
			try {
				const res = await esbuild.build({
					entryPoints: [jsFile.path],
					minify: true,
					sourcemap: 'external',
					outdir: '.',
					packages: 'external',
					platform: 'neutral',
					target: ['es2022'],
					write: false
				});
				const jsOut = res.outputFiles.find(f => /\.js$/.test(f.path));
				const mapOut = res.outputFiles.find(f => /\.js\.map$/.test(f.path));
				if (jsOut) {
					const contents = Buffer.from(jsOut.contents);
					const unicodeMatch = contents.toString().match(/[^\x00-\xFF]+/g);
					if (unicodeMatch) {
						cb(new Error(`Found non-ascii character ${unicodeMatch[0]} in minified output of ${jsFile.path}`));
						return;
					}
					jsFile.contents = contents;
					jsFile.sourceMap = mapOut ? JSON.parse(mapOut.text) : undefined;
				}
				processedJsFiles.push(jsFile);
			} catch (err) {
				cb(err);
				return;
			}
		}

		// Process CSS files with esbuild (replaces cssnano)
		const cssStream = gulp.src([src + '/**/*.css', '!' + src + '/**/*.map']);
		const processedCssFiles: VinylFile[] = [];
		for await (const f of cssStream) {
			const cssFile = f as VinylFile;
			try {
				const res = await esbuild.build({
					entryPoints: [cssFile.path],
					minify: true,
					sourcemap: 'external',
					outdir: '.',
					loader: { '.css': 'css' },
					write: false
				});
				const cssOut = res.outputFiles.find(f => /\.css$/.test(f.path));
				const mapOut = res.outputFiles.find(f => /\.css\.map$/.test(f.path));
				if (cssOut) {
					cssFile.contents = Buffer.from(cssOut.contents);
					cssFile.sourceMap = mapOut ? JSON.parse(mapOut.text) : undefined;
				}
				processedCssFiles.push(cssFile);
			} catch (err) {
				cb(err);
				return;
			}
		}

		// Process SVG files
		const svgStream = gulp.src([src + '/**/*.svg', '!' + src + '/**/*.map']);
		const processedSvgFiles: VinylFile[] = [];
		for await (const f of svgStream) {
			processedSvgFiles.push(f as VinylFile);
		}

		// Output
		const outStream = mergeStream(
			stream.Readable.from(processedJsFiles),
			stream.Readable.from(processedCssFiles),
			stream.Readable.from(processedSvgFiles)
		);

		outStream
			.pipe(sourcemaps.write('./', {
				sourceMappingURL,
				sourceRoot: undefined,
				includeContent: true,
				addComment: true
			} as any))
			.pipe(gulp.dest(src + '-min'))
			.on('end', () => cb())
			.on('error', (err: any) => cb(err));
	};
}
