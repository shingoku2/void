/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as ts from 'typescript';

// Re-export the entire ts.server.protocol namespace using namespace assignment
// This pattern works with both `import * as Proto` and esModuleInterop
export = ts.server.protocol;

// Augment ts.server.protocol with additional types needed by the extension
declare module 'typescript' {
	namespace server.protocol {
		type TextInsertion = ts.TextInsertion;
		type ScriptElementKind = ts.ScriptElementKind;

		interface Response {
			readonly _serverType?: ServerType;
		}
	}
}

declare enum ServerType {
	Syntax = 'syntax',
	Semantic = 'semantic',
}
