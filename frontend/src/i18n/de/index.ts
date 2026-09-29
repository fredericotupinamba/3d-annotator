import type { Translation } from "../i18n-types";

const de: Translation = {
	ENGLISH: "Englisch",
	GERMAN: "Deutsch",
	CONFIRM_RELOAD_ON_LANGUAGE_CHANGE:
		"Um die Sprache zu ändern, wird die Seite neu geladen. Alle ungesicherten Änderungen gehen verloren. Möchten Sie fortfahren?",

	PASSWORD: "Passwort",
	USERNAME: "Benutzername",
	LOG_IN: "Anmelden",
	INVALID_LOGIN_CREDENTIALS: "Falsche Anmeldedaten",

	REGISTER: "Registrieren",
	EMAIL_ADDRESS: "E-Mail-Adresse",

	LOG_OUT: "Abmelden",
	MY_PROJECTS: "Meine Projekte",
	ADD_PROJECT: "Projekt hinzufügen",
	OWNER: "BesitzerIn",
	OPEN: "Öffnen",
	NAME: "Name",
	DESCRIPTION: "Beschreibung",

	UPLOAD_MODELS: "Modelle hochladen",
	LABELS: "Label",
	EDIT_LABELS: "Labels bearbeiten",
	COLOR: "Farbe",
	MEMBERS: "Mitglieder",
	EDIT_MEMBERS: "Mitglieder bearbeiten",
	EDIT_PROJECT: "Projekt bearbeiten",
	DELETE_PROJECT: "Projekt löschen",
	LEAVE_PROJECT: "Projekt verlassen",
	EDIT: "Bearbeiten",
	EXPORT: "Exportieren",
	DELETE: "Löschen",
	UNLOCK: "Entsperren",

	EDIT_MODEL: "Modell bearbeiten",
	ANNOTATION_FILE: "Annotationsdatei",
	UPLOAD_ANNOTATION_FILE: "Annotationsdatei hochladen",
	FILE_DESCRIPTION_3D_MODEL: "3D-Modell",
	FILE_DESCRIPTION_TEXTURE: "Textur",
	FILE_DESCRIPTION_ANNOTATION: "Annotation",
	NO_MODEL_DATA_PREVIEWS_MSG: "Keine Dateien ausgewählt",
	NO_MODEL_TYPE_MSG: "Kein Modelltyp ausgewählt",
	NO_TEXTURE_MSG: "Keine Texturdatei ausgewählt",
	UNNAMED_MODEL_DATA_PREVIEW_MSG: "Unbenannte Dateien",

	TRIANGLE_MESH: "Mesh",
	TRIANGLE_MESH_TEXTURE: "Mesh (Texturmodus)",
	POINT_CLOUD: "Punktwolke",

	SELECT_DIRECTORY: "Ordner auswählen",
	SELECT_FILES: "Dateien auswählen",
	UPLOAD: "Hochladen",

	MODEL_FILE_NAME: "Modelldateiname",
	TEXTURE_FILE_NAME: "Texturdateiname",
	ANNOTATION_FILE_NAME: "Annotationsdateiname",

	NEW_LABEL: "Neues Label",
	ANNOTATION_CLASS: "Annotationsklasse",
	ADD: "Hinzufügen",

	ADD_MEMBER: "Mitglied hinzufügen",

	PAGE_NOT_FOUND: "404 Seite nicht gefunden",
	START_PAGE: "Startseite",

	// Error texts

	FILL_ALL_FIELDS: "Bitte füllen Sie alle Felder aus.",
	SELECT_FILE: "Bitte wählen Sie eine Datei aus.",
	ANNOTATION_CLASS_ALREADY_EXISTS: "Annotationsklasse existiert bereits.",
	SPECIFY_NAME: "Bitte geben Sie den Namen für das Modell an.",
	USER_NAME_ALREADY_TAKEN: "Benutzername ist bereits vergeben.",
	EMAIL_NOT_VALID: "E-Mail-Adresse ist nicht gültig.",
	PASSWORD_INSECURE: "Passwort ist nicht sicher genug.",

	// Toast messages

	NETWORK_ERROR:
		"Netzwerk Fehler, bitte überprüfen Sie Ihre Internetverbindung.",
	LOCKED_BY: "Gesperrt von",
	MODEL_LOCKED: "Modell ist gesperrt",
	BIG_FILES_WARNING:
		"Große Dateien können zum Absturz des Browserfensters führen.",
	SAVING: "Speichern...",
	UPLOAD_ERROR: "Fehler beim Hochladen der Datei.",
	SAVING_SUCCESS: "Gespeichert",
	COMPRESSING: "Komprimieren...",
	UPLOADING: "Hochladen...",
	COMPRESSING_ANNOTATION_FILE: "Komprimiere Annotationsdatei...",
	UPLOADING_ANNOTATION_FILE: "Lade Annotationsdatei hoch...",
	ANNOTATION_FILE_TOO_BIG: "Annotationsdatei ist zu groß.",
	UPLOAD_SUCCESS: "Hochgeladen",
	BASE_FILE_ALREADY_EXISTS: "Basisdatei existiert bereits.",
	DOWNLOAD_SUCCESS: "Heruntergeladen",
	NO_ANNOTATION_FILE: "Keine Annotationsdatei gefunden",
	NO_LABELS_FOUND: "Keine Label gefunden",

	// Loading states

	FETCHING_MODEL_INFORMATION: "Modellinformationen abrufen...",
	LOCKING_MODEL: "Modell sperren...",
	NO_LABELS: "Keine Label gefunden, Abbruch...",
	DOWNLOADING_MODEL: "Modell herunterladen...",
	WRITING_MODEL_TO_STORAGE: "Modell in Speicher schreiben...",
	DOWNLOADING_ANNOTATION: "Annotationsdatei herunterladen...",
	WRITING_ANNOTATION_TO_STORAGE: "Annotationsdatei in Speicher schreiben...",
	SETTING_UP_ANNOTATOR: "Annotator starten...",
	SETTING_UP_ANNOTATOR_ABORTED: "Annotator starten, Abbruch...",
	FINISHED_SETUP: "Setup abgeschlossen",

	// Parser & Loader Errors
	PARSER_UNKNOWN_LABEL:
		"Annotationsdatei Parser: Datei enthält unbekannte Annotationsklasse ({annotationClass}).",
	PARSER_DUPLICATE_LABEL:
		"Annotationsdatei Parser: Annotationsklasse {annotationClass} wurde mehrfach definiert.",
	PARSER_INCONSISTENT_LABELS:
		"Annotationsdatei Parser: Undeklarierte Annotationsklasse {annotationClass} im Daten-Chunk gefunden.",
	PARSER_INVALID_NEUTRAL_LABEL:
		"Annotationsdatei Parser: Neutrale Klasse {annotationClass} darf kein aktives Label sein.",
	PARSER_UNKNOWN_MODEL_TYPE:
		"Annotationsdatei Parser: Unbekannter Modelltyp '{modelType}'.",
	PARSER_UNKNOWN_FILE_TYPE:
		"Annotationsdatei Parser: Dateiformat nicht erkannt (ungültiger Header).",
	PARSER_UNSUPPORTED_FILE_FORMAT:
		"Annotationsdatei Parser: Format '{format}' Version {version} wird nicht unterstützt (Erwartet: {expectedVersion}).",
	PARSER_GENERIC_ERROR:
		"Annotationsdatei Parser: Ein struktureller Fehler ist beim Lesen der Datei aufgetreten.",
	PARSER_ANNOTATION_LENGTH_MISMATCH:
		"Annotationsdatei Parser: Die Länge der gelesenen Annotationsdaten stimmt nicht mit der erwarteten Größe überein.",

	MODEL_FILE_TOO_BIG:
		"Die Modelldatei überschreitet das unterstützte Größenlimit.",

	// Annotator

	ANNOTATOR: "Annotator",
	TOOLS: "Tools",

	POINT_CLOUD_ANNOTATOR: "Punktwolken Annotator",
	MESH_ANNOTATOR: "Mesh Annotator",
	MESH_TEXTURE_ANNOTATOR: "Mesh Texturmodus Annotator",

	LASSO: "Lasso",
	POLYGON: "Polygon",
	BRUSH_3D: "3D-Pinsel",
	BRUSH: "Pinsel",
	PIXEL: "Pixel",
	TRIANGLE: "Dreieck",
	FILL: "Füllen",

	SAVE: "Speichern",
	RENDER: "Rendern",
	ERASER: "Radierer",
	SHOW_HIDE: "Ein-/Ausblenden",
	SELECTION_MODE: "Auswahlmodus",
	CENTROID: "Schwerpunkt",
	CENTROID_DESCRIPTION:
		"Wählt eine Fläche aus, wenn sein Schwerpunkt enthalten ist.",
	INTERSECTION: "Schnitt",
	INTERSECTION_DESCRIPTION:
		"Wählt eine Fläche aus, wenn das Polygon es schneidet (Übermenge von Umfassen).",
	CONTAIN: "Umfassen",
	CONTAIN_DESCRIPTION:
		"Wählt eine Fläche aus, wenn alle seine Eckpunkte enthalten sind.",
	REMOVE_CORNER: "Ecke entfernen",
	CLOSE: "Schließen",
	ANNOTATE: "Annotieren",
	CANCEL: "Abbrechen",
	DELETE_KEY: "entf",
	SIZE: "Größe",
	ADD_CORNER: "Ecke hinzufügen",
	LEFT_MOUSE_BUTTON: "Linke Maustaste",
	POLYGON_PREVIEW: "Polygon-Vorschau",
	SHIFT_KEY: "umschalt",
	DELETE_LAST_CORNER: "Letzte Ecke löschen",
	OR: "oder",
	CLOSE_POLYGON: "Polygon schließen",
	ENTER_KEY: "enter",
	ESCAPE_KEY: "esc",
	VIEWS: "Ansichten",
	TOP: "Oben",
	BOTTOM: "Unten",
	LEFT: "Links",
	RIGHT: "Rechts",
	FRONT: "Vorne",
	BACK: "Hinten",
	CAMERA: "Kamera",
	GIZMO: "Gizmo",
	PERSPECTIVE: "Perspektivisch",
	ORTHOGRAPHIC: "Orthografisch",
	FOV: "FOV",
	LIGHTING: "Licht",
	GLOBAL_BRIGHTNESS: "Globale Helligkeit",
	SUN: "Sonne",
	BRIGHTNESS: "Helligkeit",
	AXIS_POSITION: "Achsenposition",
	CAMERA_CONTROLLED_SUN: "Kameragesteuerte Sonne",
	SET_POSITION: "Position setzen",
	FOLLOW_CAMERA: "Kamera folgen",
	POINTS: "Punkte",
	POINT_SIZE: "Punktgröße",
	OPACITY: "Deckkraft",
	NONE: "Keine",
	SCALAR_FIELDS: "Skalarfelder",
	COLOR_BY_SCALAR_FIELD: "Einfärben nach",
	FILTER_BY_SCALAR_FIELD: "Filter",
	ADD_FILTER: "Filter hinzufügen",
	SELECT_FIELD: "Feld auswählen",
	FILL_TOOLTIP:
		"Alles, was nicht gesperrt sind, mit der aktuellen Farbe annotieren",

	// Settings

	SETTINGS: "Einstellungen",

	SETTING_DEFAULT: "Default",
	SETTING_RESET: "Doppelklick zum Zurücksetzen",
	SETTING_RELOAD_NOTICE:
		"Änderungen an dieser Einstellung werden erst nach dem Neuladen der Seite wirksam!",
	SETTING_RELOAD_CHANGED:
		"Diese Einstellung wurde seit dem Laden der Seite geändert. Bitte laden Sie die Seite neu, um die Änderungen zu übernehmen.",

	SETTING_BACKGROUND_COLOR: "Hintergrundfarbe",
	SETTING_BACKGROUND_COLOR_DESC:
		"Die Hintergrundfarbe der Annotationsansicht.",
	SETTING_STATS: "Renderer-Metriken-Monitor",
	SETTING_STATS_DESC:
		"Zeigt Renderer-Metriken wie FPS und Speichernutzung unten rechts an.",
	SETTING_GLOBAL_LIGHT_COLOR: "Globale Lichtfarbe",
	SETTING_GLOBAL_LIGHT_COLOR_DESC: "Die Farbe des globalen Lichts.",
	SETTING_SUN_LIGHT_COLOR: "Sonnenlichtfarbe",
	SETTING_SUN_LIGHT_COLOR_DESC: "Die Farbe des Sonnenlichts.",

	SETTING_DEFAULT_MESH_COLOR: "Standard-Mesh-Farbe",
	SETTING_DEFAULT_MESH_COLOR_DESC:
		"Die Scheitelpunktfarbe, die verwendet wird, wenn weder Scheitelpunktfarbinformationen noch Texturen vorhanden sind.",

	SETTING_DEFAULT_POINT_CLOUD_COLOR: "Standard-Punktwolken-Farbe",
	SETTING_DEFAULT_POINT_CLOUD_COLOR_DESC:
		"Die Farbe der Punkte, wenn keine Farbinformationen vorhanden sind.",

	TEXTURE_VISUALIZER_HEADING: "Visualisierer",
	TEXTURE_VISUALIZER_DESC:
		"Der Texturmodus-Visualisierer kann Annotationen auf drei verschiedene Arten darstellen: „Füllen“ (am schnellsten bei wenigen Änderungen), „Puffer“ (am schnellsten bei mittlerem Änderungsaufkommen) und „Alles neu zeichnen“ (am schnellsten bei vielen Änderungen).",
	TEXTURE_VISUALIZER_BUFFER: "Puffer-Schwelle",
	TEXTURE_VISUALIZER_BUFFER_DESC:
		"Die Schwelle zwischen „Füllen“ und „Puffer“ in Prozent der Gesamtpixel.",
	TEXTURE_VISUALIZER_BUFFER_ALL: "Schwelle für „Alles neu zeichnen“",
	TEXTURE_VISUALIZER_BUFFER_ALL_DESC:
		"Die Schwelle zwischen „Puffer“ und „Alles neu zeichnen“ in Prozent der Gesamtpixel.",

	CIRCLE_OPACITY: "Pinsel-Deckkraft",
	CIRCLE_OPACITY_DESC:
		"Die Deckkraft des Pinsels. Reicht von 0% (unsichtbar) bis 100% (nur Kreis sichtbar).",
	CIRCLE_SEGMENTS: "Geometrie-Segmente",
	CIRCLE_SEGMENTS_DESC:
		"Die Anzahl der dreieckigen Segmente der Kreis-Geometrie.",
	CIRCLE_COLOR: "Pinselfarbe",
	CIRCLE_COLOR_DESC: "Die Farbe des Pinselmaterials.",
	CIRCLE_EMISSIVE_COLOR: "Pinsel-Leuchtfarbe",
	CIRCLE_EMISSIVE_COLOR_DESC: "Die leuchtende Farbe des Pinselmaterials.",
	CIRCLE_EMISSIVE_COLOR_INTENSITY: "Pinsel-Leuchtfarbe Intensität",
	CIRCLE_EMISSIVE_COLOR_INTENSITY_DESC:
		"Die Intensität der leuchtenden Pinsel-Farbe.",

	SPHERE_OPACITY: "Pinsel-Deckkraft",
	SPHERE_OPACITY_DESC:
		"Die Deckkraft der Pinselkugel. Reicht von 0% (unsichtbar) bis 100% (nur Kugel sichtbar).",
	SPHERE_HEIGHT_SEGMENTS: "Geometrie-Höhensegmente",
	SPHERE_HEIGHT_SEGMENTS_DESC:
		"Die Anzahl der vertikalen dreieckigen Segmente der Kugel-Geometrie.",
	SPHERE_WIDTH_SEGMENTS: "Geometrie-Breitensegmente",
	SPHERE_WIDTH_SEGMENTS_DESC:
		"Die Anzahl der horizontalen dreieckigen Segmente der Kugel-Geometrie.",
	SPHERE_COLOR: "Pinselfarbe",
	SPHERE_COLOR_DESC: "Die Farbe des Pinselmaterials.",
	SPHERE_EMISSIVE_COLOR: "Pinsel-Leuchtfarbe",
	SPHERE_EMISSIVE_COLOR_DESC: "Die leuchtende Farbe des Pinselmaterials.",
	SPHERE_EMISSIVE_COLOR_INTENSITY: "Intensität der Pinsel-Leuchtfarbe",
	SPHERE_EMISSIVE_COLOR_INTENSITY_DESC:
		"Die Intensität der leuchtenden Pinsel-Farbe.",

	LASSO_COLOR: "Linienfarbe",
	LASSO_COLOR_DESC: "Die Farbe der Lasso-Linie.",

	POLYGON_COLOR: "Linienfarbe",
	POLYGON_COLOR_DESC: "Die Farbe der Polygon-Linie.",

	// Cache
	CACHE: "Cache",
	USAGE: "Nutzung",
	USAGE_NUMBERS:
		"Aktuell werden {usage} von {quota} des geschätzten Speicherplatzes genutzt.",

	REFRESH: "Aktualisieren",
	SHOW_CONTENT: "Inhalt anzeigen",
	DELETE_CACHE: "Cache löschen",

	// Export Menu
	EXPORT_MENU_TITLE: "Daten exportieren",
	VIEW_HEADING: "Ansicht",
	VIEW_DESCRIPTION: "Export der aktuellen Modellansicht.",
	EXPORT_BUTTON: "Exportieren",
	ANNOTATION_FILE_HEADING: "Annotationsdatei",
	BINARY_SUBHEADING: "Binary",
	BINARY_DESCRIPTION:
		"Export der aktuellen Annotation im Binary Anno3d Dateiformat.",
	UTF8_SUBHEADING: "UTF-8",
	UTF8_DESCRIPTION:
		"Export der aktuellen Annotation im UTF-8 Anno3d Dateiformat.",
	TEXTURE_HEADING: "Textur",
	TEXTURE_DESCRIPTION_INTRO:
		"Die Textur wird als PNG exportiert. Es gibt drei Möglichkeiten, die Farben der PNG-Datei zu setzen:",
	TEXTURE_OPTION_GRAYSCALE_DESCRIPTION:
		"Die Annotationsklasse jedes Pixels wird als Graustufenwert (R=G=B) exportiert. Unannotierte Pixel haben die Annotationsklasse 255 (Weiß).",
	TEXTURE_OPTION_COLOR_DESCRIPTION:
		"Die Labelfarbe jedes Pixels wird exportiert. Unannotierte Pixel haben die Farbe Weiß.",
	TEXTURE_OPTION_BLENDED_DESCRIPTION:
		"Die Labelfarbe jedes Pixels wird über die Originalfarbe der Textur gelegt. Unannotierte Pixel behalten ihre Originalfarbe. Es wird die aktuelle Deckkraft verwendet (einstellbar im Labelmenü).",
} satisfies Translation;

// eslint-disable-next-line import/no-default-export
export default de;
