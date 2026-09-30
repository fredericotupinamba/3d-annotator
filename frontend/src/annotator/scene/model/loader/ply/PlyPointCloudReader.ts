import type { CoordinateShift } from "~entity/ScalarField";
import type { PointCloudData } from "../PointCloudGeometry";
import {
	findScalarPropertyNames,
	type PlyHeader,
	type PlyProperty,
} from "./PlyHeader";

/**
 * A streaming reader for `.ply` point clouds (a `vertex` element without
 * faces), in ASCII or binary encoding.
 *
 * Unlike three.js' `PLYLoader`, which collects every value in plain JS
 * arrays first (~300 bytes per point for binary, ~1 KB for ASCII files),
 * values are written straight into preallocated typed arrays while the file
 * is fed in chunks, so the memory needed is little more than the final
 * geometry. Files with faces (meshes) are still left to three.js.
 */

interface PlyTypeInfo {
	size: number;
	read: (view: DataView, offset: number, littleEndian: boolean) => number;
	/** multiplier to map a color stored in this type to [0, 1] */
	colorScale: number;
}

const INT8: PlyTypeInfo = {
	size: 1,
	read: (v, o) => v.getInt8(o),
	colorScale: 1 / 255,
};
const UINT8: PlyTypeInfo = {
	size: 1,
	read: (v, o) => v.getUint8(o),
	colorScale: 1 / 255,
};
const INT16: PlyTypeInfo = {
	size: 2,
	read: (v, o, le) => v.getInt16(o, le),
	colorScale: 1 / 65535,
};
const UINT16: PlyTypeInfo = {
	size: 2,
	read: (v, o, le) => v.getUint16(o, le),
	colorScale: 1 / 65535,
};
const INT32: PlyTypeInfo = {
	size: 4,
	read: (v, o, le) => v.getInt32(o, le),
	colorScale: 1 / 255,
};
const UINT32: PlyTypeInfo = {
	size: 4,
	read: (v, o, le) => v.getUint32(o, le),
	colorScale: 1 / 255,
};
const FLOAT32: PlyTypeInfo = {
	size: 4,
	read: (v, o, le) => v.getFloat32(o, le),
	colorScale: 1,
};
const FLOAT64: PlyTypeInfo = {
	size: 8,
	read: (v, o, le) => v.getFloat64(o, le),
	colorScale: 1,
};

const PLY_TYPES: Partial<Record<string, PlyTypeInfo>> = {
	char: INT8,
	int8: INT8,
	uchar: UINT8,
	uint8: UINT8,
	short: INT16,
	int16: INT16,
	ushort: UINT16,
	uint16: UINT16,
	int: INT32,
	int32: INT32,
	uint: UINT32,
	uint32: UINT32,
	float: FLOAT32,
	float32: FLOAT32,
	double: FLOAT64,
	float64: FLOAT64,
};

/** same property names three.js' PLYLoader maps to position and color */
const POSITION_NAMES = [
	["x", "px", "posx"],
	["y", "py", "posy"],
	["z", "pz", "posz"],
];
const COLOR_NAMES = [
	["red", "diffuse_red", "r", "diffuse_r"],
	["green", "diffuse_green", "g", "diffuse_g"],
	["blue", "diffuse_blue", "b", "diffuse_b"],
];

/** elements that make a ply file a mesh rather than a point cloud */
const FACE_ELEMENTS = new Set(["face", "tristrips"]);

type PlyFormat = "ascii" | "binary_little_endian" | "binary_big_endian";

export interface PlyPointCloudLayout {
	format: PlyFormat;
	count: number;
	properties: PlyProperty[];
	types: PlyTypeInfo[];
	/** byte size of one binary vertex record */
	recordSize: number;
	positionIndices: [number, number, number];
	colorIndices: [number, number, number] | null;
	scalarFields: { name: string; index: number }[];
}

function findPropertyIndex(properties: PlyProperty[], names: string[]) {
	for (const name of names) {
		const index = properties.findIndex((p) => p.name === name);
		if (index !== -1) return index;
	}
	return -1;
}

