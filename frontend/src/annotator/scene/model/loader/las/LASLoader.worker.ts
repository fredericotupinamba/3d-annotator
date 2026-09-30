import { createTimeoutProxy } from "~util/Timeout";
import { type LoaderWorkerReceive, type LoaderWorkerSend } from "../Loader";
import { createPointCloudGeometry } from "../PointCloudGeometry";
import {
	LAS_STANDARD_FIELD_NAMES,
	LasPointDecoder,
	parseExtraBytesDimensions,
	parseLasHeader,
	type LasExtraBytesDimension,
	type LasHeader,
} from "./LasFormat";
import { forEachLazPoint } from "./LazDecompressor";

/** size of the fixed LAS 1.4 header, the largest header of any LAS version */
const MAX_HEADER_SIZE = 375;
/** uncompressed point records are read in chunks of about this size */
const READ_CHUNK_SIZE = 64 * 1024 * 1024;

async function readUncompressedPoints(
	file: File,
	header: LasHeader,
	extraDimensions: LasExtraBytesDimension[],
	onProgress: (loaded: number, total: number) => void
): Promise<LasPointDecoder> {
	const recordLength = header.pointRecordLength;
	const recordsPerChunk = Math.max(
		1,
		Math.floor(READ_CHUNK_SIZE / recordLength)
	);
	const available = Math.floor(
		(file.size - header.pointDataOffset) / recordLength
	);
	const count = Math.min(header.pointCount, available);
	if (count < header.pointCount) {
		console.warn(
			`LAS: header declares ${header.pointCount} points, but the file only contains ${count}.`
		);
	}

	const decoder = new LasPointDecoder(header, extraDimensions, count);
	for (let first = 0; first < count; first += recordsPerChunk) {
		const chunkCount = Math.min(recordsPerChunk, count - first);
		const start = header.pointDataOffset + first * recordLength;
		const chunk = await file
			.slice(start, start + chunkCount * recordLength)
			.arrayBuffer();
		const view = new DataView(chunk);
		for (let i = 0; i < chunkCount; i++) {
			decoder.decode(view, i * recordLength);
		}
		onProgress(first + chunkCount, count);
	}
	return decoder;
}

onmessage = async function ({ data }: MessageEvent<LoaderWorkerReceive>) {
	const { modelFile, options } = data;

	const postProgress = options.hasProgressObserver
		? // don't call postMessage on every progress update
		  createTimeoutProxy((progress: { loaded: number; total: number }) => {
				postMessage<LoaderWorkerSend>({ progress });
		  })
		: undefined;
	const onProgress = (loaded: number, total: number) =>
		postProgress?.({ loaded, total });

	try {
		// only the header and VLRs are read up front, point records are
		// streamed, so the complete file is never held in memory
		const headerView = new DataView(
			await modelFile.slice(0, MAX_HEADER_SIZE).arrayBuffer()
		);
		const header = parseLasHeader(headerView);
		const headerAndVlrs = new DataView(
			await modelFile.slice(0, header.pointDataOffset).arrayBuffer()
		);
		const extraDimensions = parseExtraBytesDimensions(
			headerAndVlrs,
			header,
			[...LAS_STANDARD_FIELD_NAMES]
		);

		let decoder: LasPointDecoder | undefined;
		if (header.isCompressed) {
			await forEachLazPoint(
				modelFile,
				(pointCount, pointRecordLength) => {
					if (pointRecordLength !== header.pointRecordLength) {
						throw new Error(
							`LAZ: unexpected point record length ${pointRecordLength} (header: ${header.pointRecordLength}).`
						);
					}
					decoder = new LasPointDecoder(
						header,
						extraDimensions,
						pointCount
					);
				},
				(view, byteOffset) => {
					decoder!.decode(view, byteOffset);
				},
				onProgress
			);
		} else {
			decoder = await readUncompressedPoints(
				modelFile,
				header,
				extraDimensions,
				onProgress
			);
		}

		if (!decoder) {
			throw new Error("LAS: no point records found.");
		}

		const { geometry, transfer } = createPointCloudGeometry(
			decoder.finish()
		);

		postMessage<LoaderWorkerSend>(
			{ geometryClone: geometry },
			{ transfer }
		);
	} catch (error) {
		postMessage<LoaderWorkerSend>({ error });
	}
};
