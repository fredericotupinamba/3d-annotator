import type { CoordinateShift } from "~entity/ScalarField";

/**
 * A reader for the ASPRS LAS point cloud format (versions 1.0 - 1.4,
 * point data record formats 0 - 10), including dimensions declared via the
 * "Extra Bytes" VLR.
 *
 * LAZ files share the exact same header and VLRs, only their point records
 * are compressed. Once decompressed (see `LazDecompressor`) they are decoded
 * by {@link decodeLasPoints} just like LAS point records.
 *
 * Spec reference: ASPRS LAS Specification 1.4 - R15.
 */

const LAS_SIGNATURE = "LASF";
const VLR_HEADER_LENGTH = 54;
const EXTRA_BYTES_DESCRIPTOR_LENGTH = 192;
const EXTRA_BYTES_USER_ID = "LASF_Spec";
const EXTRA_BYTES_RECORD_ID = 4;

/** size in bytes of the standard fields of each point data record format */
const POINT_FORMAT_BASE_LENGTH = [20, 28, 26, 34, 57, 63, 30, 36, 38, 59, 67];

/** byte offset of the R,G,B fields for point data record formats that have them */
const RGB_OFFSET: Partial<Record<number, number>> = {
	2: 20,
	3: 28,
	5: 28,
	7: 30,
	8: 30,
	10: 30,
};

/** point formats 6 - 10 (LAS 1.4) use a different layout for the standard fields */
const FIRST_EXTENDED_POINT_FORMAT = 6;

/** Extra Bytes data types 1 - 10 (1-indexed): size in bytes */
const EXTRA_BYTES_TYPE_SIZE = [1, 1, 2, 2, 4, 4, 8, 8, 4, 8];

const PROGRESS_INTERVAL = 1 << 18;

/** Extra Bytes dimensions treated as colors if the point format has no RGB */
const COLOR_DIMENSION_NAMES = ["red", "green", "blue"];

export interface LasHeader {
	versionMajor: number;
	versionMinor: number;
	headerSize: number;
	pointDataOffset: number;
	vlrCount: number;
	/** the point data record format (0 - 10), without LAZ compression bits */
	pointFormat: number;
	/** true if the point records are LAZ compressed */
	isCompressed: boolean;
	pointRecordLength: number;
	pointCount: number;
	scale: [number, number, number];
	offset: [number, number, number];
}

/**
 * A per-point dimension declared in the "Extra Bytes" VLR (e.g. `tree_id`).
 */
export interface LasExtraBytesDimension {
	name: string;
	/** byte offset of this dimension within a point record */
	recordOffset: number;
	/** reads the raw (unscaled) value at the given absolute byte offset */
	read: (view: DataView, byteOffset: number) => number;
	scale: number;
	offset: number;
}

export interface DecodedLasPoints {
	/** interleaved x,y,z, relative to `shift` (small values, float32 friendly) */
	positions: Float32Array;
	/** added to `positions` to recover the original real-world coordinates */
	shift: CoordinateShift;
	/** interleaved r,g,b in [0, 1], sRGB encoded (as stored in the file), or `null` if the format has no color */
	colors: Float32Array | null;
	/** standard LAS dimensions (e.g. Intensity, Classification) and all Extra Bytes dimensions */
	scalarFields: { name: string; values: Float32Array }[];
}

function readAsciiString(
	view: DataView,
	offset: number,
	length: number
): string {
	let result = "";
	for (let i = 0; i < length; i++) {
		const code = view.getUint8(offset + i);
		if (code === 0) break;
		result += String.fromCharCode(code);
	}
	return result.trim();
}

/**
 * Parses the public header block of a LAS or LAZ file.
 *
 * @param view a view on (at least) the file's header
 * @returns the parsed header
 * @throws if the data is not a LAS/LAZ file or uses an unsupported point format
 */
