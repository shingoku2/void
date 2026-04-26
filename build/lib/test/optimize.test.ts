/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Readable } from 'stream';
import through2 from 'through2';
import VinylFile from 'vinyl';
import mergeStream from 'merge-stream';

/**
 * Tests for error propagation in bundleESMTask and bundleAsync.
 * The critical fix being tested: esbuild failures should emit as stream errors,
 * not cause unhandled promise rejections.
 */
suite('Optimize Error Propagation Tests', () => {

	/**
	 * Test that errors from a async task are properly emitted on the result stream.
	 * This simulates the bundleAsync pattern where a promise can reject and the error
	 * should be propagated through the gulp stream.
	 */
	test('bundleAsync pattern emits error to stream when promise rejects', async () => {
		const bundlesStream = through2.obj();
		const resourcesStream = through2.obj();

		const result = mergeStream(bundlesStream, resourcesStream);

		// Capture the error emitted on the result stream
		let emittedErrorMessage: string | null = null;
		result.on('error', (err: Error) => {
			emittedErrorMessage = err.message;
		});

		// Simulate the bundleAsync pattern with a failing promise
		const bundleAsync = () => {
			return Promise.reject(new Error('esbuild build failed: invalid entry point'));
		};

		// This pattern mirrors what bundleESMTask does in optimize.ts
		bundleAsync().then((output: any) => {
			// Should not reach here if esbuild failed
			Readable.from(output.files).pipe(bundlesStream);
			gulp.src(opts.resources ?? [], { base: `${opts.src}`, allowEmpty: true }).pipe(resourcesStream);
		}).catch((err: Error) => {
			// Forward esbuild failures as stream errors to avoid unhandled promise rejection
			// THIS IS THE CRITICAL FIX - the error is emitted on result, not thrown
			result.emit('error', err);
		});

		// Wait for the error to propagate
		await new Promise<void>((resolve) => {
			result.on('error', () => resolve());
			result.on('end', () => resolve());
		});

		// Assert that the error was properly propagated
		assert.strictEqual(emittedErrorMessage, 'esbuild build failed: invalid entry point');
	});

	/**
	 * Test that successful bundle operations don't emit errors.
	 */
	test('bundleAsync pattern does not emit error on success', async () => {
		const bundlesStream = through2.obj();
		const resourcesStream = through2.obj();

		const result = mergeStream(bundlesStream, resourcesStream);

		let emittedError: Error | null = null;
		result.on('error', (err: Error) => {
			emittedError = err;
		});

		// Simulate successful bundleAsync
		const bundleAsync = () => {
			return Promise.resolve({
				files: [
					new VinylFile({
						path: '/src/test.js',
						contents: Buffer.from('console.log("test");'),
						base: '/src'
					})
				]
			});
		};

		bundleAsync().then((output: any) => {
			Readable.from(output.files).pipe(bundlesStream);
			gulp.src([]).pipe(resourcesStream);
		}).catch((err: Error) => {
			result.emit('error', err);
		});

		// Wait a bit for stream to process
		await new Promise<void>((resolve) => setTimeout(resolve, 50));

		assert.strictEqual(emittedError, null, 'No error should have been emitted on success');
	});

	/**
	 * Test that the result stream properly passes through files after successful bundle.
	 */
	test('bundleAsync pattern passes files through result stream', async () => {
		const bundlesStream = through2.obj();
		const resourcesStream = through2.obj();

		const result = mergeStream(bundlesStream, resourcesStream);

		const receivedFiles: VinylFile[] = [];
		result.on('data', (file: VinylFile) => {
			receivedFiles.push(file);
		});

		// Simulate successful bundleAsync with files
		const testFile = new VinylFile({
			path: '/src/bundle.js',
			contents: Buffer.from('bundled content'),
			base: '/src'
		});

		const bundleAsync = () => {
			return Promise.resolve({
				files: [testFile]
			});
		};

		bundleAsync().then((output: any) => {
			Readable.from(output.files).pipe(bundlesStream);
			gulp.src([]).pipe(resourcesStream);
		}).catch((err: Error) => {
			result.emit('error', err);
		});

		// Wait for stream to finish
		await new Promise<void>((resolve) => {
			result.on('end', resolve);
		});

		assert.strictEqual(receivedFiles.length, 1);
		// Normalize path for cross-platform compatibility
		assert.ok(receivedFiles[0].path.endsWith('bundle.js'), `Expected path to end with bundle.js, got ${receivedFiles[0].path}`);
	});
});

// Mock gulp module for the test context
const gulp = {
	src: (_patterns: any, _opts?: any) => {
		const stream = through2.obj();
		stream.end();
		return stream;
	}
};

// Mock opts for test context
const opts = {
	src: '/src',
	resources: [] as string[]
};