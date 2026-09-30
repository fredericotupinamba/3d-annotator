import { err, ok, type Result } from "neverthrow";
import {
	BufferAttribute,
	SRGBColorSpace,
	Color as ThreeColor,
	type BufferGeometry,
	type Object3D,
	type Points,
	type PointsMaterial,
	type Mesh as ThreeMesh,
} from "three";
import {
	computeCategoricalColors,
	computeContinuousColors,
} from "~annotator/scalarFields/ScalarFieldColorMap";
import type { CacheScope } from "~cache/index";
import type {
	CoordinateShift,
	ScalarFieldFilter,
	ScalarFieldInfo,
	ScalarFieldKind,
} from "~entity/ScalarField";
import { type Observer } from "~events/Events";
import { NumberSetting } from "~settings/Settings";
import { createSettingsManager } from "~settings/SettingsManager";
import { LocalStorageSettingsRegistry } from "~settings/SettingsRegistry";
import { disposeMaterials } from "~util/Three";
import type { MutableArrayLike } from "~util/TypedArrays";
import { PointCloudBuilder } from "./builder/PointCloudBuilder";
import { GenericLoader } from "./loader/GenericLoader";
import { type LoaderError } from "./loader/Loader";
import {
	MODEL_FIELD_ACCESS_ERROR_MESSAGE,
	type GeometryObject3D,
	type Model,
} from "./Model";

const FILTER_ATTRIBUTE_PREFIX = "filterValue";

/**
 * The number of scalar field filters that can be active at the same time
 * (combined with AND, e.g. "tree == 1 AND part == trunk"). Backed by a
 * fixed number of shader uniforms/attributes, see {@link PointCloud.ensureFilterShader}.
 */
export const MAX_ACTIVE_FILTERS = 4;

const FILTER_MODE_RANGE = 0;
const FILTER_MODE_SET = 1;

interface FilterSlotUniforms {
	enabled: { value: boolean };
	mode: { value: number };
	min: { value: number };
	max: { value: number };
}

/**
 * The raw per-point data needed to export this point cloud to an external
 * format (e.g. LAS), alongside the annotation data.
 */
export interface PointCloudExportData {
	/** interleaved x,y,z, in the model's local (viewer) coordinates */
	positions: Float32Array;
	/** added to `positions` to recover the original real-world coordinates */
	coordinateShift: CoordinateShift;
	/** interleaved r,g,b in [0, 1], sRGB encoded (as in the source file), or `null` if the source file had no color */
	colors: Float32Array | null;
	/** the raw values of every scalar field discovered in the source file */
	scalarFields: { name: string; values: Float32Array }[];
}

/**
 * Loaders convert sRGB file colors to the linear working color space (see
 * three.js' PLYLoader). This reverses that conversion for exporting.
 */
function linearToSRGBColors(linearColors: Float32Array): Float32Array {
	const srgbColors = new Float32Array(linearColors.length);
	const color = new ThreeColor();
	const srgb = { r: 0, g: 0, b: 0 };
	for (let i = 0; i < linearColors.length; i += 3) {
		color
			.setRGB(linearColors[i], linearColors[i + 1], linearColors[i + 2])
			.getRGB(srgb, SRGBColorSpace);
		srgbColors[i] = srgb.r;
		srgbColors[i + 1] = srgb.g;
		srgbColors[i + 2] = srgb.b;
	}
	return srgbColors;
}

export const POINT_CLOUD_SETTINGS = {
	size: new NumberSetting("size", { initial: 0.005, min: 0, max: 5 }),
};

const settingsRegistry = new LocalStorageSettingsRegistry("pointCloud-tZ0mg");
settingsRegistry.registerMultiple(POINT_CLOUD_SETTINGS);

/**
 * A PointCloud Model
 */
export class PointCloud implements Model {
	private readonly settings;

	private readonly cacheScope: CacheScope;

	private readonly loader = new GenericLoader();

