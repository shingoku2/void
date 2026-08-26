/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Writable } from 'stream';
import through2 from 'through2';
import VinylFile from 'vinyl';
import path from 'path';

/**
 * Tests for the NLS (National Language Support) file processing.
 * Specifically tests the through2.obj() callback pattern with transform
 * and flush functions.
 */
suite('NLS through2.obj() Callback Pattern Tests', () => {

	/**
	 * Simulates the nls() function pattern from nls.ts.
	 * Tests the through2.obj() with both a transform callback and a flush callback.
	 */
	function createNlsLikeStream(_options: { preserveEnglish: boolean }): NodeJS.ReadWriteStream {
		let base: string;
		let hasSourcemap = false;
		const input = through2.obj();
		const output = input
			.pipe(through2.obj(function (f: VinylFile, _enc, cb) {
				// Transform function - processes each file
				if (!(f as any).sourceMap || !/\.js$/.test(f.path)) {
					return cb(null, f);
				}

				let source = (f as any).sourceMap.sources[0];
				if (!source) {
					return cb(null, f);
				}

				const root = (f as any).sourceMap.sourceRoot;
				if (root) {
					source = path.join(root, source);
				}

				const typescript = (f as any).sourceMap.sourcesContent?.[0];
				if (!typescript) {
					cb(new Error(`File ${f.relative} does not have the original content in the source map.`));
					return;
				}

				base = f.base;
				hasSourcemap = true;

				// Simulate NLS patching - in real code this calls _nls.patchFile
				const patchedContent = (f.contents ?? Buffer.from('')).toString('utf8') + '/* patched */';
				const patchedFile = new VinylFile({
					contents: Buffer.from(patchedContent),
					base: f.base,
					path: f.path
				});

				cb(null, patchedFile);
			}, function (cb) {
				// Flush function - called when stream is ending
				// Only emit NLS files if we processed at least one file with sourcemap
				if (hasSourcemap) {
					for (const file of [
						new VinylFile({
							contents: Buffer.from(JSON.stringify({
								keys: { 'test/module': ['key1', 'key2'] },
								messages: { 'test/module': ['message1', 'message2'] }
							}, null, '\t')),
							base,
							path: `${base}/nls.metadata.json`
						}),
						new VinylFile({
							contents: Buffer.from(JSON.stringify(['message1', 'message2'])),
							base,
							path: `${base}/nls.messages.json`
						})
					]) {
						this.push(file);
					}
				}
				cb();
			}));

		return createDuplex(input, output);
	}

	function createDuplex(input: Writable, output: NodeJS.ReadWriteStream): NodeJS.ReadWriteStream {
		const { Duplex } = require('stream') as typeof import('stream');
		const combined = new Duplex({
			objectMode: true,
			write(chunk: any, enc: string, cb: () => void) {
				if ((input as any).write(chunk, enc)) {
					cb();
				} else {
					input.once('drain', cb);
				}
			},
			final(cb: () => void) {
				input.end();
				cb();
			},
			read() { }
		});
		output.on('data', (chunk: any) => {
			if (!combined.push(chunk) && typeof (output as any).pause === 'function') {
				(output as any).pause();
			}
		});
		combined.on('drain', () => {
			if (typeof (output as any).resume === 'function') {
				(output as any).resume();
			}
		});
		output.on('end', () => combined.push(null));
		output.on('error', (err: Error) => combined.destroy(err));
		input.on('error', (err: Error) => combined.destroy(err));
		return combined as unknown as NodeJS.ReadWriteStream;
	}

	test('through2.obj transform callback receives file and can emit processed file', (done) => {
		const nlsStream = createNlsLikeStream({ preserveEnglish: true });

		const receivedFiles: VinylFile[] = [];
		nlsStream.on('data', (file: VinylFile) => {
			receivedFiles.push(file);
		});

		nlsStream.on('end', () => {
			// Should have received the original file (patched) plus NLS metadata files
			assert.ok(receivedFiles.length >= 1, 'Should receive at least one file');
			done();
		});

		// Send a file without sourcemap - should pass through unchanged
		const testFile = new VinylFile({
			path: '/src/test/no-sourcemap.js',
			contents: Buffer.from('console.log("test");'),
			base: '/src'
		});

		(nlsStream as any).write(testFile);
		(nlsStream as any).end();
	});

	test('through2.obj flush callback emits additional files at end', (done) => {
		const nlsStream = createNlsLikeStream({ preserveEnglish: true });

		const receivedFiles: VinylFile[] = [];
		nlsStream.on('data', (file: VinylFile) => {
			receivedFiles.push(file);
		});

		nlsStream.on('end', () => {
			// Should have received the original file plus NLS metadata and messages files
			assert.strictEqual(receivedFiles.length, 3, 'Should receive original + 2 NLS files');

			const nlsMetadata = receivedFiles.find(f => f.path.endsWith('nls.metadata.json'));
			const nlsMessages = receivedFiles.find(f => f.path.endsWith('nls.messages.json'));

			assert.ok(nlsMetadata, 'Should have nls.metadata.json');
			assert.ok(nlsMessages, 'Should have nls.messages.json');

			done();
		});

		// Send a file with sourcemap
		const testFileWithSourcemap = new VinylFile({
			path: '/src/test/with-sourcemap.js',
			contents: Buffer.from('console.log("test");'),
			base: '/src'
		});
		(testFileWithSourcemap as any).sourceMap = {
			version: 3,
			sources: ['test/with-sourcemap.ts'],
			sourcesContent: ['console.log("test");'],
			mappings: 'AAAA'
		};

		(nlsStream as any).write(testFileWithSourcemap);
		(nlsStream as any).end();
	});

	test('through2.obj flush callback is called when stream ends', (done) => {
		let flushCalled = false;

		const input = through2.obj();
		const output = input
			.pipe(through2.obj(function (f: VinylFile, _enc, cb) {
				cb(null, f);
			}, function (cb) {
				// This is the flush function - should be called on stream end
				flushCalled = true;
				this.push(new VinylFile({
					path: '/src/flush-file.json',
					contents: Buffer.from('{"flushed": true}'),
					base: '/src'
				}));
				cb();
			}));

		const { Duplex } = require('stream') as typeof import('stream');
		const combined = new Duplex({
			objectMode: true,
			write(chunk: any, enc: string, cb: () => void) {
				if ((input as any).write(chunk, enc)) {
					cb();
				} else {
					input.once('drain', cb);
				}
			},
			final(cb: () => void) {
				input.end();
				cb();
			},
			read() { }
		});
		output.on('data', (chunk: any) => combined.push(chunk));
		output.on('end', () => combined.push(null));
		output.on('error', (err: Error) => combined.destroy(err));
		input.on('error', (err: Error) => combined.destroy(err));

		const receivedFiles: VinylFile[] = [];
		combined.on('data', (file: VinylFile) => {
			receivedFiles.push(file);
		});

		combined.on('end', () => {
			assert.strictEqual(flushCalled, true, 'Flush callback should have been called');
			assert.strictEqual(receivedFiles.length, 2, 'Should receive input file + flushed file');
			done();
		});

		(combined as any).write(new VinylFile({
			path: '/src/input.js',
			contents: Buffer.from('input'),
			base: '/src'
		}));
		(combined as any).end();
	});

	test('through2.obj handles non-JS files by passing through unchanged', (done) => {
		// Test using simple through2 stream to verify the pattern
		const input = through2.obj();
		const output = input.pipe(through2.obj(function (f: VinylFile, _enc, cb) {
			if (!(f as any).sourceMap || !/\.js$/.test(f.path)) {
				return cb(null, f);
			}
			cb(null, f);
		}));

		const { Duplex } = require('stream') as typeof import('stream');
		const combined = new Duplex({
			objectMode: true,
			write(chunk: any, enc: string, cb: () => void) {
				if ((input as any).write(chunk, enc)) {
					cb();
				} else {
					input.once('drain', cb);
				}
			},
			final(cb: () => void) {
				input.end();
				cb();
			},
			read() { }
		});
		output.on('data', (chunk: any) => combined.push(chunk));
		output.on('end', () => combined.push(null));
		output.on('error', (err: Error) => combined.destroy(err));
		input.on('error', (err: Error) => combined.destroy(err));

		const receivedFiles: VinylFile[] = [];
		combined.on('data', (file: VinylFile) => {
			receivedFiles.push(file);
		});

		combined.on('end', () => {
			// CSS file should pass through unchanged
			const processedFile = receivedFiles.find(f => f.path.endsWith('.css'));
			assert.ok(processedFile, 'CSS file should pass through');
			assert.strictEqual((processedFile?.contents ?? Buffer.from('')).toString(), 'body { color: red; }', 'CSS content unchanged');
			done();
		});

		// Send a CSS file - should pass through unchanged
		const cssFile = new VinylFile({
			path: '/src/test/style.css',
			contents: Buffer.from('body { color: red; }'),
			base: '/src'
		});

		(combined as any).write(cssFile);
		(combined as any).end();
	});
});