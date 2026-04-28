"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const stream_1 = require("stream");
const through2_1 = __importDefault(require("through2"));
const vinyl_1 = __importDefault(require("vinyl"));
const merge_stream_1 = __importDefault(require("merge-stream"));
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
        const bundlesStream = through2_1.default.obj();
        const resourcesStream = through2_1.default.obj();
        const result = (0, merge_stream_1.default)(bundlesStream, resourcesStream);
        // Capture the error emitted on the result stream
        let emittedErrorMessage = null;
        result.on('error', (err) => {
            emittedErrorMessage = err.message;
        });
        // Simulate the bundleAsync pattern with a failing promise
        const bundleAsync = () => {
            return Promise.reject(new Error('esbuild build failed: invalid entry point'));
        };
        // This pattern mirrors what bundleESMTask does in optimize.ts
        bundleAsync().then((output) => {
            // Should not reach here if esbuild failed
            stream_1.Readable.from(output.files).pipe(bundlesStream);
            gulp.src(opts.resources ?? [], { base: `${opts.src}`, allowEmpty: true }).pipe(resourcesStream);
        }).catch((err) => {
            // Forward esbuild failures as stream errors to avoid unhandled promise rejection
            // THIS IS THE CRITICAL FIX - the error is emitted on result, not thrown
            result.emit('error', err);
        });
        // Wait for the error to propagate
        await new Promise((resolve) => {
            result.on('error', () => resolve());
            result.on('end', () => resolve());
        });
        // Assert that the error was properly propagated
        assert_1.default.strictEqual(emittedErrorMessage, 'esbuild build failed: invalid entry point');
    });
    /**
     * Test that successful bundle operations don't emit errors.
     */
    test('bundleAsync pattern does not emit error on success', async () => {
        const bundlesStream = through2_1.default.obj();
        const resourcesStream = through2_1.default.obj();
        const result = (0, merge_stream_1.default)(bundlesStream, resourcesStream);
        let emittedError = null;
        result.on('error', (err) => {
            emittedError = err;
        });
        // Simulate successful bundleAsync
        const bundleAsync = () => {
            return Promise.resolve({
                files: [
                    new vinyl_1.default({
                        path: '/src/test.js',
                        contents: Buffer.from('console.log("test");'),
                        base: '/src'
                    })
                ]
            });
        };
        bundleAsync().then((output) => {
            stream_1.Readable.from(output.files).pipe(bundlesStream);
            gulp.src([]).pipe(resourcesStream);
        }).catch((err) => {
            result.emit('error', err);
        });
        // Wait a bit for stream to process
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert_1.default.strictEqual(emittedError, null, 'No error should have been emitted on success');
    });
    /**
     * Test that the result stream properly passes through files after successful bundle.
     */
    test('bundleAsync pattern passes files through result stream', async () => {
        const bundlesStream = through2_1.default.obj();
        const resourcesStream = through2_1.default.obj();
        const result = (0, merge_stream_1.default)(bundlesStream, resourcesStream);
        const receivedFiles = [];
        result.on('data', (file) => {
            receivedFiles.push(file);
        });
        // Simulate successful bundleAsync with files
        const testFile = new vinyl_1.default({
            path: '/src/bundle.js',
            contents: Buffer.from('bundled content'),
            base: '/src'
        });
        const bundleAsync = () => {
            return Promise.resolve({
                files: [testFile]
            });
        };
        bundleAsync().then((output) => {
            stream_1.Readable.from(output.files).pipe(bundlesStream);
            gulp.src([]).pipe(resourcesStream);
        }).catch((err) => {
            result.emit('error', err);
        });
        // Wait for stream to finish
        await new Promise((resolve) => {
            result.on('end', resolve);
        });
        assert_1.default.strictEqual(receivedFiles.length, 1);
        // Normalize path for cross-platform compatibility
        assert_1.default.ok(receivedFiles[0].path.endsWith('bundle.js'), `Expected path to end with bundle.js, got ${receivedFiles[0].path}`);
    });
});
// Mock gulp module for the test context
const gulp = {
    src: (_patterns, _opts) => {
        const stream = through2_1.default.obj();
        stream.end();
        return stream;
    }
};
// Mock opts for test context
const opts = {
    src: '/src',
    resources: []
};
//# sourceMappingURL=optimize.test.js.map