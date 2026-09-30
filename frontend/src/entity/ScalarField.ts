export type ScalarFieldKind = "continuous" | "categorical";

/**
 * The total translation applied to a point cloud's raw coordinates (e.g. to
 * avoid float32 precision loss with large absolute coordinates). Adding this
 * back to a point's viewer-local position recovers its original coordinate.
 */
export interface CoordinateShift {
	x: number;
	y: number;
	z: number;
}

/**
 * Describes a scalar field (e.g. intensity, classification) read from a
 * point cloud's source file (`.ply` custom vertex properties, or `.las`/`.laz`
 * standard and Extra Bytes dimensions).
 */
export interface ScalarFieldInfo {
	/** the original property name, as found in the source file */
	name: string;
	/** the {@link THREE.BufferAttribute} name storing this field's values */
	attributeKey: string;
	kind: ScalarFieldKind;
	min: number;
	max: number;
	/**
	 * Present (and capped in size) only when `kind === "categorical"`.
	 */
	uniqueValues?: number[];
}

/**
 * Hides points whose value for `fieldName` falls outside of `[min, max]`.
 */
export interface RangeScalarFieldFilter {
	fieldName: string;
	mode: "range";
	min: number;
	max: number;
}

/**
 * Hides points whose value for `fieldName` is not one of `selectedValues`.
 * Only applicable to categorical scalar fields.
 */
export interface SetScalarFieldFilter {
	fieldName: string;
	mode: "set";
	selectedValues: number[];
}

export type ScalarFieldFilter = RangeScalarFieldFilter | SetScalarFieldFilter;
