import { buildLasFile } from "~annotator/export/LasWriter";
import {
	LAS_STANDARD_FIELD_NAMES,
	LasPointDecoder,
	decodeLasPoints,
	parseExtraBytesDimensions,
	parseLasHeader,
} from "../LasFormat";

function decodeFile(buffer: ArrayBuffer) {
	const view = new DataView(buffer);
	const header = parseLasHeader(view);
	const extraDimensions = parseExtraBytesDimensions(view, header, [
		...LAS_STANDARD_FIELD_NAMES,
	]);
	const decoded = decodeLasPoints(
		new DataView(buffer, header.pointDataOffset),
		header,
		extraDimensions
	);
	return { header, decoded };
}

function field(
	decoded: ReturnType<typeof decodeLasPoints>,
	name: string
): number[] | undefined {
	const found = decoded.scalarFields.find((f) => f.name === name);
	return found ? Array.from(found.values) : undefined;
}

/**
 * Builds a minimal LAS 1.2 file with point data record format 3
 * (legacy layout, GPS time + RGB) and no VLRs.
 */
function buildLegacyFormat3File(
	points: {
		x: number;
		y: number;
		z: number;
		intensity: number;
		returnByte: number;
		classificationByte: number;
		rgb: [number, number, number];
	}[],
	scale: number,
	offset: [number, number, number]
): ArrayBuffer {
	const headerSize = 227;
	const recordLength = 34;
	const buffer = new ArrayBuffer(headerSize + points.length * recordLength);
	const view = new DataView(buffer);

	"LASF".split("").forEach((c, i) => {
		view.setUint8(i, c.charCodeAt(0));
	});
	view.setUint8(24, 1);
	view.setUint8(25, 2);
	view.setUint16(94, headerSize, true);
	view.setUint32(96, headerSize, true);
	view.setUint32(100, 0, true);
	view.setUint8(104, 3);
	view.setUint16(105, recordLength, true);
	view.setUint32(107, points.length, true);
	for (let axis = 0; axis < 3; axis++) {
		view.setFloat64(131 + axis * 8, scale, true);
		view.setFloat64(155 + axis * 8, offset[axis], true);
	}

	points.forEach((p, i) => {
		const base = headerSize + i * recordLength;
		view.setInt32(base, Math.round((p.x - offset[0]) / scale), true);
		view.setInt32(base + 4, Math.round((p.y - offset[1]) / scale), true);
		view.setInt32(base + 8, Math.round((p.z - offset[2]) / scale), true);
		view.setUint16(base + 12, p.intensity, true);
		view.setUint8(base + 14, p.returnByte);
		view.setUint8(base + 15, p.classificationByte);
		view.setUint16(base + 28, p.rgb[0], true);
		view.setUint16(base + 30, p.rgb[1], true);
		view.setUint16(base + 32, p.rgb[2], true);
	});

	return buffer;
}

describe("parseLasHeader", () => {
	test("rejects files without the LASF signature", () => {
		const buffer = new ArrayBuffer(400);
		expect(() => parseLasHeader(new DataView(buffer))).toThrow(/LASF/);
	});

	test("detects LAZ compression bits and strips them from the point format", () => {
		const buffer = buildLasFile({
			positions: [0, 0, 0],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0],
		});
		const view = new DataView(buffer);
		view.setUint8(104, 7 | 0x80);

		const header = parseLasHeader(view);
		expect(header.isCompressed).toBe(true);
		expect(header.pointFormat).toBe(7);
	});
});

