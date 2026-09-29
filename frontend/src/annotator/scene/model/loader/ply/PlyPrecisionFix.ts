import { extractPlyHeaderText, parsePlyHeader } from "./PlyHeader";

export interface CoordinateShift {
	x: number;
	y: number;
	z: number;
}

export interface ShiftedPlyText {
	text: string;
	shift: CoordinateShift;
}

/**
 * Coordinates with a magnitude below this are left untouched: at this scale
 * float32 rounding (used internally by three.js for vertex positions) is
 * not visually noticeable.
 */
const SHIFT_THRESHOLD = 1000;

/**
 * Three.js stores vertex positions in a 32-bit `Float32Array`. When a `.ply`
 * file uses large absolute coordinates (e.g. UTM), the limited precision of
 * float32 at that magnitude causes points to visibly snap to a coarse grid
 * ("staircase" artifacts).
 *
 * For ASCII encoded files this can be fixed by centering the coordinates
 * (subtracting their centroid, computed in full double precision) *before*
 * three.js' loader ever converts them to float32.
 *
 * Binary encoded files are not supported here: if the file stores
 * coordinates as 32-bit floats, the precision loss already happened when
 * the file was exported and cannot be recovered afterwards.
 *
 * @param text the full contents of an ASCII `.ply` file
 * @returns the rewritten file contents and the applied shift, or `null` if
 *          the file is not a (recognizable) ASCII ply, or the coordinates
 *          are already small enough that no shift is necessary
 */
export function shiftAsciiPlyVertices(text: string): ShiftedPlyText | null {
	const headerText = extractPlyHeaderText(text);
	if (!headerText) return null;

	const header = parsePlyHeader(headerText);
	if (!header || header.format !== "ascii") return null;

	const vertexElement = header.elements.find((e) => e.name === "vertex");
	if (!vertexElement) return null;
	if (vertexElement.properties.some((p) => p.isList)) return null;

	const xIdx = vertexElement.properties.findIndex((p) => p.name === "x");
	const yIdx = vertexElement.properties.findIndex((p) => p.name === "y");
	const zIdx = vertexElement.properties.findIndex((p) => p.name === "z");
	if (xIdx === -1 || yIdx === -1 || zIdx === -1) return null;

	const bodyText = text.slice(headerText.length);
	const tokens = bodyText.trim().split(/\s+/);

	// Locate the token index at which each vertex record starts. Elements
	// are walked in header order since ply's ASCII body is one flat,
	// whitespace-separated token stream shared by all elements.
	let cursor = 0;
	const vertexRecordStarts: number[] = [];

	for (const element of header.elements) {
		const isVertex = element === vertexElement;
		const hasList = element.properties.some((p) => p.isList);

		for (let i = 0; i < element.count; i++) {
			if (isVertex) vertexRecordStarts.push(cursor);

			if (hasList) {
				for (const property of element.properties) {
					if (property.isList) {
						const count = parseInt(tokens[cursor], 10);
						cursor += 1 + count;
					} else {
						cursor += 1;
					}
				}
			} else {
				cursor += element.properties.length;
			}
		}
	}

	if (vertexRecordStarts.length === 0) return null;

	let sumX = 0;
	let sumY = 0;
	let sumZ = 0;
	for (const start of vertexRecordStarts) {
		sumX += parseFloat(tokens[start + xIdx]);
		sumY += parseFloat(tokens[start + yIdx]);
		sumZ += parseFloat(tokens[start + zIdx]);
	}

	const count = vertexRecordStarts.length;
	const shift: CoordinateShift = {
		x: sumX / count,
		y: sumY / count,
		z: sumZ / count,
	};

	const magnitude = Math.max(
		Math.abs(shift.x),
		Math.abs(shift.y),
		Math.abs(shift.z)
	);
	if (magnitude < SHIFT_THRESHOLD) return null;

	for (const start of vertexRecordStarts) {
		tokens[start + xIdx] = String(
			parseFloat(tokens[start + xIdx]) - shift.x
		);
		tokens[start + yIdx] = String(
			parseFloat(tokens[start + yIdx]) - shift.y
		);
		tokens[start + zIdx] = String(
			parseFloat(tokens[start + zIdx]) - shift.z
		);
	}

	return { text: headerText + tokens.join(" "), shift };
}
