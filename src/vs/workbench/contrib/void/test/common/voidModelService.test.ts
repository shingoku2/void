/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';

// Mock IReference for testing
class MockReference<T> {
	constructor(public object: T) {}
	dispose() {}
}

import { VoidModelService } from '../../common/voidModelService.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { ITextFileService } from '../../../../services/textfile/common/textfiles.js';

suite('VoidModelService', () => {

	suite('_modelRefOfURI LRU memory management', () => {

		test('cleans up oldest entries when exceeding max limit', async () => {
			// Create a mock text model service
			const createdRefs: Map<string, MockReference<any>> = new Map();

			const mockTextModelService = {
				async createModelReference(uri: URI) {
					const id = uri.fsPath;
					createdRefs.set(id, new MockReference({
						textEditorModel: {
							getValue: () => 'mock content',
							getLineCount: () => 1
						}
					}));
					return createdRefs.get(id)!;
				}
			};

			const mockTextFileService = {
				async save() { return true; }
			};

			const service = new VoidModelService(
				mockTextModelService as any as ITextModelService,
				mockTextFileService as any as ITextFileService
			);

			// Fill up to the limit (100 entries)
			const uris = [];
			for (let i = 0; i < 100; i++) {
				const uri = URI.file(`/test/file${i}.txt`);
				uris.push(uri);
				await service.initializeModel(uri);
			}

			// Verify we have 100 entries
			const keysAfterFill = Object.keys((service as any)._modelRefOfURI);
			assert.strictEqual(keysAfterFill.length, 100, 'Should have 100 entries after filling');

			// Now add one more - should trigger cleanup to ~50 entries
			const extraUri = URI.file('/test/extra.txt');
			await service.initializeModel(extraUri);

			// After cleanup, we should have fewer than 100 entries
			// The cleanup removes oldest half (first 50), so we should have ~51
			const keysAfterOverflow = Object.keys((service as any)._modelRefOfURI);
			assert.ok(keysAfterOverflow.length < 100, `Should have fewer than 100 entries after overflow cleanup, got ${keysAfterOverflow.length}`);

			// The extra file we just added should still be present
			assert.ok((service as any)._modelRefOfURI['/test/extra.txt'], 'New entry should be present after cleanup');

			service.dispose();
		});

		test('disposes references during cleanup to prevent memory leaks', async () => {
			const disposedRefs: Set<string> = new Set();

			const mockTextModelService = {
				async createModelReference(uri: URI) {
					const id = uri.fsPath;
					return {
						object: { textEditorModel: {} },
						dispose() {
							disposedRefs.add(id);
						}
					};
				}
			};

			const mockTextFileService = {
				async save() { return true; }
			};

			const service = new VoidModelService(
				mockTextModelService as any as ITextModelService,
				mockTextFileService as any as ITextFileService
			);

			// Add 150 entries to trigger cleanup
			for (let i = 0; i < 150; i++) {
				const uri = URI.file(`/test/dispose-test${i}.txt`);
				await service.initializeModel(uri);
			}

			// Some entries should have been disposed during cleanup
			assert.ok(disposedRefs.size > 0, 'Some entries should have been disposed during LRU cleanup');

			service.dispose();
		});

		test('dispose cleans up all remaining references', async () => {
			const disposedRefs: Set<string> = new Set();

			const mockTextModelService = {
				async createModelReference(uri: URI) {
					const id = uri.fsPath;
					return {
						object: { textEditorModel: {} },
						dispose() {
							disposedRefs.add(id);
						}
					};
				}
			};

			const mockTextFileService = {
				async save() { return true; }
			};

			const service = new VoidModelService(
				mockTextModelService as any as ITextModelService,
				mockTextFileService as any as ITextFileService
			);

			// Add some entries
			await service.initializeModel(URI.file('/test/dispose-all-1.txt'));
			await service.initializeModel(URI.file('/test/dispose-all-2.txt'));

			service.dispose();

			// All entries should be disposed
			assert.ok(disposedRefs.has('/test/dispose-all-1.txt'), 'First entry should be disposed');
			assert.ok(disposedRefs.has('/test/dispose-all-2.txt'), 'Second entry should be disposed');
		});

		test('initializeModel is idempotent - calling twice for same URI does not create duplicate', async () => {
			let createCount = 0;

			const mockTextModelService = {
				async createModelReference(uri: URI) {
					createCount++;
					return {
						object: { textEditorModel: {} },
						dispose() {}
					};
				}
			};

			const mockTextFileService = {
				async save() { return true; }
			};

			const service = new VoidModelService(
				mockTextModelService as any as ITextModelService,
				mockTextFileService as any as ITextFileService
			);

			const uri = URI.file('/test/idempotent.txt');

			// Call initializeModel twice for the same URI
			await service.initializeModel(uri);
			await service.initializeModel(uri);

			// Should only have created the model once
			assert.strictEqual(createCount, 1, 'Should only create model reference once for same URI');

			service.dispose();
		});

	});

});