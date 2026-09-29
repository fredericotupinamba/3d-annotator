import {
	AlphaFormat,
	BufferAttribute,
	BufferGeometry,
	ByteType,
	FloatType,
	HalfFloatType,
	IntType,
	LuminanceAlphaFormat,
	LuminanceFormat,
	type Material,
	RedFormat,
	RGBAFormat,
	RGBFormat,
	RGFormat,
	ShortType,
	type Texture,
	UnsignedByteType,
	UnsignedIntType,
	UnsignedShortType,
} from "three";
import { type ExcludeMethods } from "./TypeScript";
import type { NumberTypedArray } from "./TypedArrays";
import type { TransferData } from "./Worker";

/**
 * Calls `dispose()` on all given materials.
 *
 * @param materials the materials to dispose.
 */
export function disposeMaterials(materials: Material | Material[] | undefined) {
	if (!materials) {
		return;
	}

	if (!Array.isArray(materials)) {
		materials.dispose();
		return;
	}

	for (const material of materials) {
		material.dispose();
	}
}

/**
 * Creates a new BufferGeometry out of a structured clone of a BufferGeometry.
 *
 * ! Uses shallow copies !
 * ! Only copies attributes and userData !
 *
 * @param structuredClone a structured clone of a BufferGeometry
 * @returns a new BufferGeometry
 */
export function createGeometryFromClone(
	structuredClone: ExcludeMethods<BufferGeometry>
): BufferGeometry {
	const geometry = new BufferGeometry();
	if (!structuredClone.attributes) {
		throw new Error("No attributes found in serialized data!");
	}
	const serializedAttrs = structuredClone.attributes;
	for (const key in serializedAttrs) {
		const oldAttrData = serializedAttrs[
			key
		] as ExcludeMethods<BufferAttribute>;
		const newAttr = new BufferAttribute(
			oldAttrData.array,
			oldAttrData.itemSize,
			oldAttrData.normalized
		);
		geometry.setAttribute(key, newAttr);
	}
	geometry.userData = structuredClone.userData ?? {};
	return geometry;
}

export interface BufferAttributeTransferPayload {
	version: 1;
	kind: "BufferAttribute";
	name: BufferAttribute["name"];
	itemSize: BufferAttribute["itemSize"];
	array: BufferAttribute["array"] | NumberTypedArray<SharedArrayBuffer>;
	usage: BufferAttribute["usage"];
	gpuType: BufferAttribute["gpuType"];
	normalized: BufferAttribute["normalized"];
}

/**
 * Prepares a three js `BufferAttribute` for a transfer through the
 * `postMessage` browser api.
 *
 * @param bufferAttribute - the `BufferAttribute`
 * @param shared - An optional shared buffer, replacing the original buffer
 * in the target context. This buffer already needs to be filled with the
 * contents of the original buffer.
 * @returns a TransferData tuple
 */
export function bufferAttributeToTransfer(
	bufferAttribute: BufferAttribute,
	shared?: NumberTypedArray<SharedArrayBuffer>
): TransferData<BufferAttributeTransferPayload> {
	const out = {
		version: 1 as const,
		kind: "BufferAttribute" as const,
		name: bufferAttribute.name,
		array: shared ? shared : bufferAttribute.array,
		itemSize: bufferAttribute.itemSize,
		usage: bufferAttribute.usage,
		gpuType: bufferAttribute.gpuType,
		normalized: bufferAttribute.normalized,
	};
	if (shared) {
		return [out, []];
	} else {
		return [out, [out.array.buffer]];
	}
}

/**
 * Creates a new `BufferAttribute` out of a `BufferAttributeTransferPayload`.
 *
 * @param payload - The payload.
 * @returns a new `BufferAttribute`
 */
export function bufferAttributeFromTransfer(
	payload: BufferAttributeTransferPayload
): BufferAttribute {
	const bufferAttribute = new BufferAttribute(
		payload.array,
		payload.itemSize,
		payload.normalized
	);
	bufferAttribute.name = payload.name;
	bufferAttribute.setUsage(payload.usage);
	bufferAttribute.gpuType = payload.gpuType;
	return bufferAttribute;
}

