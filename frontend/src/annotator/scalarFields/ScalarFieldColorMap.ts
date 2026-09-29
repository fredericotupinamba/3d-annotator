/**
 * Color mapping utilities to visualize point cloud scalar fields (e.g.
 * intensity, classification) as point colors.
 */

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

// Polynomial approximation of Google's "Turbo" colormap.
// Source: https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html (public domain)
const RED_V4 = [0.13572138, 4.6153926, -42.66032258, 132.13108234];
const GREEN_V4 = [0.09140261, 2.19418839, 4.84296658, -14.18503333];
const BLUE_V4 = [0.1066733, 12.64194608, -60.58204836, 110.36276771];
const RED_V2 = [-152.94239396, 59.28637943];
const GREEN_V2 = [4.27729857, 2.82956604];
const BLUE_V2 = [-89.90310912, 27.34824973];

function turboChannel(x: number, v4: number[], v2: number[]): number {
	const x2 = x * x;
	const x3 = x2 * x;
	const x4 = x3 * x;
	const x5 = x4 * x;
	return (
		v4[0] + v4[1] * x + v4[2] * x2 + v4[3] * x3 + v2[0] * x4 + v2[1] * x5
	);
}

/**
 * Maps a value in `[0, 1]` to an RGB color (each channel in `[0, 1]`) using
 * the "Turbo" colormap. Well suited for continuous scalar fields.
 */
export function turboColormap(value: number): [number, number, number] {
	const x = clamp01(value);
	return [
		clamp01(turboChannel(x, RED_V4, RED_V2)),
		clamp01(turboChannel(x, GREEN_V4, GREEN_V2)),
		clamp01(turboChannel(x, BLUE_V4, BLUE_V2)),
	];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const k = (n: number) => (n + h * 12) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) =>
		l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)];
}

const GOLDEN_ANGLE = 0.618033988749895;

/**
 * Returns a visually distinct color for the given index, regardless of how
 * many distinct categories there are in total. Well suited for categorical
 * scalar fields (e.g. classification codes).
 */
export function categoricalColor(index: number): [number, number, number] {
	const hue = (index * GOLDEN_ANGLE) % 1;
	return hslToRgb(hue, 0.65, 0.55);
}

/**
 * Computes a color per point from a continuous scalar field.
 *
 * @param values the scalar field's raw values, one per point
 * @param min the field's minimum value (maps to the start of the colormap)
 * @param max the field's maximum value (maps to the end of the colormap)
 * @returns a `Float32Array` of RGB colors (length `values.length * 3`)
 */
export function computeContinuousColors(
	values: ArrayLike<number>,
	min: number,
	max: number
): Float32Array {
	const range = max - min || 1;
	const colors = new Float32Array(values.length * 3);
	for (let i = 0; i < values.length; i++) {
		const [r, g, b] = turboColormap((values[i] - min) / range);
		colors[i * 3] = r;
		colors[i * 3 + 1] = g;
		colors[i * 3 + 2] = b;
	}
	return colors;
}

/**
 * Computes a color per point from a categorical scalar field, assigning
 * each unique value a distinct color.
 *
 * @param values the scalar field's raw values, one per point
 * @param uniqueValues all distinct values that occur in `values`
 * @returns a `Float32Array` of RGB colors (length `values.length * 3`)
 */
export function computeCategoricalColors(
	values: ArrayLike<number>,
	uniqueValues: number[]
): Float32Array {
	const colorByValue = new Map<number, [number, number, number]>();
	uniqueValues.forEach((value, index) => {
		colorByValue.set(value, categoricalColor(index));
	});

	const colors = new Float32Array(values.length * 3);
	for (let i = 0; i < values.length; i++) {
		const [r, g, b] = colorByValue.get(values[i]) ?? [0.8, 0.8, 0.8];
		colors[i * 3] = r;
		colors[i * 3 + 1] = g;
		colors[i * 3 + 2] = b;
	}
	return colors;
}
