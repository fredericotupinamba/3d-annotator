export type ScalarFieldKind = "continuous" | "categorical";

/**
 * Describes a scalar field (e.g. intensity, classification) read from a
 * point cloud's source file (currently only `.ply` custom vertex
 * properties).
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