export function parseLasHeader(view: DataView): LasHeader {
	if (
		view.byteLength < 227 ||
		readAsciiString(view, 0, 4) !== LAS_SIGNATURE
	) {
		throw new Error("Not a LAS/LAZ file (missing 'LASF' signature).");
	}

	const versionMajor = view.getUint8(24);
	const versionMinor = view.getUint8(25);
	const headerSize = view.getUint16(94, true);

	// LASzip marks compressed files by setting bit 7 (and sometimes bit 6)
	// of the point data record format
	const rawPointFormat = view.getUint8(104);
	const isCompressed = (rawPointFormat & 0xc0) !== 0;
	const pointFormat = rawPointFormat & 0x3f;

	if (pointFormat >= POINT_FORMAT_BASE_LENGTH.length) {
		throw new Error(`Unsupported LAS point data format ${pointFormat}.`);
	}

	let pointCount = view.getUint32(107, true);
	if (versionMinor >= 4 && headerSize >= 375 && view.byteLength >= 255) {
		const extendedCount = Number(view.getBigUint64(247, true));
		if (extendedCount > 0) {
			pointCount = extendedCount;
		}
	}

	return {
		versionMajor,
		versionMinor,
		headerSize,
		pointDataOffset: view.getUint32(96, true),
		vlrCount: view.getUint32(100, true),
		pointFormat,
		isCompressed,
		pointRecordLength: view.getUint16(105, true),
		pointCount,
		scale: [
			view.getFloat64(131, true),
			view.getFloat64(139, true),
			view.getFloat64(147, true),
		],
		offset: [
			view.getFloat64(155, true),
			view.getFloat64(163, true),
			view.getFloat64(171, true),
		],
	};
}

function createExtraBytesReader(
	dataType: number
): LasExtraBytesDimension["read"] | null {
	switch (dataType) {
		case 1:
			return (v, o) => v.getUint8(o);
		case 2:
			return (v, o) => v.getInt8(o);
		case 3:
			return (v, o) => v.getUint16(o, true);
		case 4:
			return (v, o) => v.getInt16(o, true);
		case 5:
			return (v, o) => v.getUint32(o, true);
		case 6:
			return (v, o) => v.getInt32(o, true);
		case 7:
			return (v, o) => Number(v.getBigUint64(o, true));
		case 8:
			return (v, o) => Number(v.getBigInt64(o, true));
		case 9:
			return (v, o) => v.getFloat32(o, true);
		case 10:
			return (v, o) => v.getFloat64(o, true);
		default:
			return null;
	}
}

/**
 * @returns the size in bytes of an Extra Bytes dimension, or `null` if unknown
 */
function extraBytesSize(dataType: number, options: number): number | null {
	if (dataType === 0) {
		// "undocumented extra bytes": the options field holds the byte count
		return options;
	}
	if (dataType >= 1 && dataType <= 10) {
		return EXTRA_BYTES_TYPE_SIZE[dataType - 1];
	}
	if (dataType >= 11 && dataType <= 30) {
		// deprecated 2 and 3 element array types
		const baseType = ((dataType - 11) % 10) + 1;
		const elementCount = dataType <= 20 ? 2 : 3;
		return EXTRA_BYTES_TYPE_SIZE[baseType - 1] * elementCount;
	}
	return null;
}

/**
 * Reads the dimensions declared in the file's "Extra Bytes" VLR, if any.
 * Undocumented and (deprecated) array typed dimensions are skipped.
 *
 * @param view a view on (at least) the file's header and VLRs
 * @param header the file's parsed header
 * @param reservedNames names already in use (e.g. by standard dimensions);
 *                      a clashing Extra Bytes dimension is renamed
 * @returns the readable Extra Bytes dimensions, in record order
 */