/**
 * Checks whether a ply file can be read by {@link PlyPointCloudReader}: the
 * first element must be `vertex` (with x, y, z and no list properties) and
 * the file must not contain faces.
 *
 * @param header the file's parsed header
 * @returns the vertex layout, or `null` if the file must be loaded by three.js
 */
export function getPlyPointCloudLayout(
	header: PlyHeader
): PlyPointCloudLayout | null {
	const format = header.format as PlyFormat;
	if (
		format !== "ascii" &&
		format !== "binary_little_endian" &&
		format !== "binary_big_endian"
	) {
		return null;
	}

	const vertexElement = header.elements[0];
	if (!vertexElement || vertexElement.name !== "vertex") return null;
	if (header.elements.some((e) => FACE_ELEMENTS.has(e.name) && e.count > 0)) {
		return null;
	}

	const { properties } = vertexElement;
	if (properties.some((p) => p.isList)) return null;

	const types: PlyTypeInfo[] = [];
	for (const property of properties) {
		const type = PLY_TYPES[property.type];
		if (!type) return null;
		types.push(type);
	}

	const positionIndices = POSITION_NAMES.map((names) =>
		findPropertyIndex(properties, names)
	) as [number, number, number];
	if (positionIndices.includes(-1)) return null;

	const colorIndices = COLOR_NAMES.map((names) =>
		findPropertyIndex(properties, names)
	) as [number, number, number];

	const scalarFields = findScalarPropertyNames(header).map((name) => ({
		name,
		index: properties.findIndex((p) => p.name === name),
	}));

	return {
		format,
		count: vertexElement.count,
		properties,
		types,
		recordSize: types.reduce((sum, t) => sum + t.size, 0),
		positionIndices,
		colorIndices: colorIndices.includes(-1) ? null : colorIndices,
		scalarFields,
	};
}

/**
 * Collects vertices fed as binary chunks ({@link pushBytes}) or ASCII text
 * chunks ({@link pushText}), depending on the file's format.
 *
 * Coordinates are stored relative to the first point, computed in double
 * precision, so large absolute coordinates (e.g. UTM) stored as doubles
 * don't suffer from float32 precision loss.
 */
export class PlyPointCloudReader {
	private readonly layout: PlyPointCloudLayout;
	private readonly littleEndian: boolean;
	private readonly colorScales: number[];

	private readonly positions: Float32Array;
	private readonly colors: Float32Array | null;
	private readonly scalarValues: Float32Array[];

	/** the values of the vertex currently being read */
	private readonly record: Float64Array;
	private recordFill = 0;
	private count = 0;
	private shift: CoordinateShift = { x: 0, y: 0, z: 0 };

	/** a binary record split across two chunks */
	private readonly pendingBytes: Uint8Array;
	private pendingByteCount = 0;
	/** an ASCII token split across two chunks */
	private pendingText = "";

	constructor(layout: PlyPointCloudLayout) {
		this.layout = layout;
		this.littleEndian = layout.format !== "binary_big_endian";
		this.colorScales = layout.colorIndices
			? layout.colorIndices.map((index) => layout.types[index].colorScale)
			: [];

		this.positions = new Float32Array(layout.count * 3);
		this.colors = layout.colorIndices
			? new Float32Array(layout.count * 3)
			: null;
		this.scalarValues = layout.scalarFields.map(
			() => new Float32Array(layout.count)
		);

		this.record = new Float64Array(layout.properties.length);
		this.pendingBytes = new Uint8Array(layout.recordSize);
	}

	/** true once all vertices declared in the header have been read */
	public get isComplete(): boolean {
		return this.count >= this.layout.count;
	}

