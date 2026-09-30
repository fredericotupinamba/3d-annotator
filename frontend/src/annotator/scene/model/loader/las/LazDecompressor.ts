import { createLazPerf, type LazPerf } from "laz-perf/lib/worker/index.js";
import lazPerfWasmUrl from "laz-perf/lib/worker/laz-perf.wasm?url";

const PROGRESS_INTERVAL = 1 << 16;
/** the file is copied into wasm memory in chunks of this size */
const COPY_CHUNK_SIZE = 64 * 1024 * 1024;

let lazPerfPromise: Promise<LazPerf> | undefined;

function getLazPerf(): Promise<LazPerf> {
	lazPerfPromise ??= createLazPerf({
		locateFile: (path: string) =>
			path.endsWith(".wasm") ? lazPerfWasmUrl : path,
	});
	return lazPerfPromise;
}

/**
 * Decompresses the point records of a LAZ file using laz-perf (LASzip
 * compiled to WebAssembly), handing each record to `onPoint` right after it
 * was decompressed. Must be run inside a web worker.
 *
 * Only the compressed file (in wasm memory) and a single uncompressed
 * record exist at any time, the uncompressed point data is never held in
 * memory as a whole.
 *
 * @param file the complete LAZ file
 * @param onOpen called once with the number of points and the record length,
 *               before the first call to `onPoint`
 * @param onPoint called for every point with a view on its uncompressed
 *                record. The view is only valid during the call.
 * @param onProgress called periodically with the number of decompressed points
 */
export async function forEachLazPoint(
	file: Blob,
	onOpen: (pointCount: number, pointRecordLength: number) => void,
	onPoint: (view: DataView, byteOffset: number) => void,
	onProgress?: (decompressed: number, total: number) => void
): Promise<void> {
	const lazPerf = await getLazPerf();

	const filePointer = lazPerf._malloc(file.size);
	if (filePointer === 0) {
		throw new Error("LAZ: not enough memory to load the file.");
	}
	const laszip = new lazPerf.LASZip();
	let pointPointer = 0;

	try {
		for (let offset = 0; offset < file.size; offset += COPY_CHUNK_SIZE) {
			const chunk = await file
				.slice(offset, offset + COPY_CHUNK_SIZE)
				.arrayBuffer();
			// HEAPU8 must be re-read: it is replaced when wasm memory grows
			lazPerf.HEAPU8.set(new Uint8Array(chunk), filePointer + offset);
		}
		laszip.open(filePointer, file.size);

		const count = laszip.getCount();
		const pointRecordLength = laszip.getPointLength();
		onOpen(count, pointRecordLength);

		pointPointer = lazPerf._malloc(pointRecordLength);
		let view = new DataView(lazPerf.HEAPU8.buffer);

		for (let i = 0; i < count; i++) {
			laszip.getPoint(pointPointer);
			if (view.buffer !== lazPerf.HEAPU8.buffer) {
				view = new DataView(lazPerf.HEAPU8.buffer);
			}
			onPoint(view, pointPointer);

			if (onProgress && i % PROGRESS_INTERVAL === 0) {
				onProgress(i, count);
			}
		}
	} finally {
		laszip.delete();
		lazPerf._free(filePointer);
		if (pointPointer !== 0) {
			lazPerf._free(pointPointer);
		}
	}
}
