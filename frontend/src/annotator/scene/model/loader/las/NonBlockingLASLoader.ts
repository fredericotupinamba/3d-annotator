import { err, ok, type Result } from "neverthrow";
import { type BufferGeometry } from "three";
import { type Observer } from "~events/Events";
import { hasFileExtension } from "~util/fileSystem/FileUtils";
import { createGeometryFromClone } from "~util/Three";
import { progressInPercent } from "~util/Util";
import {
	type LoaderError,
	type LoaderWorkerReceive,
	type LoaderWorkerSend,
	type ModelLoaderWorker,
} from "../Loader";

export const LAS_FILE_EXTENSIONS = ["las", "laz"];

/**
 * A ModelLoader to load point clouds in a webworker asynchronously out of
 * .las and .laz files
 */
export class NonBlockingLASLoader implements ModelLoaderWorker {
	private running: boolean;
	private worker: Worker | null;

	constructor() {
		this.running = false;
		this.worker = new Worker(
			new URL("./LASLoader.worker.ts", import.meta.url),
			{ type: "module" }
		);
		this.worker.onerror = (e) => {
			throw new Error(
				`LASLoaderWorker: Could not create Web Worker: "${e.message}"`
			);
		};
	}

	public async load(
		modelFile: File,
		onProgress?: Observer<number>
	): Promise<Result<BufferGeometry, LoaderError>> {
		if (this.running) {
			throw new Error("LASLoaderWorker: Already running job.");
		}

		if (this.worker === null) {
			throw new Error("LASLoaderWorker: Worker has been terminated.");
		}

		if (!hasFileExtension(modelFile, LAS_FILE_EXTENSIONS)) {
			throw new Error(
				`Expected a las or laz file but got '${modelFile.name}'.`
			);
		}

		const worker = this.worker;
		this.running = true;

		return new Promise((resolve, reject) => {
			worker.onerror = (e) => {
				reject(new Error(`LASLoaderWorker: ${e.message}`));
				this.running = false;
			};

			worker.onmessage = ({ data }: MessageEvent<LoaderWorkerSend>) => {
				const { error, geometryClone, progress } = data;

				if (error) {
					this.running = false;
					reject(error);
					worker.onmessage = null;
				} else if (geometryClone) {
					this.running = false;
					const geometry = createGeometryFromClone(geometryClone);

					if (geometry.getAttribute("position").count === 0) {
						resolve(err({ code: "UNSUPPORTED_FILE_SIZE" }));
					} else {
						resolve(ok(geometry));
					}

					worker.onmessage = null;
				} else if (onProgress && progress) {
					onProgress(progressInPercent({ ...progress }));
				}
			};

			worker.postMessage<LoaderWorkerReceive>({
				modelFile: modelFile,
				options: {
					hasProgressObserver: Boolean(onProgress),
				},
			});
		});
	}

	public destroy() {
		if (this.worker === null) return;
		this.worker.terminate();
		this.worker = null;
	}
}
