import { EventManager } from "~events/EventManager";
import { PointCloudUndoManagerRouter } from "../PointCloudUndoManagerRouter";
import type { UndoManager, UndoManagerEvents } from "../UndoManager";

/** a minimal, independently-controllable fake `UndoManager` for testing routing */
function createFakeUndoManager(): UndoManager & {
	emitUndo: () => void;
	emitCountChange: (undos: number, redos: number) => void;
	calls: { undo: number; redo: number; startGroup: number };
} {
	const eventManager = new EventManager<UndoManagerEvents>();
	const calls = { undo: 0, redo: 0, startGroup: 0 };
	let counts = { undos: 0, redos: 0 };

	return {
		on: eventManager.on.bind(eventManager),
		startGroup: () => {
			calls.startGroup++;
		},
		endGroup: () => undefined,
		undo: () => {
			calls.undo++;
		},
		redo: () => {
			calls.redo++;
		},
		activate: () => undefined,
		deactivate: () => undefined,
		reset: () => undefined,
		getCounts: () => counts,
		destroy: () => {
			eventManager.destroy();
		},
		emitUndo: () => {
			eventManager.emit("undo", undefined);
		},
		emitCountChange: (undos: number, redos: number) => {
			counts = { undos, redos };
			eventManager.emit("countChange", counts);
		},
		calls,
	};
}

describe("PointCloudUndoManagerRouter", () => {
	test("forwards calls to the main manager by default", () => {
		const main = createFakeUndoManager();
		const router = new PointCloudUndoManagerRouter(main);

		router.undo();
		router.redo();
		router.startGroup();

		expect(main.calls.undo).toBe(1);
		expect(main.calls.redo).toBe(1);
		expect(main.calls.startGroup).toBe(1);
	});

	test("forwards events from the main manager", () => {
		const main = createFakeUndoManager();
		const router = new PointCloudUndoManagerRouter(main);

		const received: number[] = [];
		router.on("countChange", (counts) => received.push(counts.undos));

		main.emitCountChange(3, 0);
		expect(received).toEqual([3]);
	});

	test("setActive() redirects calls to the new manager instead", () => {
		const main = createFakeUndoManager();
		const session = createFakeUndoManager();
		const router = new PointCloudUndoManagerRouter(main);

		router.setActive(session);
		router.undo();

		expect(session.calls.undo).toBe(1);
		expect(main.calls.undo).toBe(0);
	});

	test("setActive() immediately re-emits the new manager's current counts", () => {
		const main = createFakeUndoManager();
		const session = createFakeUndoManager();
		session.emitCountChange(2, 1); // set before anyone is listening

		const router = new PointCloudUndoManagerRouter(main);
		const received: { undos: number; redos: number }[] = [];
		router.on("countChange", (counts) => received.push(counts));

		router.setActive(session);

		expect(received).toEqual([{ undos: 2, redos: 1 }]);
	});

	test("setActive(null) switches back to the main manager", () => {
		const main = createFakeUndoManager();
		const session = createFakeUndoManager();
		const router = new PointCloudUndoManagerRouter(main);

		router.setActive(session);
		router.setActive(null);
		router.undo();

		expect(main.calls.undo).toBe(1);
		expect(session.calls.undo).toBe(0);
	});

	test("stops forwarding events from a manager once it's no longer active", () => {
		const main = createFakeUndoManager();
		const session = createFakeUndoManager();
		const router = new PointCloudUndoManagerRouter(main);

		router.setActive(session);
		router.setActive(null);

		const received: number[] = [];
		router.on("countChange", (counts) => received.push(counts.undos));

		session.emitCountChange(99, 0); // should be ignored, session is no longer active
		expect(received).toEqual([]);

		main.emitCountChange(1, 0);
		expect(received).toEqual([1]);
	});
});
