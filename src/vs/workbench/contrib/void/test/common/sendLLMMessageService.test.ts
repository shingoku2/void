/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { LLMMessageService } from '../sendLLMMessageService.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { IMCPService } from './mcpService.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';

// Helper to create a mock channel with event listeners
function createMockChannel() {
	const listeners: Record<string, Emitter<any>> = {};
	const onTextEmitter = new Emitter<any>();
	const onFinalMessageEmitter = new Emitter<any>();
	const onErrorEmitter = new Emitter<any>();

	listeners['onText_sendLLMMessage'] = onTextEmitter;
	listeners['onFinalMessage_sendLLMMessage'] = onFinalMessageEmitter;
	listeners['onError_sendLLMMessage'] = onErrorEmitter;

	const mockChannel: Partial<IChannel> = {
		listen: (event: string) => {
			const emitter = listeners[event];
			if (!emitter) {
				return new Emitter<any>().event;
			}
			return emitter.event;
		},
		call: async (command: string, params: any) => {
			if (command === 'sendLLMMessage') {
				return params.requestId;
			}
			if (command === 'abort') {
				return undefined;
			}
			return undefined;
		}
	};

	return { mockChannel, emitters: { onTextEmitter, onFinalMessageEmitter, onErrorEmitter } };
}

