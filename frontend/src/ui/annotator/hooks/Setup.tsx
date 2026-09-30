import { getI18NContext } from "i18n/vanilla-context";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
	AnnotatorSetupAbortController,
	SetupWarning,
	type Annotator,
} from "~annotator/Annotator";
import { MeshAnnotator } from "~annotator/MeshAnnotator";
import { PointCloudAnnotator } from "~annotator/PointCloudAnnotator";
import type { Model } from "~annotator/scene/model/Model";
import { TextureAnnotator } from "~annotator/TextureAnnotator";
import { Errors } from "~api/Errors";
import { createMainThreadCacheRuntime } from "~cache/index";
import { ModelType, type ModelInformation } from "~entity/ModelInformation";
import { useAPI } from "~ui/contexts/APIContext";
import { useAuth } from "~ui/contexts/AuthContext";
import { getOpfsOverview } from "~util/fileSystem/OriginPrivateFileSystem";
import { assertUnreachable } from "~util/TypeScript";
import { useAnnotatorContext } from "../contexts/AnnotatorContext";

export interface LoadingState {
	loading: boolean;
	progress?: number;
	message: string;
}

export interface LoadingError {
	error: boolean;
	message: string;
}

const LL = getI18NContext();

export function useSetup(sceneParentRef: React.RefObject<HTMLDivElement>) {
	const navigate = useNavigate();
	const params = useParams();

	const api = useAPI();
	const user = useAuth();
	const { setAnnotator, setModelInformation } = useAnnotatorContext();

	const [loadingState, setLoadingState] = useState<LoadingState>({
		loading: true,
		progress: 0,
		message: "",
	});
	const [error, setError] = useState<LoadingError>({
		error: false,
		message: "",
	});

	function updateLoadingState(
		message: string,
		progress?: number,
		loading = true,
		error = false
	) {
		const logMessage = error ? `ERROR ${message}` : message;
		console.log(
			"Loading state (%s): %s",
			loading ? "loading" : "finished",
			logMessage
		);

		setError({ error, message });

		setLoadingState({ loading, progress, message });
	}

	useEffect(() => {
		// After a page reload the user is restored asynchronously. Starting
		// without it breaks the lock check (e.g. for a model locked by this
		// user); this effect runs again once the user is available.
		if (!user) {
			return;
		}
		const currentUser = user;

		const apiAbortController = new AbortController();
		const setupAbortController = new AnnotatorSetupAbortController();

		let ownsLock = false;
		let annotator: Annotator<Model>;
		let modelInformation: ModelInformation;

		async function start() {
			updateLoadingState(LL.FETCHING_MODEL_INFORMATION());
			/**
			 *  Fetch model detail
			 */
			if (!params.annotatorId) {
				throw new Error("No model id.");
			}

			try {
				const modelRes = await api.models.detail(
					+params.annotatorId,
					apiAbortController
				);
				if (modelRes.isErr()) {
					const error = modelRes.error;
					switch (error.code) {
						case Errors.ABORTED:
							console.log("api.model.detail was aborted");
							return;
						case Errors.NETWORK:
							toast.error(LL.NETWORK_ERROR());
							return;
						default:
							assertUnreachable(error.code);
					}
				}
				modelInformation = modelRes.value;
				setModelInformation(modelInformation);
			} catch {
				navigate("/404");
				return;
			}

			/**
			 *  Check lock state of model
			 */
			const locked = modelInformation.locked;
			ownsLock = locked ? locked.id === currentUser.id : false;

			if (locked && !ownsLock) {
				// go back to project page
				navigate(`/project/${modelInformation.projectId}`);
				toast.warning(LL.LOCKED_BY() + " " + locked.username);
				return;
			}

			updateLoadingState(LL.LOCKING_MODEL());
			/**
			 *  Lock model
			 */

			// only lock the model if the user does not already own the lock
			if (!ownsLock) {
				const lockRes = await api.models.lock(
					modelInformation.id,
					true
				);

				if (lockRes.isErr()) {
					switch (lockRes.error.code) {
						case Errors.LOCKED:
							// this handles the race condition of obtaining the lock,
							// i.e. someone else locked the model after the model
							// information was fetched

							// go back to project page
							navigate(`/project/${modelInformation.projectId}`);
							toast.warning(LL.MODEL_LOCKED());
							return;
						case Errors.NETWORK:
							toast.error(LL.NETWORK_ERROR());
							return;
						default:
							assertUnreachable(lockRes.error.code);
					}
				}

				ownsLock = true;
			}

			/**
			 *  Fetch labels
			 */
			const labelRes = await api.labels.list(
				modelInformation.projectId,
				apiAbortController
			);
			if (labelRes.isErr()) {
				switch (labelRes.error.code) {
					case Errors.ABORTED:
						console.log("api.labels.list was aborted");
						return;
					case Errors.NETWORK:
						toast.error(LL.NETWORK_ERROR());
						return;
					default:
						assertUnreachable(labelRes.error.code);
				}
			}
			const labels = labelRes.value;
			if (labels.length === 0) {
				updateLoadingState(LL.NO_LABELS(), undefined, false, true);
				navigate(`/project/${modelInformation.projectId}`);
				toast.warning(LL.NO_LABELS());
				return;
			}

			/**
			 * Initialize annotator
			 */

			if (!sceneParentRef.current) {
				throw new Error("Canvas ref is null!");
			}

			const runtime = await createMainThreadCacheRuntime();

			switch (modelInformation.modelType) {
				case ModelType.MESH:
					annotator = new MeshAnnotator(
						runtime,
						currentUser,
						sceneParentRef.current,
						modelInformation,
						labels
					);
					break;
				case ModelType.TEXTURE_MESH:
					annotator = new TextureAnnotator(
						runtime,
						currentUser,
						sceneParentRef.current,
						modelInformation,
						labels
					);
					break;
				case ModelType.POINT_CLOUD:
					annotator = new PointCloudAnnotator(
						runtime,
						currentUser,
						sceneParentRef.current,
						modelInformation,
						labels
					);
					break;
				default:
					assertUnreachable(modelInformation.modelType);
			}

			/**
			 * Download modelFile
			 */

			if (!(await annotator.modelFileManager.hasModelFiles())) {
				// no model file

				updateLoadingState(LL.DOWNLOADING_MODEL());
				const res = await api.files.downloadModel(
					modelInformation.id,
					(n) => {
						console.log(`downloading model... ${n.toFixed(0)}%`);
						updateLoadingState(LL.DOWNLOADING_MODEL(), n);
					},
					apiAbortController
				);

				if (res.isErr()) {
					switch (res.error.code) {
						case Errors.ABORTED:
							console.log("api.files.downloadModel was aborted");
							return;
						case Errors.NETWORK:
							toast.error(LL.NETWORK_ERROR());
							return;
						default:
							assertUnreachable(res.error.code);
					}
				}
				updateLoadingState(LL.WRITING_MODEL_TO_STORAGE());
				await annotator.modelFileManager.writeModelFiles(res.value);
			}
			/**
			 *  Download annotationFile
			 */
			if (modelInformation.annotationFile) {
				updateLoadingState(LL.DOWNLOADING_ANNOTATION());

				const res = await api.files.downloadAnnotationFile(
					modelInformation.id,
					(n) => {
						console.log(
							`downloading annotation file... ${n.toFixed(0)}%`
						);
						updateLoadingState(LL.DOWNLOADING_ANNOTATION(), n);
					},
					apiAbortController
				);

				if (res.isErr()) {
					switch (res.error.code) {
						case Errors.ABORTED:
							console.log(
								"api.files.downloadAnnotationFile was aborted"
							);
							return;
						case Errors.NETWORK:
							toast.error(LL.NETWORK_ERROR());
							return;
						case Errors.NO_ANNOTATION_FILE:
							throw new Error(
								"File unexpectedly has no annotation file."
							);
						default:
							assertUnreachable(res.error.code);
					}
				}
				updateLoadingState(LL.WRITING_ANNOTATION_TO_STORAGE());
				await annotator.annotationFileManager.writeAnnotationFile(
					res.value.data
				);
			}

			// log state of origin private file system
			const tree = await getOpfsOverview();
			console.groupCollapsed("File system tree:");
			console.log(tree);
			console.groupEnd();

			/**
			 *  Annotator setup
			 */
			updateLoadingState(LL.SETTING_UP_ANNOTATOR());
			const result = await annotator.setup(
				setupAbortController,
				(progress) => {
					const message = progress.data?.progress
						? `${progress.stage} ${progress.data.progress.toFixed(
								0
						  )}%`
						: `${progress.stage} `;
					updateLoadingState(
						LL.SETTING_UP_ANNOTATOR() + " " + message,
						progress.data?.progress
					);

					const warning = progress.data?.warning;
					if (
						warning === SetupWarning.LARGE_OBJ_FILE ||
						warning === SetupWarning.LARGE_PLY_FILE
					) {
						toast.warning(LL.BIG_FILES_WARNING());
					}
				}
			);
			if (setupAbortController.aborted) {
				updateLoadingState(LL.SETTING_UP_ANNOTATOR_ABORTED());
				return;
			}

			if (result.isErr()) {
				const error = result.error;
				console.error(`Setup error:`, error);

				let errorMessage: string;

				switch (error.code) {
					case "UNKNOWN_LABEL":
						errorMessage = LL.PARSER_UNKNOWN_LABEL({
							annotationClass: error.payload.annotationClass,
						});
						break;

					case "DUPLICATE_LABEL":
						errorMessage = LL.PARSER_DUPLICATE_LABEL({
							annotationClass: error.payload.annotationClass,
						});
						break;

					case "INCONSISTENT_LABELS":
						errorMessage = LL.PARSER_INCONSISTENT_LABELS({
							annotationClass: error.payload.annotationClass,
						});
						break;

					case "INVALID_NEUTRAL_LABEL":
						errorMessage = LL.PARSER_INVALID_NEUTRAL_LABEL({
							annotationClass: error.payload.annotationClass,
						});
						break;

					case "UNKNOWN_MODEL_TYPE":
						errorMessage = LL.PARSER_UNKNOWN_MODEL_TYPE({
							modelType: error.payload.modelType,
						});
						break;

					case "UNKNOWN_FILE_TYPE":
						errorMessage = LL.PARSER_UNKNOWN_FILE_TYPE();
						break;

					case "UNSUPPORTED":
						errorMessage = LL.PARSER_UNSUPPORTED_FILE_FORMAT({
							format: error.payload.format,
							version: error.payload.version,
							expectedVersion: error.payload.expectedVersion,
						});
						break;

					case "PARSING_ERROR":
						errorMessage = LL.PARSER_GENERIC_ERROR();
						break;

					case "LENGTH_MISMATCH":
						errorMessage = LL.PARSER_ANNOTATION_LENGTH_MISMATCH();
						break;

					case "UNSUPPORTED_FILE_SIZE":
						errorMessage = LL.MODEL_FILE_TOO_BIG();
						break;

					default:
						assertUnreachable(error);
				}

				updateLoadingState(errorMessage, undefined, false, true);
				toast.error(errorMessage, { autoClose: false });

				navigate(`/project/${modelInformation.projectId}`);

				return;
			}

			updateLoadingState(LL.FINISHED_SETUP(), undefined, false);
			annotator.start();
			setAnnotator(annotator);
		}

		// without this, a failure (e.g. running out of memory while building
		// the BVH) leaves the loading screen spinning forever
		start().catch((error: unknown) => {
			if (setupAbortController.aborted) return;
			console.error("Annotator setup failed:", error);
			updateLoadingState(
				`${LL.SETUP_FAILED()} ${
					error instanceof Error ? error.message : String(error)
				}`,
				undefined,
				false,
				true
			);
		});

		return () => {
			apiAbortController.abort();
			setupAbortController.abort();

			if (annotator) {
				annotator.destroy();
			}

			if (modelInformation) {
				api.models.lock(modelInformation.id, false);
			}
		};
	}, [api, navigate, params, user]);

	return {
		loadingState,
		error,
	};
}
