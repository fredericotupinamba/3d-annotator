import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import {
	MAX_ACTIVE_FILTERS,
	PointCloud,
} from "~annotator/scene/model/PointCloud";
import type { ScalarFieldInfo } from "~entity/ScalarField";

const CACHE_SCOPE = { modelId: "1", projectId: "1", userId: "1" };

/**
 * Constructs a `PointCloud` with a fake, already-loaded geometry, bypassing
 * `initializeModel()` (which needs a real file, worker and OPFS cache).
 */
function createTestPointCloud(
	scalarFields: {
		info: ScalarFieldInfo;
		values: number[];
	}[]
): PointCloud {
	const pointCloud = new PointCloud(CACHE_SCOPE);

	const count = scalarFields[0]?.values.length ?? 4;
	const geometry = new BufferGeometry();
	geometry.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(count * 3), 3)
	);
	geometry.setAttribute(
		"color",
		new BufferAttribute(new Float32Array(count * 3), 3)
	);

	for (const { info, values } of scalarFields) {
		geometry.setAttribute(
			info.attributeKey,
			new BufferAttribute(Float32Array.from(values), 1)
		);
	}
	geometry.userData.scalarFields = scalarFields.map((f) => f.info);

	const points = new Points(geometry, new PointsMaterial());
	(pointCloud as unknown as { points: Points }).points = points;

	// as done by initializeModel() after loading
	(
		pointCloud as unknown as { detachScalarFields(): void }
	).detachScalarFields();
	return pointCloud;
}

function classField(values: number[]): {
	info: ScalarFieldInfo;
	values: number[];
} {
	return {
		info: {
			name: "classification",
			attributeKey: "scalarField_classification",
			kind: "categorical",
			min: Math.min(...values),
			max: Math.max(...values),
			uniqueValues: Array.from(new Set(values)).sort((a, b) => a - b),
		},
		values,
	};
}

function heightField(values: number[]): {
	info: ScalarFieldInfo;
	values: number[];
} {
	return {
		info: {
			name: "height",
			attributeKey: "scalarField_height",
			kind: "continuous",
			min: Math.min(...values),
			max: Math.max(...values),
		},
		values,
	};
}

describe("PointCloud scalar field filtering", () => {
	test("filterVisibleIndices() returns everything when no filter is active", () => {
		const pointCloud = createTestPointCloud([classField([1, 2, 3, 1])]);
		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([
			0, 1, 2, 3,
		]);
	});

	test("set-mode filter keeps only points matching selected values", () => {
		const pointCloud = createTestPointCloud([classField([1, 2, 3, 1])]);

		pointCloud.setFilterSlot(0, {
			fieldName: "classification",
			mode: "set",
			selectedValues: [1],
		});

		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([0, 3]);
	});

	test("range-mode filter keeps only points within [min, max]", () => {
		const pointCloud = createTestPointCloud([heightField([0, 5, 10, 15])]);

		pointCloud.setFilterSlot(0, {
			fieldName: "height",
			mode: "range",
			min: 4,
			max: 11,
		});

		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([1, 2]);
	});

	test("multiple active filters are combined with AND", () => {
		const pointCloud = createTestPointCloud([
			classField([1, 1, 2, 2]),
			heightField([0, 10, 0, 10]),
		]);

		pointCloud.setFilterSlot(0, {
			fieldName: "classification",
			mode: "set",
			selectedValues: [1],
		});
		pointCloud.setFilterSlot(1, {
			fieldName: "height",
			mode: "range",
			min: 5,
			max: 15,
		});

		// only index 1 has classification == 1 AND height in [5, 15]
		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([1]);
	});

	test("clearing a filter slot restores those points", () => {
		const pointCloud = createTestPointCloud([classField([1, 2, 1, 2])]);

		pointCloud.setFilterSlot(0, {
			fieldName: "classification",
			mode: "set",
			selectedValues: [1],
		});
		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([0, 2]);

		pointCloud.setFilterSlot(0, null);
		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([
			0, 1, 2, 3,
		]);
	});

	test("clearAllFilters() disables every active slot", () => {
		const pointCloud = createTestPointCloud([
			classField([1, 1, 2, 2]),
			heightField([0, 10, 0, 10]),
		]);

		pointCloud.setFilterSlot(0, {
			fieldName: "classification",
			mode: "set",
			selectedValues: [1],
		});
		pointCloud.setFilterSlot(1, {
			fieldName: "height",
			mode: "range",
			min: 5,
			max: 15,
		});

		pointCloud.clearAllFilters();

		expect(pointCloud.filterVisibleIndices([0, 1, 2, 3])).toEqual([
			0, 1, 2, 3,
		]);
	});

	test("setFilterSlot() rejects an out-of-range slot", () => {
		const pointCloud = createTestPointCloud([classField([1, 2])]);
		expect(() => {
			pointCloud.setFilterSlot(MAX_ACTIVE_FILTERS, {
				fieldName: "classification",
				mode: "set",
				selectedValues: [1],
			});
		}).toThrow();
	});
});

describe("PointCloud scalar field storage", () => {
	test("keeps scalar fields out of the geometry, so they are not uploaded to the GPU", () => {
		const pointCloud = createTestPointCloud([classField([1, 2, 3, 1])]);
		const geometry = pointCloud.getPoints().geometry;

		expect(
			geometry.getAttribute("scalarField_classification")
		).toBeUndefined();
		expect(
			Array.from(pointCloud.getScalarFieldValues("classification"))
		).toEqual([1, 2, 3, 1]);
	});

	test("only allocates filter attributes for slots that are used", () => {
		const pointCloud = createTestPointCloud([classField([1, 2, 3, 1])]);
		pointCloud.setFilterSlot(1, {
			fieldName: "classification",
			mode: "set",
			selectedValues: [1],
		});
		const geometry = pointCloud.getPoints().geometry;

		expect(geometry.getAttribute("filterValue0")).toBeUndefined();
		expect(geometry.getAttribute("filterValue1")).toBeDefined();
	});
});
