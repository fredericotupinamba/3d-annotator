import { type AnnotationData } from "~entity/Annotation";
import { type PointCloud } from "../scene/model/PointCloud";
import { AnnotationManager } from "./AnnotationManager";
import { type LabelManager } from "./LabelManager";

/**
 * An `AnnotationManager` for point clouds that excludes points currently
 * hidden by a scalar field filter from selection, so annotation tools can
 * only label points that are actually visible.
 */
export class PointCloudAnnotationManager extends AnnotationManager {
	private readonly pointCloud: PointCloud;

	constructor(pointCloud: PointCloud, labelManager: LabelManager) {
		super(pointCloud.getIndexCount(), labelManager);
		this.pointCloud = pointCloud;
	}

	public override annotate(annotationData: AnnotationData): void {
		super.annotate(this.pointCloud.filterVisibleIndices(annotationData));
	}
}
