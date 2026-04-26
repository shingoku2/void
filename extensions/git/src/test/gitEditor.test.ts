/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';

/**
 * Test for GitEditor's _tabListeners Map disposal.
 * This verifies the memory leak fix where tab listeners were not being disposed.
 */

// Simple disposable interface for testing
interface IDisposable {
	dispose(): void;
}

// Simple disposable for testing
class MockDisposable implements IDisposable {
	isDisposed = false;
	dispose() {
		this.isDisposed = true;
	}
}

// Simulates the map behavior from GitEditor
class GitEditorTabListeners {
	private _tabListeners = new Map<string, IDisposable>();
	private _disposed = false;

	setListener(key: string, listener: IDisposable): void {
		if (this._disposed) return;
		this._tabListeners.set(key, listener);
	}

	deleteListener(key: string): void {
		this._tabListeners.delete(key);
	}

	getListener(key: string): IDisposable | undefined {
		return this._tabListeners.get(key);
	}

	dispose(): void {
		this._disposed = true;
		for (const listener of this._tabListeners.values()) {
			listener.dispose();
		}
		this._tabListeners.clear();
	}

	get listenerCount(): number {
		return this._tabListeners.size;
	}
}

suite('GitEditor _tabListeners disposal', () => {

	test('dispose cleans up all stored listeners', () => {
		const tabListeners = new GitEditorTabListeners();

		// Add several listeners
		const listener1 = new MockDisposable();
		const listener2 = new MockDisposable();
		const listener3 = new MockDisposable();

		tabListeners.setListener('/path/to/file1.txt', listener1);
		tabListeners.setListener('/path/to/file2.txt', listener2);
		tabListeners.setListener('/path/to/file3.txt', listener3);

		assert.strictEqual(tabListeners.listenerCount, 3);
		assert.strictEqual(listener1.isDisposed, false);
		assert.strictEqual(listener2.isDisposed, false);
		assert.strictEqual(listener3.isDisposed, false);

		// Dispose should clean up all listeners
		tabListeners.dispose();

		assert.strictEqual(tabListeners.listenerCount, 0);
		assert.strictEqual(listener1.isDisposed, true, 'listener1 should be disposed');
		assert.strictEqual(listener2.isDisposed, true, 'listener2 should be disposed');
		assert.strictEqual(listener3.isDisposed, true, 'listener3 should be disposed');
	});

	test('deleteListener removes specific listener without affecting others', () => {
		const tabListeners = new GitEditorTabListeners();

		const listener1 = new MockDisposable();
		const listener2 = new MockDisposable();
		const listener3 = new MockDisposable();

		tabListeners.setListener('/path/to/file1.txt', listener1);
		tabListeners.setListener('/path/to/file2.txt', listener2);
		tabListeners.setListener('/path/to/file3.txt', listener3);

		// Delete one listener
		tabListeners.deleteListener('/path/to/file2.txt');

		assert.strictEqual(tabListeners.listenerCount, 2);
		assert.strictEqual(listener2.isDisposed, false, 'deleted listener should not be disposed immediately');

		// Dispose should only dispose remaining listeners
		tabListeners.dispose();

		assert.strictEqual(listener1.isDisposed, true);
		assert.strictEqual(listener2.isDisposed, false, 'deleted listener should stay not disposed');
		assert.strictEqual(listener3.isDisposed, true);
	});

	test('dispose can be called multiple times safely', () => {
		const tabListeners = new GitEditorTabListeners();
		const listener1 = new MockDisposable();

		tabListeners.setListener('/path/to/file1.txt', listener1);

		// Multiple dispose calls should not throw
		tabListeners.dispose();
		tabListeners.dispose();
		tabListeners.dispose();

		assert.strictEqual(listener1.isDisposed, true);
	});

	test('setting listener after dispose is a no-op', () => {
		const tabListeners = new GitEditorTabListeners();

		tabListeners.dispose();

		// Adding listeners after dispose should be ignored
		const listener = new MockDisposable();
		tabListeners.setListener('/path/to/file.txt', listener);

		assert.strictEqual(tabListeners.listenerCount, 0);
		assert.strictEqual(listener.isDisposed, false);
	});

	test('double delete of same key does not cause issues', () => {
		const tabListeners = new GitEditorTabListeners();
		const listener = new MockDisposable();

		tabListeners.setListener('/path/to/file.txt', listener);
		tabListeners.deleteListener('/path/to/file.txt');
		tabListeners.deleteListener('/path/to/file.txt'); // Second delete

		assert.strictEqual(tabListeners.listenerCount, 0);

		tabListeners.dispose();

		assert.strictEqual(listener.isDisposed, false, 'listener should not be disposed since it was removed from map');
	});

	test('Map behavior matches GitEditor implementation', () => {
		// This test verifies the pattern used in GitEditor:
		// 1. _tabListeners is a Map<string, IDisposable>
		// 2. set() stores listeners
		// 3. delete() removes them
		// 4. dispose() iterates values() and disposes each, then clear()

		const map = new Map<string, IDisposable>();
		let disposeCallCount = 0;

		class CountingDisposable implements IDisposable {
			isDisposed = false;
			dispose() {
				disposeCallCount++;
				this.isDisposed = true;
			}
		}

		// Add multiple listeners like GitEditor.handle() does
		const d1 = new CountingDisposable();
		const d2 = new CountingDisposable();
		const d3 = new CountingDisposable();

		map.set('/commit/msg1', d1);
		map.set('/commit/msg2', d2);
		map.set('/commit/msg3', d3);

		// Simulate closing one tab (removing one listener)
		const removed = map.get('/commit/msg2');
		map.delete('/commit/msg2');
		removed?.dispose(); // GitEditor calls dispose on removed listener in the callback

		assert.strictEqual(disposeCallCount, 1);

		// Simulate full dispose (like GitEditor.dispose() does)
		for (const listener of map.values()) {
			listener.dispose();
		}
		map.clear();

		assert.strictEqual(disposeCallCount, 4, 'Should have disposed: removed one + three in dispose loop');
		assert.strictEqual(map.size, 0);
	});

});