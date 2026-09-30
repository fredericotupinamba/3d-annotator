import { err, ok, type Result } from "neverthrow";
import { type BufferGeometry, type Texture } from "three";
import { type Observer } from "~events/Events";
import { hasFileExtension } from "~util/fileSystem/FileUtils";
import { getBufferGeometryInfo, getTextureInfo } from "~util/Three";
import {
	LAS_FILE_EXTENSIONS,
	NonBlockingLASLoader,
} from "./las/NonBlockingLASLoader";
import { type Loader, type LoaderError } from "./Loader";
import {
	NonBlockingOBJLoader,
	OBJ_FILE_EXTENSIONS,
} from "./obj/NonBlockingOBJLoader";
import {
	NonBlockingPLYLoader,
	PLY_FILE_EXTENSIONS,
} from "./ply/NonBlockingPLYLoader";
import { TEXTURE_FILE_EXTENSIONS, TextureLoader } from "./TextureLoader";

interface GenericLoaderResult {
	geometry?: BufferGeometry;
	texture?: Texture;
}

/**
 * A Generic loader to load models from model files
 */
export class GenericLoader implements Loader<GenericLoaderResult, File[]> {
	/**
	 *
	 * **Important note**:\
	 * The onProgress callback currently only tracks the progress of loading
	 * the model file.\
	 * Tracking the progress of the following tasks is **not** (yet) supported:
	 * - loading the texture file
	 * - parsing/reading the model and texture file
	 *
	 * @param files model files
	 * @param onProgress an optional onProgress {@link Observer}
	 * @return a {@link GenericLoaderResult}
	 */
	public async load(
		files: File[],
		onProgress?: Observer<number>,
		skipModel = false
	): Promise<Result<GenericLoaderResult, LoaderError>> {
		if (files.length === 0) {
			throw new Error("expected at least one file");
		}

		if (files.length > 2) {
			throw new Error("Not more than two files supported.");
		}

		let modelLoaderConstructor;
		let modelFile: File | undefined;

		let textureLoader: TextureLoader | undefined;
		let textureFile: File | undefined;

		for (const file of files) {
			if (
				!modelLoaderConstructor &&
				hasFileExtension(file, OBJ_FILE_EXTENSIONS)
			) {
				modelLoaderConstructor = NonBlockingOBJLoader;
				modelFile = file;
			} else if (
				!modelLoaderConstructor &&
				hasFileExtension(file, PLY_FILE_EXTENSIONS)
			) {
				modelLoaderConstructor = NonBlockingPLYLoader;
				modelFile = file;
			} else if (
				!modelLoaderConstructor &&
				hasFileExtension(file, LAS_FILE_EXTENSIONS)
			) {
				modelLoaderConstructor = NonBlockingLASLoader;
				modelFile = file;
			} else if (
				!textureLoader &&
				hasFileExtension(file, TEXTURE_FILE_EXTENSIONS)
			) {
				textureLoader = new TextureLoader();
				textureFile = file;
			} else {
				throw new Error(`unable to select loader for '${file.name}'`);
			}
		}

		if (!modelLoaderConstructor || !modelFile) {
			throw new Error(`unable to select a model loader`);
		}

		const modelLoader = skipModel
			? undefined
			: new modelLoaderConstructor();

		if (textureLoader && textureFile) {
			const [geometryRes, textureRes] = await Promise.all([
				modelLoader
					? modelLoader.load(modelFile, onProgress)
					: Promise.resolve(undefined),
				textureLoader.load(textureFile),
			]);

			modelLoader?.destroy();

			if (geometryRes && geometryRes.isErr()) {
				return err(geometryRes.error);
			}

			const geometry = geometryRes?.value;
			const texture = textureRes.value;
			console.log(getTextureInfo(texture));
			return ok({
				geometry,
				texture,
			});
		} else {
			if (!modelLoader) {
				return ok({ geometry: undefined });
			}

			const geometryRes = await modelLoader.load(modelFile, onProgress);
			modelLoader.destroy();

			if (geometryRes.isErr()) {
				return err(geometryRes.error);
			}

			const geometry = geometryRes.value;
			console.log(getBufferGeometryInfo(geometry));
			return ok({ geometry });
		}
	}
}
