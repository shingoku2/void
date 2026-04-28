/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// registered in app.ts
// can't make a service responsible for this, because it needs
// to be connected to the main process and node dependencies

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MCPConfigFileJSON, MCPConfigFileEntryJSON, MCPServer, RawMCPToolCall, MCPToolErrorResponse, MCPServerEventResponse, MCPToolCallParams, removeMCPToolNamePrefix } from '../common/mcpServiceTypes.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPUserStateOfName } from '../common/voidSettingsTypes.js';
import { isWindows } from '../../../../base/common/platform.js';
import { randomUUID } from 'crypto';

// ============================================================================
// Command Path Validation (Security: prevent arbitrary command execution)
// ============================================================================

const ALLOWED_COMMAND_PREFIXES: { unix: string[], windows: string[] } = {
	unix: [
		'/usr/bin/',
		'/usr/local/bin/',
		'/opt/',
		'/usr/sbin/',
		'/bin/',
		'/sbin/',
	],
	windows: [
		'C:\\Program Files\\',
		'C:\\Program Files (x86)\\',
		'C:\\Windows\\System32\\',
		'C:\\Windows\\SysWOW64\\',
		// Node.js common install locations
		process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs\\` : '',
		// npm global paths
		'C:\\Users\\',
	].filter(Boolean),
};

/**
 * Validates that a command path is within allowed directories.
 * Returns { valid: true } if safe, { valid: false, reason: string } if suspicious.
 */
function validateCommandPath(command: string): { valid: boolean; reason?: string } {
	if (!command || command.trim() === '') {
		return { valid: false, reason: 'Empty command path' };
	}

	// Check for path traversal attempts
	if (command.includes('..') || command.includes('\\..') || command.includes('/..')) {
		return { valid: false, reason: 'Path traversal detected in command' };
	}

	// Check for shell metacharacters that could be used for injection
	// Expanded to include: ! > < \ ( ) and compound operators && ||
	const suspiciousChars = /[;&|`$<>!\\()]|&&|\|\|/;
	if (suspiciousChars.test(command)) {
		return { valid: false, reason: 'Suspicious shell metacharacters in command' };
	}

	const isUnix = !isWindows;

	if (isUnix) {
		// On Unix, check if command starts with an allowed prefix or is an absolute path in allowed dir
		const matchesAllowedPrefix = ALLOWED_COMMAND_PREFIXES.unix.some(prefix =>
			command.startsWith(prefix)
		);
		const isAbsoluteInAllowedDir = command.startsWith('/') && matchesAllowedPrefix;

		if (matchesAllowedPrefix || isAbsoluteInAllowedDir) {
			return { valid: true };
		}

		// Also allow commands that exist in PATH and are just the command name (no path)
		// e.g., "node", "npx", "python3"
		if (!command.includes('/') && !command.includes('\\')) {
			return { valid: true };
		}

		return {
			valid: false,
			reason: `Command path "${command}" is not in allowed directories: ${ALLOWED_COMMAND_PREFIXES.unix.join(', ')}`
		};
	} else {
		// On Windows, normalize path separators and check
		const normalizedCommand = command.replace(/\//g, '\\').toLowerCase();

		const matchesAllowedPrefix = ALLOWED_COMMAND_PREFIXES.windows.some(prefix =>
			normalizedCommand.startsWith(prefix.toLowerCase())
		);

		if (matchesAllowedPrefix) {
			return { valid: true };
		}

		// Allow relative commands (just command name without path)
		if (!command.includes('\\') && !command.includes('/')) {
			return { valid: true };
		}

		return {
			valid: false,
			reason: `Command path "${command}" is not in allowed directories on Windows`
		};
	}
}

// ============================================================================
// End Command Path Validation
// ============================================================================

const getClientConfig = (serverName: string) => {
	return {
		name: `${serverName}-client`,
		version: '0.1.0',
		// debug: true,
	}
}

type MCPServerNonError = MCPServer & { status: Omit<MCPServer['status'], 'error'> }
type MCPServerError = MCPServer & { status: 'error' }



type ClientInfo = {
	_client: Client, // _client is the client that connects with an mcp client. We're calling mcp clients "server" everywhere except here for naming consistency.
	_transport?: Transport, // stored so we can close it properly
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerNonError,
} | {
	_client?: undefined,
	_transport?: undefined,
	mcpServerEntryJSON: MCPConfigFileEntryJSON,
	mcpServer: MCPServerError,
}

type InfoOfClientId = {
	[clientId: string]: ClientInfo
}

export class MCPChannel implements IServerChannel {

	private readonly infoOfClientId: InfoOfClientId = {}
	private readonly _refreshingServerNames: Set<string> = new Set()

	// mcp emitters
	private readonly mcpEmitters = {
		serverEvent: {
			onAdd: new Emitter<MCPServerEventResponse>(),
			onUpdate: new Emitter<MCPServerEventResponse>(),
			onDelete: new Emitter<MCPServerEventResponse>(),
		}
	} satisfies {
		serverEvent: {
			onAdd: Emitter<MCPServerEventResponse>,
			onUpdate: Emitter<MCPServerEventResponse>,
			onDelete: Emitter<MCPServerEventResponse>,
		}
	}

	constructor(
	) { }

	// browser uses this to listen for changes
	listen(_: unknown, event: string): Event<any> {

		// server events
		if (event === 'onAdd_server') return this.mcpEmitters.serverEvent.onAdd.event;
		else if (event === 'onUpdate_server') return this.mcpEmitters.serverEvent.onUpdate.event;
		else if (event === 'onDelete_server') return this.mcpEmitters.serverEvent.onDelete.event;
		// else if (event === 'onLoading_server') return this.mcpEmitters.serverEvent.onChangeLoading.event;

		// tool call events

		// handle unknown events
		else throw new Error(`Event not found: ${event}`);
	}

	// browser uses this to call (see this.channel.call() in mcpConfigService.ts for all usages)
	async call(_: unknown, command: string, params: any): Promise<any> {
		try {
			if (command === 'refreshMCPServers') {
				await this._refreshMCPServers(params)
			}
			else if (command === 'closeAllMCPServers') {
				await this._closeAllMCPServers()
			}
			else if (command === 'toggleMCPServer') {
				await this._toggleMCPServer(params.serverName, params.isOn)
			}
			else if (command === 'callTool') {
				const p: MCPToolCallParams = params
				const response = await this._safeCallTool(p.serverName, p.toolName, p.params)
				return response
			}
			else {
				throw new Error(`Void sendLLM: command "${command}" not recognized.`)
			}
		}
		catch (e) {
			console.error('mcp channel: Call Error:', e)
		}
	}

	// server functions


	private async _refreshMCPServers(params: { mcpConfigFileJSON: MCPConfigFileJSON, userStateOfName: MCPUserStateOfName, addedServerNames: string[], removedServerNames: string[], updatedServerNames: string[] }) {

		const {
			mcpConfigFileJSON,
			userStateOfName,
			addedServerNames,
			removedServerNames,
			updatedServerNames,
		} = params

		const { mcpServers: mcpServersJSON } = mcpConfigFileJSON

		const allChanges: { type: 'added' | 'removed' | 'updated', serverName: string }[] = [
			...addedServerNames.map(n => ({ serverName: n, type: 'added' }) as const),
			...removedServerNames.map(n => ({ serverName: n, type: 'removed' }) as const),
			...updatedServerNames.map(n => ({ serverName: n, type: 'updated' }) as const),
		]

		await Promise.all(
			allChanges.map(async ({ serverName, type }) => {

				// check if already refreshing
				if (this._refreshingServerNames.has(serverName)) return
				this._refreshingServerNames.add(serverName)

				const prevServer = this.infoOfClientId[serverName]?.mcpServer;

				// close and delete the old client
				if (type === 'removed' || type === 'updated') {
					await this._closeClient(serverName)
					delete this.infoOfClientId[serverName]
					this.mcpEmitters.serverEvent.onDelete.fire({ response: { prevServer, name: serverName, } })
				}

				// create a new client
				if (type === 'added' || type === 'updated') {
					const clientInfo = await this._createClient(mcpServersJSON[serverName], serverName, userStateOfName[serverName]?.isOn)
					this.infoOfClientId[serverName] = clientInfo
					this.mcpEmitters.serverEvent.onAdd.fire({ response: { newServer: clientInfo.mcpServer, name: serverName, } })
				}
			})
		)

		allChanges.forEach(({ serverName, type }) => {
			this._refreshingServerNames.delete(serverName)
		})

	}

	private async _createClientUnsafe(server: MCPConfigFileEntryJSON, serverName: string, isOn: boolean): Promise<ClientInfo> {

		const clientConfig = getClientConfig(serverName)
		const client = new Client(clientConfig)
		let transport: Transport | undefined;
		let info: MCPServerNonError;

		if (server.url) {
			// first try HTTP, fall back to SSE
			try {
				transport = new StreamableHTTPClientTransport(server.url);
				await client.connect(transport);
				console.log(`Connected via HTTP to ${serverName}`);
				const { tools } = await client.listTools()
				const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))
				info = {
					status: isOn ? 'success' : 'offline',
					tools: toolsWithUniqueName,
					command: server.url.toString(),
				}
			} catch (httpErr) {
				// Close the failed HTTP transport before trying SSE
				if (transport) {
					try {
						await transport.close()
					} catch (closeErr) {
						console.warn(`Error closing failed HTTP transport for ${serverName}:`, closeErr)
						// Track failed close - surface to caller since resource cleanup failed
						throw new Error(`Failed to close HTTP transport for ${serverName}: ${closeErr}`);
					}
				}
				console.warn(`HTTP failed for ${serverName}, trying SSE…`, httpErr);
				transport = new SSEClientTransport(server.url);
				await client.connect(transport);
				const { tools } = await client.listTools()
				const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))
				console.log(`Connected via SSE to ${serverName}`);
				info = {
					status: isOn ? 'success' : 'offline',
					tools: toolsWithUniqueName,
					command: server.url.toString(),
				}
			}
		} else if (server.command) {
			// Validate command path before execution (security fix)
			const validation = validateCommandPath(server.command);
			if (!validation.valid) {
				const error = new Error(`Security: Command path validation failed for "${server.command}": ${validation.reason}`);
				console.error(`❌ Security: ${error.message}`);
				throw error;
			}

			// Validate args to prevent command injection via arguments
			// Reject args containing shell metacharacters that could enable command injection
			if (server.args && Array.isArray(server.args)) {
				const dangerousArgPattern = /^[;&|`$()<>!\\]|[\x00-\x1f]/;
				for (const arg of server.args) {
					if (typeof arg !== 'string') continue;
					if (dangerousArgPattern.test(arg)) {
						const error = new Error(`Security: Command argument contains dangerous characters: "${arg}"`);
						console.error(`❌ Security: ${error.message}`);
						throw error;
					}
				}
			}

			console.warn(`⚠️ MCP: Using stdio transport with command: ${server.command}`);

			// console.log('ENV DATA: ', server.env)
			transport = new StdioClientTransport({
				command: server.command,
				args: server.args,
				env: {
					...server.env,
					PATH: process.env.PATH,
					HOME: process.env.HOME,
					USER: process.env.USER,
				} as Record<string, string>,
			});

			await client.connect(transport)

			// Get the tools from the server
			const { tools } = await client.listTools()
			const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }))

			// Create a full command string for display
			const fullCommand = `${server.command} ${server.args?.join(' ') || ''}`

			// Format server object
			info = {
				status: isOn ? 'success' : 'offline',
				tools: toolsWithUniqueName,
				command: fullCommand,
			}

		} else {
			throw new Error(`No url or command for server ${serverName}`);
		}


		return { _client: client, _transport: transport, mcpServerEntryJSON: server, mcpServer: info }
	}

	private _addUniquePrefix(base: string) {
		return `${randomUUID()}_${base}`;
	}

	private async _createClient(serverConfig: MCPConfigFileEntryJSON, serverName: string, isOn = true): Promise<ClientInfo> {
		try {
			const c: ClientInfo = await this._createClientUnsafe(serverConfig, serverName, isOn)
			return c
		} catch (err) {
			console.error(`❌ Failed to connect to server "${serverName}":`, err)
			const fullCommand = !serverConfig.command ? '' : `${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`
			const c: MCPServerError = { status: 'error', error: err + '', command: fullCommand, }
			return { mcpServerEntryJSON: serverConfig, mcpServer: c, }
		}
	}

	private async _closeAllMCPServers() {
		for (const serverName in this.infoOfClientId) {
			await this._closeClient(serverName)
			delete this.infoOfClientId[serverName]
		}
		console.log('Closed all MCP servers');
	}

	private async _closeClient(serverName: string) {
		const info = this.infoOfClientId[serverName]
		if (!info) return
		const { _client: client, _transport: transport } = info
		// Close the transport first (SSE/WebSocket connections)
		if (transport) {
			try {
				await transport.close()
			} catch (e) {
				console.warn(`Error closing transport for ${serverName}:`, e)
			}
		}
		if (client) {
			await client.close()
		}
		console.log(`Closed MCP server ${serverName}`);
	}


	private async _toggleMCPServer(serverName: string, isOn: boolean) {
		const prevServer = this.infoOfClientId[serverName]?.mcpServer
		// Handle turning on the server
		if (isOn) {
			// this.mcpEmitters.serverEvent.onChangeLoading.fire(getLoadingServerObject(serverName, isOn))
			const clientInfo = await this._createClientUnsafe(this.infoOfClientId[serverName].mcpServerEntryJSON, serverName, isOn)
			this.mcpEmitters.serverEvent.onUpdate.fire({
				response: {
					name: serverName,
					newServer: clientInfo.mcpServer,
					prevServer: prevServer,
				}
			})
		}
		// Handle turning off the server
		else {
			// this.mcpEmitters.serverEvent.onChangeLoading.fire(getLoadingServerObject(serverName, isOn))
			this._closeClient(serverName)
			delete this.infoOfClientId[serverName]._client

			this.mcpEmitters.serverEvent.onUpdate.fire({
				response: {
					name: serverName,
					newServer: {
						status: 'offline',
						tools: [],
						command: '',
						// Explicitly set error to undefined to reset the error state
						error: undefined,
					},
					prevServer: prevServer,
				}
			})
		}
	}

	// tool call functions

	private async _callTool(serverName: string, toolName: string, params: any): Promise<RawMCPToolCall> {
		const server = this.infoOfClientId[serverName]
		if (!server) throw new Error(`Server ${serverName} not found`)
		const { _client: client } = server
		if (!client) throw new Error(`Client for server ${serverName} not found`)

		// Call the tool with the provided parameters
		const response = await client.callTool({
			name: removeMCPToolNamePrefix(toolName),
			arguments: params
		})
		const { content } = response as CallToolResult
		const returnValue = content[0]

		if (returnValue.type === 'text') {
			// handle text response

			if (response.isError) {
				throw new Error(`Tool call error: ${returnValue.text}`)
			}

			// handle success
			return {
				event: 'text',
				text: returnValue.text,
				toolName,
				serverName,
			}
		}

		// if (returnValue.type === 'audio') {
		// 	// handle audio response
		// }

		// if (returnValue.type === 'image') {
		// 	// handle image response
		// }

		// if (returnValue.type === 'resource') {
		// 	// handle resource response
		// }

		throw new Error(`Tool call error: We don\'t support ${returnValue.type} tool response yet for tool ${toolName} on server ${serverName}`)
	}

	// tool call error wrapper
	private async _safeCallTool(serverName: string, toolName: string, params: any): Promise<RawMCPToolCall> {
		try {
			const response = await this._callTool(serverName, toolName, params)
			return response
		} catch (err) {

			let errorMessage: string;

			if (typeof err === 'object' && err !== null && err['code']) {
				const code = err.code
				let codeDescription = ''
				if (code === -32700)
					codeDescription = 'Parse Error';
				if (code === -32600)
					codeDescription = 'Invalid Request';
				if (code === -32601)
					codeDescription = 'Method Not Found';
				if (code === -32602)
					codeDescription = 'Invalid Parameters';
				if (code === -32603)
					codeDescription = 'Internal Error';
				errorMessage = `${codeDescription}. Full response:\n${JSON.stringify(err, null, 2)}`
			}
			// Check if it's an MCP error with a code
			else if (typeof err === 'string') {
				// String error
				errorMessage = err;
			} else {
				// Unknown error format
				errorMessage = JSON.stringify(err, null, 2);
			}

			const fullErrorMessage = `❌ Failed to call tool "${toolName}" on server "${serverName}": ${errorMessage}`;
			const errorResponse: MCPToolErrorResponse = {
				event: 'error',
				text: fullErrorMessage,
				toolName,
				serverName,
			}
			return errorResponse
		}
	}

	// ============================================================================
	// Dispose / Cleanup
	// ============================================================================

	/**
	 * Properly disposes of the MCPChannel, closing all server connections.
	 * This should be called when the channel is no longer needed.
	 */
	async dispose(): Promise<void> {
		console.log('Disposing MCPChannel, closing all connections...');
		await this._closeAllMCPServers();
		// Clear all emitters
		this.mcpEmitters.serverEvent.onAdd.dispose();
		this.mcpEmitters.serverEvent.onUpdate.dispose();
		this.mcpEmitters.serverEvent.onDelete.dispose();
		console.log('MCPChannel disposed successfully');
	}
}


