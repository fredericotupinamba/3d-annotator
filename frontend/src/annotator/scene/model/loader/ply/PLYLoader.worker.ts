import { PLYLoader as ThreePLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import type { ScalarFieldInfo, ScalarFieldKind } from "~entity/ScalarField";
import { createTimeoutProxy } from "~util/Timeout";
import { findArrayBuffers } from "~util/Util";
import { type LoaderWorkerReceive, type LoaderWorkerSend } from "../Loader";
import { findScalarPropertyNames, parsePlyHeader } from "./PlyHeader";
import { shiftAsciiPlyVertices, type CoordinateShift } from "./PlyPrecisionFix";

// A .ply header is plain text, terminated by "end_header", even in binary
// encoded files. This is comfortably larger than any realistic header.
const HEADER_PROBE_SIZE = 1_048_576;

const CATEGORICAL_MAX_UNIQUE_VALUES = 32;

function analyzeScalarAttribute(values: ArrayLike<number>): {
	kind: ScalarFieldKind;
	min: number;
	max: number;
	uniqueValues?: number[];
} {
	let min = Infinity;
	let max = -Infinity;
	const uniqueValues = new Set<number>();
	let isCategorical = true;

	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (value < min) min = value;
		if (value > max) max = value;

		if (isCategorical) {
			if (!Number.isInteger(value)) {
				isCategorical = false;
			} else {
				uniqueValues.add(value);
				if (uniqueValues.size > CATEGORICAL_MAX_UNIQUE_VALUES) {
					isCategorical = false;
				}
			}
		}
	}

	return isCategorical
		? {
				kind: "categorical",
				min,
				max,
				uniqueValues: Array.from(uniqueValues).sort((a, b) => a - b),
		  }
		: { kind: "continuous", min, max };
}

onmessage = async function ({ data }: MessageEvent<LoaderWorkerReceive>) {
	const { modelFile, options } = data;

	let fileToLoad = modelFile;
	let coordinateShift: CoordinateShift | undefined;
	let scalarPropertyNames: string[] = [];

	try {
		const probeText = await modelFile.slice(0, HEADER_PROBE_SIZE).text();
		const header = parsePlyHeader(probeText);

		if (header) {
			scalarPropertyNames = findScalarPropertyNames(header);

			if (header.format === "ascii") {
				const fullText = await modelFile.text();
				const shifted = shiftAsciiPlyVertices(fullText);
				if (shifted) {
					fileToLoad = new File([shifted.text], modelFile.name, {
						type: modelFile.type,
					});
					coordinateShift = shifted.shift;
				}
			}
		}
	} catch (e) {
		// best-effort only: fall back to loading the file unmodified
		console.warn(
			"PLYLoader: header pre-processing failed, loading file as-is.",
			e
		);
	}

	const modelURL = URL.createObjectURL(fileToLoad);
	try {
		const loader = new ThreePLYLoader();

		const attributeKeyByProperty = new Map<string, string>();
		if (scalarPropertyNames.length > 0) {
			const customPropertyMapping: Record<string, string[]> = {};
			for (const propertyName of scalarPropertyNames) {
				const attributeKey = `scalarField_${propertyName}`;
				customPropertyMapping[attributeKey] = [propertyName];
				attributeKeyByProperty.set(propertyName, attributeKey);
			}
			loader.setCustomPropertyNameMapping(customPropertyMapping);
		}

		const onProgress = options.hasProgressObserver
			? // don't call postMessage on every progress update
			  createTimeoutProxy((progress: ProgressEvent) => {
					postMessage<LoaderWorkerSend>({
						progress: { ...progress },
					});
			  })
			: undefined;

		let geometry = await loader.loadAsync(modelURL, onProgress);
		if (geometry.index !== null) {
			geometry = geometry.toNonIndexed();
		}

		// compute normals (used by phong materials)
		geometry.computeVertexNormals();

		if (attributeKeyByProperty.size > 0) {
			const scalarFields: ScalarFieldInfo[] = [];
			for (const [name, attributeKey] of attributeKeyByProperty) {
				const attribute = geometry.getAttribute(attributeKey);
				if (!attribute) continue;

				const analysis = analyzeScalarAttribute(
					attribute.array as ArrayLike<number>
				);
				scalarFields.push({ name, attributeKey, ...analysis });
			}
			if (scalarFields.length > 0) {
				geometry.userData.scalarFields = scalarFields;
			}
		}

		if (coordinateShift) {
			geometry.userData.coordinateShift = coordinateShift;
		}

		postMessage<LoaderWorkerSend>(
			{
				geometryClone: geometry,
			},
			{ transfer: findArrayBuffers(geometry.attributes) }
		);
	} catch (error) {
		postMessage<LoaderWorkerSend>({ error });
	} finally {
		URL.revokeObjectURL(modelURL);
	}
};
