import { parsePlyHeader } from "../PlyHeader";
import {
	getPlyPointCloudLayout,
	PlyPointCloudReader,
	type PlyPointCloudLayout,
} from "../PlyPointCloudReader";

const POINTS = [
	{
		x: 500000.125,
		y: 4600000.5,
		z: 100.25,
		r: 255,
		g: 0,
		b: 51,
		i: 0.5,
		c: 2,
	},
	{
		x: 500001.125,
		y: 4600002.5,
		z: 103.25,
		r: 0,
		g: 255,
		b: 0,
		i: 1.5,
		c: 6,
	},
	{
		x: 499999.125,
		y: 4599999.5,
		z: 99.25,
		r: 10,
		g: 20,
		b: 30,
		i: 2.5,
		c: 2,
	},
];

function header(format: string, extra = "") {
	return [
		"ply",
		`format ${format} 1.0`,
		"comment test",
		`element vertex ${POINTS.length}`,
		"property double x",
		"property double y",
		"property double z",
		"property uchar red",
		"property uchar green",
		"property uchar blue",
		"property float scalar_Intensity",
		"property int scalar_Classification",
		extra,
		"end_header",
		"",
	]
		.filter((line, i, lines) => line !== "" || i === lines.length - 1)
		.join("\n");
}

function layoutFor(headerText: string): PlyPointCloudLayout {
	const layout = getPlyPointCloudLayout(parsePlyHeader(headerText)!);
	expect(layout).not.toBeNull();
	return layout!;
}

function binaryBody(littleEndian: boolean): Uint8Array {
	const recordSize = 3 * 8 + 3 + 4 + 4;
	const buffer = new ArrayBuffer(POINTS.length * recordSize);
	const view = new DataView(buffer);
	POINTS.forEach((p, n) => {
		let o = n * recordSize;
		for (const value of [p.x, p.y, p.z]) {
			view.setFloat64(o, value, littleEndian);
			o += 8;
		}
		for (const value of [p.r, p.g, p.b]) {
			view.setUint8(o++, value);
		}
		view.setFloat32(o, p.i, littleEndian);
		view.setInt32(o + 4, p.c, littleEndian);
	});
	return new Uint8Array(buffer);
}

function asciiBody(): string {
	return (
		POINTS.map((p) =>
			[p.x, p.y, p.z, p.r, p.g, p.b, p.i, p.c].join(" ")
		).join("\r\n") + "\r\n"
	);
}

function expectPoints(reader: PlyPointCloudReader) {
	const data = reader.finish();

	expect(data.positions.length).toBe(POINTS.length * 3);
	POINTS.forEach((p, n) => {
		// exact: the offsets from the first point are representable in float32
		expect(data.positions[n * 3] + data.shift.x).toBe(p.x);
		expect(data.positions[n * 3 + 1] + data.shift.y).toBe(p.y);
		expect(data.positions[n * 3 + 2] + data.shift.z).toBe(p.z);
		expect(data.colors![n * 3]).toBeCloseTo(p.r / 255, 6);
		expect(data.colors![n * 3 + 2]).toBeCloseTo(p.b / 255, 6);
	});

	expect(data.scalarFields.map((f) => f.name)).toEqual([
		"scalar_Intensity",
		"scalar_Classification",
	]);
	expect(Array.from(data.scalarFields[0].values)).toEqual([0.5, 1.5, 2.5]);
	expect(Array.from(data.scalarFields[1].values)).toEqual([2, 6, 2]);
}

describe("getPlyPointCloudLayout", () => {
	test("rejects meshes, so they are loaded by three.js", () => {
		const text = header(
			"ascii",
			"element face 1\nproperty list uchar int vertex_indices"
		);
		expect(getPlyPointCloudLayout(parsePlyHeader(text)!)).toBeNull();
	});

	test("accepts an empty face element", () => {
		const text = header(
			"ascii",
			"element face 0\nproperty list uchar int vertex_indices"
		);
		expect(getPlyPointCloudLayout(parsePlyHeader(text)!)).not.toBeNull();
	});

	test("rejects files without coordinates", () => {
		const text = [
			"ply",
			"format ascii 1.0",
			"element vertex 1",
			"property float intensity",
			"end_header",
			"",
		].join("\n");
		expect(getPlyPointCloudLayout(parsePlyHeader(text)!)).toBeNull();
	});
});

describe("PlyPointCloudReader", () => {
	test.each([
		["binary_little_endian", true],
		["binary_big_endian", false],
	])("reads %s records split across arbitrary chunks", (format, le) => {
		const body = binaryBody(le);

		for (const chunkSize of [1, 5, 35, 36, 1000]) {
			const reader = new PlyPointCloudReader(layoutFor(header(format)));
			for (let o = 0; o < body.length; o += chunkSize) {
				reader.pushBytes(body.subarray(o, o + chunkSize));
			}
			expect(reader.isComplete).toBe(true);
			expectPoints(reader);
		}
	});

	test("reads ASCII tokens split across arbitrary chunks", () => {
		const body = asciiBody();

		for (const chunkSize of [1, 3, 7, 16, 1000]) {
			const reader = new PlyPointCloudReader(layoutFor(header("ascii")));
			for (let o = 0; o < body.length; o += chunkSize) {
				reader.pushText(body.substring(o, o + chunkSize));
			}
			expectPoints(reader);
		}
	});

	test("reads the last ASCII token without a trailing newline", () => {
		const reader = new PlyPointCloudReader(layoutFor(header("ascii")));
		reader.pushText(asciiBody().trimEnd());
		expectPoints(reader);
	});

	test("ignores data after the declared vertices", () => {
		const reader = new PlyPointCloudReader(layoutFor(header("ascii")));
		reader.pushText(asciiBody() + "1 2 3 4 5 6 7 8\n");
		expectPoints(reader);
	});

	test("trims the result if the file has fewer vertices than declared", () => {
		const reader = new PlyPointCloudReader(layoutFor(header("ascii")));
		reader.pushText(asciiBody().split("\r\n").slice(0, 2).join("\n"));
		const data = reader.finish();
		expect(data.positions.length).toBe(6);
		expect(data.scalarFields[1].values.length).toBe(2);
	});
});
