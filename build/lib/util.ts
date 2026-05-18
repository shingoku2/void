/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import through2 from 'through2';
import es from 'event-stream';
import _debounce from 'debounce';
import _filter from 'gulp-filter';
import rename from 'gulp-rename';
import path from 'path';
import fs from 'fs';
import stream from 'stream';
import * as _rimraf from 'rimraf';
import VinylFile from 'vinyl';
import sm from 'source-map';
import { pathToFileURL } from 'url';
import mergeStream from 'merge-stream';

function duplex(input: NodeJS.ReadWriteStream, output: NodeJS.ReadWriteStream): NodeJS.ReadWriteStream {
	const combined = new stream.Duplex({
		objectMode: true,
		write(chunk, enc, cb) {
			if ((input as any).write(chunk, enc)) {
				cb();
			} else {
				input.once('drain', cb);
			}
		},
		final(cb) {
			(input as any).end();
			cb();
		},
		read() { }
	});

	output.on('data', (chunk: unknown) => {
		if (!combined.push(chunk)) {
			if (typeof (output as any).pause === 'function') {
				(output as any).pause();
			}
		}
	});
	combined.on('drain', () => {
		if (typeof (output as any).resume === 'function') {
			(output as any).resume();
		}
	});

	output.on('end', () => combined.push(null));
	output.on('error', err => combined.destroy(err));
	input.on('error', err => combined.destroy(err));

	return combined as unknown as NodeJS.ReadWriteStream;
}

function readableFromArray<T>(array: T[]): NodeJS.ReadWriteStream {
	const { PassThrough } = require('stream');
	const pt = new PassThrough({ objectMode: true });
	for (const item of array) {
		pt.write(item);
	}
	pt.end();
	return pt;
}

const root = path.dirname(path.dirname(__dirname));

export interface ICancellationToken {
	isCancellationRequested(): boolean;
}

const NoCancellationToken: ICancellationToken = { isCancellationRequested: () => false };

export interface IStreamProvider {
	(cancellationToken?: ICancellationToken): NodeJS.ReadWriteStream;
}

export function incremental(streamProvider: IStreamProvider, initial: NodeJS.ReadWriteStream, supportsCancellation?: boolean): NodeJS.ReadWriteStream {
	const input = through2.obj();
	const output = through2();
	let state = 'idle';
	let buffer = Object.create(null);

	const token: ICancellationToken | undefined = !supportsCancellation ? undefined : { isCancellationRequested: () => Object.keys(buffer).length > 0 };

	const run = (input: NodeJS.ReadWriteStream, isCancellable: boolean) => {
		state = 'running';

		const stream = !supportsCancellation ? streamProvider() : streamProvider(isCancellable ? token : NoCancellationToken);

		input
			.pipe(stream)
			.pipe(through2(undefined, () => {
				state = 'idle';
				eventuallyRun();
			}))
			.pipe(output);
	};

	if (initial) {
		run(initial, false);
	}

	const eventuallyRun = _debounce(() => {
		const paths = Object.keys(buffer);

		if (paths.length === 0) {
			return;
		}

		const data = paths.map(path => buffer[path]);
		buffer = Object.create(null);
		run(readableFromArray(data), true);
	}, 500);

	input.on('data', (f: any) => {
		buffer[f.path] = f;

		if (state === 'idle') {
			eventuallyRun();
		}
	});

	return duplex(input, output);
}

export function debounce(task: () => NodeJS.ReadWriteStream, duration = 500): NodeJS.ReadWriteStream {
	const input = through2.obj();
	const output = through2();
	let state = 'idle';

	const run = () => {
		state = 'running';

		task()
			.pipe(through2(undefined, () => {
				const shouldRunAgain = state === 'stale';
				state = 'idle';

				if (shouldRunAgain) {
					eventuallyRun();
				}
			}))
			.pipe(output);
	};

	run();

	const eventuallyRun = _debounce(() => run(), duration);

	input.on('data', () => {
		if (state === 'idle') {
			eventuallyRun();
		} else {
			state = 'stale';
		}
	});

	return duplex(input, output);
}

export function fixWin32DirectoryPermissions(): NodeJS.ReadWriteStream {
	if (!/win32/.test(process.platform)) {
		return through2();
	}

	return through2.obj<VinylFile, VinylFile>(function (f, _enc, cb) {
		if (f.stat && f.stat.isDirectory && f.stat.isDirectory()) {
			f.stat.mode = 16877;
		}

		cb(null, f);
	});
}