	// initialized in this.initializeModel()
	private points?: Points;
	private bvhMesh?: ThreeMesh;

	private index?: Uint32Array;

	/** the point cloud's original (PLY or default) colors, before any scalar field coloring is applied */
	private pristineColors?: Float32Array;

	private filterSlots?: FilterSlotUniforms[];

	/** scalar field values by field name, kept outside of the geometry, see {@link initializeModel} */
	private readonly scalarFieldValues = new Map<string, Float32Array>();

	constructor(scope: CacheScope) {
		this.settings = createSettingsManager(POINT_CLOUD_SETTINGS);

		this.cacheScope = scope;

		this.settings.onChange("size", ({ new: size }) => {
			this.setPointSize(size);
		});
	}

	public getBVHMesh(): ThreeMesh {
		if (!this.bvhMesh) {
			throw new Error(MODEL_FIELD_ACCESS_ERROR_MESSAGE);
		}

		return this.bvhMesh;
	}

	public getPoints(): Points {
		if (!this.points) {
			throw new Error(MODEL_FIELD_ACCESS_ERROR_MESSAGE);
		}

		return this.points;
	}

	public getObject(): GeometryObject3D {
		return this.getPoints();
	}

	private setPointSize(size: number) {
		if (!this.points) {
			throw new Error(MODEL_FIELD_ACCESS_ERROR_MESSAGE);
		}

		const material = this.points.material as PointsMaterial;
		material.size = size;
	}

	public async initializeModel(
		files: File[],
		onProgress?: Observer<number>
	): Promise<Result<undefined, LoaderError>> {
		if (files.length !== 1) {
			throw new Error("expected one file but got " + files.length);
		}

		let geometry: BufferGeometry | undefined;
		if (!(await PointCloudBuilder.isCached(this.cacheScope))) {
			const res = await this.loader.load(files, onProgress);
			if (res.isErr()) {
				return err(res.error);
			}

			geometry = res.value.geometry;
		}

		const builder = new PointCloudBuilder(this.cacheScope);
		const [pointCloud, bvhMesh] = await builder.build(geometry);
		this.bvhMesh = bvhMesh;
		this.index = bvhMesh.geometry.index!.array as Uint32Array;
		this.points = pointCloud;

		const colorAttribute = pointCloud.geometry.getAttribute(
			"color"
		) as BufferAttribute;
		this.pristineColors = Float32Array.from(
			colorAttribute.array as Float32Array
		);

		this.detachScalarFields();

		return ok(undefined);
	}

	/**
	 * Moves the scalar field values out of the points geometry. They are
	 * only ever read on the CPU (colormaps, filters, export, editing); left
	 * as geometry attributes, three.js would also upload every one of them
	 * to the GPU, which for large clouds with many fields costs gigabytes.
	 */
	private detachScalarFields(): void {
		const geometry = this.getPoints().geometry;
		for (const field of this.getScalarFields()) {
			const attribute = geometry.getAttribute(field.attributeKey) as
				| BufferAttribute
				| undefined;
			if (!attribute) continue;
			this.scalarFieldValues.set(
				field.name,
				attribute.array as Float32Array
			);
			geometry.deleteAttribute(field.attributeKey);
		}
	}

	/**
	 * Returns the scalar fields (e.g. intensity, classification) available
	 * on this point cloud, as discovered from the source file.
	 *
	 * @returns the available scalar fields, or an empty array if none exist
	 */
	public getScalarFields(): ScalarFieldInfo[] {
		return (
			(this.getPoints().geometry.userData.scalarFields as
				| ScalarFieldInfo[]
				| undefined) ?? []
		);
	}

	/**
	 * Returns the per-point values of a scalar field. The array is shared,
	 * writing to it changes the field's values.
	 *
	 * @param fieldName the scalar field's name
	 * @returns one value per point
	 */
	public getScalarFieldValues(fieldName: string): Float32Array {
		const values = this.scalarFieldValues.get(fieldName);
		if (!values) {
			throw new Error(`Unknown scalar field '${fieldName}'.`);
		}
		return values;
	}

