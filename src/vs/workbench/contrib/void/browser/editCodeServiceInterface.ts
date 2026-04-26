/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Diff, DiffArea, VoidFileSnapshot } from '../common/editCodeServiceTypes.js';


export type StartBehavior = 'accept-conflicts' | 'reject-conflicts' | 'keep-conflicts'

export type CallBeforeStartApplyingOpts = {
	from: 'QuickEdit';
	diffareaid: number; // id of the CtrlK area (contains text selection)
} | {
	from: 'ClickApply';
	uri: 'current' | URI;
}

export type StartApplyingOpts = {
	from: 'QuickEdit';
	diffareaid: number; // id of the CtrlK area (contains text selection)
	startBehavior: StartBehavior;
} | {
	from: 'ClickApply';
	applyStr: string;
	uri: 'current' | URI;
	startBehavior: StartBehavior;
}

export type AddCtrlKOpts = {
	startLine: number,
	endLine: number,
	editor: ICodeEditor,
}

export const IEditCodeService = createDecorator<IEditCodeService>('editCodeService');

export interface IEditCodeService {
	readonly _serviceBrand: undefined;

	/**
	 * Converts keybinding token strings (e.g., "Enter", "Backspace") to their symbolic
	 * representations (e.g., "↵", "⌫") for display in the UI.
	 */
	processRawKeybindingText(keybindingStr: string): string;

	/**
	 * Saves the current model and ensures the URI is initialized before apply/edit operations.
	 * Call before `startApplying` or edit operations.
	 */
	callBeforeApplyOrEdit(uri: URI | 'current'): Promise<void>;

	/**
	 * Initiates an apply operation (either QuickEdit or ClickApply).
	 * Returns `[URI, Promise<void>]` on success, or `null` if the operation could not start.
	 * The returned promise may reject; callers should handle with `.catch()`.
	 *
	 * QuickEdit: streams edits into a CtrlK zone
	 * ClickApply: either fast apply (search/replace blocks) or slow apply (full file rewrite)
	 */
	startApplying(opts: StartApplyingOpts): [URI, Promise<void>] | null;

	/**
	 * Applies search/replace blocks immediately without streaming.
	 * Used for fast apply mode when the LLM generates complete search/replace blocks.
	 */
	instantlyApplySearchReplaceBlocks(opts: { uri: URI; searchReplaceBlocks: string }): void;

	/**
	 * Rewrites the entire file with new content immediately.
	 * Used for slow apply mode or when `enableFastApply` is disabled.
	 */
	instantlyRewriteFile(opts: { uri: URI; newContent: string }): void;

	/**
	 * Creates a new CtrlK zone for QuickEdit. Returns the zone ID or `undefined` if creation failed.
	 * If the zone overlaps an existing CtrlK zone, focuses that zone instead.
	 */
	addCtrlKZone(opts: AddCtrlKOpts): number | undefined;

	/**
	 * Removes a CtrlK zone and its associated streaming DiffZone if active.
	 */
	removeCtrlKZone(opts: { diffareaid: number }): void;

	/** URI string -> Set of diffareaid strings */
	diffAreasOfURI: Record<string, Set<string> | undefined>;
	/** diffareaid string -> DiffArea */
	diffAreaOfId: Record<string, DiffArea>;
	/** diffid string -> Diff */
	diffOfId: Record<string, Diff>;

	/**
	 * Accepts or rejects all diff areas for a URI in one operation.
	 * @param removeCtrlKs If true, also removes CtrlK zones
	 * @param behavior 'accept' to keep changes, 'reject' to revert
	 */
	acceptOrRejectAllDiffAreas(opts: { uri: URI, removeCtrlKs: boolean, behavior: 'reject' | 'accept', _addToHistory?: boolean }): void;

	/** Accepts a single diff by ID, merging its changes into the original code. */
	acceptDiff({ diffid }: { diffid: number }): void;

	/** Rejects a single diff by ID, reverting to the original code for that diff. */
	rejectDiff({ diffid }: { diffid: number }): void;

	// --- Events ---

	/** Fires when diff zones are added or deleted for a URI */
	onDidAddOrDeleteDiffZones: Event<{ uri: URI }>;

	/**
	 * Fires when diffs change in a non-streaming DiffZone.
	 * Does NOT fire during streaming (would be too frequent).
	 */
	onDidChangeDiffsInDiffZoneNotStreaming: Event<{ uri: URI; diffareaid: number }>;

	/** Fires when a DiffZone starts or stops streaming */
	onDidChangeStreamingInDiffZone: Event<{ uri: URI; diffareaid: number }>;

	/** Fires when a CtrlK zone's linked streaming state changes */
	onDidChangeStreamingInCtrlKZone: Event<{ uri: URI; diffareaid: number }>;

	/**
	 * Returns true if the CtrlK zone is currently linked to a streaming DiffZone.
	 */
	isCtrlKZoneStreaming(opts: { diffareaid: number }): boolean;

	/**
	 * Interrupts streaming for a CtrlK zone's linked DiffZone and reverts the file.
	 */
	interruptCtrlKStreaming(opts: { diffareaid: number }): void;

	/**
	 * Interrupts all streaming DiffZones for a URI and reverts the file.
	 */
	interruptURIStreaming(opts: { uri: URI }): void;

	/**
	 * Captures the current state of all diff areas and file content for a URI.
	 * Used for undo/redo support.
	 */
	getVoidFileSnapshot(uri: URI): VoidFileSnapshot;

	/**
	 * Restores a previously captured snapshot, replacing current diff areas and file content.
	 */
	restoreVoidFileSnapshot(uri: URI, snapshot: VoidFileSnapshot): void;
}
