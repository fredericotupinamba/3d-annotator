/**
 * A minimal writer for the LAS 1.4 point cloud format (uncompressed).
 *
 * Writes Point Data Record Format 7 (position + intensity + classification +
 * RGB), optionally extended with arbitrary extra scalar fields (e.g.
 * `tree_id`) via the standard "Extra Bytes" VLR, so they show up as regular
 * dimensions in PDAL, CloudCompare, QGIS, etc.
 *
 * Extra fields named like a standard LAS dimension (as produced when a LAS
 * file is imported, e.g. `Intensity`) are written to that dimension instead.
 * A source `Classification` field is kept as `OriginalClassification`, since
 * the Classification dimension holds the segmented classes.
 *
 * Spec reference: ASPRS LAS Specification 1.4 - R15.
 */

const HEADER_SIZE = 375;
const POINT_DATA_FORMAT = 7;
/** X, Y, Z, Intensity, flags, Classification, UserData, ScanAngle, PointSourceId, GpsTime, R, G, B */
const BASE_POINT_RECORD_LENGTH = 36;
const EXTRA_BYTES_DESCRIPTOR_LENGTH = 192;
const VLR_HEADER_LENGTH = 54;
/** millimeter resolution - accurate enough for virtually all lidar/photogrammetry data */
const COORDINATE_SCALE = 0.001;
/** LAS stores color as 16-bit; convention is to fill the low byte too (value * 257) */
const COLOR_8_TO_16_BIT = 257;

/** standard point record dimensions that extra fields can be written to, with their max value */
const STANDARD_FIELD_MAX_VALUE = new Map([
	["Intensity", 0xffff],
	["ReturnNumber", 0x0f],
	["NumberOfReturns", 0x0f],
	["UserData", 0xff],
	["PointSourceId", 0xffff],
]);
/** prefix for extra fields that clash with a standard dimension but can't be written to it */
const CLASHING_FIELD_PREFIX = "Original";

export interface LasExtraField {
	/** dimension name, as it will show up in downstream tools (max 32 ASCII chars) */
	name: string;
	/** one value per point, in the same order as `positions`/`classification` */
	values: ArrayLike<number>;
}

export interface LasExportInput {
	/** interleaved x,y,z, length = pointCount * 3, in the model's local (viewer) coordinates */
	positions: ArrayLike<number>;
	/** added to `positions` to recover the original real-world coordinates */
	shift: { x: number; y: number; z: number };
	/** interleaved r,g,b in [0, 1], length = pointCount * 3; omit if the source had no color */
	colors?: ArrayLike<number> | null;
	/** one classification byte (0-255) per point, e.g. from the annotation tool's labels */
	classification: ArrayLike<number>;
	/** additional per-point scalar fields to preserve as LAS "Extra Bytes" dimensions */
	extraFields?: LasExtraField[];
	generatingSoftware?: string;
}

function writeAsciiString(
	view: DataView,
	offset: number,
	value: string,
	maxLength: number
): void {
	for (let i = 0; i < maxLength; i++) {
		view.setUint8(offset + i, i < value.length ? value.charCodeAt(i) : 0);
	}
}

function computeBounds(
	positions: ArrayLike<number>,
	shift: { x: number; y: number; z: number }
): { min: [number, number, number]; max: [number, number, number] } {
	const pointCount = positions.length / 3;
	const min: [number, number, number] = [Infinity, Infinity, Infinity];
	const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
	const shiftArr = [shift.x, shift.y, shift.z];

	for (let i = 0; i < pointCount; i++) {
		for (let axis = 0; axis < 3; axis++) {
			const value = positions[i * 3 + axis] + shiftArr[axis];
			if (value < min[axis]) min[axis] = value;
			if (value > max[axis]) max[axis] = value;
		}
	}

	if (pointCount === 0) {
		min.fill(0);
		max.fill(0);
	}

	return { min, max };
}

function fitsStandardField(values: ArrayLike<number>, maxValue: number) {
	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (!Number.isInteger(value) || value < 0 || value > maxValue) {
			return false;
		}
	}
	return true;
}

