import { getI18NContext } from "i18n/vanilla-context";
import { useState } from "react";
import { toast } from "react-toastify";
import { LAS_FILE_EXTENSIONS } from "~annotator/scene/model/loader/las/NonBlockingLASLoader";
import { Errors } from "~api/Errors";
import { ModelType } from "~entity/ModelInformation";
import { ElementList } from "~ui/components/ElementList";
import { useAPI } from "~ui/contexts/APIContext";
import { ModelDataPreviewItem } from "~ui/pages/project/addModel/ModelDataPreviewItem";
import {
	fileExtension,
	fileName,
	hasFileExtension,
} from "~util/fileSystem/FileUtils";
import { assertUnreachable } from "~util/TypeScript";
import { useProjectPageStore } from "../ProjectPage";

interface AddModelDataModalProps {
	projectId: number;
}
export interface ModelDataPreview {
	key: number;
	name: string;
	modelFile: File;
	textureFile?: File;
	annotationFile?: File;
}

const LL = getI18NContext();

export function AddModelDataModalController({
	projectId,
}: AddModelDataModalProps) {
	const api = useAPI();

	const setLoading = useProjectPageStore((state) => state.setLoading);

	const [modalOpen, setModalOpen] = useState(false);
	const [modelType, setModelType] = useState<ModelType>();
	const [modelDataPreviews, setModelDataPreviews] = useState<
		ModelDataPreview[]
	>([]);
	const [error, setError] = useState({ error: false, message: "" });

	async function addModelData(
		name: string,
		modelType: ModelType,
		modelFile: File,
		textureFile: File | undefined,
		annotationFile: File | undefined,
		nr: number,
		total: number
	) {
		const res = await api.models.add({
			name,
			modelType,
			projectId,
		});

		if (res.isErr()) {
			return Promise.reject(res.error);
		}

		const modelInformation = res.value;
		const fileStreams = [
			{
				data: modelFile.stream(),
				name: modelFile.name,
				size: modelFile.size,
			},
		];
		if (textureFile) {
			fileStreams.push({
				data: textureFile.stream(),
				name: textureFile.name,
				size: textureFile.size,
			});
		}

		const toastProgressText = nr && total ? `[${nr}/${total}] ` : "";

		const id = toast.info(toastProgressText + LL.COMPRESSING(), {
			isLoading: true,
		});

		const filesRes = await api.files.uploadModel(
			modelInformation.id,
			fileStreams,
			{
				onCompressionProgress: (n) => {
					if (n != 100) {
						toast.update(id, {
							progress: n / 100,
							isLoading: false,
							render: toastProgressText + LL.COMPRESSING(),
						});
					}
				},
				onUploadProgress: (n) => {
					toast.update(id, {
						progress: n / 100,
						isLoading: false,
						render: toastProgressText + LL.UPLOADING(),
					});
				},
			}
		);

		if (filesRes.isErr()) {
			const error = filesRes.error;

			const errorInfoText = ` (${modelFile.name})`;
			switch (error.code) {
				case Errors.NETWORK:
					toast.update(id, {
						progress: 0,
						hideProgressBar: true,
						isLoading: false,
						autoClose: 5000,
						type: "error",
						render:
							toastProgressText +
							LL.NETWORK_ERROR() +
							errorInfoText,
					});
					console.log("network error" + errorInfoText);
					break;
				case Errors.LARGE_FILE:
					toast.update(id, {
						progress: 0,
						hideProgressBar: true,
						isLoading: false,
						autoClose: 5000,
						type: "error",
						render:
							toastProgressText +
							LL.ANNOTATION_FILE_TOO_BIG() +
							errorInfoText,
					});
					console.log("large file" + errorInfoText);
					break;
				case Errors.EXISTING_BASE_FILE:
					toast.update(id, {
						progress: 0,
						hideProgressBar: true,
						isLoading: false,
						autoClose: 5000,
						type: "error",
						render:
							toastProgressText +
							LL.BASE_FILE_ALREADY_EXISTS() +
							errorInfoText,
					});
					console.log("existing base file" + errorInfoText);
					break;

				default:
					assertUnreachable(error.code);
			}

			return Promise.reject(filesRes.error);
		}

		if (annotationFile) {
			const fileRes = await api.files.uploadAnnotationFile(
				modelInformation.id,
				{
					data: annotationFile.stream(),
					size: annotationFile.size,
				},
				{
					onCompressionProgress: (n) => {
						if (n != 100) {
							toast.update(id, {
								progress: n / 100,
								isLoading: false,
								render:
									toastProgressText +
									LL.COMPRESSING_ANNOTATION_FILE(),
							});
						}
					},
					onUploadProgress: (n) => {
						toast.update(id, {
							progress: n / 100,
							isLoading: false,
							render:
								toastProgressText +
								LL.UPLOADING_ANNOTATION_FILE(),
						});
					},
				}
			);

			if (fileRes.isErr()) {
				const error = fileRes.error;
				const errorInfoText = ` (${annotationFile.name})`;

				switch (error.code) {
					case Errors.NETWORK:
						toast.update(id, {
							progress: 0,
							hideProgressBar: true,
							isLoading: false,
							autoClose: 5000,
							type: "error",
							render:
								toastProgressText +
								LL.NETWORK_ERROR() +
								errorInfoText,
						});
						console.log("network error" + errorInfoText);
						break;
					case Errors.LARGE_FILE:
						toast.update(id, {
							progress: 0,
							hideProgressBar: true,
							isLoading: false,
							autoClose: 5000,
							type: "error",
							render:
								toastProgressText +
								LL.ANNOTATION_FILE_TOO_BIG() +
								errorInfoText,
						});
						console.log("large file");
						break;
					case Errors.LOCKED:
						toast.update(id, {
							progress: 0,
							hideProgressBar: true,
							isLoading: false,
							autoClose: 5000,
							type: "error",
							render:
								toastProgressText +
								LL.MODEL_LOCKED() +
								errorInfoText,
						});
						console.log("model locked");
						break;
					default:
						assertUnreachable(error.code);
				}

				return Promise.reject(fileRes.error);
			}
		}

		toast.update(id, {
			progress: 0,
			hideProgressBar: true,
			isLoading: false,
			autoClose: 3000,
			type: "success",
			render: toastProgressText + LL.UPLOAD_SUCCESS(),
		});

		setLoading(true);
		return modelInformation;
	}

	const filePickerOpts = {
		types: [
			{
				description: "3D-Modell",
				accept: {
					"*/*": [
						".obj" as const,
						".OBJ" as const,
						".ply" as const,
						".PLY" as const,
						".las" as const,
						".LAS" as const,
						".laz" as const,
						".LAZ" as const,
						".jpeg" as const,
						".JPEG" as const,
						".jpg" as const,
						".JPG" as const,
						".txt" as const,
						".TXT" as const,
						".anno3d" as const,
						".ANNO3D" as const,
						".png" as const,
						".PNG" as const,
					],
				},
			},
		],
		excludeAcceptAllOption: true,
		multiple: true,
	};

	async function onFilesSelect() {
		try {
			const filesHandle = await window.showOpenFilePicker(filePickerOpts);

			const files: File[] = [];

			for await (const [, value] of filesHandle.entries()) {
				files.push(await value.getFile());
			}

			setSelectedFiles(files);
		} catch {
			//Throws Exception when file picker is closed
		}
	}

	async function onFolderSelect() {
		try {
			const folderHandle = await window.showDirectoryPicker();
			const files: File[] = [];
			setModelDataPreviews([]);

			for await (const [, value] of folderHandle.entries()) {
				if (value.kind === "file") files.push(await value.getFile());
			}
			setSelectedFiles(files);
		} catch {
			//Throws Exception when file picker is closed
		}
	}

	function setSelectedFiles(files: File[]) {
		const tempModelDataPreviews: ModelDataPreview[] = [];
		const modelFiles: File[] = [];
		const textureFiles: File[] = [];
		const annotationFiles: File[] = [];

		const modelFileRegEx = new RegExp(
			"(obj)|(OBJ)|(ply)|(PLY)|(las)|(LAS)|(laz)|(LAZ)"
		);
		const textureFileRegEx = new RegExp("(jpeg)|(JPEG)|(jpg)|(JPG)");
		const annotationFileRegEx = new RegExp(
			"(txt)|(TXT)|(anno3d)|(ANNO3D)|(png)|(PNG)"
		);

		for (const file of files) {
			const extension = fileExtension(file);

			if (extension === "") continue;
			else if (modelFileRegEx.test(extension)) {
				//modelFile
				modelFiles.push(file);
			} else if (textureFileRegEx.test(extension)) {
				//textureFile
				textureFiles.push(file);
			} else if (annotationFileRegEx.test(extension)) {
				//annotationFile
				annotationFiles.push(file);
			}
		}

		for (const [index, modelFile] of modelFiles.entries()) {
			const modelFileName = fileName(modelFile.name);
			const textureFile = textureFiles.find((file) =>
				fileName(file.name).includes(modelFileName)
			);

			const annotationFile = annotationFiles.find((file) =>
				fileName(file.name).includes(modelFileName)
			);

			tempModelDataPreviews.push({
				key: index,
				name: modelFileName,
				modelFile: modelFile,
				textureFile: textureFile,
				annotationFile: annotationFile,
			});
		}

		setModelDataPreviews(tempModelDataPreviews);
	}

	function changeName(id: number, name: string) {
		const tempModelDataPreviews = [...modelDataPreviews];
		if (tempModelDataPreviews && id < tempModelDataPreviews.length) {
			tempModelDataPreviews[id] = {
				...tempModelDataPreviews[id],
				name: name,
			};

			setModelDataPreviews(tempModelDataPreviews);
		}
	}

	function changeModelFile(id: number, file: File) {
		const tempModelDataPreviews = [...modelDataPreviews];
		if (tempModelDataPreviews && id < tempModelDataPreviews.length) {
			tempModelDataPreviews[id] = {
				...tempModelDataPreviews[id],
				modelFile: file,
			};

			setModelDataPreviews(tempModelDataPreviews);
		}
	}

	function changeTextureFile(id: number, file: File | undefined) {
		const tempModelDataPreviews = [...modelDataPreviews];
		if (tempModelDataPreviews && id < tempModelDataPreviews.length) {
			tempModelDataPreviews[id] = {
				...tempModelDataPreviews[id],
				textureFile: file,
			};

			setModelDataPreviews(tempModelDataPreviews);
		}
	}

	function changeAnnotationFile(id: number, file: File | undefined) {
		const tempModelDataPreviews = [...modelDataPreviews];
		if (tempModelDataPreviews && id < tempModelDataPreviews.length) {
			tempModelDataPreviews[id] = {
				...tempModelDataPreviews[id],
				annotationFile: file,
			};

			setModelDataPreviews(tempModelDataPreviews);
		}
	}

	function removeModelDataPreview(id: number) {
		const tempModelDataPreviews = [...modelDataPreviews];
		tempModelDataPreviews.splice(id, 1);
		setModelDataPreviews(tempModelDataPreviews);
	}

	function getModelDataPreviewItems(): JSX.Element[] {
		const previewItems: JSX.Element[] = [];
		if (!modelDataPreviews) {
			return [];
		}

		for (const preview of modelDataPreviews) {
			previewItems.push(
				<ModelDataPreviewItem
					key={preview.key}
					name={preview.name}
					id={previewItems.length}
					modelFile={preview.modelFile}
					textureFile={
						preview.textureFile ? preview.textureFile : undefined
					}
					annotationFile={
						preview.annotationFile
							? preview.annotationFile
							: undefined
					}
					changeName={changeName}
					changeModelFile={changeModelFile}
					changeTextureFile={changeTextureFile}
					changeAnnotationFile={changeAnnotationFile}
					removePreviewItem={removeModelDataPreview}
					modelType={modelType}
				/>
			);
		}
		return previewItems;
	}

	async function upload() {
		setError({ error: false, message: "" });
		if (modelDataPreviews.length === 0) {
			setError({ error: true, message: LL.NO_MODEL_DATA_PREVIEWS_MSG() });
			return;
		}

		if (!modelType) {
			setError({ error: true, message: LL.NO_MODEL_TYPE_MSG() });
			return;
		}

		for (const preview of modelDataPreviews) {
			if (!preview.name) {
				setError({
					error: true,
					message: LL.UNNAMED_MODEL_DATA_PREVIEW_MSG(),
				});
				return;
			}

			if (
				modelType !== ModelType.POINT_CLOUD &&
				hasFileExtension(preview.modelFile, LAS_FILE_EXTENSIONS)
			) {
				setError({
					error: true,
					message: `${LL.LAS_REQUIRES_POINT_CLOUD_MSG()} (${
						preview.name
					})`,
				});
				return;
			}

			if (modelType === ModelType.TEXTURE_MESH && !preview.textureFile) {
				setError({
					error: true,
					message: `${LL.NO_TEXTURE_MSG()} (${preview.name})`,
				});
				return;
			}
		}

		const previews = [...modelDataPreviews];
		setModelDataPreviews([]);
		setModalOpen(false);

		for (let i = 0; i < previews.length; i++) {
			const preview = previews[i];
			const textureFile =
				modelType !== ModelType.POINT_CLOUD
					? preview.textureFile
					: undefined;

			await addModelData(
				preview.name,
				modelType,
				preview.modelFile,
				textureFile,
				preview.annotationFile,
				i + 1,
				previews.length
			);
		}
	}

	return (
		<div className="flex flex-col gap-y-4">
			<>
				<label
					htmlFor="add-model-modal"
					className="modal-button btn btn-primary w-full normal-case"
					onClick={() => {
						setModalOpen(true);
					}}
				>
					{LL.UPLOAD_MODELS()}
				</label>
				<input
					type="checkbox"
					id="add-model-modal"
					className="modal-toggle "
					checked={modalOpen}
					onChange={() => {
						setModalOpen(modalOpen);
					}}
				/>

				<div className="modal  py-20">
					<div className="modal-box max-h-full max-w-5xl">
						<label
							htmlFor="add-model-modal"
							className="btn btn-circle btn-sm absolute right-4 top-4"
							onClick={() => {
								setModalOpen(false);
							}}
						>
							✕
						</label>
						<div className="my-auto space-y-4">
							<h2 className="text-xl">{LL.UPLOAD_MODELS()}</h2>
						</div>

						<form
							onSubmit={(submitEvent: React.FormEvent) => {
								submitEvent.preventDefault();
								upload();
							}}
						>
							<div className="divider"></div>

							<div className="form-control mt-4">
								<label className="label cursor-pointer">
									<span className="label-text">
										{LL.TRIANGLE_MESH()}
									</span>
									<input
										type="radio"
										name="mesh"
										className="checked:primary radio"
										checked={modelType === ModelType.MESH}
										onChange={() => {
											setModelType(ModelType.MESH);
										}}
									/>
								</label>
							</div>
							<div className="form-control">
								<label className="label cursor-pointer">
									<span className="label-text">
										{LL.TRIANGLE_MESH_TEXTURE()}
									</span>
									<input
										type="radio"
										name="mesh"
										className="checked:primary radio"
										checked={
											modelType === ModelType.TEXTURE_MESH
										}
										onChange={() => {
											setModelType(
												ModelType.TEXTURE_MESH
											);
										}}
									/>
								</label>
							</div>
							<div className="form-control">
								<label className="label cursor-pointer">
									<span className="label-text">
										{LL.POINT_CLOUD()}
									</span>
									<input
										type="radio"
										name="point-cloud"
										className="checked:primary radio"
										checked={
											modelType === ModelType.POINT_CLOUD
										}
										onChange={() => {
											setModelType(ModelType.POINT_CLOUD);
										}}
									/>
								</label>
							</div>

							<div className="mt-4 grid grid-cols-2 gap-4">
								<button
									type="button"
									className=" btn btn-primary w-full normal-case"
									onClick={() => {
										onFolderSelect();
									}}
								>
									{LL.SELECT_DIRECTORY()}
								</button>
								<button
									type="button"
									className=" btn btn-primary w-full normal-case "
									onClick={() => {
										onFilesSelect();
									}}
								>
									{LL.SELECT_FILES()}
								</button>
							</div>

							{modelDataPreviews && (
								<div>
									<ElementList
										items={getModelDataPreviewItems()}
									/>
								</div>
							)}

							<div className="mt-8">
								{error.error && (
									<p className="text-error">
										{error.message}
									</p>
								)}
								<button
									type="submit"
									className="btn btn-primary btn-block normal-case"
								>
									{LL.UPLOAD_MODELS()}
								</button>
							</div>
						</form>
					</div>
				</div>
			</>
		</div>
	);
}