suite('LLMMessageService', () => {

	suite('_clearChannelHooks abort handler cleanup', () => {

		test('clears all hook types when abort is called', async () => {
			const { mockChannel, emitters } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			// Manually set up hooks for a request
			const requestId = 'test-request-123';
			(service as any).llmMessageHooks.onText[requestId] = () => {};
			(service as any).llmMessageHooks.onFinalMessage[requestId] = () => {};
			(service as any).llmMessageHooks.onError[requestId] = () => {};
			(service as any).llmMessageHooks.onAbort[requestId] = () => {};

			// Verify hooks are set
			assert.ok((service as any).llmMessageHooks.onText[requestId], 'onText hook should be set');
			assert.ok((service as any).llmMessageHooks.onFinalMessage[requestId], 'onFinalMessage hook should be set');
			assert.ok((service as any).llmMessageHooks.onError[requestId], 'onError hook should be set');
			assert.ok((service as any).llmMessageHooks.onAbort[requestId], 'onAbort hook should be set');

			// Call abort which should clear all hooks
			service.abort(requestId);

			// Verify all hooks are cleared
			assert.strictEqual((service as any).llmMessageHooks.onText[requestId], undefined, 'onText hook should be cleared');
			assert.strictEqual((service as any).llmMessageHooks.onFinalMessage[requestId], undefined, 'onFinalMessage hook should be cleared');
			assert.strictEqual((service as any).llmMessageHooks.onError[requestId], undefined, 'onError hook should be cleared');
			assert.strictEqual((service as any).llmMessageHooks.onAbort[requestId], undefined, 'onAbort hook should be cleared');

			service.dispose();
		});

		test('calling abort twice does not throw', async () => {
			const { mockChannel } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			const requestId = 'test-request-twice';
			(service as any).llmMessageHooks.onText[requestId] = () => {};
			(service as any).llmMessageHooks.onAbort[requestId] = () => {};

			// First abort should work
			service.abort(requestId);

			// Second abort should also not throw (hooks already cleared)
			assert.doesNotThrow(() => {
				service.abort(requestId);
			}, 'Calling abort twice should not throw');

			service.dispose();
		});

		test('abort does not affect other request hooks', async () => {
			const { mockChannel } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			const requestId1 = 'request-1';
			const requestId2 = 'request-2';

			(service as any).llmMessageHooks.onText[requestId1] = () => {};
			(service as any).llmMessageHooks.onAbort[requestId1] = () => {};
			(service as any).llmMessageHooks.onText[requestId2] = () => {};
			(service as any).llmMessageHooks.onAbort[requestId2] = () => {};

			// Abort request 1
			service.abort(requestId1);

			// Request 2 hooks should still be present
			assert.ok((service as any).llmMessageHooks.onText[requestId2], 'requestId2 onText should still be set');
			assert.ok((service as any).llmMessageHooks.onAbort[requestId2], 'requestId2 onAbort should still be set');
			assert.strictEqual((service as any).llmMessageHooks.onText[requestId1], undefined, 'requestId1 onText should be cleared');

			service.dispose();
		});

		test('list hooks are also cleared by _clearChannelHooks', async () => {
			const { mockChannel } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			const requestId = 'test-list-hooks';
			(service as any).listHooks.ollama.success[requestId] = () => {};
			(service as any).listHooks.ollama.error[requestId] = () => {};
			(service as any).listHooks.openAICompat.success[requestId] = () => {};
			(service as any).listHooks.openAICompat.error[requestId] = () => {};
			(service as any).healthCheckHooks.success[requestId] = () => {};
			(service as any).healthCheckHooks.error[requestId] = () => {};

			// Clear hooks directly (simulating what happens after message completes)
			(service as any)._clearChannelHooks(requestId);

			// All hook types should be cleared
			assert.strictEqual((service as any).listHooks.ollama.success[requestId], undefined);
			assert.strictEqual((service as any).listHooks.ollama.error[requestId], undefined);
			assert.strictEqual((service as any).listHooks.openAICompat.success[requestId], undefined);
			assert.strictEqual((service as any).listHooks.openAICompat.error[requestId], undefined);
			assert.strictEqual((service as any).healthCheckHooks.success[requestId], undefined);
			assert.strictEqual((service as any).healthCheckHooks.error[requestId], undefined);

			service.dispose();
		});

		test('onFinalMessage event clears hooks automatically', async () => {
			const { mockChannel, emitters } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			const requestId = 'auto-clear-test';

			// Set up hooks
			(service as any).llmMessageHooks.onText[requestId] = () => {};
			(service as any).llmMessageHooks.onFinalMessage[requestId] = () => {};
			(service as any).llmMessageHooks.onError[requestId] = () => {};

			// Fire the final message event (simulating what happens when LLM completes)
			emitters.onFinalMessageEmitter.fire({ requestId, fullText: 'completed' });

			// Hooks should be auto-cleared by the event handler
			assert.strictEqual((service as any).llmMessageHooks.onText[requestId], undefined);
			assert.strictEqual((service as any).llmMessageHooks.onFinalMessage[requestId], undefined);

			service.dispose();
		});

		test('onError event clears hooks automatically', async () => {
			const { mockChannel, emitters } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			const requestId = 'error-clear-test';

			// Set up hooks
			(service as any).llmMessageHooks.onText[requestId] = () => {};
			(service as any).llmMessageHooks.onFinalMessage[requestId] = () => {};
			(service as any).llmMessageHooks.onError[requestId] = () => {};

			// Fire the error event
			emitters.onErrorEmitter.fire({ requestId, message: 'error occurred' });

			// Hooks should be auto-cleared
			assert.strictEqual((service as any).llmMessageHooks.onText[requestId], undefined);
			assert.strictEqual((service as any).llmMessageHooks.onError[requestId], undefined);

			service.dispose();
		});

	});

	suite('sendLLMMessage validation', () => {

		test('returns null and calls onError when no model/provider selected', async () => {
			const { mockChannel } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {}, modelSelection: null } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			let errorCalled = false;
			let errorMessage = '';

			const result = service.sendLLMMessage({
				messagesType: 'FIMMessage',
				messages: { prefix: 'test', suffix: 'test', stopTokens: [] },
				modelSelection: null, // null model selection
				onText: () => {},
				onFinalMessage: () => {},
				onError: (e) => { errorCalled = true; errorMessage = e.message; },
				onAbort: () => {},
				logging: { loggingName: 'test' },
			});

			assert.strictEqual(result, null, 'Should return null when modelSelection is null');
			assert.strictEqual(errorCalled, true, 'onError should be called');
			assert.ok(errorMessage.includes('Please add a provider'), 'Error message should mention adding provider');

			service.dispose();
		});

		test('returns null and calls onError when no messages provided for chatMessages', async () => {
			const { mockChannel } = createMockChannel();

			const mockVoidSettingsService: Partial<IVoidSettingsService> = {
				state: { settingsOfProvider: {} } as any
			};

			const mockMCPService: Partial<IMCPService> = {
				getMCPTools: () => []
			};

			const service = new LLMMessageService(
				mockChannel as any,
				mockVoidSettingsService as any,
				mockMCPService as any
			);

			let errorCalled = false;

			const result = service.sendLLMMessage({
				messagesType: 'chatMessages',
				messages: [], // empty messages
				modelSelection: { providerName: 'test', modelName: 'test' } as any,
				onText: () => {},
				onFinalMessage: () => {},
				onError: (e) => { errorCalled = true; },
				onAbort: () => {},
				logging: { loggingName: 'test' },
			});

			assert.strictEqual(result, null, 'Should return null when messages is empty');
			assert.strictEqual(errorCalled, true, 'onError should be called');

			service.dispose();
		});

	});

});