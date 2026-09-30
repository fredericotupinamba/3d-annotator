import { shiftAsciiPlyVertices } from "../PlyPrecisionFix";

function buildAsciiPly(vertices: [number, number, number][]): string {
	const header = [
		"ply",
		"format ascii 1.0",
		`element vertex ${vertices.length}`,
		"property float x",
		"property float y",
		"property float z",
		"property uchar red",
		"end_header",
	].join("\n");

	const body = vertices.map(([x, y, z]) => `${x} ${y} ${z} 255`).join("\n");

	return `${header}\n${body}\n`;
}

describe("shiftAsciiPlyVertices", () => {
	test("shifts large coordinates by their centroid", () => {
		const vertices: [number, number, number][] = [
			[500000, 6000000, 100],
			[500001, 6000002, 101],
			[500002, 6000004, 102],
		];

		const result = shiftAsciiPlyVertices(buildAsciiPly(vertices));

		expect(result).not.toBeNull();
		expect(result!.shift).toEqual({ x: 500001, y: 6000002, z: 101 });

		// The rewritten body is a flat, whitespace-separated token stream
		// (matching how three.js' own ASCII ply parser reads it), so vertex
		// records are grouped by chunking tokens instead of splitting lines.
		const tokens = result!.text
			.split(/end_header\r?\n/)[1]
			.trim()
			.split(/\s+/)
			.map(Number);

		expect(tokens).toHaveLength(vertices.length * 4);
		expect(tokens.slice(0, 3)).toEqual([-1, -2, -1]);
		expect(tokens.slice(4, 7)).toEqual([0, 0, 0]);
		expect(tokens.slice(8, 11)).toEqual([1, 2, 1]);
	});

	test("preserves non-position properties", () => {
		const vertices: [number, number, number][] = [
			[500000, 6000000, 100],
			[500001, 6000002, 101],
		];

		const result = shiftAsciiPlyVertices(buildAsciiPly(vertices));

		expect(result).not.toBeNull();
		const tokens = result!.text
			.split(/end_header\r?\n/)[1]
			.trim()
			.split(/\s+/);

		// the "red" property (255) is the 4th token of each vertex record
		// and must survive untouched
		expect(tokens[3]).toBe("255");
		expect(tokens[7]).toBe("255");
	});

	test("returns null for coordinates that are already small", () => {
		const vertices: [number, number, number][] = [
			[0, 0, 0],
			[1, 1, 1],
			[-1, -1, -1],
		];

		expect(shiftAsciiPlyVertices(buildAsciiPly(vertices))).toBeNull();
	});

	test("returns null for binary ply files", () => {
		const binaryHeader = [
			"ply",
			"format binary_little_endian 1.0",
			"element vertex 1",
			"property float x",
			"property float y",
			"property float z",
			"end_header",
			"",
		].join("\n");

		expect(shiftAsciiPlyVertices(binaryHeader)).toBeNull();
	});

	test("returns null when there is no vertex element", () => {
		const text = [
			"ply",
			"format ascii 1.0",
			"element face 0",
			"property list uchar int vertex_indices",
			"end_header",
			"",
		].join("\n");

		expect(shiftAsciiPlyVertices(text)).toBeNull();
	});

	test("correctly skips list properties of elements preceding vertex data", () => {
		// non-standard ordering (face before vertex), to exercise the
		// generic token-stream walker for elements other than "vertex"
		const text = [
			"ply",
			"format ascii 1.0",
			"element face 1",
			"property list uchar int vertex_indices",
			"element vertex 2",
			"property float x",
			"property float y",
			"property float z",
			"end_header",
			"3 0 1 2",
			"500000 6000000 0",
			"500002 6000002 0",
		].join("\n");

		const result = shiftAsciiPlyVertices(text);

		expect(result).not.toBeNull();
		expect(result!.shift).toEqual({ x: 500001, y: 6000001, z: 0 });
	});
});