export function setExecutableBit(pattern?: string | string[]): NodeJS.ReadWriteStream {
	const setBit = through2.obj<VinylFile, VinylFile>(function (f, _enc, cb) {
		if (!f.stat) {
			f.stat = { isFile() { return true; } } as any;
		}
		f.stat.mode = /* 100755 */ 33261;
		cb(null, f);
	});

	if (!pattern) {
		return setBit;
	}

	const input = through2.obj();
	const filter = _filter(pattern, { restore: true });
	const output = input
		.pipe(filter)
		.pipe(setBit)
		.pipe(filter.restore);

	return duplex(input, output);
}

export function toFileUri(filePath: string): string {
	const match = filePath.match(/^([a-z])\:(.*)$/i);

	if (match) {
		filePath = '/' + match[1].toUpperCase() + ':' + match[2];
	}

	return 'file://' + filePath.replace(/\\/g, '/');
}

export function skipDirectories(): NodeJS.ReadWriteStream {
	return through2.obj<VinylFile, VinylFile>(function(f, enc, cb) {
		if (!f.isDirectory()) {
			cb(null, f);
		} else {
			cb();
		}
	});
}

export function cleanNodeModules(rulePath: string): NodeJS.ReadWriteStream {
	const rules = fs.readFileSync(rulePath, 'utf8')
		.split(/\r?\n/g)
		.map(line => line.trim())
		.filter(line => line && !/^#/.test(line));

	const excludes = rules.filter(line => !/^!/.test(line)).map(line => `!**/node_modules/${line}`);
	const includes = rules.filter(line => /^!/.test(line)).map(line => `**/node_modules/${line.substr(1)}`);

	const input = through2.obj();
	const output = mergeStream(
		input.pipe(_filter(['**', ...excludes])),
		input.pipe(_filter(includes))
	);

	return duplex(input, output);
}

declare class FileSourceMap extends VinylFile {
	public sourceMap: sm.RawSourceMap;
}

export function loadSourcemaps(): NodeJS.ReadWriteStream {
	const input = through2.obj();

	const output = input
		.pipe(through2.obj<FileSourceMap, FileSourceMap>(function (f, _enc, cb) {
			if (f.sourceMap) {
				cb(undefined, f);
				return;
			}

			if (!f.contents) {
				cb(undefined, f);
				return;
			}

			const contents = (<Buffer>f.contents).toString('utf8');

			const reg = /\/\/# sourceMappingURL=(.*)$/g;
			let lastMatch: RegExpExecArray | null = null;
			let match: RegExpExecArray | null = null;

			while (match = reg.exec(contents)) {
				lastMatch = match;
			}

			if (!lastMatch) {
				f.sourceMap = {
					version: '3',
					names: [],
					mappings: '',
					sources: [f.relative.replace(/\\/g, '/')],
					sourcesContent: [contents]
				};

				cb(undefined, f);
				return;
			}

			f.contents = Buffer.from(contents.replace(/\/\/# sourceMappingURL=(.*)$/g, ''), 'utf8');

			fs.readFile(path.join(path.dirname(f.path), lastMatch[1]), 'utf8', (err, contents) => {
				if (err) { return cb(err); }

				f.sourceMap = JSON.parse(contents);
				cb(undefined, f);
			});
		}));

	return duplex(input, output);
}

export function stripSourceMappingURL(): NodeJS.ReadWriteStream {
	const input = through2.obj();

	const output = input
		.pipe(through2.obj<VinylFile, VinylFile>(function (f, _enc, cb) {
			const contents = (<Buffer>f.contents).toString('utf8');
			f.contents = Buffer.from(contents.replace(/\n\/\/# sourceMappingURL=(.*)$/gm, ''), 'utf8');
			cb(null, f);
		}));

	return duplex(input, output);
}

/** Splits items in the stream based on the predicate, sending them to onTrue if true, or onFalse otherwise */
export function $if(test: boolean | ((f: VinylFile) => boolean), onTrue: NodeJS.ReadWriteStream, onFalse: NodeJS.ReadWriteStream = through2.obj()) {
	if (typeof test === 'boolean') {
		return test ? onTrue : onFalse;
	}

	const input = through2.obj<VinylFile, VinylFile>();
	const onTrueInput = through2.obj<VinylFile, VinylFile>();
	const onFalseInput = through2.obj<VinylFile, VinylFile>();
	const output = mergeStream(
		onTrueInput.pipe(onTrue),
		onFalseInput.pipe(onFalse)
	);

	const router = through2.obj<VinylFile, VinylFile>(function (file, _enc, cb) {
		if (test(file)) {
			onTrueInput.write(file);
		} else {
			onFalseInput.write(file);
		}
		cb();
	}, function (cb) {
		onTrueInput.end();
		onFalseInput.end();
		cb();
	});

	input.pipe(router);
	return duplex(input, output);
}

/** Operator that appends the js files' original path a sourceURL, so debug locations map */
export function appendOwnPathSourceURL(): NodeJS.ReadWriteStream {
	const input = through2.obj();

	const output = input
		.pipe(through2.obj<VinylFile, VinylFile>(function (f, _enc, cb) {
			if (!(f.contents instanceof Buffer)) {
				return cb(new Error(`contents of ${f.path} are not a buffer`));
			}

			f.contents = Buffer.concat([f.contents, Buffer.from(`\n//# sourceURL=${pathToFileURL(f.path)}`)]);
			cb(null, f);
		}));

	return duplex(input, output);
}

export function rewriteSourceMappingURL(sourceMappingURLBase: string): NodeJS.ReadWriteStream {
	const input = through2.obj();

	const output = input
		.pipe(through2.obj<VinylFile, VinylFile>(function (f, _enc, cb) {
			const contents = (<Buffer>f.contents).toString('utf8');
			const str = `//# sourceMappingURL=${sourceMappingURLBase}/${path.dirname(f.relative).replace(/\\/g, '/')}/$1`;
			f.contents = Buffer.from(contents.replace(/\n\/\/# sourceMappingURL=(.*)$/gm, str));
			cb(null, f);
		}));

	return duplex(input, output);
}

export function rimraf(dir: string): () => Promise<void> {
	const result = () => new Promise<void>((c, e) => {
		let retries = 0;

		const retry = () => {
			_rimraf.rimraf(dir, { maxBusyTries: 1 })
				.then(() => c())
				.catch((err: any) => {
					if (err.code === 'ENOTEMPTY' && ++retries < 5) {
						return setTimeout(() => retry(), 10);
					}
					return e(err);
				});
		};

		retry();
	});

	result.taskName = `clean-${path.basename(dir).toLowerCase()}`;
	return result;
}

function _rreaddir(dirPath: string, prepend: string, result: string[]): void {
	const entries = fs.readdirSync(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			_rreaddir(path.join(dirPath, entry.name), `${prepend}/${entry.name}`, result);
		} else {
			result.push(`${prepend}/${entry.name}`);
		}
	}
}

export function rreddir(dirPath: string): string[] {
	const result: string[] = [];
	_rreaddir(dirPath, '', result);
	return result;
}

export function ensureDir(dirPath: string): void {
	if (fs.existsSync(dirPath)) {
		return;
	}
	ensureDir(path.dirname(dirPath));
	fs.mkdirSync(dirPath);
}

export function rebase(count: number): NodeJS.ReadWriteStream {
	return rename(f => {
		const parts = f.dirname ? f.dirname.split(/[\/\\]/) : [];
		f.dirname = parts.slice(count).join(path.sep);
	});
}

export interface FilterStream extends NodeJS.ReadWriteStream {
	restore: NodeJS.ReadWriteStream;
}

export function filter(fn: (data: any) => boolean): FilterStream {
	const result = es.through(function (data) {
		if (fn(data)) {
			this.emit('data', data);
		} else {
			(result as any).restore.push(data);
		}
	}) as unknown as FilterStream;

	result.restore = es.through();
	return result;
}

export function streamToPromise(stream: NodeJS.ReadWriteStream): Promise<void> {
	return new Promise((c, e) => {
		stream.on('error', err => e(err));
		stream.on('end', () => c());
	});
}

export function getElectronVersion(): Record<string, string> {
	const npmrc = fs.readFileSync(path.join(root, '.npmrc'), 'utf8');
	const electronVersion = /^target="(.*)"$/m.exec(npmrc)![1];
	const msBuildId = /^ms_build_id="(.*)"$/m.exec(npmrc)![1];
	return { electronVersion, msBuildId };
}