/**
 * Splits extra fields into those written to a standard dimension (keyed by
 * dimension name) and those written as Extra Bytes dimensions.
 */
function partitionExtraFields(fields: LasExtraField[]): {
	standard: Map<string, ArrayLike<number>>;
	extra: LasExtraField[];
} {
	const standard = new Map<string, ArrayLike<number>>();
	const extra: LasExtraField[] = [];

	for (const field of fields) {
		const maxValue = STANDARD_FIELD_MAX_VALUE.get(field.name);
		if (
			maxValue !== undefined &&
			!standard.has(field.name) &&
			fitsStandardField(field.values, maxValue)
		) {
			standard.set(field.name, field.values);
		} else if (maxValue !== undefined || field.name === "Classification") {
			extra.push({
				name: CLASHING_FIELD_PREFIX + field.name,
				values: field.values,
			});
		} else {
			extra.push(field);
		}
	}

	return { standard, extra };
}

/**
 * Builds a complete, uncompressed LAS 1.4 file.
 *
 * @param input the point data to write
 * @returns the file contents, ready to be saved as a `.las` file
 */
export function buildLasFile(input: LasExportInput): ArrayBuffer {
	const {
		positions,
		shift,
		colors,
		classification,
		extraFields: inputExtraFields = [],
		generatingSoftware = "3D-Annotator",
	} = input;

	const { standard: standardFields, extra: extraFields } =
		partitionExtraFields(inputExtraFields);
	const intensity = standardFields.get("Intensity");
	const returnNumber = standardFields.get("ReturnNumber");
	const numberOfReturns = standardFields.get("NumberOfReturns");
	const userData = standardFields.get("UserData");
	const pointSourceId = standardFields.get("PointSourceId");

	const pointCount = classification.length;
	const extraBytesPerPoint = extraFields.length * 8;
	const pointRecordLength = BASE_POINT_RECORD_LENGTH + extraBytesPerPoint;

	const vlrCount = extraFields.length > 0 ? 1 : 0;
	const vlrLength =
		vlrCount > 0
			? VLR_HEADER_LENGTH +
			  extraFields.length * EXTRA_BYTES_DESCRIPTOR_LENGTH
			: 0;

	const pointDataOffset = HEADER_SIZE + vlrLength;
	const totalSize = pointDataOffset + pointCount * pointRecordLength;

	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);

	const { min, max } = computeBounds(positions, shift);

	// ---- Public header block ----
	writeAsciiString(view, 0, "LASF", 4);
	view.setUint16(4, 0, true); // file source ID
	view.setUint16(6, 0, true); // global encoding
	// project ID GUID (16 bytes) left as 0

	view.setUint8(24, 1); // version major
	view.setUint8(25, 4); // version minor

	writeAsciiString(view, 26, "3D-Annotator", 32); // system identifier
	writeAsciiString(view, 58, generatingSoftware, 32);

	const now = new Date();
	const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
	const dayOfYear =
		Math.floor((now.getTime() - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
	view.setUint16(90, dayOfYear, true);
	view.setUint16(92, now.getUTCFullYear(), true);

	view.setUint16(94, HEADER_SIZE, true);
	view.setUint32(96, pointDataOffset, true);
	view.setUint32(100, vlrCount, true);
	view.setUint8(104, POINT_DATA_FORMAT);
	view.setUint16(105, pointRecordLength, true);

	// legacy point counts: must be 0 for point data formats >= 6 (LAS 1.4 spec)
	view.setUint32(107, 0, true);
	for (let i = 0; i < 5; i++) {
		view.setUint32(111 + i * 4, 0, true);
	}

	view.setFloat64(131, COORDINATE_SCALE, true); // x scale
	view.setFloat64(139, COORDINATE_SCALE, true); // y scale
	view.setFloat64(147, COORDINATE_SCALE, true); // z scale
	view.setFloat64(155, min[0], true); // x offset
	view.setFloat64(163, min[1], true); // y offset
	view.setFloat64(171, min[2], true); // z offset

	view.setFloat64(179, max[0], true);
	view.setFloat64(187, min[0], true);
	view.setFloat64(195, max[1], true);
	view.setFloat64(203, min[1], true);
	view.setFloat64(211, max[2], true);
	view.setFloat64(219, min[2], true);

	view.setFloat64(227, 0, true); // start of waveform data packet record
	view.setBigUint64(235, BigInt(0), true); // start of first extended VLR (none)
	view.setUint32(243, 0, true); // number of extended VLRs
	view.setBigUint64(247, BigInt(pointCount), true); // extended number of point records
	for (let i = 0; i < 15; i++) {
		view.setBigUint64(255 + i * 8, BigInt(0), true);
	}

	// ---- Variable length records ----
	let cursor = HEADER_SIZE;
	if (extraFields.length > 0) {
		view.setUint16(cursor, 0, true); // reserved
		writeAsciiString(view, cursor + 2, "LASF_Spec", 16);
		view.setUint16(cursor + 18, 4, true); // record ID: Extra Bytes
		view.setUint16(
			cursor + 20,
			extraFields.length * EXTRA_BYTES_DESCRIPTOR_LENGTH,
			true
		);
		writeAsciiString(view, cursor + 22, "Extra Bytes", 32);
		cursor += VLR_HEADER_LENGTH;

		for (const field of extraFields) {
			const start = cursor;
			view.setUint16(start, 0, true); // reserved
			view.setUint8(start + 2, 10); // data type: double
			view.setUint8(start + 3, 0); // options: no min/max/scale/offset/no-data
			writeAsciiString(view, start + 4, field.name, 32);
			// unused(4) + no_data(24) + min(24) + max(24) + scale(24) + offset(24) left as 0
			writeAsciiString(view, start + 160, "", 32); // description
			cursor += EXTRA_BYTES_DESCRIPTOR_LENGTH;
		}
	}

	// ---- Point data records ----
	for (let i = 0; i < pointCount; i++) {
		const recordOffset = pointDataOffset + i * pointRecordLength;

		const x = positions[i * 3] + shift.x;
		const y = positions[i * 3 + 1] + shift.y;
		const z = positions[i * 3 + 2] + shift.z;

		view.setInt32(
			recordOffset,
			Math.round((x - min[0]) / COORDINATE_SCALE),
			true
		);
		view.setInt32(
			recordOffset + 4,
			Math.round((y - min[1]) / COORDINATE_SCALE),
			true
		);
		view.setInt32(
			recordOffset + 8,
			Math.round((z - min[2]) / COORDINATE_SCALE),
			true
		);

		view.setUint16(recordOffset + 12, intensity?.[i] ?? 0, true);
		// return number (bits 0-3) and number of returns (bits 4-7), default 1
		view.setUint8(
			recordOffset + 14,
			(returnNumber?.[i] ?? 1) | ((numberOfReturns?.[i] ?? 1) << 4)
		);
		view.setUint8(recordOffset + 15, 0); // classification flags / scanner channel
		view.setUint8(recordOffset + 16, classification[i] & 0xff);
		view.setUint8(recordOffset + 17, userData?.[i] ?? 0);
		view.setInt16(recordOffset + 18, 0, true); // scan angle
		view.setUint16(recordOffset + 20, pointSourceId?.[i] ?? 0, true);
		view.setFloat64(recordOffset + 22, 0, true); // GPS time

		if (colors) {
			view.setUint16(
				recordOffset + 30,
				Math.round(colors[i * 3] * 255) * COLOR_8_TO_16_BIT,
				true
			);
			view.setUint16(
				recordOffset + 32,
				Math.round(colors[i * 3 + 1] * 255) * COLOR_8_TO_16_BIT,
				true
			);
			view.setUint16(
				recordOffset + 34,
				Math.round(colors[i * 3 + 2] * 255) * COLOR_8_TO_16_BIT,
				true
			);
		} else {
			view.setUint16(recordOffset + 30, 0, true);
			view.setUint16(recordOffset + 32, 0, true);
			view.setUint16(recordOffset + 34, 0, true);
		}

		for (let f = 0; f < extraFields.length; f++) {
			view.setFloat64(
				recordOffset + BASE_POINT_RECORD_LENGTH + f * 8,
				extraFields[f].values[i],
				true
			);
		}
	}

	return buffer;
}