describe("decodeLasPoints", () => {
	test("round-trips a LAS 1.4 file written by the LAS writer", () => {
		const shift = { x: 500_000.123, y: 4_600_000.456, z: 250.5 };
		const buffer = buildLasFile({
			positions: [0, 0, 0, 1.5, -2.25, 3.125, -10, 20, -0.5],
			shift,
			colors: [1, 0, 0, 0, 1, 0, 0, 0, 1],
			classification: [2, 5, 7],
			extraFields: [
				{ name: "tree_id", values: [1, 2, 3] },
				{ name: "Intensity", values: [10, 20, 30] },
			],
		});

		const { header, decoded } = decodeFile(buffer);

		expect(header.versionMinor).toBe(4);
		expect(header.pointFormat).toBe(7);
		expect(header.isCompressed).toBe(false);
		expect(header.pointCount).toBe(3);

		const expected = [
			[0, 0, 0],
			[1.5, -2.25, 3.125],
			[-10, 20, -0.5],
		];
		expected.forEach(([x, y, z], i) => {
			expect(decoded.positions[i * 3] + decoded.shift.x).toBeCloseTo(
				x + shift.x,
				2
			);
			expect(decoded.positions[i * 3 + 1] + decoded.shift.y).toBeCloseTo(
				y + shift.y,
				2
			);
			expect(decoded.positions[i * 3 + 2] + decoded.shift.z).toBeCloseTo(
				z + shift.z,
				2
			);
		});

		// coordinates are relative, so they stay small (float32 friendly)
		for (const value of decoded.positions) {
			expect(Math.abs(value)).toBeLessThan(100);
		}

		expect(Array.from(decoded.colors!)).toEqual([
			1, 0, 0, 0, 1, 0, 0, 0, 1,
		]);
		expect(field(decoded, "Classification")).toEqual([2, 5, 7]);
		expect(field(decoded, "Intensity")).toEqual([10, 20, 30]);
		expect(field(decoded, "tree_id")).toEqual([1, 2, 3]);
	});

	test("drops standard fields holding only default values, but keeps Classification", () => {
		const buffer = buildLasFile({
			positions: [0, 0, 0, 1, 1, 1],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0, 0],
		});

		const { decoded } = decodeFile(buffer);

		expect(decoded.scalarFields.map((f) => f.name)).toEqual([
			"Classification",
		]);
		expect(decoded.colors).not.toBeNull();
	});

	test("decodes legacy point format 3 (LAS 1.2)", () => {
		const buffer = buildLegacyFormat3File(
			[
				{
					x: 1000.5,
					y: 2000.25,
					z: 10,
					intensity: 100,
					// return 2 of 3
					returnByte: 2 | (3 << 3),
					// class 6 + "withheld" flag (bit 7)
					classificationByte: 6 | 0x80,
					rgb: [255, 128, 0],
				},
				{
					x: 1002.5,
					y: 2004.25,
					z: 12,
					intensity: 200,
					returnByte: 1 | (1 << 3),
					classificationByte: 2,
					rgb: [0, 0, 255],
				},
			],
			0.01,
			[1000, 2000, 0]
		);

		const { header, decoded } = decodeFile(buffer);

		expect(header.pointFormat).toBe(3);
		expect(header.pointCount).toBe(2);

		// coordinates are relative to the first point
		expect(decoded.shift.x).toBeCloseTo(1000.5, 6);
		expect(decoded.shift.y).toBeCloseTo(2000.25, 6);
		expect(decoded.shift.z).toBeCloseTo(10, 6);
		expect(Array.from(decoded.positions)).toEqual([0, 0, 0, 2, 4, 2]);

		expect(field(decoded, "Classification")).toEqual([6, 2]);
		expect(field(decoded, "Intensity")).toEqual([100, 200]);
		expect(field(decoded, "ReturnNumber")).toEqual([2, 1]);
		expect(field(decoded, "NumberOfReturns")).toEqual([3, 1]);

		// no value exceeds 255: treated as 8-bit colors
		expect(decoded.colors![0]).toBe(1);
		expect(decoded.colors![1]).toBeCloseTo(128 / 255, 6);
		expect(decoded.colors![5]).toBe(1);
	});

	test("applies Extra Bytes scale/offset and renames clashing names", () => {
		const buffer = buildLasFile({
			positions: [0, 0, 0, 1, 1, 1],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0, 0],
			extraFields: [{ name: "height", values: [4, 8] }],
		});
		const view = new DataView(buffer);
		const descriptor = 375 + 54;
		// options: scale (bit 3) + offset (bit 4)
		view.setUint8(descriptor + 3, 0x18);
		view.setFloat64(descriptor + 112, 0.5, true);
		view.setFloat64(descriptor + 136, 100, true);

		const header = parseLasHeader(view);
		const dimensions = parseExtraBytesDimensions(view, header, ["HEIGHT"]);
		expect(dimensions.map((d) => d.name)).toEqual(["height_2"]);

		const decoded = decodeLasPoints(
			new DataView(buffer, header.pointDataOffset),
			header,
			dimensions
		);
		expect(field(decoded, "height_2")).toEqual([102, 104]);
	});

	test("decodes records fed one at a time, e.g. from a LAZ decompressor", () => {
		const buffer = buildLasFile({
			positions: [0, 0, 0, 1, 2, 3],
			shift: { x: 100, y: 200, z: 300 },
			classification: [3, 4],
		});
		const view = new DataView(buffer);
		const header = parseLasHeader(view);

		// capacity larger than the number of decoded points
		const decoder = new LasPointDecoder(header, [], 5);
		for (let i = 0; i < 2; i++) {
			// copy each record into its own buffer, at a non-zero offset
			const record = new Uint8Array(header.pointRecordLength + 7);
			record.set(
				new Uint8Array(
					buffer,
					header.pointDataOffset + i * header.pointRecordLength,
					header.pointRecordLength
				),
				7
			);
			decoder.decode(new DataView(record.buffer), 7);
		}
		const decoded = decoder.finish();

		expect(decoded.positions.length).toBe(6);
		expect(decoded.positions[3] + decoded.shift.x).toBeCloseTo(101, 3);
		expect(decoded.positions[5] + decoded.shift.z).toBeCloseTo(303, 3);
		expect(field(decoded, "Classification")).toEqual([3, 4]);
	});

	test("only decodes the points actually present in a truncated file", () => {
		const buffer = buildLasFile({
			positions: [0, 0, 0, 1, 1, 1, 2, 2, 2],
			shift: { x: 0, y: 0, z: 0 },
			classification: [1, 2, 3],
		});
		const truncated = buffer.slice(0, buffer.byteLength - 10);

		const { decoded } = decodeFile(truncated);
		expect(decoded.positions.length).toBe(6);
	});
});
