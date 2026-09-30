import { unzip } from "fflate";
import type { NameableData } from "~entity/Types";

/**
 * Was used previously to make the number of files inside the zip archive is consistent
 * by adding empty files which is not needed anymore. Keep it for backwards capability.
 */
const EMPTY_FILE = "empty";

export async function unzipBlob(
	blob: Blob
): Promise<NameableData<Uint8Array>[]> {
	const data = new Uint8Array(await blob.arrayBuffer());

	return new Promise<NameableData<Uint8Array>[]>((resolve, reject) => {
		unzip(data, (error, files) => {
			if (error) {
				reject(error);
				return;
			}

			const res: NameableData<Uint8Array>[] = [];
			for (const [key, value] of Object.entries(files)) {
				if (key === EMPTY_FILE) {
					continue;
				}

				res.push({
					name: key,
					data: value,
				});
			}
			resolve(res);
			return;
		});
	});
}
