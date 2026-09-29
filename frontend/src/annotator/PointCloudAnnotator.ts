import { type Label } from "~entity/Annotation";
import type { Color } from "~entity/Color";
import { type ModelType } from "~entity/ModelInformation";
import type {
	ScalarFieldFilter,
	ScalarFieldInfo,
	ScalarFieldKind,
} from "~entity/ScalarField";
import { type AnnotationManager } from "./annotation/AnnotationManager";
import type { LabelManager } from "./annotation/LabelManager";
import { PointCloudAnnotationManager } from "./annotation/PointCloudAnnotationManager";
import { ScalarFieldEditSession } from "./annotation/ScalarFieldEditSession";
import { HybridUndoManager } from "./annotation/undo/HybridUndoManager";
import { PointCloudUndoManagerRouter } from "./annotation/undo/PointCloudUndoManagerRouter";
import { type UndoManager } from "./annotation/undo/UndoManager";
import { Annotator } from "./Annotator";
import { PointCloudAnnotatorSettingsView } from "./PointCloudAnnotatorSettings";
import {
	MAX_ACTIVE_FILTERS,
	type PointCloud,
	type PointCloudExportData,
} from "./scene/model/PointCloud";
import { PointCloudScene } from "./scene/PointCloudScene";
import { type Scene } from "./scene/Scene";
import { type AnnotationVisualizer } from "./scene/visualizer/AnnotationVisualizer";
import { PointCloudAnnotationVisualizer } from "./scene/visualizer/PointCloudAnnotationVisualizer";
import { PointCloudToolManager } from "./tools/point_cloud/PointCloudToolManager";
import { type ToolManager } from "./tools/ToolManager";

/**
 * The Annotator for PointClouds
 */
export class PointCloudAnnotator extends Annotator<PointCloud> {
	public declare modelType: ModelType.POINT_CLOUD;

	private undoRouter?: PointCloudUndoManagerRouter;
	private editSession: ScalarFieldEditSession | null = null;

	public override isPointCloudAnnotator(): this is PointCloudAnnotator {
		return true;
	}

	public override getSettingsComponent() {
		return PointCloudAnnotatorSettingsView;
	}

	protected createToolManager(
		annotationManager: AnnotationManager,
		undoManager: UndoManager,
		scene: Scene<PointCloud>
	): ToolManager<PointCloud> {
		return new PointCloudToolManager(annotationManager, undoManager, scene);
	}

	protected override createScene(
		sceneParent: HTMLDivElement
	): Scene<PointCloud> {
		return new PointCloudScene(this.cacheScope, sceneParent);
	}

	protected override onInitializedModel(): void {
		// nothing to do
	}

	protected override createAnnotationVisualizer(
		scene: Scene<PointCloud>,
		labelManager: LabelManager
	): AnnotationVisualizer {
		return new PointCloudAnnotationVisualizer(scene, labelManager);
	}

	/**
	 * Uses a {@link PointCloudAnnotationManager} so tools can't select
	 * points currently hidden by a scalar field filter.
	 */
	protected override createAnnotationManager(
		model: PointCloud,
		labelManager: LabelManager
	): AnnotationManager {
		return new PointCloudAnnotationManager(model, labelManager);
	}

	/**
	 * Wraps the main (Classification) undo manager in a
	 * {@link PointCloudUndoManagerRouter}, so entering/leaving a scalar
	 * field edit session can redirect undo/redo without recreating any
	 * tool.
	 */
	protected override createUndoManager(
		annotationManager: AnnotationManager
	): UndoManager {
		const mainManager = new HybridUndoManager(
			annotationManager,
			this.labelManager
		);
		this.undoRouter = new PointCloudUndoManagerRouter(mainManager);
		return this.undoRouter;
	}

	/**
	 * Returns the scalar fields (e.g. intensity, classification) available
	 * on the current point cloud, as discovered from the source file.
	 */
	public getScalarFields(): ScalarFieldInfo[] {
		return this.scene.getModel().getScalarFields();
	}

	/**
	 * Colors the point cloud by a scalar field instead of its original
	 * colors. Annotation labels continue to be blended on top, as usual.
	 *
	 * @param fieldName the scalar field to color by, or `null` to restore
	 *                   the point cloud's original colors
	 * @param kindOverride overrides the scalar field's detected {@link ScalarFieldKind}
	 */
	public setScalarFieldColoring(
		fieldName: string | null,
		kindOverride?: ScalarFieldKind
	): void {
		this.stopEditingField();

		const colors = this.scene
			.getModel()
			.computeBaseColors(fieldName, kindOverride);
		(
			this.annotationVisualizer as PointCloudAnnotationVisualizer
		).setBaseColors(colors);
		this.notifyVisualizerChange(true);
	}

