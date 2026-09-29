import { type BufferAttribute } from "three";
import { categoricalColor } from "~annotator/scalarFields/ScalarFieldColorMap";
import { type Scene } from "~annotator/scene/Scene";
import { type PointCloud } from "~annotator/scene/model/PointCloud";
import { PointCloudAnnotationVisualizer } from "~annotator/scene/visualizer/PointCloudAnnotationVisualizer";
import {
	MAX_ANNOTATION_CLASS,
	MutableLabel,
	type Label,
} from "~entity/Annotation";
import { Color } from "~entity/Color";
import type { ScalarFieldInfo } from "~entity/ScalarField";
import { type Destroyable } from "~entity/Types";
import { AnnotationManager } from "./AnnotationManager";
import { LabelManager } from "./LabelManager";
import { HybridUndoManager } from "./undo/HybridUndoManager";

/**
 * An independent, purely local (not persisted to the backend) editing
 * session for a single integer ("categorical") scalar field. Lets the user
 * paint the field's existing values, and introduce brand new ones (e.g. add
 * the value `3` to a field that only had `0`/`1`), using the exact same
 * tools, undo/redo and visualization machinery as the project's normal
 * Classification labels - just pointed at this field's data instead.
 *
 * Painted values are written directly into the scalar field's live
 * `BufferAttribute` as soon as a stroke completes; there is no separate
 * "commit"/"flush" step.
 */
export class ScalarFieldEditSession implements Destroyable {
	public readonly fieldName: string;
	public readonly labelManager: LabelManager;
	public readonly annotationManager: AnnotationManager;
	public readonly undoManager: HybridUndoManager;

	private readonly fieldAttribute: BufferAttribute;
	private readonly visualizer: PointCloudAnnotationVisualizer;
	private readonly unsubscribeAnnotate: () => void;

	/** maps a real scalar field value (e.g. `3`) to the internal annotationClass used to paint it */
	private readonly valueToClass = new Map<number, number>();
	/** the inverse of {@link valueToClass} */
	private readonly classToValue = new Map<number, number>();
	private nextClass = 0;

	constructor(scene: Scene<PointCloud>, field: ScalarFieldInfo) {
		this.fieldName = field.name;

		const geometry = scene.getModel().getPoints().geometry;
		this.fieldAttribute = geometry.getAttribute(
			field.attributeKey
		) as BufferAttribute;
		const values = this.fieldAttribute.array as Float32Array;

		const uniqueValues =
			field.uniqueValues ??
			Array.from(new Set(Array.from(values))).sort((a, b) => a - b);

		const initialLabels = uniqueValues.map((value) =>
			this.createLabelForValue(value)
		);
		this.labelManager = new LabelManager(initialLabels);

		this.annotationManager = new AnnotationManager(
			values.length,
			this.labelManager
		);
		const seed = new Uint8Array(values.length);
		for (let i = 0; i < values.length; i++) {
			seed[i] = this.valueToClass.get(values[i])!;
		}
		this.annotationManager.loadAnnotations(seed);

		this.undoManager = new HybridUndoManager(
			this.annotationManager,
			this.labelManager
		);

		// give the visualizer a clean, field-colored base to blend onto,
		// instead of whatever the main Classification view last showed
		const baseColors = scene.getModel().computeBaseColors(field.name);
		this.visualizer = new PointCloudAnnotationVisualizer(
			scene,
			this.labelManager
		);
		this.visualizer.setBaseColors(baseColors);
		this.visualizer.visualizeAll(seed);

		this.unsubscribeAnnotate = this.annotationManager.on(
			"afterAnnotation",
			({ data }) => {
				this.visualizer.visualize(data);
				this.flush(data.data);
			}
		);
	}

	private createLabelForValue(
		value: number,
		name?: string,
		color?: Color
	): MutableLabel {
		if (this.valueToClass.has(value)) {
			throw new Error(`Value ${value} is already part of this field.`);
		}

		const annotationClass = this.nextClass;
		if (annotationClass > MAX_ANNOTATION_CLASS) {
			throw new Error(
				`This field already has the maximum of ${
					MAX_ANNOTATION_CLASS + 1
				} distinct values that can be edited at once.`
			);
		}
		this.nextClass++;

		this.valueToClass.set(value, annotationClass);
		this.classToValue.set(annotationClass, value);

		const resolvedColor = color ?? this.defaultColorFor(annotationClass);
		return new MutableLabel(
			annotationClass,
			annotationClass,
			name ?? String(value),
			resolvedColor
		);
	}

	private defaultColorFor(rank: number): Color {
		const [r, g, b] = categoricalColor(rank);
		return new Color(
			Math.round(r * 255),
			Math.round(g * 255),
			Math.round(b * 255)
		);
	}

	/**
	 * Introduces a new, previously unused integer value to this field and
	 * makes it available to paint with (e.g. add `3` to a field that only
	 * had `0`/`1`).
	 *
	 * @param value the new integer value
	 * @param name an optional display name (defaults to the value itself)
	 * @param color an optional color (defaults to an auto-generated one)
	 * @returns the new label, which can be passed to `labelManager.selectLabel`
	 */
	public addValue(value: number, name?: string, color?: Color): Label {
		if (!Number.isInteger(value)) {
			throw new Error(
				"Only integer values can be added to a scalar field."
			);
		}

		const label = this.createLabelForValue(value, name, color);
		this.labelManager.registerLabel(label);
		return label;
	}

	/**
	 * Returns every value currently paintable in this session, as labels
	 * (existing field values plus any added via `addValue`).
	 */
	public getValueLabels(): Label[] {
		return this.labelManager.getLabels();
	}

	private flush(indices: ArrayLike<number>): void {
		const values = this.fieldAttribute.array as Float32Array;
		const lut = this.annotationManager.getAnnotationDataLUT();

		for (let i = 0; i < indices.length; i++) {
			const index = indices[i];
			values[index] = this.classToValue.get(lut[index])!;
		}

		this.fieldAttribute.needsUpdate = true;
	}

	public destroy(): void {
		this.unsubscribeAnnotate();
		this.annotationManager.destroy();
		this.undoManager.destroy();
		this.visualizer.destroy();
	}
}
