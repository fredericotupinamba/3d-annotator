import {
	BufferAttribute,
	BufferGeometry,
	SRGBColorSpace,
	Color as ThreeColor,
} from "three";
import type { CoordinateShift, ScalarFieldInfo } from "~entity/ScalarField";
import { analyzeScalarAttribute } from "./ScalarFieldAnalysis";

export interface PointCloudData {
	/** interleaved x,y,z, relative to `shift` */
	positions: Float32Array;
	/** added to `positions` to recover the original real-world coordinates */
	shift: CoordinateShift;
	/** interleaved r,g,b in [0, 1], sRGB encoded (as stored in files), or `null` */
	colors: Float32Array | null;
	scalarFields: { name: string; values: Float32Array }[];
}

/**
 * Converts sRGB encoded colors to the linear working color space in place,
 * exactly like three.js' PLYLoader does, so colors look the same regardless
 * of which loader read them.
 */
function convertSRGBToLinear(colors: Float32Array) {
	const color = new ThreeColor();
	for (let i = 0; i < colors.length; i += 3) {
		color.setRGB(colors[i], colors[i + 1], colors[i + 2], SRGBColorSpace);
		colors[i] = color.r;
		colors[i + 1] = color.g;
		colors[i + 2] = color.b;
	}
}

/**
 * Wraps decoded point cloud data into a {@link BufferGeometry} (without
 * copying any of the arrays), with its scalar fields and coordinate shift
 * described in `userData` as expected by `PointCloud`.
 *
 * @param data the decoded point data. Its color array is converted in place.
 * @returns the geometry, and the buffers that can be transferred when
 *          posting it from a worker
 */
export function createPointCloudGeometry(data: PointCloudData): {
	geometry: BufferGeometry;
	transfer: ArrayBuffer[];
} {
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new BufferAttribute(data.positions, 3));

	if (data.colors) {
		convertSRGBToLinear(data.colors);
		geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
	}

	const scalarFields: ScalarFieldInfo[] = [];
	for (const { name, values } of data.scalarFields) {
		const attributeKey = `scalarField_${name}`;
		geometry.setAttribute(attributeKey, new BufferAttribute(values, 1));
		scalarFields.push({
			name,
			attributeKey,
			...analyzeScalarAttribute(values),
		});
	}
	if (scalarFields.length > 0) {
		geometry.userData.scalarFields = scalarFields;
	}

	geometry.userData.coordinateShift = data.shift;

	// every attribute owns a separate buffer, so all can be transferred
	const transfer = Object.values(geometry.attributes).map(
		(attribute) => attribute.array.buffer as ArrayBuffer
	);

	return { geometry, transfer };
}
