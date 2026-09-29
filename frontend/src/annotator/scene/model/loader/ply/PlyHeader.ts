/**
 * A minimal parser for the ASCII header of a `.ply` file (present in both
 * ASCII and binary encoded files). Used to discover the vertex properties
 * before handing the file off to three.js' `PLYLoader`.
 */

export interface PlyProperty {
	name: string;
	type: string;
	isList: boolean;
}

export interface PlyElement {
	name: string;
	count: number;
	properties: PlyProperty[];
}

export interface PlyHeader {
	format: string;
	elements: PlyElement[];
}

const HEADER_PATTERN = /^ply[\s\S]*?end_header(?:\r\n|\r|\n)/;

/**
 * Names of vertex properties that three.js' `PLYLoader` already maps to a
 * standard geometry attribute (position, normal, color or uv). Everything
 * else on the `vertex` element is considered a custom "scalar field".
 */
const STANDARD_VERTEX_PROPERTIES = new Set([
	"x",
	"y",
	"z",
	"px",
	"py",
	"pz",
	"posx",
	"posy",
	"posz",
	"nx",
	"ny",
	"nz",
	"normalx",
	"normaly",
	"normalz",
	"red",
	"green",
	"blue",
	"alpha",
	"r",
	"g",
	"b",
	"a",
	"diffuse_red",
	"diffuse_green",
	"diffuse_blue",
	"diffuse_r",
	"diffuse_g",
	"diffuse_b",
	"s",
	"t",
	"u",
	"v",
	"texture_u",
	"texture_v",
	"tx",
	"ty",
]);

/**
 * Extracts the leading `ply ... end_header` block from `text` (if present).
 *
 * @param text either a full ASCII ply file or just a leading slice of one
 *             (binary files also start with a plain text header)
 * @returns the header text (including the `end_header` line) or `null` if no
 *          complete header could be found
 */
export function extractPlyHeaderText(text: string): string | null {
	const match = HEADER_PATTERN.exec(text);
	return match ? match[0] : null;
}

/**
 * Parses a `.ply` header (as returned by {@link extractPlyHeaderText}) into
 * its elements and properties.
 */
export function parsePlyHeader(headerText: string): PlyHeader | null {
	const match = HEADER_PATTERN.exec(headerText);
	if (!match) {
		return null;
	}

	const lines = match[0].split(/\r\n|\r|\n/);

	let format = "";
	const elements: PlyElement[] = [];
	let current: PlyElement | undefined;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line === "ply") continue;

		const tokens = line.split(/\s+/);
		const lineType = tokens.shift();

		switch (lineType) {
			case "format":
				format = tokens[0] ?? "";
				break;

			case "element":
				if (current) elements.push(current);
				current = {
					name: tokens[0],
					count: parseInt(tokens[1], 10),
					properties: [],
				};
				break;

			case "property":
				if (!current) break;
				if (tokens[0] === "list") {
					current.properties.push({
						name: tokens[3],
						type: tokens[2],
						isList: true,
					});
				} else {
					current.properties.push({
						name: tokens[1],
						type: tokens[0],
						isList: false,
					});
				}
				break;

			default:
				break;
		}
	}

	if (current) elements.push(current);

	return { format, elements };
}

/**
 * Returns the names of all non-standard, non-list properties on the
 * `vertex` element of the given header. These are treated as "scalar
 * fields" (e.g. intensity, classification).
 */
export function findScalarPropertyNames(header: PlyHeader): string[] {
	const vertexElement = header.elements.find((e) => e.name === "vertex");
	if (!vertexElement) return [];

	return vertexElement.properties
		.filter((p) => !p.isList && !STANDARD_VERTEX_PROPERTIES.has(p.name))
		.map((p) => p.name);
}
