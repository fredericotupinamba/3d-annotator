import { err, ok, type Result } from "neverthrow";
import type { FC } from "react";
import type * as Anno3Dv2 from "~anno3d/v2";
import { type CacheRuntime, type ModelUserCacheScope } from "~cache/index";
import { type AnnotationsLUT, type Label } from "~entity/Annotation";
import {
	type ModelInformation,
	type ModelType,
} from "~entity/ModelInformation";
import { type Destroyable } from "~entity/Types";
import type { User } from "~entity/User";
import type { Observer, Unsubscribe } from "~events/Events";
import { hasFileExtension } from "~util/fileSystem/FileUtils";
import { AnnotationManager } from "./annotation/AnnotationManager";
import { LabelManager } from "./annotation/LabelManager";
import { HybridUndoManager } from "./annotation/undo/HybridUndoManager";
import { type UndoManager } from "./annotation/undo/UndoManager";
import {
	CacheBackedAnnotationFileManager,
	type AnnotationFileManager,
} from "./files/AnnotationFileManager";
import {
	CacheBackedModelFileManager,
	type ModelFileManager,
} from "./files/ModelFileManager";
import type { MeshAnnotator } from "./MeshAnnotator";
import type { PointCloudAnnotator } from "./PointCloudAnnotator";
import {
	MAX_UTF8_FILE_LENGTH,
	PLY_BINARY_SIZE_WARNING,
	type LoaderError,
} from "./scene/model/loader/Loader";
import { OBJ_FILE_EXTENSIONS } from "./scene/model/loader/obj/NonBlockingOBJLoader";
import { PLY_FILE_EXTENSIONS } from "./scene/model/loader/ply/NonBlockingPLYLoader";
import { type Model } from "./scene/model/Model";
import { type Scene } from "./scene/Scene";
import { type SceneManager } from "./scene/SceneManager";
import {
	VISUALIZER_SETTINGS,
	type AnnotationVisualizer,
} from "./scene/visualizer/AnnotationVisualizer";
import type { TextureAnnotator } from "./TextureAnnotator";
import "./three/three-mesh-bvh.config";
import { type ToolManager } from "./tools/ToolManager";

export type AnnotationFileError = {
	code: "LENGTH_MISMATCH";
};

export type SetupError =
	| Anno3Dv2.ParserError
	| LoaderError
	| AnnotationFileError;

/**
 * The stages of an setup process \
 * Possible stages:
 * 1. ReadModelFiles,
 * 2. InitializeModel,
 * 3. CheckAnnotationFile,
 * 4. ReadAnnotationData,
 * 5. Finished,
 * 6. Canceled,
 */
export enum SetupStage {
	READ_MODEL_FILES = "readModelFile",
	INITIALIZE_MODEL = "initializeModel",
	CHECK_ANNOTATION_FILE = "checkAnnotationFile",
	READ_ANNOTATION_DATA = "readAnnotationData",
	// LoadAnnotations,
	LOAD_TOOLS = "loadTools",
	FINISHED = "finished",
	ABORTED = "aborted",
}

/**
 * The Progress of an setup stage
 */
export interface SetupProgress {
	stage: SetupStage;
	data?: {
		progress?: number;
		warning?: SetupWarning;
	};
}

export enum SetupWarning {
	LARGE_OBJ_FILE = "largeOBJFile",
	LARGE_PLY_FILE = "largePLYFile",
}

/**
 * Can be passed to the annotator setup method to enable aborting the setup
 */
export class AnnotatorSetupAbortController {
	private _aborted = false;

	public get aborted() {
		return this._aborted;
	}

	public abort() {
		this._aborted = true;
	}
}

/**
 * The Annotator, the anchor point for all manager classes
 */
export abstract class Annotator<T extends Model> implements Destroyable {
	public readonly modelType: ModelType;
	public readonly cacheScope: ModelUserCacheScope;

	public readonly labelManager: LabelManager;
	public readonly modelFileManager: ModelFileManager;
	public readonly annotationFileManager: AnnotationFileManager;

	/**
	 * Exists only after {@link setup} was called and has finished.
	 */
	public undoManager!: UndoManager;

	/**
	 * Exists only after {@link setup} was called and has finished.
	 */
	public sceneManager!: SceneManager;

	public toolManager!: ToolManager<T>;

	protected annotationVisualizer!: AnnotationVisualizer;
	protected annotationManager!: AnnotationManager;

	protected readonly scene: Scene<T>;
	private readonly opacitySetting = VISUALIZER_SETTINGS.opacity;
	private readonly unsubscribeOpacitySetting: Unsubscribe;

	private readonly modelInformation: ModelInformation;

