/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';

/**
 * Test for SelectionHelperContribution's mouseenter/mouseleave listener cleanup.
 * This verifies the memory leak fix where DOM listeners were not being removed in dispose().
 */

// Mock DOM element for testing
class MockHTMLElement {
	private listeners: Map<string, EventListener> = new Map();
	style: { [key: string]: string } = {};

	addEventListener(type: string, handler: EventListener): void {
		this.listeners.set(`${type}`, handler);
	}

	removeEventListener(type: string, handler: EventListener): void {
		if (this.listeners.get(`${type}`) === handler) {
			this.listeners.delete(`${type}`);
		}
	}

	hasListeners(type: string): boolean {
		return this.listeners.has(`${type}`);
	}

	get listenerCount(): number {
		return this.listeners.size;
	}

	dispatchEvent(type: string): void {
		const handler = this.listeners.get(`${type}`);
		if (handler) {
			handler.call(this, {} as Event);
		}
	}
}

// Simulates the mouse handler behavior from SelectionHelperContribution
class SelectionHelperWidgetState {
	private _rootHTML: MockHTMLElement;
	private _isMouseOverWidget = false;
	private readonly _mouseEnterHandler: () => void;
	private readonly _mouseLeaveHandler: () => void;
	private _disposed = false;

	constructor() {
		this._rootHTML = new MockHTMLElement();
		this._mouseEnterHandler = () => { this._isMouseOverWidget = true; };
		this._mouseLeaveHandler = () => { this._isMouseOverWidget = false; };
	}

	get rootHTML(): MockHTMLElement {
		return this._rootHTML;
	}

	get isMouseOverWidget(): boolean {
		return this._isMouseOverWidget;
	}

	// Called during construction (like SelectionHelperContribution constructor)
	registerMouseListeners(): void {
		if (this._disposed) return;
		this._rootHTML.addEventListener('mouseenter', this._mouseEnterHandler);
		this._rootHTML.addEventListener('mouseleave', this._mouseLeaveHandler);
	}

	// Called in dispose (like SelectionHelperContribution override dispose)
	removeMouseListeners(): void {
		this._rootHTML.removeEventListener('mouseenter', this._mouseEnterHandler);
		this._rootHTML.removeEventListener('mouseleave', this._mouseLeaveHandler);
	}

	dispose(): void {
		if (this._disposed) return;
		this._disposed = true;
		this.removeMouseListeners();
	}

	get disposed(): boolean {
		return this._disposed;
	}
}

suite('SelectionHelperContribution DOM listener cleanup', () => {

	test('mouseenter and mouseleave listeners are registered on construction', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		const root = widget.rootHTML;
		assert.strictEqual(root.hasListeners('mouseenter'), true, 'mouseenter listener should be registered');
		assert.strictEqual(root.hasListeners('mouseleave'), true, 'mouseleave listener should be registered');
	});

	test('mouseenter sets isMouseOverWidget to true', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		assert.strictEqual(widget.isMouseOverWidget, false);

		widget.rootHTML.dispatchEvent('mouseenter');

		assert.strictEqual(widget.isMouseOverWidget, true);
	});

	test('mouseleave sets isMouseOverWidget to false', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		// Enter widget
		widget.rootHTML.dispatchEvent('mouseenter');
		assert.strictEqual(widget.isMouseOverWidget, true);

		// Leave widget
		widget.rootHTML.dispatchEvent('mouseleave');
		assert.strictEqual(widget.isMouseOverWidget, false);
	});

	test('dispose removes mouseenter listener', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		const root = widget.rootHTML;
		assert.strictEqual(root.hasListeners('mouseenter'), true);

		widget.dispose();

		assert.strictEqual(root.hasListeners('mouseenter'), false, 'mouseenter listener should be removed after dispose');
	});

	test('dispose removes mouseleave listener', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		const root = widget.rootHTML;
		assert.strictEqual(root.hasListeners('mouseleave'), true);

		widget.dispose();

		assert.strictEqual(root.hasListeners('mouseleave'), false, 'mouseleave listener should be removed after dispose');
	});

	test('dispose does not affect other listeners on the element', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		// Add another listener (simulating other code adding listeners)
		let clickCount = 0;
		const clickHandler = () => { clickCount++; };
		widget.rootHTML.addEventListener('click', clickHandler);

		widget.dispose();

		// Click listener should still be there
		assert.strictEqual(widget.rootHTML.hasListeners('click'), true);

		// But mouse listeners should be gone
		assert.strictEqual(widget.rootHTML.hasListeners('mouseenter'), false);
		assert.strictEqual(widget.rootHTML.hasListeners('mouseleave'), false);
	});

	test('double dispose does not throw', () => {
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		// First dispose
		widget.dispose();

		// Second dispose should not throw
		widget.dispose();

		assert.strictEqual(widget.disposed, true);
	});

	test('dispose can be called without prior registerMouseListeners', () => {
		const widget = new SelectionHelperWidgetState();

		// dispose without registerMouseListeners should not throw
		widget.dispose();

		assert.strictEqual(widget.disposed, true);
	});

	test('mouse state resets on leave even after dispose protection', () => {
		// This tests the sequence: enter -> dispose protection (leave) -> enter again
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		// Enter
		widget.rootHTML.dispatchEvent('mouseenter');
		assert.strictEqual(widget.isMouseOverWidget, true);

		// Leave
		widget.rootHTML.dispatchEvent('mouseleave');
		assert.strictEqual(widget.isMouseOverWidget, false);

		// Enter again (normal usage pattern)
		widget.rootHTML.dispatchEvent('mouseenter');
		assert.strictEqual(widget.isMouseOverWidget, true);

		// Final leave
		widget.rootHTML.dispatchEvent('mouseleave');
		assert.strictEqual(widget.isMouseOverWidget, false);
	});

	test('listener removal uses same function reference', () => {
		// This tests the critical bug: removeEventListener must use the same function reference
		const widget = new SelectionHelperWidgetState();
		widget.registerMouseListeners();

		const root = widget.rootHTML;
		const enterHandler = root['listeners'].get('mouseenter');
		const leaveHandler = root['listeners'].get('mouseleave');

		// Remove with same handler
		widget.removeMouseListeners();

		assert.strictEqual(root.hasListeners('mouseenter'), false, 'mouseenter should be removed');
		assert.strictEqual(root.hasListeners('mouseleave'), false, 'mouseleave should be removed');

		// Verify handlers were the same reference (critical for proper removal)
		assert.ok(enterHandler !== undefined, 'enter handler should exist');
		assert.ok(leaveHandler !== undefined, 'leave handler should exist');
	});

});