export function parseExtraBytesDimensions(
	view: DataView,
	header: LasHeader,
	reservedNames: string[] = []
): LasExtraBytesDimension[] {
	const dimensions: LasExtraBytesDimension[] = [];
	const usedNames = new Set(reservedNames.map((n) => n.toLowerCase()));

	let vlrOffset = header.headerSize;
	for (let v = 0; v < header.vlrCount; v++) {
		if (vlrOffset + VLR_HEADER_LENGTH > view.byteLength) break;

		const userId = readAsciiString(view, vlrOffset + 2, 16);
		const recordId = view.getUint16(vlrOffset + 18, true);
		const recordLength = view.getUint16(vlrOffset + 20, true);
		const dataOffset = vlrOffset + VLR_HEADER_LENGTH;
		vlrOffset = dataOffset + recordLength;

		if (
			userId !== EXTRA_BYTES_USER_ID ||
			recordId !== EXTRA_BYTES_RECORD_ID ||
			dataOffset + recordLength > view.byteLength
		) {
			continue;
		}

		let recordOffset = POINT_FORMAT_BASE_LENGTH[header.pointFormat];
		const descriptorCount = Math.floor(
			recordLength / EXTRA_BYTES_DESCRIPTOR_LENGTH
		);

		for (let d = 0; d < descriptorCount; d++) {
			const start = dataOffset + d * EXTRA_BYTES_DESCRIPTOR_LENGTH;
			const dataType = view.getUint8(start + 2);
			const options = view.getUint8(start + 3);

			const size = extraBytesSize(dataType, options);
			if (size === null) {
				console.warn(
					`LAS: unknown Extra Bytes data type ${dataType}, ignoring the remaining extra dimensions.`
				);
				break;
			}

			const read = createExtraBytesReader(dataType);
			const fitsRecord = recordOffset + size <= header.pointRecordLength;

			if (read && fitsRecord) {
				const rawName =
					readAsciiString(view, start + 4, 32) || `extra_${d}`;
				let name = rawName;
				for (let i = 2; usedNames.has(name.toLowerCase()); i++) {
					name = `${rawName}_${i}`;
				}
				usedNames.add(name.toLowerCase());

				dimensions.push({
					name,
					recordOffset,
					read,
					// options bit 3: scale is relevant, bit 4: offset is relevant
					scale:
						options & 0x08 ? view.getFloat64(start + 112, true) : 1,
					offset:
						options & 0x10 ? view.getFloat64(start + 136, true) : 0,
				});
			}

			recordOffset += size;
		}

		// a file may only contain a single Extra Bytes VLR
		break;
	}

	return dimensions;
}

/**
 * Names of the standard LAS dimensions exposed as scalar fields. These
 * names match the ones used by PDAL and are recognized by the LAS writer.
 */
export const LAS_STANDARD_FIELD_NAMES = [
	"Intensity",
	"Classification",
	"ReturnNumber",
	"NumberOfReturns",
	"UserData",
	"PointSourceId",
] as const;

/**
 * Standard dimensions that are dropped when every point has this value.
 * They carry no information but would clutter the scalar field list, and
 * the LAS writer restores exactly these defaults on export.
 * Classification is always kept, so it can be viewed and edited.
 */
const DROP_IF_ALL_EQUAL = new Map<string, number>([
	["Intensity", 0],
	["ReturnNumber", 1],
	["NumberOfReturns", 1],
	["UserData", 0],
	["PointSourceId", 0],
]);

function allEqual(values: ArrayLike<number>, value: number): boolean {
	for (let i = 0; i < values.length; i++) {
		if (values[i] !== value) return false;
	}
	return true;
}

/**
 * Decodes LAS point records one at a time into preallocated arrays, so
 * records can be fed from file chunks or straight out of the LAZ
 * decompressor without ever holding all raw records in memory.
 *
 * Coordinates are made relative to the first point (exactly, in integer
 * space) before being converted to float32, so large absolute coordinates
 * (e.g. UTM) don't suffer from float32 precision loss.
 */
export class LasPointDecoder {
	private readonly header: LasHeader;
	private readonly extraDimensions: LasExtraBytesDimension[];
	private readonly capacity: number;
	private readonly isExtended: boolean;
	private readonly rgbOffset: number | undefined;
	/** red, green, blue Extra Bytes dimensions, used when the format has no RGB */
	private readonly colorDimensions: LasExtraBytesDimension[] | null = null;

	private count = 0;
	private referenceInt: [number, number, number] = [0, 0, 0];
	private maxRawColor = 0;

	private readonly positions: Float32Array;
	private readonly colors: Float32Array | null;
	private readonly intensity: Uint16Array;
	private readonly classification: Uint8Array;
	private readonly returnNumber: Uint8Array;
	private readonly numberOfReturns: Uint8Array;
	private readonly userData: Uint8Array;
	private readonly pointSourceId: Uint16Array;
	private readonly extraValues: Float32Array[];

