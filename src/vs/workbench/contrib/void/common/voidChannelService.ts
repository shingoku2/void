/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export interface IVoidChannelService {
	readonly _serviceBrand: undefined;
	getChannel(channelName: string): IChannel;
}

export const IVoidChannelService = createDecorator<IVoidChannelService>('voidChannelService');