	/**
	 * Computes the base point colors (i.e. the colors annotation labels are
	 * blended on top of) either from the point cloud's original colors, or
	 * from a scalar field.
	 *
	 * @param fieldName the scalar field to color by, or `null` to use the
	 *                   point cloud's original colors
	 * @param kindOverride overrides the scalar field's detected {@link ScalarFieldKind}
	 * @returns the computed colors, as a flat RGB `Float32Array`
	 */
	public computeBaseColors(
		fieldName: string | null,
		kindOverride?: ScalarFieldKind
	): Float32Array {
		if (!this.pristineColors) {
			throw new Error(MODEL_FIELD_ACCESS_ERROR_MESSAGE);
		}

		if (!fieldName) {
			return this.pristineColors;
		}

		const field = this.getScalarFields().find((f) => f.name === fieldName);
		if (!field) {
			throw new Error(`Unknown scalar field '${fieldName}'.`);
		}

		const values = this.getScalarFieldValues(field.name);
		const kind = kindOverride ?? field.kind;

		return kind === "categorical" && field.uniqueValues
			? computeCategoricalColors(values, field.uniqueValues)
			: computeContinuousColors(values, field.min, field.max);
	}

	/**
	 * Returns the raw per-point data needed to export this point cloud
	 * (e.g. to LAS), including original coordinates (with the viewer's
	 * precision-fix shift reversed), original colors and all scalar fields.
	 */
	public getExportData(): PointCloudExportData {
		const geometry = this.getPoints().geometry;

		const positions = (geometry.getAttribute("position") as BufferAttribute)
			.array as Float32Array;

		const coordinateShift = (geometry.userData.coordinateShift as
			| CoordinateShift
			| undefined) ?? { x: 0, y: 0, z: 0 };

		// The "color" attribute holds the currently displayed colors (blended
		// with annotation labels, or a scalar field colormap), so the colors
		// captured right after loading are used instead.
		const colors =
			geometry.userData.hasOriginalColor === true && this.pristineColors
				? linearToSRGBColors(this.pristineColors)
				: null;

		const scalarFields = this.getScalarFields().map((field) => ({
			name: field.name,
			values: this.getScalarFieldValues(field.name),
		}));

		return { positions, coordinateShift, colors, scalarFields };
	}

	/**
	 * Sets or clears one of the `MAX_ACTIVE_FILTERS` scalar field filter
	 * slots. All enabled slots are combined with AND (a point must pass
	 * every active filter to be visible), which allows filtering by
	 * multiple scalar fields at once (e.g. `tree == 1 AND part == trunk`).
	 * Hidden points are not rendered, without affecting their index or
	 * annotation data.
	 *
	 * @param slot the filter slot, in `[0, MAX_ACTIVE_FILTERS)`
	 * @param filter the filter to apply, or `null` to disable this slot
	 */
	public setFilterSlot(slot: number, filter: ScalarFieldFilter | null): void {
		this.assertValidSlot(slot);
		const uniforms = this.ensureFilterShader()[slot];

		if (!filter) {
			uniforms.enabled.value = false;
			return;
		}

		const field = this.getScalarFields().find(
			(f) => f.name === filter.fieldName
		);
		if (!field) {
			throw new Error(`Unknown scalar field '${filter.fieldName}'.`);
		}

		const sourceValues = this.getScalarFieldValues(field.name);
		const filterAttribute = this.getOrCreateFilterAttribute(slot);
		const filterValues = filterAttribute.array as Float32Array;

		if (filter.mode === "range") {
			filterValues.set(sourceValues);
			uniforms.mode.value = FILTER_MODE_RANGE;
			uniforms.min.value = filter.min;
			uniforms.max.value = filter.max;
		} else {
			const selectedValues = new Set(filter.selectedValues);
			for (let i = 0; i < sourceValues.length; i++) {
				filterValues[i] = selectedValues.has(sourceValues[i]) ? 1 : 0;
			}
			uniforms.mode.value = FILTER_MODE_SET;
		}

		filterAttribute.needsUpdate = true;
		uniforms.enabled.value = true;
	}