	/**
	 * @param header the file's parsed header
	 * @param extraDimensions the dimensions declared in the Extra Bytes VLR
	 * @param capacity the maximum number of points that will be decoded
	 */
	constructor(
		header: LasHeader,
		extraDimensions: LasExtraBytesDimension[],
		capacity: number
	) {
		this.header = header;
		this.capacity = capacity;
		this.isExtended = header.pointFormat >= FIRST_EXTENDED_POINT_FORMAT;
		this.rgbOffset = RGB_OFFSET[header.pointFormat];

		// Some writers store colors as red/green/blue Extra Bytes when the
		// point format has no RGB fields: treat them as colors, not as
		// scalar fields.
		let remainingDimensions = extraDimensions;
		if (this.rgbOffset === undefined) {
			const colorIndices = COLOR_DIMENSION_NAMES.map((name) =>
				extraDimensions.findIndex((d) => d.name.toLowerCase() === name)
			);
			if (!colorIndices.includes(-1)) {
				this.colorDimensions = colorIndices.map(
					(index) => extraDimensions[index]
				);
				remainingDimensions = extraDimensions.filter(
					(_, index) => !colorIndices.includes(index)
				);
			}
		}
		this.extraDimensions = remainingDimensions;

		this.positions = new Float32Array(capacity * 3);
		this.colors =
			this.rgbOffset !== undefined || this.colorDimensions
				? new Float32Array(capacity * 3)
				: null;
		this.intensity = new Uint16Array(capacity);
		this.classification = new Uint8Array(capacity);
		this.returnNumber = new Uint8Array(capacity);
		this.numberOfReturns = new Uint8Array(capacity);
		this.userData = new Uint8Array(capacity);
		this.pointSourceId = new Uint16Array(capacity);
		this.extraValues = this.extraDimensions.map(
			() => new Float32Array(capacity)
		);
	}

	public get decodedCount(): number {
		return this.count;
	}

	/**
	 * Decodes the point record starting at `base` as the next point.
	 */
	public decode(view: DataView, base: number): void {
		const i = this.count;
		if (i >= this.capacity) {
			throw new Error("LasPointDecoder: capacity exceeded.");
		}
		const { scale } = this.header;

		const xInt = view.getInt32(base, true);
		const yInt = view.getInt32(base + 4, true);
		const zInt = view.getInt32(base + 8, true);
		if (i === 0) {
			this.referenceInt = [xInt, yInt, zInt];
		}
		const reference = this.referenceInt;
		this.positions[i * 3] = (xInt - reference[0]) * scale[0];
		this.positions[i * 3 + 1] = (yInt - reference[1]) * scale[1];
		this.positions[i * 3 + 2] = (zInt - reference[2]) * scale[2];

		this.intensity[i] = view.getUint16(base + 12, true);
		const returnByte = view.getUint8(base + 14);
		this.userData[i] = view.getUint8(base + 17);

		if (this.isExtended) {
			this.returnNumber[i] = returnByte & 0x0f;
			this.numberOfReturns[i] = returnByte >> 4;
			this.classification[i] = view.getUint8(base + 16);
			this.pointSourceId[i] = view.getUint16(base + 20, true);
		} else {
			this.returnNumber[i] = returnByte & 0x07;
			this.numberOfReturns[i] = (returnByte >> 3) & 0x07;
			// bits 5 - 7 are the synthetic/key-point/withheld flags
			this.classification[i] = view.getUint8(base + 15) & 0x1f;
			this.pointSourceId[i] = view.getUint16(base + 18, true);
		}

		// raw color values are stored as-is and normalized in finish(),
		// once their range is known
		if (this.colors && this.rgbOffset !== undefined) {
			for (let c = 0; c < 3; c++) {
				const raw = view.getUint16(base + this.rgbOffset + c * 2, true);
				if (raw > this.maxRawColor) this.maxRawColor = raw;
				this.colors[i * 3 + c] = raw;
			}
		} else if (this.colors && this.colorDimensions) {
			for (let c = 0; c < 3; c++) {
				const dimension = this.colorDimensions[c];
				const raw =
					dimension.read(view, base + dimension.recordOffset) *
						dimension.scale +
					dimension.offset;
				if (raw > this.maxRawColor) this.maxRawColor = raw;
				this.colors[i * 3 + c] = raw;
			}
		}

		for (let d = 0; d < this.extraDimensions.length; d++) {
			const dimension = this.extraDimensions[d];
			this.extraValues[d][i] =
				dimension.read(view, base + dimension.recordOffset) *
					dimension.scale +
				dimension.offset;
		}

		this.count++;
	}

