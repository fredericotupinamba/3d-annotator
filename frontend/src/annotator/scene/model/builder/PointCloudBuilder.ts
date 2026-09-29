import { BUFFER_GEOMETRY_CACHE_CODEC } from "codecs/three/BufferGeometry";
import {
	Box3,
	BufferAttribute,
	DynamicDrawUsage,
	MeshBasicMaterial,
	Points,
	PointsMaterial,
	Mesh as ThreeMesh,
	Vector3,
	type BufferGeometry,
} from "three";
import {
	createMainThreadCacheRuntime,
	defineTypedModelCacheResource,
	type CacheScope,
	type CacheSession,
} from "~cache/index";
import type { CoordinateShift } from "~entity/ScalarField";
import { ColorSetting } from "~settings/Settings";
import { LocalStorageSettingsRegistry } from "~settings/SettingsRegistry";
import { getBufferGeometryInfo } from "~util/Three";
import { wait } from "~util/Timeout";
import { POINT_CLOUD_SETTINGS } from "../PointCloud";
import { BUILDER_RESULT_RESOURCE } from "./BuilderResultResource";
import { NonBlockingBVHBuilder } from "./bvh/NonBlockingBVHBuilder";

/**
 * - defaultPointColor: The color used for points if they do not have any color values. Changes to this setting only take affect after rebuilding.
 */
export const POINT_CLOUD_BUILDER_SETTINGS = {
	defaultPointColor: new ColorSetting("defaultPointColor", 0xcccccc),
};

const settingsRegistry = new LocalStorageSettingsRegistry(
	"pointCloudBuilder-JLzS9"
);
settingsRegistry.registerMultiple(POINT_CLOUD_BUILDER_SETTINGS);

export const POINTS_GEOMETRY_RESOURCE = defineTypedModelCacheResource(
	"points-geometry",
	BUFFER_GEOMETRY_CACHE_CODEC
);

/**
 * Builds a PointCloud model
 */
export class PointCloudBuilder {
	private readonly cacheScope: CacheScope;

	/**
	 * constructs a new PointCloudBuilder Instance.
	 */
	constructor(scope: CacheScope) {
		this.cacheScope = scope;
	}

	/**
	 * Builds the {@link THREE.Mesh} out of the {@link THREE.BufferGeometry} which was defined in the constructor
	 *
	 * @returns an array which contains {@link THREE.Points} and {@link THREE.Mesh}
	 */
	public async build(
		bufferGeometry?: BufferGeometry
	): Promise<[Points, ThreeMesh]> {
		await wait();

		let geometry: BufferGeometry;

		const cacheRuntime = await createMainThreadCacheRuntime();
		const cacheSession = cacheRuntime.getSession(this.cacheScope);

		if (bufferGeometry) {
			geometry = bufferGeometry!;

			geometry.userData.hasOriginalColor = geometry.hasAttribute("color");

			if (!geometry.hasAttribute("color")) {
				const count = geometry.attributes.position.count;
				const colors = new Float32Array(count * 3);
				const color =
					POINT_CLOUD_BUILDER_SETTINGS.defaultPointColor.getAsColor()
						.floatRGBValues;
				for (let i = 0; i < count; i++) {
					colors.set(color, i * 3);
				}
				const attribute = new BufferAttribute(colors, 3);
				geometry.setAttribute("color", attribute);
				await wait();
			}

			const colorAttribute = geometry.getAttribute(
				"color"
			) as BufferAttribute;
			colorAttribute.setUsage(DynamicDrawUsage);

			await wait();
			const boundingBox = new Box3().setFromBufferAttribute(
				geometry.getAttribute("position") as BufferAttribute
			);
			const center = new Vector3();
			boundingBox.getCenter(center);
			geometry.translate(-center.x, -center.y, -center.z);

			const previousShift = geometry.userData.coordinateShift as
				| CoordinateShift
				| undefined;
			geometry.userData.coordinateShift = {
				x: (previousShift?.x ?? 0) + center.x,
				y: (previousShift?.y ?? 0) + center.y,
				z: (previousShift?.z ?? 0) + center.z,
			};

			await cacheSession.write(POINTS_GEOMETRY_RESOURCE, geometry);

			console.log(`Saved to cache: ${POINTS_GEOMETRY_RESOURCE.id}`);
		} else {
			if (await cacheSession.has(POINTS_GEOMETRY_RESOURCE)) {
				// todo: handle null (cache version mismatch...)
				geometry = (await cacheSession.read(POINTS_GEOMETRY_RESOURCE))!;

				console.log(
					`Retrieved from cache: ${POINTS_GEOMETRY_RESOURCE.id}`
				);
			} else {
				throw new Error("No geometry provided ");
			}
		}

		console.log("Points:\n" + getBufferGeometryInfo(geometry));

		await wait();
		const material = new PointsMaterial({
			size: POINT_CLOUD_SETTINGS.size.get(),
			vertexColors: true,
		});

		const pointCloud = new Points(geometry, material);
		pointCloud.matrixAutoUpdate = false;

		await wait();
		const bvhMesh = await this.createBVHMesh(geometry, cacheSession);

		console.log("Points BVH:\n" + getBufferGeometryInfo(bvhMesh.geometry));

		return Promise.resolve([pointCloud, bvhMesh]);
	}

	private async createBVHMesh(
		pointsGeometry: BufferGeometry,
		cacheSession: CacheSession<CacheScope>
	) {
		let bvhGeometry: BufferGeometry;

		if (await cacheSession.has(BUILDER_RESULT_RESOURCE)) {
			// todo: handle null (cache version mismatch...)
			bvhGeometry = (await cacheSession.read(BUILDER_RESULT_RESOURCE))!;

			console.log(`Retrieved from cache: ${BUILDER_RESULT_RESOURCE.id}.`);
		} else {
			bvhGeometry = pointsGeometry.clone();
			bvhGeometry.deleteAttribute("color");
			await wait();

			const verticesLength = bvhGeometry.attributes.position.count;
			const indices = new Array(verticesLength * 3);

			for (let i = 0, base = 0; i < verticesLength; i++, base += 3) {
				indices[base] = i;
				indices[base + 1] = i;
				indices[base + 2] = i;
			}
			await wait();

			bvhGeometry.setIndex(indices);

			await wait();
			const bvhBuilder = new NonBlockingBVHBuilder();
			const bvh = await bvhBuilder.build(bvhGeometry);
			bvhBuilder.destroy();
			bvhGeometry.boundsTree = bvh;

			await cacheSession.write(BUILDER_RESULT_RESOURCE, bvhGeometry);

			console.log(`Saved to cache: ${BUILDER_RESULT_RESOURCE.id}.`);
		}

		const bvhMaterial = new MeshBasicMaterial({
			color: 0xff0000,
		});
		const bvhMesh = new ThreeMesh(bvhGeometry!, bvhMaterial);

		return bvhMesh;
	}

	public static async isCached(scope: CacheScope) {
		const cacheRuntime = await createMainThreadCacheRuntime();
		const cacheSession = cacheRuntime.getSession(scope);
		return (
			(await cacheSession.has(POINTS_GEOMETRY_RESOURCE)) &&
			(await cacheSession.has(BUILDER_RESULT_RESOURCE))
		);
	}
}
