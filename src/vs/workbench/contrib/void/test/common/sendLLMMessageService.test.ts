import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { LLMMessageService } from '../../common/sendLLMMessageService.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { IMCPService } from '../../common/mcpService.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';

suite('LLMMessageService', () => {

	test('providerHealthCheck calls the channel and handles response', async () => {
		
		const onSuccessEmitter = new Emitter<any>();
		const onErrorEmitter = new Emitter<any>();

		const mockChannel: Partial<IChannel> = {
			listen: (event: string) => {
				if (event === 'onSuccess_providerHealthCheck') return onSuccessEmitter.event;
				if (event === 'onError_providerHealthCheck') return onErrorEmitter.event;
				return new Emitter().event;
			},
			call: async (command: string, params: any) => {
				if (command === 'providerHealthCheck') {
					// Simulate main process responding via emitter
					onSuccessEmitter.fire({ requestId: params.requestId, message: 'OK' });
				}
				return;
			}
		};

		const mockMainProcessService: Partial<IMainProcessService> = {
			getChannel: (channelName: string) => mockChannel as IChannel
		};

		const mockVoidSettingsService: Partial<IVoidSettingsService> = {
			state: { settingsOfProvider: {} } as any
		};

		const mockMCPService: Partial<IMCPService> = {
			getMCPTools: () => []
		};

		const service = new LLMMessageService(
			mockMainProcessService as IMainProcessService,
			mockVoidSettingsService as IVoidSettingsService,
			mockMCPService as IMCPService
		);

		let successResult: string | undefined;
		service.providerHealthCheck({
			providerName: 'ollama',
			onSuccess: (p) => {
				successResult = p.message;
			},
			onError: (e) => {
				assert.fail('Should not call onError');
			}
		});

		// The implementation should now call the channel and receive the response from the mock
		assert.strictEqual(successResult, 'OK');
	});
});