	/**
	 * Starts an independent, local editing session for `fieldName`: an
	 * integer ("categorical") scalar field. While a session is active,
	 * every annotation tool paints this field's values instead of the
	 * normal Classification labels, with its own undo/redo history.
	 *
	 * @param fieldName the scalar field to edit; must be categorical
	 */
	public startEditingField(fieldName: string): void {
		const field = this.getScalarFields().find((f) => f.name === fieldName);
		if (!field) {
			throw new Error(`Unknown scalar field '${fieldName}'.`);
		}
		if (field.kind !== "categorical") {
			throw new Error(
				`Only integer scalar fields can be edited; '${fieldName}' is continuous.`
			);
		}

		this.editSession?.destroy();

		this.editSession = new ScalarFieldEditSession(this.scene, field);
		(this.annotationManager as PointCloudAnnotationManager).setEditSession(
			this.editSession
		);
		this.undoRouter!.setActive(this.editSession.undoManager);
	}

	/**
	 * Stops the current scalar field edit session (if any) and restores the
	 * normal Classification labels and undo/redo history. Edits already
	 * made are kept (they were written directly into the field as they
	 * happened).
	 */
	public stopEditingField(): void {
		if (!this.editSession) return;

		this.editSession.destroy();
		this.editSession = null;
		(this.annotationManager as PointCloudAnnotationManager).setEditSession(
			null
		);
		this.undoRouter!.setActive(null);
		this.notifyVisualizerChange(true);
	}

	/**
	 * Returns the name of the scalar field currently being edited, or
	 * `null` if no edit session is active.
	 */
	public getEditingFieldName(): string | null {
		return this.editSession?.fieldName ?? null;
	}

	/**
	 * Returns every value currently paintable in the active edit session
	 * (existing field values plus any added via `addValueToEditedField`).
	 * Empty if no edit session is active.
	 */
	public getEditableValues(): Label[] {
		return this.editSession?.getValueLabels() ?? [];
	}

	/**
	 * Introduces a new, previously unused integer value to the field
	 * currently being edited, and makes it available to paint with (e.g.
	 * add `3` to a field that only had `0`/`1`).
	 *
	 * @param value the new integer value
	 * @param name an optional display name (defaults to the value itself)
	 * @param color an optional color (defaults to an auto-generated one)
	 */
	public addValueToEditedField(
		value: number,
		name?: string,
		color?: Color
	): Label {
		if (!this.editSession) {
			throw new Error("No scalar field is currently being edited.");
		}
		return this.editSession.addValue(value, name, color);
	}

	/**
	 * Selects which value the annotation tools currently paint, within the
	 * active edit session.
	 */
	public setActiveEditValue(label: Label): void {
		if (!this.editSession) {
			throw new Error("No scalar field is currently being edited.");
		}
		this.editSession.labelManager.selectLabel(label);
	}

	/** the number of scalar field filters that can be active at once */
	public readonly maxFilterSlots = MAX_ACTIVE_FILTERS;

	/**
	 * Sets or clears one of the `maxFilterSlots` scalar field filter slots.
	 * All enabled slots are combined with AND, e.g. to filter by
	 * `tree == 1 AND part == trunk`, set one filter per field in two
	 * different slots.
	 *
	 * @param slot the filter slot, in `[0, maxFilterSlots)`
	 * @param filter the filter to apply, or `null` to disable this slot
	 */
	public setFilterSlot(slot: number, filter: ScalarFieldFilter | null): void {
		this.scene.getModel().setFilterSlot(slot, filter);
	}

	/**
	 * Disables all active scalar field filters, making all points visible
	 * again.
	 */
	public clearAllFilters(): void {
		this.scene.getModel().clearAllFilters();
	}

	/**
	 * Returns the raw per-point data needed to export this point cloud
	 * (e.g. to LAS): original coordinates, original colors and scalar
	 * fields. Combine with `getAnnotationsLUTUnsafe()` for the segmented
	 * classes.
	 */
	public getExportData(): PointCloudExportData {
		return this.scene.getModel().getExportData();
	}

	public override destroy(): void {
		this.editSession?.destroy();
		this.editSession = null;
		super.destroy();
	}
}
