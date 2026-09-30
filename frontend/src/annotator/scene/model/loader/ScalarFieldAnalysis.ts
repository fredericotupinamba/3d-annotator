import type { ScalarFieldKind } from "~entity/ScalarField";

const CATEGORICAL_MAX_UNIQUE_VALUES = 32;

/**
 * Determines the value range of a scalar field and whether it looks
 * categorical (few distinct integer values, e.g. a classification) or
 * continuous (e.g. intensity).
 *
 * @param values the scalar field's per-point values
 * @returns the detected kind and value range, plus the sorted unique values
 *          for categorical fields
 */
export function analyzeScalarAttribute(values: ArrayLike<number>): {
	kind: ScalarFieldKind;
	min: number;
	max: number;
	uniqueValues?: number[];
} {
	let min = Infinity;
	let max = -Infinity;
	const uniqueValues = new Set<number>();
	let isCategorical = true;

	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (value < min) min = value;
		if (value > max) max = value;

		if (isCategorical) {
			if (!Number.isInteger(value)) {
				isCategorical = false;
			} else {
				uniqueValues.add(value);
				if (uniqueValues.size > CATEGORICAL_MAX_UNIQUE_VALUES) {
					isCategorical = false;
				}
			}
		}
	}

	return isCategorical
		? {
				kind: "categorical",
				min,
				max,
				uniqueValues: Array.from(uniqueValues).sort((a, b) => a - b),
		  }
		: { kind: "continuous", min, max };
}
