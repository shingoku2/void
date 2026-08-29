/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { IVoidChannelService } from '../common/voidChannelService.js';

class VoidChannelService implements IVoidChannelService {
	readonly _serviceBrand: undefined;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
	) { }

	getChannel(channelName: string): IChannel {
		return this.mainProcessService.getChannel(channelName);
	}
}

registerSingleton(IVoidChannelService, VoidChannelService, InstantiationType.Delayed);
