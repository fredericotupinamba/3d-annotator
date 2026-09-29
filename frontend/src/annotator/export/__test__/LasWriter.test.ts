import { buildLasFile, type LasExportInput } from "../LasWriter";

/** decodes just enough of a LAS 1.4 file to verify the writer's output */
function readLasFile(buffer: ArrayBuffer) {
	const view = new DataView(buffer);
	const decoder = new TextDecoder("ascii");

	const signature = decoder.decode(new Uint8Array(buffer, 0, 4));
	const versionMajor = view.getUint8(24);
	const versionMinor = view.getUint8(25);
	const headerSize = view.getUint16(94, true);
	const pointDataOffset = view.getUint32(96, true);
	const numberOfVlrs = view.getUint32(100, true);
	const pointDataFormat = view.getUint8(104);
	const pointRecordLength = view.getUint16(105, true);
	const legacyPointCount = view.getUint32(107, true);

	const xScale = view.getFloat64(131, true);
	const yScale = view.getFloat64(139, true);
	const zScale = view.getFloat64(147, true);
	const xOffset = view.getFloat64(155, true);
	const yOffset = view.getFloat64(163, true);
	const zOffset = view.getFloat64(171, true);

	const maxX = view.getFloat64(179, true);
	const minX = view.getFloat64(187, true);
	const maxY = view.getFloat64(195, true);
	const minY = view.getFloat64(203, true);
	const maxZ = view.getFloat64(211, true);
	const minZ = view.getFloat64(219, true);

	const pointCount = Number(view.getBigUint64(247, true));

	const extraFields: { name: string; values: number[] }[] = [];
	let vlrCursor = headerSize;
	for (let i = 0; i < numberOfVlrs; i++) {
		const recordId = view.getUint16(vlrCursor + 18, true);
		const recordLength = view.getUint16(vlrCursor + 20, true);
		const payloadStart = vlrCursor + 54;

		if (recordId === 4) {
			const descriptorCount = recordLength / 192;
			for (let d = 0; d < descriptorCount; d++) {
				const descriptorStart = payloadStart + d * 192;
				const nameBytes = new Uint8Array(
					buffer,
					descriptorStart + 4,
					32
				);
				const nullIndex = nameBytes.indexOf(0);
				const name = decoder.decode(
					nameBytes.subarray(0, nullIndex === -1 ? 32 : nullIndex)
				);
				extraFields.push({ name, values: [] });
			}
		}

		vlrCursor += 54 + recordLength;
	}

	const points: {
		x: number;
		y: number;
		z: number;
		classification: number;
		red: number;
		green: number;
		blue: number;
		extra: number[];
	}[] = [];

	for (let i = 0; i < pointCount; i++) {
		const recordOffset = pointDataOffset + i * pointRecordLength;
		const x = view.getInt32(recordOffset, true) * xScale + xOffset;
		const y = view.getInt32(recordOffset + 4, true) * yScale + yOffset;
		const z = view.getInt32(recordOffset + 8, true) * zScale + zOffset;
		const classification = view.getUint8(recordOffset + 16);
		const red = view.getUint16(recordOffset + 30, true);
		const green = view.getUint16(recordOffset + 32, true);
		const blue = view.getUint16(recordOffset + 34, true);

		const extra: number[] = [];
		for (let f = 0; f < extraFields.length; f++) {
			extra.push(view.getFloat64(recordOffset + 36 + f * 8, true));
		}

		points.push({ x, y, z, classification, red, green, blue, extra });
	}

	return {
		signature,
		versionMajor,
		versionMinor,
		pointDataOffset,
		numberOfVlrs,
		pointDataFormat,
		pointRecordLength,
		legacyPointCount,
		bounds: { minX, maxX, minY, maxY, minZ, maxZ },
		pointCount,
		extraFieldNames: extraFields.map((f) => f.name),
		points,
	};
}