	private setupActive = false;
	private abortController?: AnnotatorSetupAbortController;

	/**
	 * Constructs a new instance of an annotator
	 *
	 * @param sceneParent the element which to add the rendere's dom element to
	 * @param modelInformation  the model information
	 * @param labels the labels
	 * @param rootId the id of the root directory
	 */
	constructor(
		runtime: CacheRuntime,
		user: User,
		sceneParent: HTMLDivElement,
		modelInformation: ModelInformation,
		labels: Label[]
	) {
		this.modelType = modelInformation.modelType;
		this.cacheScope = {
			modelId: String(modelInformation.id),
			projectId: String(modelInformation.projectId),
			userId: String(user.id),
		};

		this.modelInformation = modelInformation;

		this.labelManager = new LabelManager(labels);

		this.modelFileManager = new CacheBackedModelFileManager(
			runtime,
			this.cacheScope
		);

		this.annotationFileManager = new CacheBackedAnnotationFileManager(
			runtime,
			this.cacheScope,
			labels,
			modelInformation.modelType
		);

		this.scene = this.createScene(sceneParent);

		this.unsubscribeOpacitySetting = this.opacitySetting.on(
			"change",
			() => {
				this.notifyVisualizerChange(true);
			}
		);
	}

	public isPointCloudAnnotator(): this is PointCloudAnnotator {
		return false;
	}

	public isMeshAnnotator(): this is MeshAnnotator {
		return false;
	}

	public isTextureAnnotator(): this is TextureAnnotator {
		return false;
	}

	/**
	 * Creates a new scene
	 *
	 * @param canvas a canvas element
	 */
	protected abstract createScene(sceneParen: HTMLDivElement): Scene<T>;

	/**
	 * Setups the annotator
	 * The setup process is divided into multiple {@link SetupStage}.
	 *
	 * @param abortController the AbortController
	 * @param onProgress a progress Observer
	 * @returns true if the setup completed
	 */
	public async setup(
		abortController: AnnotatorSetupAbortController,
		onProgress?: Observer<SetupProgress>
	): Promise<Result<boolean, SetupError>> {
		if (this.setupActive) {
			return ok(true);
		}

		this.setupActive = true;
		this.abortController = abortController;

		this.scene.setup();

		// STAGE ONE (read model files)
		this.setProgress(SetupStage.READ_MODEL_FILES, onProgress);

		const files = await this.modelFileManager.readModelFiles();
		this.setFileWarnings(SetupStage.READ_MODEL_FILES, onProgress, files);

		if (this.breakSetup()) return ok(false);

		// STAGE TWO (initialize model)
		this.setProgress(SetupStage.INITIALIZE_MODEL, onProgress, {
			progress: 0,
		});

		const progressObserver = (progress: number) => {
			this.setProgress(SetupStage.INITIALIZE_MODEL, onProgress, {
				progress: progress,
			});
		};

		const res = await this.scene.initializeModel(files, progressObserver);
		if (res.isErr()) {
			return err(res.error);
		}

		if (this.breakSetup()) return ok(false);

		// synchronously initialize instances

		this.annotationVisualizer = this.createAnnotationVisualizer(
			this.scene,
			this.labelManager
		);

		this.annotationManager = this.createAnnotationManager(
			this.scene.getModel(),
			this.labelManager
		);
		this.annotationManager.on(
			"afterAnnotation",
			({ data, annotations }) => {
				this.annotationVisualizer.visualize(data, annotations);
			}
		);

		this.undoManager = this.createUndoManager(this.annotationManager);

		this.onInitializedModel(this.scene);

		// STAGE THREE (check annotation file)
		this.setProgress(SetupStage.CHECK_ANNOTATION_FILE, onProgress);

		if (await this.annotationFileManager.hasAnnotationFile()) {
			if (this.breakSetup()) return ok(false);

			// STAGE FOUR - OPTIONAL (read annotation data)
			this.setProgress(SetupStage.READ_ANNOTATION_DATA, onProgress);

			const result =
				await this.annotationFileManager.readAnnotationData();
			if (result.isErr()) {
				return err(result.error);
			} else if (
				result.value.annotations.length !==
				this.scene.getModel().getIndexCount()
			) {
				return err({ code: "LENGTH_MISMATCH" });
			}

			const data = result.value.annotations;

			if (this.breakSetup()) return ok(false);

			this.annotationManager.loadAnnotations(data);
			this.annotationVisualizer.visualizeAll(data, true);

			if (this.breakSetup()) return ok(false);
		}

		this.sceneManager = this.scene.createSceneManager();

		// STAGE FIVE(SIX) (load tools)
		this.setProgress(SetupStage.LOAD_TOOLS, onProgress);

		this.toolManager = this.createToolManager(
			this.annotationManager,
			this.undoManager,
			this.scene
		);

		this.setProgress(SetupStage.FINISHED, onProgress);
		this.setupActive = false;
		return ok(true);
	}

