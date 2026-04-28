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
const through2_1 = __importDefault(require("through2"));
const vinyl_1 = __importDefault(require("vinyl"));
const path_1 = __importDefault(require("path"));
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
    function createNlsLikeStream(_options) {
        let base;
        let hasSourcemap = false;
        const input = through2_1.default.obj();
        const output = input
            .pipe(through2_1.default.obj(function (f, _enc, cb) {
            // Transform function - processes each file
            if (!f.sourceMap || !/\.js$/.test(f.path)) {
                return cb(null, f);
            }
            let source = f.sourceMap.sources[0];
            if (!source) {
                return cb(null, f);
            }
            const root = f.sourceMap.sourceRoot;
            if (root) {
                source = path_1.default.join(root, source);
            }
            const typescript = f.sourceMap.sourcesContent?.[0];
            if (!typescript) {
                cb(new Error(`File ${f.relative} does not have the original content in the source map.`));
                return;
            }
            base = f.base;
            hasSourcemap = true;
            // Simulate NLS patching - in real code this calls _nls.patchFile
            const patchedContent = (f.contents ?? Buffer.from('')).toString('utf8') + '/* patched */';
            const patchedFile = new vinyl_1.default({
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
                    new vinyl_1.default({
                        contents: Buffer.from(JSON.stringify({
                            keys: { 'test/module': ['key1', 'key2'] },
                            messages: { 'test/module': ['message1', 'message2'] }
                        }, null, '\t')),
                        base,
                        path: `${base}/nls.metadata.json`
                    }),
                    new vinyl_1.default({
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
    function createDuplex(input, output) {
        const { Duplex } = require('stream');
        const combined = new Duplex({
            objectMode: true,
            write(chunk, enc, cb) {
                if (input.write(chunk, enc)) {
                    cb();
                }
                else {
                    input.once('drain', cb);
                }
            },
            final(cb) {
                input.end();
                cb();
            },
            read() { }
        });
        output.on('data', (chunk) => {
            if (!combined.push(chunk) && typeof output.pause === 'function') {
                output.pause();
            }
        });
        combined.on('drain', () => {
            if (typeof output.resume === 'function') {
                output.resume();
            }
        });
        output.on('end', () => combined.push(null));
        output.on('error', (err) => combined.destroy(err));
        input.on('error', (err) => combined.destroy(err));
        return combined;
    }
    test('through2.obj transform callback receives file and can emit processed file', (done) => {
        const nlsStream = createNlsLikeStream({ preserveEnglish: true });
        const receivedFiles = [];
        nlsStream.on('data', (file) => {
            receivedFiles.push(file);
        });
        nlsStream.on('end', () => {
            // Should have received the original file (patched) plus NLS metadata files
            assert_1.default.ok(receivedFiles.length >= 1, 'Should receive at least one file');
            done();
        });
        // Send a file without sourcemap - should pass through unchanged
        const testFile = new vinyl_1.default({
            path: '/src/test/no-sourcemap.js',
            contents: Buffer.from('console.log("test");'),
            base: '/src'
        });
        nlsStream.write(testFile);
        nlsStream.end();
    });
    test('through2.obj flush callback emits additional files at end', (done) => {
        const nlsStream = createNlsLikeStream({ preserveEnglish: true });
        const receivedFiles = [];
        nlsStream.on('data', (file) => {
            receivedFiles.push(file);
        });
        nlsStream.on('end', () => {
            // Should have received the original file plus NLS metadata and messages files
            assert_1.default.strictEqual(receivedFiles.length, 3, 'Should receive original + 2 NLS files');
            const nlsMetadata = receivedFiles.find(f => f.path.endsWith('nls.metadata.json'));
            const nlsMessages = receivedFiles.find(f => f.path.endsWith('nls.messages.json'));
            assert_1.default.ok(nlsMetadata, 'Should have nls.metadata.json');
            assert_1.default.ok(nlsMessages, 'Should have nls.messages.json');
            done();
        });
        // Send a file with sourcemap
        const testFileWithSourcemap = new vinyl_1.default({
            path: '/src/test/with-sourcemap.js',
            contents: Buffer.from('console.log("test");'),
            base: '/src',
            sourceMap: {
                version: 3,
                sources: ['test/with-sourcemap.ts'],
                sourcesContent: ['console.log("test");'],
                mappings: 'AAAA'
            }
        });
        nlsStream.write(testFileWithSourcemap);
        nlsStream.end();
    });
    test('through2.obj flush callback is called when stream ends', (done) => {
        let flushCalled = false;
        const input = through2_1.default.obj();
        const output = input
            .pipe(through2_1.default.obj(function (f, _enc, cb) {
            cb(null, f);
        }, function (cb) {
            // This is the flush function - should be called on stream end
            flushCalled = true;
            this.push(new vinyl_1.default({
                path: '/src/flush-file.json',
                contents: Buffer.from('{"flushed": true}'),
                base: '/src'
            }));
            cb();
        }));
        const { Duplex } = require('stream');
        const combined = new Duplex({
            objectMode: true,
            write(chunk, enc, cb) {
                if (input.write(chunk, enc)) {
                    cb();
                }
                else {
                    input.once('drain', cb);
                }
            },
            final(cb) {
                input.end();
                cb();
            },
            read() { }
        });
        output.on('data', (chunk) => combined.push(chunk));
        output.on('end', () => combined.push(null));
        output.on('error', (err) => combined.destroy(err));
        input.on('error', (err) => combined.destroy(err));
        const receivedFiles = [];
        combined.on('data', (file) => {
            receivedFiles.push(file);
        });
        combined.on('end', () => {
            assert_1.default.strictEqual(flushCalled, true, 'Flush callback should have been called');
            assert_1.default.strictEqual(receivedFiles.length, 2, 'Should receive input file + flushed file');
            done();
        });
        combined.write(new vinyl_1.default({
            path: '/src/input.js',
            contents: Buffer.from('input'),
            base: '/src'
        }));
        combined.end();
    });
    test('through2.obj handles non-JS files by passing through unchanged', (done) => {
        // Test using simple through2 stream to verify the pattern
        const input = through2_1.default.obj();
        const output = input.pipe(through2_1.default.obj(function (f, _enc, cb) {
            // If not a JS file with sourcemap, pass through unchanged
            if (!f.sourceMap || !/\.js$/.test(f.path)) {
                return cb(null, f);
            }
            cb(null, f);
        }));
        const { Duplex } = require('stream');
        const combined = new Duplex({
            objectMode: true,
            write(chunk, enc, cb) {
                if (input.write(chunk, enc)) {
                    cb();
                }
                else {
                    input.once('drain', cb);
                }
            },
            final(cb) {
                input.end();
                cb();
            },
            read() { }
        });
        output.on('data', (chunk) => combined.push(chunk));
        output.on('end', () => combined.push(null));
        output.on('error', (err) => combined.destroy(err));
        input.on('error', (err) => combined.destroy(err));
        const receivedFiles = [];
        combined.on('data', (file) => {
            receivedFiles.push(file);
        });
        combined.on('end', () => {
            // CSS file should pass through unchanged
            const processedFile = receivedFiles.find(f => f.path.endsWith('.css'));
            assert_1.default.ok(processedFile, 'CSS file should pass through');
            assert_1.default.strictEqual((processedFile?.contents ?? Buffer.from('')).toString(), 'body { color: red; }', 'CSS content unchanged');
            done();
        });
        // Send a CSS file - should pass through unchanged
        const cssFile = new vinyl_1.default({
            path: '/src/test/style.css',
            contents: Buffer.from('body { color: red; }'),
            base: '/src'
        });
        combined.write(cssFile);
        combined.end();
    });
});
//# sourceMappingURL=nls.test.js.map