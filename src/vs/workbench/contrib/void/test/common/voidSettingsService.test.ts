/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { IEncryptionService } from '../../../../../platform/encryption/common/encryptionService.js';
import { IStorageService, StorageScope } from '../../../../../platform/storage/common/storage.js';
import { IMetricsService } from '../metricsService.js';

// Mock implementations for testing
class MockStorageService implements Partial<IStorageService> {
	private store: Map<string, string> = new Map();

	get(key: string, _scope: StorageScope): string | undefined {
		return this.store.get(key);
	}

	store(key: string, value: string, _scope: StorageScope, _target: any): void {
		this.store.set(key, value);
	}

	remove(key: string, _scope: StorageScope): void {
		this.store.delete(key);
	}
}

class MockEncryptionService implements Partial<IEncryptionService> {
	async encrypt(data: string): Promise<string> {
		return Buffer.from(data).toString('base64');
	}

	async decrypt(data: string): Promise<string> {
		return Buffer.from(data, 'base64').toString();
	}
}

class MockMetricsService implements Partial<IMetricsService> {
	capture(_event: string, _data?: object): void { }
}

// Import after mocks are defined
import { VoidSettingsService, IVoidSettingsService } from '../voidSettingsService.js';
import { VOID_SETTINGS_STORAGE_KEY } from '../storageKeys.js';
import { defaultState } from '../voidSettingsService.js';

suite('VoidSettingsService', () => {

	suite('_readState error handling', () => {

		test('falls back to default state when storage returns null', async () => {
			const storageService = new MockStorageService() as any;
			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			// Should have default state since storage returned nothing
			const defaultSt = defaultState();
			assert.strictEqual(service.state.settingsOfProvider, defaultSt.settingsOfProvider);
			assert.strictEqual(service.state.globalSettings, defaultSt.globalSettings);
		});

		test('falls back to default state when encrypted data is corrupt', async () => {
			const storageService = new MockStorageService() as any;
			// Store corrupted base64 data (valid base64 but not valid JSON after decryption)
			storageService.store(VOID_SETTINGS_STORAGE_KEY, 'corrupted_invalid_data', StorageScope.APPLICATION, null);

			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			// Should have default state, not crash
			const defaultSt = defaultState();
			assert.strictEqual(service.state.globalSettings, defaultSt.globalSettings);
		});

		test('falls back to default state when JSON.parse throws', async () => {
			const storageService = new MockStorageService() as any;

			// Create valid base64 that decodes to invalid JSON
			const invalidJson = '{ invalid json that will not parse';
			const validBase64 = Buffer.from(invalidJson).toString('base64');
			storageService.store(VOID_SETTINGS_STORAGE_KEY, validBase64, StorageScope.APPLICATION, null);

			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			// Should fall back to defaults when JSON.parse fails
			const defaultSt = defaultState();
			assert.deepStrictEqual(service.state.globalSettings, defaultSt.globalSettings);
		});

		test('loads valid state from storage without errors', async () => {
			const storageService = new MockStorageService() as any;

			// Create valid state and encrypt it
			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const validState = defaultState();
			const encryptedState = await encryptionService.encrypt(JSON.stringify(validState));
			storageService.store(VOID_SETTINGS_STORAGE_KEY, encryptedState, StorageScope.APPLICATION, null);

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			// Should load the state correctly
			assert.strictEqual(service.state.globalSettings.autoApprove, defaultState().globalSettings.autoApprove);
		});

		test('setGlobalSetting stores state and fires change event', async () => {
			const storageService = new MockStorageService() as any;
			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			let changeCount = 0;
			service.onDidChangeState(() => changeCount++);

			// Set a global setting
			await service.setGlobalSetting('chatMode', 'agent');

			assert.strictEqual(changeCount, 1);
			assert.strictEqual(service.state.globalSettings.chatMode, 'agent');
		});

	});

	suite('dispose behavior', () => {

		test('service can be disposed without errors', async () => {
			const storageService = new MockStorageService() as any;
			const encryptionService = new MockEncryptionService() as any;
			const metricsService = new MockMetricsService() as any;

			const service = new VoidSettingsService(
				storageService,
				encryptionService,
				metricsService
			);

			await service.waitForInitState;

			// Should not throw on dispose
			service.dispose();
		});

	});

});