import { LabelManager } from "~annotator/annotation/LabelManager";
import { PointCloudAnnotationManager } from "~annotator/annotation/PointCloudAnnotationManager";
import type { PointCloud } from "~annotator/scene/model/PointCloud";
import { NEUTRAL_LABEL, type Label } from "~entity/Annotation";
import { createLabel } from "~entity/__test__/Annotation.test";

function createFakePointCloud(
	indexCount: number,
	filterVisibleIndices: (indices: ArrayLike<number>) => number[]
): PointCloud {
	return {
		getIndexCount: () => indexCount,
		filterVisibleIndices,
	} as unknown as PointCloud;
}

describe("PointCloudAnnotationManager", () => {
	let label1: Label;
	let labelManager: LabelManager;

	beforeEach(() => {
		label1 = createLabel(0, 0);
		labelManager = new LabelManager([label1]);
	});

	test("annotate() only applies to points the point cloud reports as visible", () => {
		// simulates a filter that hides every odd index
		const pointCloud = createFakePointCloud(5, (indices) =>
			Array.from(indices).filter((index) => index % 2 === 0)
		);
		const manager = new PointCloudAnnotationManager(
			pointCloud,
			labelManager
		);

		manager.annotate([0, 1, 2, 3, 4]);

		const annotations = manager.getAnnotationDataLUT();
		expect(annotations[0]).toBe(label1.annotationClass);
		expect(annotations[1]).toBe(NEUTRAL_LABEL.annotationClass);
		expect(annotations[2]).toBe(label1.annotationClass);
		expect(annotations[3]).toBe(NEUTRAL_LABEL.annotationClass);
		expect(annotations[4]).toBe(label1.annotationClass);
	});

	test("annotate() applies to nothing when the point cloud reports no visible points", () => {
		const pointCloud = createFakePointCloud(3, () => []);
		const manager = new PointCloudAnnotationManager(
			pointCloud,
			labelManager
		);

		manager.annotate([0, 1, 2]);

		const annotations = manager.getAnnotationDataLUT();
		for (const annotationClass of annotations) {
			expect(annotationClass).toBe(NEUTRAL_LABEL.annotationClass);
		}
	});

	test("annotate() applies to everything when no filter is active", () => {
		const pointCloud = createFakePointCloud(3, (indices) =>
			Array.from(indices)
		);
		const manager = new PointCloudAnnotationManager(
			pointCloud,
			labelManager
		);

		manager.annotate([0, 1, 2]);

		const annotations = manager.getAnnotationDataLUT();
		for (const annotationClass of annotations) {
			expect(annotationClass).toBe(label1.annotationClass);
		}
	});
});
