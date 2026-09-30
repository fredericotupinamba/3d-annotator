import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import { PointCloud } from "~annotator/scene/model/PointCloud";
import type { Scene } from "~annotator/scene/Scene";
import { NEUTRAL_LABEL } from "~entity/Annotation";
import type { ScalarFieldInfo } from "~entity/ScalarField";
import { ScalarFieldEditSession } from "../ScalarFieldEditSession";

const CACHE_SCOPE = { modelId: "1", projectId: "1", userId: "1" };
const FIELD: ScalarFieldInfo = {
	name: "isStem",
	attributeKey: "scalarField_isStem",
	kind: "categorical",
	min: 0,
	max: 1,
	uniqueValues: [0, 1],
};

function createTestPointCloud(values: number[]): PointCloud {
	const pointCloud = new PointCloud(CACHE_SCOPE);
	const count = values.length;

	const geometry = new BufferGeometry();
	geometry.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(count * 3), 3)
	);
	geometry.setAttribute(
		"color",
		new BufferAttribute(new Float32Array(count * 3), 3)
	);
	geometry.setAttribute(
		FIELD.attributeKey,
		new BufferAttribute(Float32Array.from(values), 1)
	);
	geometry.userData.scalarFields = [FIELD];

	const points = new Points(geometry, new PointsMaterial());
	(
		pointCloud as unknown as {
			points: Points;
			pristineColors: Float32Array;
		}
	).points = points;
	(
		pointCloud as unknown as {
			points: Points;
			pristineColors: Float32Array;
		}
	).pristineColors = new Float32Array(count * 3);

	// as done by initializeModel() after loading
	(
		pointCloud as unknown as { detachScalarFields(): void }
	).detachScalarFields();
	return pointCloud;
}

function createFakeScene(pointCloud: PointCloud): Scene<PointCloud> {
	return { getModel: () => pointCloud } as unknown as Scene<PointCloud>;
}

describe("ScalarFieldEditSession", () => {
	test("seeds labels and annotations from the field's existing values", () => {
		const pointCloud = createTestPointCloud([0, 1, 0, 1]);
		const session = new ScalarFieldEditSession(
			createFakeScene(pointCloud),
			FIELD
		);

		const labels = session.getValueLabels();
		expect(labels.map((l) => l.name)).toEqual(["0", "1"]);

		const lut = session.annotationManager.getAnnotationDataLUT();
		// point 0 and 2 have value 0, point 1 and 3 have value 1 -> different classes
		expect(lut[0]).toBe(lut[2]);
		expect(lut[1]).toBe(lut[3]);
		expect(lut[0]).not.toBe(lut[1]);
		expect(lut[0]).not.toBe(NEUTRAL_LABEL.annotationClass);

		session.destroy();
	});

	test("painting a value writes it directly back into the live field values", () => {
		const pointCloud = createTestPointCloud([0, 1, 0, 1]);
		const session = new ScalarFieldEditSession(
			createFakeScene(pointCloud),
			FIELD
		);

		const labelForOne = session
			.getValueLabels()
			.find((l) => l.name === "1")!;
		session.labelManager.selectLabel(labelForOne);
		session.annotationManager.annotate([0]); // repaint point 0 (was 0) as 1

		const fieldValues = pointCloud.getScalarFieldValues(FIELD.name);

		expect(fieldValues[0]).toBe(1);
		expect(fieldValues[1]).toBe(1);
		expect(fieldValues[2]).toBe(0);
		expect(fieldValues[3]).toBe(1);

		session.destroy();
	});

	test("addValue() introduces a brand new value that can then be painted", () => {
		const pointCloud = createTestPointCloud([0, 1, 0, 1]);
		const session = new ScalarFieldEditSession(
			createFakeScene(pointCloud),
			FIELD
		);

		const newLabel = session.addValue(3, "New class");
		expect(session.getValueLabels().map((l) => l.name)).toEqual([
			"0",
			"1",
			"New class",
		]);

		session.labelManager.selectLabel(newLabel);
		session.annotationManager.annotate([2]);

		const fieldValues = pointCloud.getScalarFieldValues(FIELD.name);
		expect(fieldValues[2]).toBe(3);

		session.destroy();
	});

	test("addValue() rejects a value that already exists", () => {
		const pointCloud = createTestPointCloud([0, 1]);
		const session = new ScalarFieldEditSession(
			createFakeScene(pointCloud),
			FIELD
		);

		expect(() => session.addValue(0)).toThrow();
		expect(() => session.addValue(1.5)).toThrow();

		session.destroy();
	});

	test("undo restores the field's previous value", () => {
		const pointCloud = createTestPointCloud([0, 1, 0, 1]);
		const session = new ScalarFieldEditSession(
			createFakeScene(pointCloud),
			FIELD
		);

		const labelForOne = session
			.getValueLabels()
			.find((l) => l.name === "1")!;
		session.labelManager.selectLabel(labelForOne);

		session.undoManager.startGroup();
		session.annotationManager.annotate([0]);
		session.undoManager.endGroup();

		const fieldValues = pointCloud.getScalarFieldValues(FIELD.name);
		expect(fieldValues[0]).toBe(1);

		session.undoManager.undo();
		expect(fieldValues[0]).toBe(0);

		session.destroy();
	});
});