	/**
	 * @returns all decoded points. The decoder must not be used afterwards.
	 */
	public finish(): DecodedLasPoints {
		const count = this.count;
		const { scale, offset } = this.header;
		const trim = (array: Float32Array, itemSize = 1): Float32Array =>
			count === this.capacity ? array : array.slice(0, count * itemSize);

		const shift: CoordinateShift = {
			x: offset[0] + this.referenceInt[0] * scale[0],
			y: offset[1] + this.referenceInt[1] * scale[1],
			z: offset[2] + this.referenceInt[2] * scale[2],
		};

		let colors: Float32Array | null = null;
		if (this.colors) {
			colors = trim(this.colors, 3);
			// The spec requires 16-bit colors, but many writers store 8-bit
			// values as-is (or [0, 1] floats in Extra Bytes). Pick the range
			// from the largest value.
			const colorRange =
				this.maxRawColor <= 1
					? 1
					: this.maxRawColor <= 255
					? 255
					: 65535;
			for (let i = 0; i < colors.length; i++) {
				colors[i] = Math.min(1, colors[i] / colorRange);
			}
		}

		const standardFields: Record<
			(typeof LAS_STANDARD_FIELD_NAMES)[number],
			Uint8Array | Uint16Array
		> = {
			Intensity: this.intensity,
			Classification: this.classification,
			ReturnNumber: this.returnNumber,
			NumberOfReturns: this.numberOfReturns,
			UserData: this.userData,
			PointSourceId: this.pointSourceId,
		};

		const scalarFields: DecodedLasPoints["scalarFields"] = [];
		for (const name of LAS_STANDARD_FIELD_NAMES) {
			const values = standardFields[name].subarray(0, count);
			const defaultValue = DROP_IF_ALL_EQUAL.get(name);
			if (defaultValue !== undefined && allEqual(values, defaultValue)) {
				continue;
			}
			scalarFields.push({ name, values: Float32Array.from(values) });
		}
		this.extraDimensions.forEach((dimension, d) => {
			scalarFields.push({
				name: dimension.name,
				values: trim(this.extraValues[d]),
			});
		});

		return {
			positions: trim(this.positions, 3),
			shift,
			colors,
			scalarFields,
		};
	}
}

/**
 * Decodes (uncompressed) LAS point records that are all in memory.
 *
 * @param pointData a view starting at the first point record
 * @param header the file's parsed header
 * @param extraDimensions the dimensions declared in the Extra Bytes VLR
 * @param onProgress called periodically with the number of decoded points
 * @returns the decoded point data
 */
export function decodeLasPoints(
	pointData: DataView,
	header: LasHeader,
	extraDimensions: LasExtraBytesDimension[] = [],
	onProgress?: (decoded: number, total: number) => void
): DecodedLasPoints {
	const recordLength = header.pointRecordLength;
	const availableCount = Math.floor(pointData.byteLength / recordLength);
	const count = Math.min(header.pointCount, availableCount);
	if (count < header.pointCount) {
		console.warn(
			`LAS: header declares ${header.pointCount} points, but the file only contains ${count}.`
		);
	}

	const decoder = new LasPointDecoder(header, extraDimensions, count);
	for (let i = 0; i < count; i++) {
		decoder.decode(pointData, i * recordLength);
		if (onProgress && i % PROGRESS_INTERVAL === 0) {
			onProgress(i, count);
		}
	}
	onProgress?.(count, count);

	return decoder.finish();
}
