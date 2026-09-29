import { useRef } from "react";
import { SCENE_SETTINGS } from "~annotator/scene/Scene";
import { Header } from "~ui/components/Header";
import { LanguageSelector } from "~ui/components/LanguageSelector";
import { CameraPerspective } from "./components/CameraPerspective";
import { CameraSettings } from "./components/CameraSettings";
import { ExportMenuModal } from "./components/ExportMenu";
import { SettingsModal } from "./components/GlobalSettings";
import { HeaderSettings } from "./components/HeaderSettings";
import { HelpContent } from "./components/Help";
import { LabelMenu } from "./components/LabelMenu";
import { LeftSidebar } from "./components/LeftSidebar";
import { LightingSettings } from "./components/LightingSettings";
import { LoadingState } from "./components/LoadingState";
import { ModelName } from "./components/ModelName";
import { PointSettings } from "./components/PointSettings";
import { ScalarFieldSettings } from "./components/ScalarFieldSettings";
import { Stats } from "./components/Stats";
import { AnnotatorProvider } from "./contexts/AnnotatorContext";
import { useCursor } from "./hooks/Cursor";
import { useHexColorSetting } from "./hooks/Settings";
import { useSetup } from "./hooks/Setup";

export function AnnotatorPage() {
	return (
		<AnnotatorProvider>
			<AnnotatorComponent></AnnotatorComponent>
		</AnnotatorProvider>
	);
}

function AnnotatorComponent() {
	const sceneParentRef = useRef<HTMLDivElement>(null);
	const [bgColor] = useHexColorSetting(SCENE_SETTINGS.backgroundColor);

	const { loadingState, error } = useSetup(sceneParentRef);
	const cursor = useCursor();

	return (
		<>
			<div
				className={`fixed h-screen ${
					loadingState.loading ? "cursor-wait" : ""
				}`}
				style={{ backgroundColor: bgColor }}
			>
				<Header>
					<div className="flex">
						<HeaderSettings />
						<div className="my-auto flex items-center ">
							<LanguageSelector />
						</div>
					</div>
				</Header>

				<LeftSidebar />

				<LabelMenu />

				<div className="absolute left-[4.75rem] -z-10 mt-2">
					<ModelName />
				</div>

				<div className="pointer-events-none absolute bottom-4 left-20 -z-10 flex items-end gap-4 [&>*]:pointer-events-auto">
					<CameraPerspective />
					<CameraSettings />
					<LightingSettings />
					<PointSettings />
					<ScalarFieldSettings />
				</div>

				<div className="absolute left-1/2 top-20 -translate-x-1/2 transform">
					<HelpContent />
				</div>

				<div
					ref={sceneParentRef}
					className={`absolute top-0 -z-20 h-full w-full ${
						loadingState.loading ? "cursor-wait" : ""
					}`}
					style={{
						cursor,
					}}
				/>

				<Stats />

				<LoadingState
					loadingState={loadingState}
					error={error}
				></LoadingState>
			</div>
			<SettingsModal />
			<ExportMenuModal />
		</>
	);
}
