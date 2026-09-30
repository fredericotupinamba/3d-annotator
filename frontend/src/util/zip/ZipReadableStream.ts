import { Zip } from "fflate";
import type { NameableSizableStream } from "~entity/Types";
import type { Observer } from "~events/Events";
import { hasFileExtension } from "~util/fileSystem/FileUtils";
import { isBinaryPLYFormat, parsePLYFormat } from "~util/PLY";
import { AsyncProgressZipDeflate } from "./AsyncProgressZipDeflate";
import { AsyncProgressZipPassThrough } from "./AsyncProgressZipPassThrough";

/**
 * A ReadableStream that zips the data provided by the named streams.
 * Each stream is written to an own file in the zip folders root.
 *
 * Whether compression is used, depends on the file extension and content:
 * Everything is compressed except png, jpg/jpeg, las/laz and binary encoded
 * ply files.
 */
export class ZipReadableStream extends ReadableStream<Uint8Array> {
	constructor(
		streams: NameableSizableStream[],
		onProgress?: Observer<number>,
		onComplete?: Observer<void>
	) {
		async function start(
			controller: ReadableStreamDefaultController<Uint8Array>
		) {
			const zip = new Zip();

			zip.ondata = (err, data, final) => {
				if (err)
					console.error("ZipStream error (ondata)", err, data, final);

				controller.enqueue(data);

				if (final) {
					onProgress?.(100);
					controller.close();
					onComplete?.();
					return;
				}
			};

			let totalSize = 0;
			let bytesProcessed = 0;
			const streamsAndFiles: {
				stream: ReadableStream<Uint8Array>;
				file: AsyncProgressZipDeflate | AsyncProgressZipPassThrough;
			}[] = [];

			for (const streamData of streams) {
				const { size, name } = streamData;
				let { data: stream } = streamData;

				let compress = true;

				if (
					hasFileExtension(streamData, [
						"png",
						"jpg",
						"jpeg",
						"las",
						"laz",
					])
				) {
					compress = false;
				} else if (hasFileExtension(streamData, ["ply"])) {
					try {
						const {
							format,
							error,
							stream: clonedStream,
						} = await parsePLYFormat(stream);
						if (format && isBinaryPLYFormat(format)) {
							compress = false;
						} else if (error) {
							console.warn(
								"Error, while checking ply format: ",
								error
							);
						}
						stream = clonedStream;
					} catch (e) {
						console.error(e);
					}
				}

				let progressObserver: Observer<number> | undefined = undefined;
				if (onProgress) {
					totalSize += size;
					progressObserver = (n) => {
						bytesProcessed += n;
						const value = (bytesProcessed / totalSize) * 100;
						if (value != 100) {
							onProgress(value);
						}
					};
				}

				const file = compress
					? new AsyncProgressZipDeflate(name, progressObserver)
					: new AsyncProgressZipPassThrough(name, progressObserver);

				streamsAndFiles.push({
					stream,
					file,
				});
			}

			for (const { stream, file } of streamsAndFiles) {
				zip.add(file);

				const reader = stream.getReader();
				while (true) {
					try {
						const { value, done } = await reader.read();

						if (done) {
							file.push(new Uint8Array(), true);
							break;
						}

						file.push(value, false);
					} catch (error) {
						throw new Error("Error while pushing chunk", {
							cause: error,
						});
					}
				}
			}

			zip.end();
		}

		super({ start });
	}
}
