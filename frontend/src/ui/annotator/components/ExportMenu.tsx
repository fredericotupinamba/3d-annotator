import { useI18nContext } from "i18n/i18n-react";
import { FileOutput as FileOutputIcon } from "lucide-react";
import type { PropsWithChildren } from "react";
import { toast } from "react-toastify";
import { type SerializerFormatOptions } from "~anno3d/v2/workers/serializer/Anno3DSerializerTask";
import { buildLasFile } from "~annotator/export/LasWriter";
import { VISUALIZER_SETTINGS } from "~annotator/scene/visualizer/AnnotationVisualizer";
import { ModelType } from "~entity/ModelInformation";
import { writeToHandle } from "~util/fileSystem/FileUtils";
import {
	useAnnotator,
	useModelInformation,
} from "../contexts/AnnotatorContext";
import { useSetting } from "../hooks/Settings";

export function ExportMenuModalButton() {
	const { LL } = useI18nContext();
	return (
		<div
			className="tooltip tooltip-right"
			data-tip={LL.EXPORT_MENU_TITLE()}
		>
			<label
				htmlFor="export-modal"
				className="modal-button btn  btn-primary m-1 h-14 w-14 px-[0.875rem]"
			>
				<FileOutputIcon strokeWidth={1} size={32} />
			</label>
		</div>
	);
}

function Section({ children }: PropsWithChildren) {
	return <div className="space-y-4">{children}</div>;
}

function Heading({ children }: PropsWithChildren) {
	return (
		<div className="divider">
			<h2 className="text-xl font-bold text-accent-content">
				{children}
			</h2>
		</div>
	);
}

function SubHeading({ children }: PropsWithChildren) {
	return (
		<h3 className="text-lg font-bold text-accent-content">{children}</h3>
	);
}

function Description({ description }: { description: string }) {
	return <p className="mr-4 mt-1 text-sm">{description}</p>;
}