/**
 * Generates a human-readable string summary of a BufferGeometry
 * for logging, focusing on attributes and index.
 *
 * @param geometry The BufferGeometry to inspect.
 * @returns A formatted string with details about the geometry.
 */
export function getBufferGeometryInfo(geometry: BufferGeometry): string {
	const info: string[] = [];

	info.push(`------- BufferGeometry -------`);
	info.push(`Name: ${geometry.name || "N/A"}`);
	info.push(`UUID: ${geometry.uuid}`);

	const positionAttribute = geometry.attributes.position;
	if (positionAttribute) {
		info.push(`Vertex Count (Positions): ${positionAttribute.count}`);
	} else {
		info.push(`Vertex Count (Positions): N/A (No 'position' attribute)`);
	}

	if (geometry.index) {
		info.push(`Index Count: ${geometry.index.count}`);
	} else {
		info.push(`Index Count: N/A (Non-indexed)`);
	}

	info.push(`\n**Attributes**`);
	const attributes = geometry.attributes;
	const attrKeys = Object.keys(attributes);

	if (attrKeys.length === 0) {
		info.push(`  - None`);
	}

	for (const key of attrKeys) {
		const attr = attributes[key];

		if (
			"isInterleavedBufferAttribute" in attr &&
			attr.isInterleavedBufferAttribute
		) {
			const interleavedAttr = attr;
			info.push(`  - ${key} (Interleaved)`);
			info.push(`    - Item Size: ${interleavedAttr.itemSize}`);
			info.push(`    - Offset: ${interleavedAttr.offset}`);
			info.push(`    - Data UUID: ${interleavedAttr.data.uuid}`);
		} else {
			const bufferAttr = attr;
			info.push(`  - ${key}`);
			info.push(`    - Count: ${bufferAttr.count}`);
			info.push(`    - Item Size: ${bufferAttr.itemSize}`);
			info.push(`    - Type: ${bufferAttr.array.constructor.name}`);
			info.push(`    - Normalized: ${bufferAttr.normalized}`);
		}
	}

	info.push(`------------------------------`);

	return info.join("\n");
}

/**
 * Generates a minimal, human-readable string summary of a Texture.
 *
 * @param texture The Texture to inspect.
 * @returns A formatted string with core details about the texture.
 */
export function getTextureInfo(texture: Texture): string {
	const FORMAT_MAP: Record<number, string> = {
		[AlphaFormat]: "AlphaFormat",
		[RedFormat]: "RedFormat",
		[RGFormat]: "RGFormat",
		[RGBFormat]: "RGBFormat",
		[RGBAFormat]: "RGBAFormat",
		[LuminanceFormat]: "LuminanceFormat",
		[LuminanceAlphaFormat]: "LuminanceAlphaFormat",
	};

	const TYPE_MAP: Record<number, string> = {
		[UnsignedByteType]: "UnsignedByteType",
		[ByteType]: "ByteType",
		[ShortType]: "ShortType",
		[UnsignedShortType]: "UnsignedShortType",
		[IntType]: "IntType",
		[UnsignedIntType]: "UnsignedIntType",
		[FloatType]: "FloatType",
		[HalfFloatType]: "HalfFloatType",
	};

	const getConst = (map: Record<number, string>, key: number): string => {
		return map[key] ?? `Unknown (${key})`;
	};

	const info: string[] = [];

	info.push(`---------- Texture ----------`);
	info.push(`Name: ${texture.name || "N/A"}`);
	info.push(`UUID: ${texture.uuid}`);

	info.push(`\n**Source & Dimensions**`);
	if (texture.image) {
		const image = texture.image as HTMLImageElement;
		info.push(`  - Source Type: ${image.constructor.name}`);
		info.push(`  - Dimensions: ${image.width} x ${image.height}`);
	} else {
		info.push(`  - Source Type: N/A (No image loaded)`);
		info.push(`  - Dimensions: N/A`);
	}

	info.push(`\n**Format & Color**`);
	info.push(`  - Color Space: ${texture.colorSpace}`);
	info.push(`  - Format: ${getConst(FORMAT_MAP, texture.format)}`);
	info.push(`  - Data Type: ${getConst(TYPE_MAP, texture.type)}`);

	info.push(`-----------------------------`);

	return info.join("\n");
}
