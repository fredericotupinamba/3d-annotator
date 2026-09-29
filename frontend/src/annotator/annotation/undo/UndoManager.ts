import { type Destroyable } from "~entity/Types";
import type { Subscribable } from "~events/Events";

export interface UndoRedoCount {
	undos: number;
	redos: number;
}

export type UndoManagerEvents = {
	undo: void;
	redo: void;
	countChange: UndoRedoCount;
};

export interface UndoManager
	extends Subscribable<UndoManagerEvents>,
		Destroyable {
	startGroup(): void;
	endGroup(): void;

	undo(): void;
	redo(): void;

	activate(): void;
	deactivate(): void;

	reset(hard?: boolean): void;

	getCounts(): UndoRedoCount;
}
