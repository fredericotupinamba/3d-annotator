import {
	MutableLabel,
	NEUTRAL_LABEL,
	type Label,
	type LabelLUT,
	type LabelMap,
	type MutableLabelLUT,
} from "~entity/Annotation";
import { EventManager } from "~events/EventManager";
import { type Subscribable } from "~events/Events";

export type LabelManagerEvents = {
	activeLabelChange: Label;
	lockChange: Label;
	visibilityChange: Label;
};

/**
 * Menages labels and shares the information about them
 */
export class LabelManager implements Subscribable<LabelManagerEvents> {
	private readonly _eventManager = new EventManager<LabelManagerEvents>();
	public on = this._eventManager.on.bind(this._eventManager);

	private readonly _labels: Label[];
	private readonly _labelLUT: MutableLabelLUT;
	private readonly _labelMap: LabelMap;

	private _activeLabel: Label;

	/**
	 * Constructs a new instance of a LabelManager
	 *
	 * @param labels
	 */
	constructor(labels: Label[]) {
		if (labels.length === 0) {
			throw new Error("'labels' is empty");
		}

		this._labels = this._cloneLabels(labels);
		this._labelLUT = this._generateLabelLUT();
		this._labelMap = this._generateLabelMap();
		this._activeLabel = labels[0];
	}

	private _cloneLabels(labels: Label[]): Label[] {
		return labels.map(
			(label) =>
				new MutableLabel(
					label.id,
					label.annotationClass,
					label.name,
					label.color
				)
		);
	}

	private _generateLabelLUT(): MutableLabelLUT {
		const labelLUT = new Array<MutableLabel>(
			NEUTRAL_LABEL.annotationClass + 1
		);
		labelLUT[NEUTRAL_LABEL.annotationClass] = NEUTRAL_LABEL;
		for (const label of this._labels) {
			labelLUT[label.annotationClass] = label;
		}
		return labelLUT;
	}

	private _generateLabelMap(): LabelMap {
		const labelMap = new Map<number, Label>();
		for (const label of this._labels) {
			labelMap.set(label.annotationClass, label);
		}
		labelMap.set(NEUTRAL_LABEL.annotationClass, NEUTRAL_LABEL);
		return labelMap;
	}

	/**
	 * Returns the active label
	 *
	 * @returns the active label
	 */
	public getActiveLabel(): Label {
		return this._activeLabel;
	}

	/**
	 * Sets the active label
	 *
	 * @param label the label
	 */
	public selectLabel(label: Label): void {
		this._activeLabel = this._findLabel(label);
		this._eventManager.emit("activeLabelChange", this._activeLabel);
	}

	private _findLabel(label: Label): MutableLabel {
		const basicLabel = this._labelLUT[label.annotationClass];
		if (basicLabel === undefined) {
			throw new Error("'label' not found in LabelManager");
		}

		return basicLabel;
	}

	/**
	 * Selects the eraser (the {@link NEUTRAL_LABEL} will be selected)
	 */
	public selectEraser(): void {
		this._activeLabel = NEUTRAL_LABEL;
		this._eventManager.emit("activeLabelChange", this._activeLabel);
	}

	public toggleLock(label: Label): void {
		const basicLabel = this._findLabel(label);
		basicLabel.locked = !basicLabel.locked;
		this._eventManager.emit("lockChange", basicLabel);
	}

	public toggleVisibility(label: Label): void {
		const basicLabel = this._findLabel(label);
		basicLabel.annotationVisible = !basicLabel.annotationVisible;
		this._eventManager.emit("visibilityChange", basicLabel);
	}

	/**
	 * Returns true when the eraser is currently selected
	 *
	 * @returns true when the eraser is currently selected
	 */
	public isEraserSelected(): boolean {
		return this._activeLabel.isNeutral;
	}

	/**
	 * Returns a copy of the label array
	 *
	 * @returns a copy of the label array
	 */
	public getLabels(): Label[] {
		return [...this._labels];
	}

	/**
	 * Registers a new label at runtime (e.g. a locally-scoped label created
	 * while editing a scalar field, not persisted to the backend). Throws if
	 * `label`'s `annotationClass` is already in use.
	 *
	 * @param label the label to register
	 */
	public registerLabel(label: MutableLabel): void {
		if (this._labelLUT[label.annotationClass] !== undefined) {
			throw new Error(
				`annotationClass ${label.annotationClass} is already registered.`
			);
		}

		this._labels.push(label);
		this._labelLUT[label.annotationClass] = label;
		this._labelMap.set(label.annotationClass, label);
	}

	/**
	 * Returns the label map including the neutral label.
	 *
	 * TODO: Deprecate
	 *
	 * @returns the label map including the neutral label
	 */
	public getLabelMap(): LabelMap {
		return this._labelMap;
	}

	/**
	 * Returns the label look up table including the neutral label.
	 *
	 * @returns the label LUT including the neutral label
	 */
	public getLabelLUT(): LabelLUT {
		return this._labelLUT;
	}
}