	/**
	 * Disables all active scalar field filters, making all points visible
	 * again.
	 */
	public clearAllFilters(): void {
		if (!this.filterSlots) return;
		for (const uniforms of this.filterSlots) {
			uniforms.enabled.value = false;
		}
	}

	/**
	 * Returns a new array containing only the indices from `indices` that
	 * are currently visible (i.e. pass every active scalar field filter).
	 * Used to keep annotation tools from selecting points that are hidden
	 * by a filter.
	 *
	 * @param indices candidate point indices
	 * @returns the subset of `indices` that is currently visible
	 */
	public filterVisibleIndices(indices: ArrayLike<number>): number[] {
		const activeFilters = this.getActiveFilters();
		if (activeFilters.length === 0) {
			return Array.from(indices);
		}

		const visible: number[] = [];
		for (let i = 0; i < indices.length; i++) {
			const pointIndex = indices[i];
			const passesAllFilters = activeFilters.every((filter) => {
				const value = filter.values[pointIndex];
				return filter.mode === FILTER_MODE_RANGE
					? value >= filter.min && value <= filter.max
					: value >= 0.5;
			});
			if (passesAllFilters) {
				visible.push(pointIndex);
			}
		}
		return visible;
	}

	/**
	 * Filter attributes are only allocated once their slot is first used
	 * (one float per point each). Slots without an attribute are always
	 * disabled, so the shader never reads them.
	 */
	private getOrCreateFilterAttribute(slot: number): BufferAttribute {
		const geometry = this.getPoints().geometry;
		const name = `${FILTER_ATTRIBUTE_PREFIX}${slot}`;
		let attribute = geometry.getAttribute(name) as
			| BufferAttribute
			| undefined;
		if (!attribute) {
			const pointCount = geometry.getAttribute("position").count;
			attribute = new BufferAttribute(new Float32Array(pointCount), 1);
			geometry.setAttribute(name, attribute);
		}
		return attribute;
	}

	private getActiveFilters(): {
		values: Float32Array;
		mode: number;
		min: number;
		max: number;
	}[] {
		if (!this.filterSlots) return [];

		const geometry = this.getPoints().geometry;
		const activeFilters = [];
		for (let slot = 0; slot < MAX_ACTIVE_FILTERS; slot++) {
			const uniforms = this.filterSlots[slot];
			if (!uniforms.enabled.value) continue;

			const attribute = geometry.getAttribute(
				`${FILTER_ATTRIBUTE_PREFIX}${slot}`
			) as BufferAttribute;
			activeFilters.push({
				values: attribute.array as Float32Array,
				mode: uniforms.mode.value,
				min: uniforms.min.value,
				max: uniforms.max.value,
			});
		}
		return activeFilters;
	}

	private assertValidSlot(slot: number): void {
		if (slot < 0 || slot >= MAX_ACTIVE_FILTERS || !Number.isInteger(slot)) {
			throw new Error(
				`Filter slot must be an integer in [0, ${MAX_ACTIVE_FILTERS}).`
			);
		}
	}