	private commitRecord() {
		const i = this.count;
		const record = this.record;
		const [xIndex, yIndex, zIndex] = this.layout.positionIndices;

		if (i === 0) {
			this.shift = {
				x: record[xIndex],
				y: record[yIndex],
				z: record[zIndex],
			};
		}
		this.positions[i * 3] = record[xIndex] - this.shift.x;
		this.positions[i * 3 + 1] = record[yIndex] - this.shift.y;
		this.positions[i * 3 + 2] = record[zIndex] - this.shift.z;

		const { colorIndices } = this.layout;
		if (this.colors && colorIndices) {
			for (let c = 0; c < 3; c++) {
				this.colors[i * 3 + c] =
					record[colorIndices[c]] * this.colorScales[c];
			}
		}

		const { scalarFields } = this.layout;
		for (let f = 0; f < scalarFields.length; f++) {
			this.scalarValues[f][i] = record[scalarFields[f].index];
		}

		this.count++;
	}

	private decodeRecord(view: DataView, base: number) {
		const { types } = this.layout;
		let offset = base;
		for (let p = 0; p < types.length; p++) {
			this.record[p] = types[p].read(view, offset, this.littleEndian);
			offset += types[p].size;
		}
		this.commitRecord();
	}

	/**
	 * Feeds the next chunk of a binary encoded vertex body.
	 */
	public pushBytes(bytes: Uint8Array): void {
		const { recordSize } = this.layout;
		let offset = 0;

		if (this.pendingByteCount > 0) {
			const needed = recordSize - this.pendingByteCount;
			const taken = Math.min(needed, bytes.length);
			this.pendingBytes.set(
				bytes.subarray(0, taken),
				this.pendingByteCount
			);
			this.pendingByteCount += taken;
			offset = taken;
			if (this.pendingByteCount < recordSize) return;

			this.pendingByteCount = 0;
			if (!this.isComplete) {
				this.decodeRecord(new DataView(this.pendingBytes.buffer), 0);
			}
		}

		const view = new DataView(
			bytes.buffer,
			bytes.byteOffset,
			bytes.byteLength
		);
		while (offset + recordSize <= bytes.length && !this.isComplete) {
			this.decodeRecord(view, offset);
			offset += recordSize;
		}

		if (!this.isComplete && offset < bytes.length) {
			this.pendingBytes.set(bytes.subarray(offset), 0);
			this.pendingByteCount = bytes.length - offset;
		}
	}

	private pushToken(token: string) {
		this.record[this.recordFill++] = parseFloat(token);
		if (this.recordFill === this.record.length) {
			this.recordFill = 0;
			this.commitRecord();
		}
	}

	/**
	 * Feeds the next chunk of an ASCII encoded vertex body. Vertices are
	 * whitespace separated tokens, in the header's property order.
	 */
	public pushText(chunk: string): void {
		const text = this.pendingText + chunk;
		this.pendingText = "";

		const length = text.length;
		let i = 0;
		while (i < length && !this.isComplete) {
			// any char code <= 32 (space, tab, CR, LF, ...) is a separator
			if (text.charCodeAt(i) <= 32) {
				i++;
				continue;
			}
			let end = i + 1;
			while (end < length && text.charCodeAt(end) > 32) end++;

			if (end === length) {
				// the token may continue in the next chunk
				this.pendingText = text.substring(i);
				return;
			}
			this.pushToken(text.substring(i, end));
			i = end;
		}
	}

	/**
	 * @returns the point cloud read so far. The reader must not be used afterwards.
	 */
	public finish(): PointCloudData {
		if (this.pendingText && !this.isComplete) {
			this.pushToken(this.pendingText);
			this.pendingText = "";
		}

		const count = this.count;
		if (count < this.layout.count) {
			console.warn(
				`PLY: header declares ${this.layout.count} vertices, but the file only contains ${count}.`
			);
		}
		const trim = (array: Float32Array, itemSize = 1) =>
			count === this.layout.count
				? array
				: array.slice(0, count * itemSize);

		return {
			positions: trim(this.positions, 3),
			shift: this.shift,
			colors: this.colors ? trim(this.colors, 3) : null,
			scalarFields: this.layout.scalarFields.map((field, f) => ({
				name: field.name,
				values: trim(this.scalarValues[f]),
			})),
		};
	}
}
