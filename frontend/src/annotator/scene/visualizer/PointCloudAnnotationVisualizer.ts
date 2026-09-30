import { type BufferAttribute } from "three";
import type { LabelManager } from "~annotator/annotation/LabelManager";
import {
	type AnnotationsLUT,
	type LabeledAnnotationData,
} from "~entity/Annotation";
import { type Scene } from "../Scene";
import { type PointCloud } from "../model/PointCloud";
import { BaseVisualizer, VISUALIZER_SETTINGS } from "./AnnotationVisualizer";

/**
 * A visualizer for point cloud data
 */
export class PointCloudAnnotationVisualizer extends BaseVisualizer {
	private readonly scene: Scene<PointCloud>;
	private originalColors: Float32Array;

	/**
	 * Constructs a new instance of {@link PointCloudAnnotationVisualizer}
	 *
	 * @param scene a {@link Scene} of type {@link PointCloud}
	 */
	constructor(scene: Scene<PointCloud>, labelManager: LabelManager) {
		super(VISUALIZER_SETTINGS, labelManager);
		this.scene = scene;
		// shared with the model (never modified here), not copied: a point
		// cloud's colors can take hundreds of MB
		this.originalColors = scene.getModel().computeBaseColors(null);
	}

	/**
	 * Replaces the base colors that annotation labels are blended on top of
	 * (e.g. to visualize a scalar field instead of the point cloud's
	 * original colors). Does not redraw by itself, call `visualizeAll`
	 * afterwards.
	 *
	 * @param colors the new base colors, as a flat RGB `Float32Array`
	 */
	public setBaseColors(colors: Float32Array): void {
		this.originalColors = colors;
	}

	public visualize({ label, data }: LabeledAnnotationData) {
		const geometry = this.scene.getModel().getPoints().geometry;
		const colorAttr = geometry.getAttribute("color") as BufferAttribute;

		const color = label.color.floatValues;

		const newColorPart =
			label.isNeutral || !label.annotationVisible
				? 0
				: this.settings.opacity;
		const originalColorPart = 1 - newColorPart;

		for (let i = 0; i < data.length; i++) {
			const vertex = data[i];
			colorAttr.setXYZ(
				vertex,
				color[0] * newColorPart +
					this.originalColors[vertex * 3] * originalColorPart,
				color[1] * newColorPart +
					this.originalColors[vertex * 3 + 1] * originalColorPart,
				color[2] * newColorPart +
					this.originalColors[vertex * 3 + 2] * originalColorPart
			);
		}

		colorAttr.needsUpdate = true;
	}

	protected visualizeAllWithLabeledAnnotationData(
		data: LabeledAnnotationData[]
	) {
		const geometry = this.scene.getModel().getPoints().geometry;
		const colorAttr = geometry.getAttribute("color") as BufferAttribute;

		colorAttr.copyArray(this.originalColors);

		for (const currentData of data) {
			this.visualize(currentData);
		}
	}

	protected visualizeAllWithAnnotationsLUT(data: AnnotationsLUT): void {
		const labelLUT = this.labelManager.getLabelLUT();
		const geometry = this.scene.getModel().getPoints().geometry;
		const colorAttr = geometry.getAttribute("color") as BufferAttribute;

		for (let vertex = 0; vertex < data.length; vertex++) {
			const label = labelLUT[data[vertex]]!;

			const color = label.color.floatValues;

			const newColorPart =
				label.isNeutral || !label.annotationVisible
					? 0
					: this.settings.opacity;
			const originalColorPart = 1 - newColorPart;

			colorAttr.setXYZ(
				vertex,
				color[0] * newColorPart +
					this.originalColors[vertex * 3] * originalColorPart,
				color[1] * newColorPart +
					this.originalColors[vertex * 3 + 1] * originalColorPart,
				color[2] * newColorPart +
					this.originalColors[vertex * 3 + 2] * originalColorPart
			);
		}

		colorAttr.needsUpdate = true;
	}
}
