import { EventManager } from "~events/EventManager";
import type { Unsubscribe } from "~events/Events";
import { type UndoManager, type UndoManagerEvents } from "./UndoManager";

/**
 * An `UndoManager` that forwards every call to whichever underlying manager
 * is currently "active": either the point cloud's main (Classification)
 * undo manager, or - while editing a scalar field - that field's own,
 * independent undo manager.
 *
 * Tools hold a single, stable reference to this router for the lifetime of
 * the annotator, so switching the active manager (e.g. when entering/leaving
 * scalar field edit mode) doesn't require recreating any tool.
 */
export class PointCloudUndoManagerRouter implements UndoManager {
	private readonly eventManager = new EventManager<UndoManagerEvents>();
	public on = this.eventManager.on.bind(this.eventManager);

	private readonly mainManager: UndoManager;
	private active: UndoManager;
	private unsubscribeForwarding: Unsubscribe[] = [];

	constructor(mainManager: UndoManager) {
		this.mainManager = mainManager;
		this.active = mainManager;
		this.subscribeForwarding();
	}

	/**
	 * Switches which underlying `UndoManager` calls are forwarded to.
	 *
	 * @param manager the manager to activate, or `null` to switch back to
	 *                the main (Classification) undo manager
	 */
	public setActive(manager: UndoManager | null): void {
		this.active = manager ?? this.mainManager;
		this.subscribeForwarding();
		this.eventManager.emit("countChange", this.active.getCounts());
	}

	private subscribeForwarding(): void {
		for (const unsubscribe of this.unsubscribeForwarding) {
			unsubscribe();
		}

		this.unsubscribeForwarding = [
			this.active.on("undo", () => {
				this.eventManager.emit("undo", undefined);
			}),
			this.active.on("redo", () => {
				this.eventManager.emit("redo", undefined);
			}),
			this.active.on("countChange", (counts) => {
				this.eventManager.emit("countChange", counts);
			}),
		];
	}

	public startGroup(): void {
		this.active.startGroup();
	}

	public endGroup(): void {
		this.active.endGroup();
	}

	public undo(): void {
		this.active.undo();
	}

	public redo(): void {
		this.active.redo();
	}

	public activate(): void {
		this.active.activate();
	}

	public deactivate(): void {
		this.active.deactivate();
	}

	public reset(hard?: boolean): void {
		this.active.reset(hard);
	}

	public getCounts() {
		return this.active.getCounts();
	}

	public destroy(): void {
		for (const unsubscribe of this.unsubscribeForwarding) {
			unsubscribe();
		}
		this.eventManager.destroy();
	}
}
