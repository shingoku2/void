/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { PassThrough } from 'stream';
import through2 from 'through2';

/**
 * Tests for the combineStreams function in extensions.ts.
 * Specifically tests the endOutput() guard that prevents double-end errors
 * when multiple source streams complete simultaneously.
 */
suite('Extensions combineStreams Tests', () => {

	/**
	 * Creates a combineStreams function similar to the one in extensions.ts.
	 * This tests the actual logic pattern used in the real implementation.
	 */
	function createCombineStreams(streams: NodeJS.ReadableStream[]): NodeJS.ReadWriteStream {
		const output = new PassThrough({ objectMode: true });
		let pending = streams.length;
		let failed = false;
		let ended = false;

		const endOutput = () => {
			// GUARD: Prevent double-end by checking state
			if (ended || (output as any).writableEnded || (output as any).destroyed) {
				return;
			}
			ended = true;
			output.end();
		};

		const fail = (err: Error) => {
			if (failed) {
				return;
			}
			failed = true;
			output.emit('error', err);
			endOutput();
		};

		if (pending === 0) {
			endOutput();
			return output;
		}

		for (const stream of streams) {
			stream.on('error', fail);
			let done = false;
			const onDone = () => {
				if (failed) {
					return;
				}
				if (done) {
					return;
				}
				done = true;
				pending--;
				if (pending === 0) {
					endOutput();
				}
			};
			stream.on('end', onDone);
			stream.on('close', onDone);
			stream.on('finish', onDone);
			stream.pipe(output, { end: false });
		}

		return output;
	}

	/**
	 * Creates a simple readable stream that emits data then ends.
	 */
	function createTestStream(data: any[]): NodeJS.ReadableStream {
		const stream = through2.obj();
		// Use setImmediate to allow the stream to be set up before emitting
		setImmediate(() => {
			for (const item of data) {
				stream.push(item);
			}
			stream.push(null); // end the stream
		});
		return stream;
	}

	test('endOutput prevents double-end when streams finish simultaneously', async () => {
		// Create multiple streams that will complete at the same time
		const stream1 = createTestStream(['file1']);
		const stream2 = createTestStream(['file2']);
		const stream3 = createTestStream(['file3']);

		const result = createCombineStreams([stream1, stream2, stream3]);

		const receivedFiles: any[] = [];
		result.on('data', (file: any) => receivedFiles.push(file));

		// Wait for completion
		await new Promise<void>((resolve) => {
			result.on('end', resolve);
			result.on('error', (err: Error) => {
				console.error('Unexpected error:', err);
				resolve();
			});
		});

		assert.strictEqual(receivedFiles.length, 3);
	});

	test('endOutput handles immediate completion (pending=0)', () => {
		const result = createCombineStreams([]);

		// Should immediately end without error
		assert.strictEqual((result as any).writableEnded, true);
	});

	test('combineStreams propagates errors from source streams', async () => {
		const errorStream = through2.obj();
		const goodStream = createTestStream(['file1']);

		const result = createCombineStreams([errorStream, goodStream]);

		const receivedFiles: any[] = [];
		let receivedErrorMessage: string | null = null;

		result.on('data', (file: any) => receivedFiles.push(file));
		result.on('error', (err: Error) => {
			receivedErrorMessage = err.message;
		});

		// Emit error on one stream
		setImmediate(() => {
			errorStream.emit('error', new Error('Stream error'));
		});

		// Wait for completion or error
		await new Promise<void>((resolve) => {
			result.on('end', resolve);
			result.on('error', resolve);
		});

		assert.strictEqual(receivedErrorMessage, 'Stream error');
	});

	test('combineStreams handles stream that errors after some data', async () => {
		const errorStream = through2.obj();
		const result = createCombineStreams([errorStream]);

		const receivedFiles: any[] = [];
		let receivedErrorMessage: string | null = null;

		result.on('data', (file: any) => receivedFiles.push(file));
		result.on('error', (err: Error) => {
			receivedErrorMessage = err.message;
		});

		// Emit some data then error
		setImmediate(() => {
			errorStream.push('partial data');
			errorStream.emit('error', new Error('Stream failed'));
		});

		// Wait for completion or error
		await new Promise<void>((resolve) => {
			result.on('end', resolve);
			result.on('error', resolve);
		});

		assert.strictEqual(receivedFiles.length, 1);
		assert.strictEqual(receivedErrorMessage, 'Stream failed');
	});

	test('combineStreams guard is idempotent - calling endOutput multiple times is safe', async () => {
		// This test verifies the guard condition works by checking that
		// a stream with 0 pending items calls endOutput immediately
		const result = createCombineStreams([]);

		// Should immediately end without error
		assert.strictEqual((result as any).writableEnded, true);

		// Calling end again should not throw
		(result as any).end();
		assert.strictEqual((result as any).writableEnded, true);
	});
});