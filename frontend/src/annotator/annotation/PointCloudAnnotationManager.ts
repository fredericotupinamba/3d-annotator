import { type AnnotationData } from "~entity/Annotation";
import { type PointCloud } from "../scene/model/PointCloud";
import { AnnotationManager } from "./AnnotationManager";
import { type LabelManager } from "./LabelManager";
import { type ScalarFieldEditSession } from "./ScalarFieldEditSession";

/**
 * An `AnnotationManager` for point clouds that:
 * - excludes points currently hidden by a scalar field filter from
 *   selection, so annotation tools can only label points that are actually
 *   visible.
 * - while a {@link ScalarFieldEditSession} is active, redirects every
 *   `annotate()` call to that session instead of the normal Classification
 *   labels, so the exact same tools can paint an arbitrary scalar field.
 */
export class PointCloudAnnotationManager extends AnnotationManager {
	private readonly pointCloud: PointCloud;
	private editSession: ScalarFieldEditSession | null = null;

	constructor(pointCloud: PointCloud, labelManager: LabelManager) {
		super(pointCloud.getIndexCount(), labelManager);
		this.pointCloud = pointCloud;
	}

	/**
	 * Switches whether `annotate()` calls target the normal Classification
	 * labels (when `session` is `null`) or the given scalar field edit
	 * session instead.
	 */
	public setEditSession(session: ScalarFieldEditSession | null): void {
		this.editSession = session;
	}

	public override annotate(annotationData: AnnotationData): void {
		const visible = this.pointCloud.filterVisibleIndices(annotationData);

		if (this.editSession) {
			this.editSession.annotationManager.annotate(visible);
		} else {
			super.annotate(visible);
		}
	}
}
