import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createDocument,
	generateTiles,
	palettes,
	reducer,
	type PatternDocument,
} from "./core";
import { loadDraft, parseDraft, saveDraft, STORAGE_KEY } from "./persistence";

const serialized = (edit: (doc: PatternDocument) => void) => {
	const doc = createDocument(123);
	edit(doc);
	return JSON.stringify(doc);
};

afterEach(() => vi.unstubAllGlobals());

describe("draft validation", () => {
	it("preserves legacy concrete layouts and palettes without regeneration", () => {
		const doc = createDocument(123);
		doc.settings = {
			...doc.settings,
			pack: "Basics",
			rows: 6,
			columns: 6,
			grid: "mixed",
		};
		const studio = palettes.find((palette) => palette.name === "Studio")!;
		doc.palette = { background: studio.background, colors: [...studio.colors] };
		// A saved older layout can be much denser than the new mixed-layout target.
		doc.tiles = generateTiles(
			{ ...doc.settings, rows: 12, columns: 12, grid: "regular" },
			321,
			3,
		).map((tile) => ({ ...tile, x: tile.x / 2, y: tile.y / 2, size: 0.5 }));
		doc.tiles[0].override = { kind: "custom", color: "#123456" };
		const restored = parseDraft(JSON.stringify(doc));
		expect(restored).toEqual(doc);
		expect(
			reducer(restored, { type: "settings", patch: { spacing: 15 } }).tiles,
		).toBe(restored.tiles);
		expect(
			reducer(restored, { type: "palette", palette: palettes[0] }).tiles.map(
				({ x, y, size, shapeId }) => ({ x, y, size, shapeId }),
			),
		).toEqual(
			doc.tiles.map(({ x, y, size, shapeId }) => ({ x, y, size, shapeId })),
		);
		expect(reducer(restored, { type: "refresh" }).tiles).not.toEqual(doc.tiles);
	});

	it.each(["Connected", "Tonal"] as const)("roundtrips %s drafts", (pack) => {
		const doc = reducer(createDocument(987), {
			type: "settings",
			patch: { pack, grid: "mixed" },
		});
		expect(parseDraft(JSON.stringify(doc))).toEqual(doc);
	});

	it("roundtrips palette and custom overrides", () => {
		const doc = createDocument(123);
		doc.tiles[0].override = { kind: "palette", index: 1 };
		doc.tiles[1].override = { kind: "custom", color: "#aAbB00" };
		expect(parseDraft(JSON.stringify(doc))).toEqual(doc);
	});

	it.each(["", "not json", "null", "[]", "{}", " ".repeat(1_000_001)])(
		"rejects invalid raw input %#",
		(raw) => {
			expect(() => parseDraft(raw)).toThrow();
		},
	);

	it.each([
		(doc: PatternDocument) => {
			doc.version = 2 as 1;
		},
		(doc: PatternDocument) => {
			doc.settings.pack = "Unknown" as "Basics";
		},
		(doc: PatternDocument) => {
			doc.settings.rows = 1;
		},
		(doc: PatternDocument) => {
			doc.settings.rows = 13;
		},
		(doc: PatternDocument) => {
			doc.settings.columns = 1;
		},
		(doc: PatternDocument) => {
			doc.settings.columns = 13;
		},
		(doc: PatternDocument) => {
			doc.settings.density = 4;
		},
		(doc: PatternDocument) => {
			doc.settings.spacing = 101;
		},
		(doc: PatternDocument) => {
			doc.settings.rotation = -1;
		},
		(doc: PatternDocument) => {
			doc.settings.opacity = 12;
		},
		(doc: PatternDocument) => {
			doc.settings.randomSpacing = 1 as unknown as boolean;
		},
		(doc: PatternDocument) => {
			doc.palette.background = "red";
		},
		(doc: PatternDocument) => {
			doc.palette.colors = [];
		},
		(doc: PatternDocument) => {
			doc.palette.colors = Array(7).fill("#abcdef");
		},
		(doc: PatternDocument) => {
			doc.palette.colors[0] = "#fff";
		},
		(doc: PatternDocument) => {
			doc.tiles[0].colorIndex = 6;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].partColors[0] = -1;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].shapeId = "arcs-quarter";
		},
		(doc: PatternDocument) => {
			doc.tiles[0].override = { kind: "palette", index: 99 };
		},
		(doc: PatternDocument) => {
			doc.tiles[0].override = { kind: "custom", color: "url(evil)" };
		},
		(doc: PatternDocument) => {
			doc.tiles[0].rotationFactor = 2;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].spacingFactor = -1;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].x = -1;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].y = doc.settings.rows;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].size = 0;
		},
		(doc: PatternDocument) => {
			doc.tiles[0].x = 0.1;
		},
		(doc: PatternDocument) => {
			doc.tiles[1].id = doc.tiles[0].id;
		},
		(doc: PatternDocument) => {
			doc.tiles.push({ ...doc.tiles[0], id: "overlap" });
		},
		(doc: PatternDocument) => {
			doc.tiles.pop();
		},
		(doc: PatternDocument) => {
			doc.tiles = Array(577).fill(doc.tiles[0]);
		},
	])("rejects invalid document %#", (edit) => {
		expect(() => parseDraft(serialized(edit))).toThrow();
	});
});

describe("local storage", () => {
	it("loads and saves using the shared key", () => {
		const doc = createDocument(123);
		const storage = {
			getItem: vi.fn(() => JSON.stringify(doc)),
			setItem: vi.fn(),
		};
		vi.stubGlobal("localStorage", storage);
		expect(loadDraft()).toEqual({ document: doc, notice: "" });
		expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
		expect(saveDraft(doc)).toBe("");
		expect(storage.setItem).toHaveBeenCalledWith(
			STORAGE_KEY,
			JSON.stringify(doc),
		);
	});

	it.each([null, "{invalid"])(
		"falls back for missing or invalid drafts",
		(raw) => {
			vi.stubGlobal("localStorage", { getItem: () => raw });
			const result = loadDraft();
			expect(result.document.version).toBe(1);
			expect(result.notice).not.toBe("");
		},
	);

	it("handles unavailable storage", () => {
		vi.stubGlobal("localStorage", {
			getItem: () => {
				throw new Error("denied");
			},
		});
		expect(loadDraft().notice).toMatch(/unavailable/i);
		expect(saveDraft(createDocument(123))).not.toBe("");
	});

	it("handles full storage without throwing", () => {
		vi.stubGlobal("localStorage", {
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		});
		expect(saveDraft(createDocument(123))).toMatch(/full/i);
	});
});