	protected abstract onInitializedModel(scene: Scene<T>): void;
	/**
	 * Sets a the setup stage.
	 *
	 * @param stage the stage
	 * @param onProgress a observer
	 * @param progress the progress of a stage
	 */
	private setProgress(
		stage: SetupStage,
		onProgress: Observer<SetupProgress> | undefined,
		data?: SetupProgress["data"]
	) {
		if (onProgress)
			onProgress({
				stage: stage,
				data: data,
			});
	}

	private setFileWarnings(
		stage: SetupStage,
		onProgress: Observer<SetupProgress> | undefined,
		files: File[]
	) {
		for (const file of files) {
			if (
				hasFileExtension(file, OBJ_FILE_EXTENSIONS) &&
				file.size > MAX_UTF8_FILE_LENGTH
			) {
				this.setProgress(stage, onProgress, {
					warning: SetupWarning.LARGE_OBJ_FILE,
				});
			} else if (
				hasFileExtension(file, PLY_FILE_EXTENSIONS) &&
				file.size > PLY_BINARY_SIZE_WARNING
			) {
				this.setProgress(stage, onProgress, {
					warning: SetupWarning.LARGE_PLY_FILE,
				});
			}
		}
	}

	/**
	 * Stops the setup and sets the setup stage to canceled
	 *
	 * @param onProgress a observer
	 * @returns true if the setup could be stopped
	 */
	private breakSetup(onProgress?: Observer<SetupProgress>): boolean {
		if (!this.abortController!.aborted) {
			return false;
		}

		this.destroyAll();
		this.setProgress(SetupStage.ABORTED, onProgress);
		this.setupActive = false;
		return true;
	}

	/**
	 * Creates an annotation visualizer
	 *
	 * @param scene a scene
	 * @return the annotation visualizer
	 */
	protected abstract createAnnotationVisualizer(
		scene: Scene<T>,
		labelManager: LabelManager
	): AnnotationVisualizer;

	/**
	 * Creates a new annotation manager
	 *
	 * @param model a model
	 * @param labelManager a label manager
	 * @returns the annotation manager
	 */
	protected createAnnotationManager(
		model: T,
		labelManager: LabelManager
	): AnnotationManager {
		return new AnnotationManager(model.getIndexCount(), labelManager);
	}

	protected createUndoManager(
		annotationManager: AnnotationManager
	): UndoManager {
		return new HybridUndoManager(annotationManager, this.labelManager);
	}

	public notifyVisualizerChange(overlayOnly = false): void {
		this.annotationVisualizer.visualizeAll(
			this.annotationManager.getAnnotationDataLUT(),
			overlayOnly
		);
	}

	/**
	 * starts the render loop
	 */
	public start(): void {
		this.scene.startRenderLoop();
	}

	/**
	 * stops the render loop
	 */
	public stop(): void {
		this.scene.stopRenderLoop();
	}

	public destroy() {
		if (this.setupActive) {
			this.abortController!.abort();
		} else {
			this.destroyAll();
		}
	}

	/**
	 * Calls `destroy` on all managers
	 */
	private destroyAll(): void {
		console.log("destroy all");

		this.annotationFileManager.destroy();

		this.scene.destroy();

		if (this.annotationVisualizer) {
			this.annotationVisualizer.destroy();
		}

		if (this.annotationManager) {
			this.annotationManager.destroy();
		}

		if (this.undoManager) {
			this.undoManager.destroy();
		}

		if (this.toolManager) {
			this.toolManager.destroy();
		}

		this.unsubscribeOpacitySetting();
	}

	/**
	 * Writes and saves all current annotation data
	 */
	public async save() {
		const data = this.annotationManager.getAnnotationDataLUT();
		await this.annotationFileManager.writeAnnotationData(data);
	}

	public getAnnotationsLUT(): AnnotationsLUT {
		const data = this.annotationManager.getAnnotationDataLUT();
		return new Uint8Array(data);
	}

	public getAnnotationsLUTUnsafe(): AnnotationsLUT {
		return this.annotationManager.getAnnotationDataLUT();
	}

	public getSettingsComponent(): FC {
		return () => null;
	}

	/**
	 * Creates a tool manager
	 *
	 * @param annotationManager a annotation manager
	 * @param scene a scene
	 * @return the tool manager
	 */
	protected abstract createToolManager(
		annotationManager: AnnotationManager,
		undoManager: UndoManager,
		scene: Scene<T>
	): ToolManager<T>;
}
