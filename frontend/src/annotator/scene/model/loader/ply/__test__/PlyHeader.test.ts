import { findScalarPropertyNames, parsePlyHeader } from "../PlyHeader";

const HEADER = [
	"ply",
	"format ascii 1.0",
	"comment author: test",
	"element vertex 3",
	"property float x",
	"property float y",
	"property float z",
	"property uchar red",
	"property uchar green",
	"property uchar blue",
	"property float scalar_Intensity",
	"property int scalar_Classification",
	"element face 1",
	"property list uchar int vertex_indices",
	"end_header",
	"",
].join("\n");

describe("parsePlyHeader", () => {
	test("parses format, elements and properties", () => {
		const header = parsePlyHeader(HEADER);

		expect(header).not.toBeNull();
		expect(header!.format).toBe("ascii");
		expect(header!.elements).toHaveLength(2);

		const vertexElement = header!.elements[0];
		expect(vertexElement.name).toBe("vertex");
		expect(vertexElement.count).toBe(3);
		expect(vertexElement.properties.map((p) => p.name)).toEqual([
			"x",
			"y",
			"z",
			"red",
			"green",
			"blue",
			"scalar_Intensity",
			"scalar_Classification",
		]);

		const faceElement = header!.elements[1];
		expect(faceElement.name).toBe("face");
		expect(faceElement.properties[0].isList).toBe(true);
	});

	test("returns null for text without a ply header", () => {
		expect(parsePlyHeader("not a ply file")).toBeNull();
	});
});

describe("findScalarPropertyNames", () => {
	test("finds custom vertex properties, excluding standard ones", () => {
		const header = parsePlyHeader(HEADER)!;
		expect(findScalarPropertyNames(header)).toEqual([
			"scalar_Intensity",
			"scalar_Classification",
		]);
	});

	test("returns an empty array when there is no vertex element", () => {
		const header = parsePlyHeader(
			["ply", "format ascii 1.0", "end_header", ""].join("\n")
		)!;
		expect(findScalarPropertyNames(header)).toEqual([]);
	});
});
