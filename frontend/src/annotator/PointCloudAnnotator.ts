import { type ModelType } from "~entity/ModelInformation";
import type {
	ScalarFieldFilter,
	ScalarFieldInfo,
	ScalarFieldKind,
} from "~entity/ScalarField";
import { type AnnotationManager } from "./annotation/AnnotationManager";
import type { LabelManager } from "./annotation/LabelManager";
import { PointCloudAnnotationManager } from "./annotation/PointCloudAnnotationManager";
import { type UndoManager } from "./annotation/undo/UndoManager";
import { Annotator } from "./Annotator";
import { PointCloudAnnotatorSettingsView } from "./PointCloudAnnotatorSettings";
import { MAX_ACTIVE_FILTERS, type PointCloud } from "./scene/model/PointCloud";
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
		const colors = this.scene
			.getModel()
			.computeBaseColors(fieldName, kindOverride);
		(
			this.annotationVisualizer as PointCloudAnnotationVisualizer
		).setBaseColors(colors);
		this.notifyVisualizerChange(true);
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
}
