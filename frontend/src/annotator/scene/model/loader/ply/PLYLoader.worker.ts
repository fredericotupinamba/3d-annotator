import { PLYLoader as ThreePLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import type { ScalarFieldInfo } from "~entity/ScalarField";
import { createTimeoutProxy } from "~util/Timeout";
import { findArrayBuffers } from "~util/Util";
import { type LoaderWorkerReceive, type LoaderWorkerSend } from "../Loader";
import {
	createPointCloudGeometry,
	type PointCloudData,
} from "../PointCloudGeometry";
import { analyzeScalarAttribute } from "../ScalarFieldAnalysis";
import {
	extractPlyHeaderText,
	findScalarPropertyNames,
	parsePlyHeader,
} from "./PlyHeader";
import {
	getPlyPointCloudLayout,
	PlyPointCloudReader,
	type PlyPointCloudLayout,
} from "./PlyPointCloudReader";
import { shiftAsciiPlyVertices, type CoordinateShift } from "./PlyPrecisionFix";

// A .ply header is plain text, terminated by "end_header", even in binary
// encoded files. This is comfortably larger than any realistic header.
const HEADER_PROBE_SIZE = 1_048_576;

/** point cloud bodies are read in chunks of this size */
const READ_CHUNK_SIZE = 64 * 1024 * 1024;

type ProgressCallback = (progress: { loaded: number; total: number }) => void;

/**
 * Reads the vertex body of a point cloud ply file chunk by chunk, so the
 * complete file is never held in memory.
 */
async function readPointCloud(
	file: File,
	layout: PlyPointCloudLayout,
	bodyOffset: number,
	onProgress?: ProgressCallback
): Promise<PointCloudData> {
	const reader = new PlyPointCloudReader(layout);
	const textDecoder = layout.format === "ascii" ? new TextDecoder() : null;

	for (
		let offset = bodyOffset;
		offset < file.size && !reader.isComplete;
		offset += READ_CHUNK_SIZE
	) {
		const bytes = new Uint8Array(
			await file.slice(offset, offset + READ_CHUNK_SIZE).arrayBuffer()
		);
		if (textDecoder) {
			reader.pushText(textDecoder.decode(bytes, { stream: true }));
		} else {
			reader.pushBytes(bytes);
		}
		onProgress?.({
			loaded: Math.min(offset + READ_CHUNK_SIZE, file.size),
			total: file.size,
		});
	}
	if (textDecoder) {
		reader.pushText(textDecoder.decode());
	}

	return reader.finish();
}

/**
 * Tries to read the file as a point cloud with {@link PlyPointCloudReader}.
 *
 * @returns `true` if the file was loaded (and posted), `false` if it has to
 *          be loaded by three.js' PLYLoader instead (e.g. meshes)
 */
async function tryLoadPointCloud(
	modelFile: File,
	onProgress?: ProgressCallback
): Promise<boolean> {
	// windows-1252 maps every byte to exactly one character, so the header's
	// length in characters equals the byte offset of the body
	const probeText = new TextDecoder("windows-1252").decode(
		await modelFile.slice(0, HEADER_PROBE_SIZE).arrayBuffer()
	);
	const headerText = extractPlyHeaderText(probeText);
	const header = headerText ? parsePlyHeader(headerText) : null;
	const layout = header ? getPlyPointCloudLayout(header) : null;
	if (!headerText || !layout) {
		return false;
	}

	const data = await readPointCloud(
		modelFile,
		layout,
		headerText.length,
		onProgress
	);
	const { geometry, transfer } = createPointCloudGeometry(data);
	postMessage<LoaderWorkerSend>({ geometryClone: geometry }, { transfer });
	return true;
}

onmessage = async function ({ data }: MessageEvent<LoaderWorkerReceive>) {
	const { modelFile, options } = data;

	const onProgress = options.hasProgressObserver
		? // don't call postMessage on every progress update
		  createTimeoutProxy((progress: { loaded: number; total: number }) => {
				postMessage<LoaderWorkerSend>({ progress });
		  })
		: undefined;

	try {
		if (await tryLoadPointCloud(modelFile, onProgress)) {
			return;
		}
	} catch (error) {
		postMessage<LoaderWorkerSend>({ error });
		return;
	}

	await loadWithThree(modelFile, options);
};

/**
 * Loads any ply file (in particular meshes) with three.js' PLYLoader.
 */
async function loadWithThree(
	modelFile: File,
	options: LoaderWorkerReceive["options"]
) {
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
}
