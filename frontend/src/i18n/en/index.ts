import type { BaseTranslation } from "../i18n-types";

const en: BaseTranslation = {
	ENGLISH: "English",
	GERMAN: "German",
	CONFIRM_RELOAD_ON_LANGUAGE_CHANGE:
		"To change the language, the page will be reloaded. Any unsaved changes will be lost. Do you want to continue?",

	PASSWORD: "Password",
	USERNAME: "Username",
	LOG_IN: "Login",
	INVALID_LOGIN_CREDENTIALS: "Incorrect login credentials",

	REGISTER: "Register",
	EMAIL_ADDRESS: "Email address",

	LOG_OUT: "Logout",
	MY_PROJECTS: "My projects",
	ADD_PROJECT: "Add project",
	OWNER: "Owner",
	OPEN: "Open",
	NAME: "Name",
	DESCRIPTION: "Description",

	UPLOAD_MODELS: "Upload models",
	LABELS: "Labels",
	EDIT_LABELS: "Edit labels",
	COLOR: "Color",
	MEMBERS: "Members",
	EDIT_MEMBERS: "Edit members",
	EDIT_PROJECT: "Edit project",
	DELETE_PROJECT: "Delete project",
	LEAVE_PROJECT: "Leave project",
	EDIT: "Edit",
	EXPORT: "Export",
	DELETE: "Delete",
	UNLOCK: "Unlock",

	EDIT_MODEL: "Edit model",
	ANNOTATION_FILE: "Annotation file",
	UPLOAD_ANNOTATION_FILE: "Upload annotation file",
	FILE_DESCRIPTION_3D_MODEL: "3D model",
	FILE_DESCRIPTION_TEXTURE: "Texture",
	FILE_DESCRIPTION_ANNOTATION: "Annotation",
	NO_MODEL_DATA_PREVIEWS_MSG: "No files selected",
	NO_MODEL_TYPE_MSG: "No model type selected",
	NO_TEXTURE_MSG: "No texture file selected",
	UNNAMED_MODEL_DATA_PREVIEW_MSG: "Unnamed files",

	TRIANGLE_MESH: "mesh",
	TRIANGLE_MESH_TEXTURE: "mesh (texture mode)",
	POINT_CLOUD: "point cloud",

	SELECT_DIRECTORY: "Select directory",
	SELECT_FILES: "Select files",
	UPLOAD: "Upload",

	MODEL_FILE_NAME: "Model file name",
	TEXTURE_FILE_NAME: "Texture file name",
	ANNOTATION_FILE_NAME: "Annotation file name",

	NEW_LABEL: "New label",
	ANNOTATION_CLASS: "Annotation class",
	ADD: "Add",

	ADD_MEMBER: "Add member",

	PAGE_NOT_FOUND: "404 Page not found",
	START_PAGE: "Start page",

	// Error texts

	FILL_ALL_FIELDS: "Please fill in all fields.",
	SELECT_FILE: "Please select a file.",
	ANNOTATION_CLASS_ALREADY_EXISTS: "Annotation class already exists.",
	SPECIFY_NAME: "Please specify the name for the model.",
	USER_NAME_ALREADY_TAKEN: "Username is already taken.",
	EMAIL_NOT_VALID: "Email address is not valid.",
	PASSWORD_INSECURE: "Password is not secure enough.",

	// Toast messages

	NETWORK_ERROR: "Network error, please check your internet connection.",
	LOCKED_BY: "Locked by",
	MODEL_LOCKED: "Model is locked",
	BIG_FILES_WARNING: "Big files can lead to a crash of the browser window.",
	SAVING: "Saving...",
	UPLOAD_ERROR: "Error during file upload.",
	SAVING_SUCCESS: "Saved",
	COMPRESSING: "Compressing...",
	UPLOADING: "Uploading...",
	COMPRESSING_ANNOTATION_FILE: "Compressing Annotation file...",
	UPLOADING_ANNOTATION_FILE: "Uploading Annotation file...",
	ANNOTATION_FILE_TOO_BIG: "Annotation file is too big.",
	UPLOAD_SUCCESS: "Upload successful.",
	BASE_FILE_ALREADY_EXISTS: "Base file already exists.",
	DOWNLOAD_SUCCESS: "Download successful.",
	NO_ANNOTATION_FILE: "No annotation file found.",
	NO_LABELS_FOUND: "No labels found.",

	// Loading states

	FETCHING_MODEL_INFORMATION: "fetching model information...",
	LOCKING_MODEL: "locking model...",
	NO_LABELS: "No labels found, aborting...",
	DOWNLOADING_MODEL: "downloading model...",
	WRITING_MODEL_TO_STORAGE: "writing model to storage...",
	DOWNLOADING_ANNOTATION: "downloading annotation file...",
	WRITING_ANNOTATION_TO_STORAGE: "writing annotation file to storage...",
	SETTING_UP_ANNOTATOR: "setting up annotator...",
	SETTING_UP_ANNOTATOR_ABORTED: "setting up annotator... aborted",
	FINISHED_SETUP: "finished setup",

	// Setup Errors

	PARSER_UNKNOWN_LABEL:
		"Annotation File Parser: File contains unknown annotation class ({annotationClass:number}).",
	PARSER_DUPLICATE_LABEL:
		"Annotation File Parser: Annotation class {annotationClass:number} is defined multiple times.",
	PARSER_INCONSISTENT_LABELS:
		"Annotation File Parser: Found undeclared annotation class {annotationClass:number} in data chunk.",
	PARSER_INVALID_NEUTRAL_LABEL:
		"Annotation File Parser: Neutral class {annotationClass:number} cannot be an active label.",
	PARSER_UNKNOWN_MODEL_TYPE:
		"Annotation File Parser: Unknown model type '{modelType}'.",
	PARSER_UNKNOWN_FILE_TYPE:
		"Annotation File Parser: File format not recognized (invalid header).",
	PARSER_UNSUPPORTED_FILE_FORMAT:
		"Annotation File Parser: Format '{format}' version {version} is not supported (Expected: {expectedVersion}).",
	PARSER_GENERIC_ERROR:
		"Annotation File Parser: An unexpected error occurred while reading the file.",
	PARSER_ANNOTATION_LENGTH_MISMATCH:
		"Annotation File Parser: The resulting annotation data length does not match the expected size.",

	MODEL_FILE_TOO_BIG: "The model file exceeds the supported size limit.",

	// Annotator

	ANNOTATOR: "Annotator",
	TOOLS: "Tools",

	POINT_CLOUD_ANNOTATOR: "Point cloud Annotator",
	MESH_ANNOTATOR: "Mesh Annotator",
	MESH_TEXTURE_ANNOTATOR: "Mesh Texture Annotator",

	LASSO: "Lasso",
	POLYGON: "Polygon",
	BRUSH_3D: "3D Brush",
	BRUSH: "Brush",
	PIXEL: "Pixel",
	TRIANGLE: "Triangle",
	FILL: "Fill",

	SAVE: "Save",
	RENDER: "Render",
	ERASER: "Eraser",
	SHOW_HIDE: "show/hide",
	SELECTION_MODE: "Selection mode",
	CENTROID: "Centroid",
	CENTROID_DESCRIPTION: "Selects a face if its center point is contained",
	INTERSECTION: "Intersection",
	INTERSECTION_DESCRIPTION:
		"Selects a face if the polygon intersects it (superset of contain)",
	CONTAIN: "Contain",
	CONTAIN_DESCRIPTION: "Selects a face if all its vertices are contained",
	REMOVE_CORNER: "Remove corner",
	CLOSE: "Close",
	ANNOTATE: "Annotate",
	CANCEL: "Cancel",
	DELETE_KEY: "del",
	SIZE: "Size",
	ADD_CORNER: "Add corner",
	LEFT_MOUSE_BUTTON: "Left mouse button",
	POLYGON_PREVIEW: "Polygon preview",
	SHIFT_KEY: "shift",
	DELETE_LAST_CORNER: "Delete last corner",
	OR: "or",
	CLOSE_POLYGON: "Close polygon",
	ENTER_KEY: "enter",
	ESCAPE_KEY: "esc",
	VIEWS: "Views",
	TOP: "Top",
	BOTTOM: "Bottom",
	LEFT: "Left",
	RIGHT: "Right",
	FRONT: "Front",
	BACK: "Back",
	CAMERA: "Camera",
	GIZMO: "Gizmo",
	PERSPECTIVE: "Perspective",
	ORTHOGRAPHIC: "Orthographic",
	FOV: "FOV",
	LIGHTING: "Lighting",
	GLOBAL_BRIGHTNESS: "Global brightness",
	SUN: "Sun",
	BRIGHTNESS: "Brightness",
	AXIS_POSITION: "Axis position",
	CAMERA_CONTROLLED_SUN: "Camera controlled sun",
	SET_POSITION: "Set position",
	FOLLOW_CAMERA: "Follow camera",
	POINTS: "Points",
	POINT_SIZE: "Point size",
	OPACITY: "Opacity",
	NONE: "None",
	SCALAR_FIELDS: "Scalar fields",
	COLOR_BY_SCALAR_FIELD: "Color by",
	FILTER_BY_SCALAR_FIELD: "Filters",
	ADD_FILTER: "Add filter",
	SELECT_FIELD: "Select field",
	FILL_TOOLTIP:
		"Annotate everything that is not locked, with the current color",

	// Settings

	SETTINGS: "Settings",

	SETTING_DEFAULT: "Default",
	SETTING_RESET: "double click to reset",
	SETTING_RELOAD_NOTICE:
		"Changes to this setting do not take effect until the page reloads!",
	SETTING_RELOAD_CHANGED:
		"This setting has been changed since the page loaded. Please reload the page to see the changes take effect.",

	SETTING_BACKGROUND_COLOR: "Background Color",
	SETTING_BACKGROUND_COLOR_DESC:
		"The background color of the annotation view.",
	SETTING_STATS: "Renderer Metrics Monitor",
	SETTING_STATS_DESC:
		"Display renderer metrics such as FPS and memory usage in the bottom right corner.",
	SETTING_GLOBAL_LIGHT_COLOR: "Global Light Color",
	SETTING_GLOBAL_LIGHT_COLOR_DESC: "The color of the global light.",
	SETTING_SUN_LIGHT_COLOR: "Sun Light Color",
	SETTING_SUN_LIGHT_COLOR_DESC: "The color of the sun light.",

	SETTING_DEFAULT_MESH_COLOR: "Default Mesh Color",
	SETTING_DEFAULT_MESH_COLOR_DESC:
		"The vertex color used if neither vertex color information nor a texture is found.",

	SETTING_DEFAULT_POINT_CLOUD_COLOR: "Default Point Cloud Color",
	SETTING_DEFAULT_POINT_CLOUD_COLOR_DESC:
		"The color of the points if no color information was found.",

	TEXTURE_VISUALIZER_HEADING: "Visualizer",
	TEXTURE_VISUALIZER_DESC:
		"The texture mode visualizer can display annotations in three different ways: 'Fill' (fastest for a small amount of changes), 'Buffer' (fastest for a medium amount of changes) 'Repaint all' (fastest for a large amount of changes).",
	TEXTURE_VISUALIZER_BUFFER: "Buffer threshold",
	TEXTURE_VISUALIZER_BUFFER_DESC:
		"The threshold between 'Fill' and 'Buffer' in percent of total pixels.",
	TEXTURE_VISUALIZER_BUFFER_ALL: "Repaint all threshold",
	TEXTURE_VISUALIZER_BUFFER_ALL_DESC:
		"The threshold between 'Buffer' and 'Repaint all' in percent of total pixels.",

	CIRCLE_OPACITY: "Brush Opacity",
	CIRCLE_OPACITY_DESC:
		"The opacity of the brush circle. Ranges from 0% (invisible) to 100% (only circle visible).",
	CIRCLE_SEGMENTS: "Geometry Segments",
	CIRCLE_SEGMENTS_DESC:
		"The number of triangular segments of the brush circle geometry.",
	CIRCLE_COLOR: "Brush Color",
	CIRCLE_COLOR_DESC: "The color of the brush material.",
	CIRCLE_EMISSIVE_COLOR: "Brush Emissive Color",
	CIRCLE_EMISSIVE_COLOR_DESC: "The emissive color of the brush material.",
	CIRCLE_EMISSIVE_COLOR_INTENSITY: "Brush Emissive Color Intensity",
	CIRCLE_EMISSIVE_COLOR_INTENSITY_DESC:
		"The intensity of the brush emissive color.",

	SPHERE_OPACITY: "Brush Opacity",
	SPHERE_OPACITY_DESC:
		"The opacity of the brush sphere. Ranges from 0% (invisible) to 100% (only circle visible).",
	SPHERE_HEIGHT_SEGMENTS: "Geometry Height Segments",
	SPHERE_HEIGHT_SEGMENTS_DESC:
		"The number of vertical triangular segments of the brush sphere geometry.",
	SPHERE_WIDTH_SEGMENTS: "Geometry Width Segments",
	SPHERE_WIDTH_SEGMENTS_DESC:
		"The number of horizontal triangular segments of the brush sphere geometry.",
	SPHERE_COLOR: "Brush Color",
	SPHERE_COLOR_DESC: "The color of the brush material.",
	SPHERE_EMISSIVE_COLOR: "Brush Emissive Color",
	SPHERE_EMISSIVE_COLOR_DESC: "The emissive color of the brush material.",
	SPHERE_EMISSIVE_COLOR_INTENSITY: "Brush Emissive Color Intensity",
	SPHERE_EMISSIVE_COLOR_INTENSITY_DESC:
		"The intensity of the brush emissive color.",

	LASSO_COLOR: "Line Color",
	LASSO_COLOR_DESC: "The color of the lasso line.",

	POLYGON_COLOR: "Line Color",
	POLYGON_COLOR_DESC: "The color of the polygon line.",

	// Cache
	CACHE: "Cache",
	USAGE: "Usage",
	USAGE_NUMBERS:
		"Currently using {usage:string} of {quota:string} estimated space.",

	REFRESH: "refresh",
	SHOW_CONTENT: "show content",
	DELETE_CACHE: "delete cache",

	// Export Menu
	EXPORT_MENU_TITLE: "Export Data",
	VIEW_HEADING: "View",
	VIEW_DESCRIPTION: "Export the current model view.",
	EXPORT_BUTTON: "Export",
	ANNOTATION_FILE_HEADING: "Annotation File",
	BINARY_SUBHEADING: "Binary",
	BINARY_DESCRIPTION:
		"Export the current annotation in the binary Anno3d file format.",
	UTF8_SUBHEADING: "UTF-8",
	UTF8_DESCRIPTION:
		"Export the current annotation in the UTF-8 Anno3d file format.",
	TEXTURE_HEADING: "Texture",
	TEXTURE_DESCRIPTION_INTRO:
		"The texture will be exported as a PNG. There are three options for setting the colors of the PNG file:",
	TEXTURE_OPTION_GRAYSCALE_DESCRIPTION:
		"The annotation class of each pixel is exported as a grayscale value (R=G=B). Unannotated pixels have the annotation class 255 (White).",
	TEXTURE_OPTION_COLOR_DESCRIPTION:
		"The label color of each pixel is exported. Unannotated pixels have the color white.",
	TEXTURE_OPTION_BLENDED_DESCRIPTION:
		"The label color of each pixel is overlaid on the original texture. Unannotated pixels retain their original color. The current opacity is used (adjustable in the label menu).",
} satisfies BaseTranslation;
// eslint-disable-next-line import/no-default-export
export default en;