	/**
	 * Patches the point cloud's material (once) so it discards fragments
	 * that fail any active filter slot. Uses `onBeforeCompile` since
	 * `THREE.PointsMaterial` has no built-in support for per-point
	 * visibility; the injected uniforms can afterwards be updated directly,
	 * without needing to recompile the shader again.
	 */
	private ensureFilterShader(): FilterSlotUniforms[] {
		if (this.filterSlots) {
			return this.filterSlots;
		}

		const slots: FilterSlotUniforms[] = [];
		for (let i = 0; i < MAX_ACTIVE_FILTERS; i++) {
			slots.push({
				enabled: { value: false },
				mode: { value: FILTER_MODE_RANGE },
				min: { value: 0 },
				max: { value: 0 },
			});
		}

		let attributeDeclarations = "";
		let varyingDeclarations = "";
		let varyingAssignments = "";
		let fragmentDeclarations = "";
		let discardChecks = "";

		for (let i = 0; i < MAX_ACTIVE_FILTERS; i++) {
			const attributeName = `${FILTER_ATTRIBUTE_PREFIX}${i}`;
			const varyingName = `vFilterValue${i}`;

			attributeDeclarations += `attribute float ${attributeName};\n`;
			varyingDeclarations += `varying float ${varyingName};\n`;
			varyingAssignments += `\t${varyingName} = ${attributeName};\n`;
			fragmentDeclarations += `varying float ${varyingName};\nuniform bool filterEnabled${i};\nuniform int filterMode${i};\nuniform float filterMin${i};\nuniform float filterMax${i};\n`;
			discardChecks += `
	if ( filterEnabled${i} ) {
		if ( filterMode${i} == ${FILTER_MODE_RANGE} ) {
			if ( ${varyingName} < filterMin${i} || ${varyingName} > filterMax${i} ) discard;
		} else if ( ${varyingName} < 0.5 ) {
			discard;
		}
	}
`;
		}

		const material = this.getPoints().material as PointsMaterial;
		material.onBeforeCompile = (shader) => {
			for (let i = 0; i < MAX_ACTIVE_FILTERS; i++) {
				shader.uniforms[`filterEnabled${i}`] = slots[i].enabled;
				shader.uniforms[`filterMode${i}`] = slots[i].mode;
				shader.uniforms[`filterMin${i}`] = slots[i].min;
				shader.uniforms[`filterMax${i}`] = slots[i].max;
			}

			shader.vertexShader = shader.vertexShader
				.replace(
					"void main() {",
					`${attributeDeclarations}${varyingDeclarations}void main() {`
				)
				.replace(
					"#include <begin_vertex>",
					`#include <begin_vertex>\n${varyingAssignments}`
				);

			shader.fragmentShader = shader.fragmentShader.replace(
				"void main() {",
				`${fragmentDeclarations}void main() {\n${discardChecks}`
			);
		};
		material.needsUpdate = true;

		this.filterSlots = slots;
		return slots;
	}

	/**
	 * Returns index count of vertices in the point cloud
	 *
	 * @returns index count
	 */
	public getIndexCount(): number {
		return this.getModelSize();
	}

	public getModelSize(): number {
		const positionAttr = this.getPoints().geometry.getAttribute("position");
		return positionAttr.count;
	}

	public translateBVHIndices(
		indices: MutableArrayLike<number>,
		inPlace?: true
	): MutableArrayLike<number>;
	public translateBVHIndices(
		indices: ArrayLike<number>,
		inPlace: false
	): Uint32Array;
	public translateBVHIndices(
		indices: ArrayLike<number> | MutableArrayLike<number>,
		inPlace = true
	) {
		const out = inPlace
			? (indices as MutableArrayLike<number>)
			: new Uint32Array(indices.length);

		const index = this.index!;
		for (let i = 0; i < out.length; i++) {
			out[i] = index[indices[i]];
		}
		return out;
	}

	public getObjects(): Object3D[] {
		return [this.getPoints()];
	}

	/**
	 * Updates the point cloud
	 */
	public update(): void {
		// nothing to do
	}

	/**
	 * Disposes:
	 * 	- the mesh geometry
	 *  - the mesh bounds tree
	 *  - the mesh material
	 *  - the mesh texture
	 */
	public destroy(): void {
		this.points?.geometry.dispose();
		disposeMaterials(this.points?.material);

		this.bvhMesh?.geometry.dispose();
		this.bvhMesh?.geometry.disposeBoundsTree();
		disposeMaterials(this.bvhMesh?.material);

		this.settings.unsubscribeAll();
	}
}