export function ExportMenuModal() {
	const { LL } = useI18nContext();
	const annotator = useAnnotator();
	const [opacity] = useSetting(VISUALIZER_SETTINGS.opacity);

	const modelInformation = useModelInformation();

	async function render() {
		if (!annotator || !modelInformation) return;

		const handle = await window.showSaveFilePicker({
			suggestedName: `screenshot ${
				modelInformation.name
			} (${new Date().toISOString()}).png`,
		});
		const blob = await annotator.sceneManager.renderImage();
		await writeToHandle(blob, handle);
	}

	async function serializeToFile(
		suggestedName: string,
		options: SerializerFormatOptions
	) {
		if (!annotator) {
			return;
		}

		const handle = await window.showSaveFilePicker({
			suggestedName,
		});
		const fileName = handle.name;

		let width = 0,
			height = 0;
		if (annotator.isTextureAnnotator()) {
			const dim = annotator.getDimensions();
			width = dim.width;
			height = dim.height;
		}

		const id = toast.info("Exporting...", {
			isLoading: true,
		});

		const serializer = annotator.annotationFileManager.serializerTask;
		await serializer.serializeToFile(
			{
				annotations: annotator.getAnnotationsLUTUnsafe(),
				labels: annotator.labelManager.getLabels(),
				modelType: annotator.modelType,
				width,
				height,
			},
			handle,
			options
		);

		toast.update(id, {
			isLoading: false,
			render: `Saved to "${fileName}"`,
			type: "success",
			autoClose: 8000,
		});
	}

	function binary() {
		if (!modelInformation) {
			return;
		}

		serializeToFile(
			`annotations ${
				modelInformation.name
			} (${new Date().toISOString()}).bin.anno3d`,
			{ format: "binary" }
		);
	}

	function utf8() {
		if (!modelInformation) {
			return;
		}

		serializeToFile(
			`annotations ${
				modelInformation.name
			} (${new Date().toISOString()}).anno3d`,
			{ format: "utf8" }
		);
	}

	async function las() {
		if (
			!annotator ||
			!modelInformation ||
			!annotator.isPointCloudAnnotator()
		) {
			return;
		}

		const handle = await window.showSaveFilePicker({
			suggestedName: `${
				modelInformation.name
			} (${new Date().toISOString()}).las`,
		});
		const fileName = handle.name;

		const id = toast.info("Exporting...", {
			isLoading: true,
		});

		const exportData = annotator.getExportData();
		const buffer = buildLasFile({
			positions: exportData.positions,
			shift: exportData.coordinateShift,
			colors: exportData.colors,
			classification: annotator.getAnnotationsLUTUnsafe(),
			extraFields: exportData.scalarFields,
		});

		await writeToHandle(buffer, handle);

		toast.update(id, {
			isLoading: false,
			render: `Saved to "${fileName}"`,
			type: "success",
			autoClose: 8000,
		});
	}

	function png(mode: "annotationClass" | "color" | "blended") {
		if (!annotator || !modelInformation) {
			return;
		}

		if (!annotator.isTextureAnnotator()) {
			console.warn("PNG export is only possible in texture mode.");
			return;
		}

		const originalColors = annotator.getOriginalColors();
		serializeToFile(
			`texture ${
				modelInformation.name
			} (${new Date().toISOString()}).png`,
			{ format: "png", mode, opacity, originalColors }
		);
	}

	return (
		<>
			<input type="checkbox" id="export-modal" className="modal-toggle" />
			<label className="modal" htmlFor="export-modal">
				<label
					className="modal-box max-w-3xl p-0 scrollbar-thin scrollbar-track-base-100 scrollbar-thumb-base-content/20"
					htmlFor=""
				>
					<div className="sticky top-0 z-10 flex items-center justify-between bg-base-100 p-6 ">
						<h1 className="text-2xl font-bold text-accent-content">
							{LL.EXPORT_MENU_TITLE()}
						</h1>
						<label
							htmlFor="export-modal"
							className="btn btn-circle btn-accent btn-sm"
						>
							✕
						</label>
					</div>

					<div className="space-y-10 px-6 pb-8">
						<Section>
							<Heading>{LL.VIEW_HEADING()}</Heading>
							<div className="flex items-center">
								<div className="flex-grow ">
									<Description
										description={LL.VIEW_DESCRIPTION()}
									/>
								</div>
								<button
									className="btn btn-primary normal-case"
									onClick={render}
								>
									{LL.EXPORT_BUTTON()}
								</button>
							</div>
						</Section>
						<Section>
							<Heading>{LL.ANNOTATION_FILE_HEADING()}</Heading>
							<div>
								<SubHeading>
									{LL.BINARY_SUBHEADING()}
								</SubHeading>
								<div className="flex items-center">
									<div className="flex-grow ">
										<Description
											description={LL.BINARY_DESCRIPTION()}
										/>
									</div>
									<button
										className="btn btn-primary normal-case"
										onClick={binary}
									>
										{LL.EXPORT_BUTTON()}
									</button>
								</div>
							</div>
							<div>
								<SubHeading>{LL.UTF8_SUBHEADING()}</SubHeading>
								<div className="flex items-center">
									<div className="flex-grow ">
										<Description
											description={LL.UTF8_DESCRIPTION()}
										/>
									</div>
									<button
										className="btn btn-primary normal-case"
										onClick={utf8}
									>
										{LL.EXPORT_BUTTON()}
									</button>
								</div>
							</div>
						</Section>
						{modelInformation?.modelType ===
							ModelType.POINT_CLOUD && (
							<Section>
								<Heading>
									{LL.POINT_CLOUD_EXPORT_HEADING()}
								</Heading>
								<div>
									<SubHeading>
										{LL.LAS_SUBHEADING()}
									</SubHeading>
									<div className="flex items-center">
										<div className="flex-grow ">
											<Description
												description={LL.LAS_DESCRIPTION()}
											/>
										</div>
										<button
											className="btn btn-primary normal-case"
											onClick={las}
										>
											{LL.EXPORT_BUTTON()}
										</button>
									</div>
								</div>
							</Section>
						)}
						{modelInformation?.modelType ===
							ModelType.TEXTURE_MESH && (
							<Section>
								<Heading>{LL.TEXTURE_HEADING()}</Heading>
								<div>
									<Description
										description={LL.TEXTURE_DESCRIPTION_INTRO()}
									/>
								</div>

								<div className="flex items-center">
									<div className="flex-grow ">
										<Description
											description={LL.TEXTURE_OPTION_GRAYSCALE_DESCRIPTION()}
										/>
									</div>
									<button
										className="btn btn-primary normal-case"
										onClick={() => {
											png("annotationClass");
										}}
									>
										{LL.EXPORT_BUTTON()}
									</button>
								</div>
								<div className="flex items-center">
									<div className="flex-grow ">
										<Description
											description={LL.TEXTURE_OPTION_COLOR_DESCRIPTION()}
										/>
									</div>
									<button
										className="btn btn-primary normal-case"
										onClick={() => {
											png("color");
										}}
									>
										{LL.EXPORT_BUTTON()}
									</button>
								</div>
								<div className="flex items-center">
									<div className="flex-grow ">
										<Description
											description={LL.TEXTURE_OPTION_BLENDED_DESCRIPTION()}
										/>
									</div>
									<button
										className="btn btn-primary normal-case"
										onClick={() => {
											png("blended");
										}}
									>
										{LL.EXPORT_BUTTON()}
									</button>
								</div>
							</Section>
						)}
					</div>
				</label>
			</label>
		</>
	);
}
