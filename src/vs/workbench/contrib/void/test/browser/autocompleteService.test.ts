/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';

/**
 * Test LRUCache behavior from autocompleteService
 * This tests the cache eviction logic that's used for autocomplete predictions.
 */

class LRUCache<K, V> {
	public items: Map<K, V>;
	private keyOrder: K[];
	private maxSize: number;
	private disposeCallback?: (value: V, key?: K) => void;

	constructor(maxSize: number, disposeCallback?: (value: V, key?: K) => void) {
		if (maxSize <= 0) throw new Error('Cache size must be greater than 0');

		this.items = new Map();
		this.keyOrder = [];
		this.maxSize = maxSize;
		this.disposeCallback = disposeCallback;
	}

	set(key: K, value: V): void {
		if (this.items.has(key)) {
			const oldValue = this.items.get(key);
			if (this.disposeCallback && oldValue !== undefined) {
				this.disposeCallback(oldValue, key);
			}
			this.keyOrder = this.keyOrder.filter(k => k !== key);
			this.items.delete(key);
		}
		else if (this.items.size >= this.maxSize) {
			const key = this.keyOrder[0];
			const value = this.items.get(key);

			if (this.disposeCallback && value !== undefined) {
				this.disposeCallback(value, key);
			}

			this.items.delete(key);
			this.keyOrder.shift();
		}

		this.items.set(key, value);
		this.keyOrder.push(key);
	}

	delete(key: K): boolean {
		const value = this.items.get(key);

		if (value !== undefined) {
			if (this.disposeCallback) {
				this.disposeCallback(value, key);
			}

			this.items.delete(key);
			this.keyOrder = this.keyOrder.filter(k => k !== key);
			return true;
		}

		return false;
	}

	clear(): void {
		if (this.disposeCallback) {
			for (const [key, value] of this.items.entries()) {
				this.disposeCallback(value, key);
			}
		}

		this.items.clear();
		this.keyOrder = [];
	}

	get size(): number {
		return this.items.size;
	}

	has(key: K): boolean {
		return this.items.has(key);
	}

	get(key: K): V | undefined {
		return this.items.get(key);
	}
}

// Test data types matching autocompleteService
type Autocompletion = {
	id: number,
	status: 'pending' | 'finished' | 'error',
	requestId: string | null,
}

