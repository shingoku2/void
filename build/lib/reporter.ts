/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import through2 from 'through2';
import fancyLog from 'fancy-log';
import ansiColors from 'ansi-colors';
import fs from 'fs';
import path from 'path';
import { Transform } from 'stream';

class ErrorLog {
	constructor(public id: string) {
	}
	allErrors: string[][] = [];
	startTime: number | null = null;
	count = 0;

	onStart(): void {
		if (this.count++ > 0) {
			return;
		}

		this.startTime = new Date().getTime();
		fancyLog(`Starting ${ansiColors.green('compilation')}${this.id ? ansiColors.blue(` ${this.id}`) : ''}...`);
	}

	onEnd(): void {
		if (--this.count > 0) {
			return;
		}

		this.log();
	}

	log(): void {
		const errors = this.allErrors.flat();
		const seen = new Set<string>();

		errors.map(err => {
			if (!seen.has(err)) {
				seen.add(err);
				fancyLog(`${ansiColors.red('Error')}: ${err}`);
			}
		});

		fancyLog(`Finished ${ansiColors.green('compilation')}${this.id ? ansiColors.blue(` ${this.id}`) : ''} with ${errors.length} errors after ${ansiColors.magenta((new Date().getTime() - this.startTime!) + ' ms')}`);

		const regex = /^([^(]+)\((\d+),(\d+)\): (.*)$/s;
		const messages = errors
			.map(err => regex.exec(err))
			.filter(match => !!match)
			.map(x => x as string[])
			.map(([, path, line, column, message]) => ({ path, line: parseInt(line), column: parseInt(column), message }));

		try {
			const logFileName = 'log' + (this.id ? `_${this.id}` : '');
			fs.writeFileSync(path.join(buildLogFolder, logFileName), JSON.stringify(messages));
		} catch (err) {
			//noop
		}
	}

}

const errorLogsById = new Map<string, ErrorLog>();
function getErrorLog(id: string = '') {
	let errorLog = errorLogsById.get(id);
	if (!errorLog) {
		errorLog = new ErrorLog(id);
		errorLogsById.set(id, errorLog);
	}
	return errorLog;
}

const buildLogFolder = path.join(path.dirname(path.dirname(__dirname)), '.build');

try {
	fs.mkdirSync(buildLogFolder);
} catch (err) {
	// ignore
}

export interface IReporter {
	(err: string): void;
	hasErrors(): boolean;
	end(emitError: boolean): NodeJS.ReadWriteStream;
}

export function createReporter(id?: string): IReporter {
	const errorLog = getErrorLog(id);

	const errors: string[] = [];
	errorLog.allErrors.push(errors);

	const result = (err: string) => errors.push(err);

	result.hasErrors = () => errors.length > 0;

	result.end = (emitError: boolean): NodeJS.ReadWriteStream => {
		errorLog.onStart();

		let flushed = false;

		// Use a proper Transform stream that explicitly controls its lifecycle
		const transform = new Transform({
			objectMode: true,
			transform(chunk, _encoding, callback) {
				this.push(chunk);
				callback();
			},
			flush(callback) {
				if (flushed) {
					callback();
					return;
				}
				flushed = true;

				errorLog.onEnd();

				if (emitError && errors.length > 0) {
					if (!(errors as any).__logged__) {
						errorLog.log();
					}
					(errors as any).__logged__ = true;
					const err = new Error(`Found ${errors.length} errors`);
					(err as any).__reporter__ = true;
					// Emit error after a tick to ensure proper async signaling
					process.nextTick(() => {
						transform.emit('error', err);
					});
				}
				callback();
			}
		});

		// Create a wrapper that forces objectMode and passes through all data
		const wrapped = through2.obj(
			function(chunk, _encoding, callback) {
				this.push(chunk);
				callback();
			},
			function(callback) {
				callback();
			}
		);

		// Pipe transform to wrapped - this should maintain objectMode
		transform.pipe(wrapped);

		return wrapped;
	};

	return result;
}
