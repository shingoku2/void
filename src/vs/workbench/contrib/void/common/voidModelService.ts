import { Disposable, IReference } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';

type VoidModelType = {
	model: ITextModel | null;
	editorModel: IResolvedTextEditorModel | null;
};

export interface IVoidModelService {
	readonly _serviceBrand: undefined;

	/**
	 * Initializes a text model reference for the given URI.
	 * Idempotent — safe to call multiple times for the same URI.
	 * @param uri The file URI to initialize
	 */
	initializeModel(uri: URI): Promise<void>;

	/**
	 * Gets the model and editor model reference for a URI.
	 * @param uri The file URI
	 * @returns VoidModelType with model (ITextModel) and editorModel (IResolvedTextEditorModel),
	 *         or null values if not initialized
	 */
	getModel(uri: URI): VoidModelType;

	/**
	 * Gets the model and editor model reference by filesystem path.
	 * @param fsPath Absolute filesystem path
	 * @returns Same as getModel(), but accepts fsPath instead of URI
	 */
	getModelFromFsPath(fsPath: string): VoidModelType;

	/**
	 * Gets the model, initializing if necessary.
	 * Convenience method that awaits initialization before returning.
	 * @param uri The file URI
	 */
	getModelSafe(uri: URI): Promise<VoidModelType>;

	/**
	 * Saves the model at the given URI.
	 * Uses skipSaveParticipants to avoid triggering extensions or reformatting.
	 * @param uri The file URI to save
	 */
	saveModel(uri: URI): Promise<void>;
}

export const IVoidModelService = createDecorator<IVoidModelService>('voidVoidModelService');

export class VoidModelService extends Disposable implements IVoidModelService {
	_serviceBrand: undefined;
	static readonly ID = 'voidVoidModelService';
	private readonly _modelRefOfURI: Record<string, IReference<IResolvedTextEditorModel>> = {};
	private readonly _maxModelRefs = 100; // Limit to prevent unbounded growth

	private _cleanUpIfNeeded() {
		const keys = Object.keys(this._modelRefOfURI);
		if (keys.length > this._maxModelRefs) {
			// Remove oldest half of entries (simple LRU approximation)
			const toRemove = keys.slice(0, Math.floor(keys.length / 2));
			for (const key of toRemove) {
				const ref = this._modelRefOfURI[key];
				ref.dispose();
				delete this._modelRefOfURI[key];
			}
		}
	}

	constructor(
		@ITextModelService private readonly _textModelService: ITextModelService,
		@ITextFileService private readonly _textFileService: ITextFileService,
	) {
		super();
	}

	saveModel = async (uri: URI) => {
		await this._textFileService.save(uri, { // we want [our change] -> [save] so it's all treated as one change.
			skipSaveParticipants: true // avoid triggering extensions etc (if they reformat the page, it will add another item to the undo stack)
		})
	}

	initializeModel = async (uri: URI) => {
		try {
			if (uri.fsPath in this._modelRefOfURI) return;
			this._cleanUpIfNeeded(); // Clean up before adding new entries
			const editorModelRef = await this._textModelService.createModelReference(uri);
			// Keep a strong reference to prevent disposal
			this._modelRefOfURI[uri.fsPath] = editorModelRef;
		}
		catch (e) {
			console.log('InitializeModel error:', e)
		}
	};

	getModelFromFsPath = (fsPath: string): VoidModelType => {
		const editorModelRef = this._modelRefOfURI[fsPath];
		if (!editorModelRef) {
			return { model: null, editorModel: null };
		}

		const model = editorModelRef.object.textEditorModel;

		if (!model) {
			return { model: null, editorModel: editorModelRef.object };
		}

		return { model, editorModel: editorModelRef.object };
	};

	getModel = (uri: URI) => {
		return this.getModelFromFsPath(uri.fsPath)
	}


	getModelSafe = async (uri: URI): Promise<VoidModelType> => {
		if (!(uri.fsPath in this._modelRefOfURI)) await this.initializeModel(uri);
		return this.getModel(uri);

	};

	override dispose() {
		super.dispose();
		for (const ref of Object.values(this._modelRefOfURI)) {
			ref.dispose(); // release reference to allow disposal
		}
	}
}

registerSingleton(IVoidModelService, VoidModelService, InstantiationType.Eager);