describe("buildLasFile", () => {
	test("writes a valid LAS 1.4 header", () => {
		const input: LasExportInput = {
			positions: [0, 0, 0, 1, 2, 3, -1, -2, -3],
			shift: { x: 500000, y: 6000000, z: 100 },
			classification: [1, 2, 3],
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.signature).toBe("LASF");
		expect(result.versionMajor).toBe(1);
		expect(result.versionMinor).toBe(4);
		expect(result.pointDataFormat).toBe(7);
		expect(result.pointRecordLength).toBe(36);
		expect(result.pointDataOffset).toBe(375);
		expect(result.legacyPointCount).toBe(0);
		expect(result.pointCount).toBe(3);
		expect(result.numberOfVlrs).toBe(0);
	});

	test("recovers original (shifted) coordinates within scale precision", () => {
		const shift = { x: 500000, y: 6000000, z: 100 };
		const positions = [0, 0, 0, 1.234, -2.5, 10, -1, 2, -3];
		const input: LasExportInput = {
			positions,
			shift,
			classification: [0, 1, 2],
		};

		const result = readLasFile(buildLasFile(input));

		for (let i = 0; i < 3; i++) {
			expect(result.points[i].x).toBeCloseTo(
				positions[i * 3] + shift.x,
				3
			);
			expect(result.points[i].y).toBeCloseTo(
				positions[i * 3 + 1] + shift.y,
				3
			);
			expect(result.points[i].z).toBeCloseTo(
				positions[i * 3 + 2] + shift.z,
				3
			);
		}
	});

	test("writes classification bytes from the annotation labels", () => {
		const input: LasExportInput = {
			positions: [0, 0, 0, 0, 0, 0],
			shift: { x: 0, y: 0, z: 0 },
			classification: new Uint8Array([7, 255]),
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.points[0].classification).toBe(7);
		expect(result.points[1].classification).toBe(255);
	});

	test("writes RGB color when provided, scaled from 8-bit to 16-bit", () => {
		const input: LasExportInput = {
			positions: [0, 0, 0],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0],
			colors: [1, 0.5, 0],
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.points[0].red).toBe(255 * 257);
		expect(result.points[0].green).toBe(Math.round(0.5 * 255) * 257);
		expect(result.points[0].blue).toBe(0);
	});

	test("omits RGB (writes zero) when no color is provided", () => {
		const input: LasExportInput = {
			positions: [0, 0, 0],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0],
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.points[0].red).toBe(0);
		expect(result.points[0].green).toBe(0);
		expect(result.points[0].blue).toBe(0);
	});

	test("preserves extra scalar fields via the Extra Bytes VLR", () => {
		const input: LasExportInput = {
			positions: [0, 0, 0, 1, 1, 1],
			shift: { x: 0, y: 0, z: 0 },
			classification: [0, 0],
			extraFields: [
				{ name: "tree_id", values: [1, 2] },
				{ name: "intensity", values: [12.5, 99.25] },
			],
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.numberOfVlrs).toBe(1);
		expect(result.pointRecordLength).toBe(36 + 2 * 8);
		expect(result.extraFieldNames).toEqual(["tree_id", "intensity"]);
		expect(result.points[0].extra).toEqual([1, 12.5]);
		expect(result.points[1].extra).toEqual([2, 99.25]);
	});

	test("computes the bounding box from the shifted coordinates", () => {
		const shift = { x: 100, y: 200, z: 300 };
		const input: LasExportInput = {
			positions: [-1, -2, -3, 5, 6, 7],
			shift,
			classification: [0, 0],
		};

		const result = readLasFile(buildLasFile(input));

		expect(result.bounds.minX).toBeCloseTo(-1 + shift.x, 3);
		expect(result.bounds.maxX).toBeCloseTo(5 + shift.x, 3);
		expect(result.bounds.minY).toBeCloseTo(-2 + shift.y, 3);
		expect(result.bounds.maxY).toBeCloseTo(6 + shift.y, 3);
		expect(result.bounds.minZ).toBeCloseTo(-3 + shift.z, 3);
		expect(result.bounds.maxZ).toBeCloseTo(7 + shift.z, 3);
	});
});