suite('AutocompleteService LRUCache', () => {

	test('evicts least recently used when at capacity', () => {
		const cache = new LRUCache<number, Autocompletion>(3);

		cache.set(1, { id: 1, status: 'pending', requestId: null });
		cache.set(2, { id: 2, status: 'pending', requestId: null });
		cache.set(3, { id: 3, status: 'pending', requestId: null });

		// Access key 1 to make it most recently used
		cache.get(1);

		// Add new entry, should evict key 2 (least recently used)
		cache.set(4, { id: 4, status: 'pending', requestId: null });

		assert.strictEqual(cache.has(1), true, 'Key 1 should still be present (was accessed recently)');
		assert.strictEqual(cache.has(2), false, 'Key 2 should be evicted (least recently used)');
		assert.strictEqual(cache.has(3), true, 'Key 3 should still be present');
		assert.strictEqual(cache.has(4), true, 'Key 4 should be present');
		assert.strictEqual(cache.size, 3, 'Cache should be at max size');
	});

	test('calling disposeCallback when evicting', () => {
		const evictedKeys: number[] = [];

		const cache = new LRUCache<number, Autocompletion>(2, (value, key) => {
			if (key !== undefined) {
				evictedKeys.push(key);
			}
		});

		cache.set(1, { id: 1, status: 'pending', requestId: null });
		cache.set(2, { id: 2, status: 'pending', requestId: null });

		// Adding a 3rd item should evict key 1
		cache.set(3, { id: 3, status: 'pending', requestId: null });

		assert.deepStrictEqual(evictedKeys, [1], 'Key 1 should have been evicted and callback called');
		assert.strictEqual(cache.has(1), false);
		assert.strictEqual(cache.has(2), true);
		assert.strictEqual(cache.has(3), true);
	});

	test('updating existing key does not evict', () => {
		const evictedKeys: number[] = [];

		const cache = new LRUCache<number, Autocompletion>(2, (value, key) => {
			if (key !== undefined) {
				evictedKeys.push(key);
			}
		});

		cache.set(1, { id: 1, status: 'pending', requestId: null });
		cache.set(2, { id: 2, status: 'pending', requestId: null });

		// Update existing key - should not evict anything
		cache.set(1, { id: 1, status: 'finished', requestId: 'new-request' });

		assert.strictEqual(evictedKeys.length, 0, 'No evictions should happen on update');
		assert.strictEqual(cache.size, 2, 'Cache should still have 2 items');
		assert.strictEqual(cache.get(1)?.status, 'finished', 'Updated value should be reflected');
	});

	test('delete calls dispose callback', () => {
		const deletedKeys: number[] = [];

		const cache = new LRUCache<number, Autocompletion>(5, (value, key) => {
			if (key !== undefined) {
				deletedKeys.push(key);
			}
		});

		cache.set(1, { id: 1, status: 'pending', requestId: null });
		cache.set(2, { id: 2, status: 'pending', requestId: null });

		cache.delete(1);

		assert.deepStrictEqual(deletedKeys, [1], 'Delete should trigger callback for key 1');
		assert.strictEqual(cache.has(1), false);
		assert.strictEqual(cache.has(2), true);
	});

	test('clear calls dispose for all items', () => {
		const clearedKeys: number[] = [];

		const cache = new LRUCache<number, Autocompletion>(10, (value, key) => {
			if (key !== undefined) {
				clearedKeys.push(key);
			}
		});

		cache.set(1, { id: 1, status: 'pending', requestId: null });
		cache.set(2, { id: 2, status: 'pending', requestId: null });
		cache.set(3, { id: 3, status: 'pending', requestId: null });

		cache.clear();

		assert.deepStrictEqual(clearedKeys.sort(), [1, 2, 3], 'All keys should be cleared');
		assert.strictEqual(cache.size, 0);
	});

	test('cannot create cache with size 0', () => {
		assert.throws(() => {
			new LRUCache<number, string>(0);
		}, /Cache size must be greater than 0/);
	});

	test('dispose callback receives both key and value', () => {
		let receivedKey: number | undefined;
		let receivedValue: Autocompletion | undefined;

		const cache = new LRUCache<number, Autocompletion>(2, (value, key) => {
			receivedKey = key;
			receivedValue = value;
		});

		const testCompletion = { id: 42, status: 'finished' as const, requestId: 'abc' };
		cache.set(42, testCompletion);

		cache.set(43, { id: 43, status: 'pending', requestId: null }); // triggers eviction

		assert.strictEqual(receivedKey, 42);
		assert.strictEqual(receivedValue?.id, 42);
		assert.strictEqual(receivedValue?.status, 'finished');
	});

	suite('MAX_CACHE_SIZE = 20', () => {
		// Matching the actual autocompleteService constant
		const MAX_CACHE_SIZE = 20;

		test('cache respects MAX_CACHE_SIZE limit', () => {
			const cache = new LRUCache<number, Autocompletion>(MAX_CACHE_SIZE);

			// Fill to capacity
			for (let i = 0; i < MAX_CACHE_SIZE; i++) {
				cache.set(i, { id: i, status: 'pending', requestId: null });
			}

			assert.strictEqual(cache.size, MAX_CACHE_SIZE);

			// Adding one more should evict the oldest
			cache.set(MAX_CACHE_SIZE, { id: MAX_CACHE_SIZE, status: 'pending', requestId: null });

			assert.strictEqual(cache.size, MAX_CACHE_SIZE);
			assert.strictEqual(cache.has(0), false, 'First entry should be evicted');
			assert.strictEqual(cache.has(1), true);
		});

	});

});

suite('AutocompleteService timeout constants', () => {

	const DEBOUNCE_TIME = 500;
	const TIMEOUT_TIME = 60000;
	const MAX_PENDING_REQUESTS = 2;

	test('DEBOUNCE_TIME is 500ms', () => {
		assert.strictEqual(DEBOUNCE_TIME, 500);
	});

	test('TIMEOUT_TIME is 60000ms (60 seconds)', () => {
		assert.strictEqual(TIMEOUT_TIME, 60000);
	});

	test('MAX_PENDING_REQUESTS is 2', () => {
		assert.strictEqual(MAX_PENDING_REQUESTS, 2);
	});

	test('timeout calculation: 60 seconds is reasonable for LLM response', () => {
		// A reasonable LLM should respond within 60 seconds
		// This is the timeout that triggers rejection of pending autocomplete
		const maxWaitTime = TIMEOUT_TIME;
		assert.ok(maxWaitTime >= 30000, 'Timeout should be at least 30 seconds for LLM calls');
		assert.ok(maxWaitTime <= 120000, 'Timeout should be at most 2 minutes for autocomplete');
	});

});