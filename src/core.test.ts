import { describe, expect, it } from "vitest";
import {
	createDocument,
	defaultSettings,
	generateTiles,
	palettes,
	reducer,
	removeColor,
	type Tile,
} from "./core";
import { getShapes, packs, shapes } from "./shapes";
import {
	cssForDocument,
	pngDimensions,
	renderSvg,
	renderTileContent,
} from "./render";

function adjacent(a: Tile, b: Tile): boolean {
	return (
		((a.x + a.size === b.x || b.x + b.size === a.x) &&
			Math.max(a.y, b.y) < Math.min(a.y + a.size, b.y + b.size)) ||
		((a.y + a.size === b.y || b.y + b.size === a.y) &&
			Math.max(a.x, b.x) < Math.min(a.x + a.size, b.x + b.size))
	);
}

describe("pattern core", () => {
	it("provides unique stable motifs and valid pack references", () => {
		expect(new Set(palettes.map((palette) => palette.name)).size).toBe(
			palettes.length,
		);
		expect(new Set(shapes.map((shape) => shape.id)).size).toBe(shapes.length);
		expect(packs.slice(0, 2)).toEqual(["Connected", "Tonal"]);
		for (const pack of packs) {
			expect(getShapes(pack)).toHaveLength(
				pack === "Connected" ? 18 : pack === "Tonal" ? 12 : 8,
			);
		}
		for (const shape of shapes) expect(packs).toContain(shape.pack);
		for (const shape of shapes)
			for (const part of shape.parts)
				expect(part).toContain('fill="currentColor"');
	});

	it("normalizes part colors when replacing a motif and allows intermediate density", () => {
		const doc = createDocument(42);
		const edited = reducer(doc, {
			type: "tile",
			id: doc.tiles[0].id,
			patch: { shapeId: "basics-duo" },
		});
		expect(edited.tiles[0].partColors).toHaveLength(2);
		expect(() =>
			reducer(doc, { type: "settings", patch: { density: 67 } }),
		).not.toThrow();
	});

	it("is deterministic and retains factors across appearance edits", () => {
		const doc = createDocument(42);
		expect(createDocument(42)).toEqual(doc);
		expect(doc.settings).toMatchObject({
			pack: "Connected",
			rows: 3,
			columns: 4,
			grid: "regular",
			randomRotation: false,
			randomSpacing: false,
			multicolor: false,
			uniqueNeighbors: true,
			density: 100,
			spacing: 0,
			opacity: 100,
			rotation: 0,
		});
		expect(doc.palette).toEqual({
			background: "#103BB9",
			colors: ["#FFFFFF", "#011341"],
		});
		const refreshed = reducer(doc, { type: "refresh" });
		expect(reducer(refreshed, { type: "reset" })).toEqual(
			createDocument(refreshed.seed),
		);
		const edited = reducer(doc, {
			type: "settings",
			patch: {
				spacing: 22,
				rotation: 45,
				multicolor: true,
				randomSpacing: true,
				opacity: 40,
			},
		});
		expect(edited.tiles).toBe(doc.tiles);
		expect(reducer(doc, { type: "refresh" }).tiles).not.toEqual(doc.tiles);
		expect(reducer(edited, { type: "reset" })).toEqual(doc);
		expect(
			reducer(doc, { type: "settings", patch: { columns: 3 } }).tiles,
		).not.toEqual(doc.tiles);
	});

	it("covers odd grids without gaps, overlaps, or matching edge neighbors", () => {
		for (const grid of ["regular", "mixed"] as const)
			for (let seed = 0; seed < 50; seed++) {
				const settings = {
					...defaultSettings,
					grid,
					rows: 5,
					columns: 7,
					density: 100,
				};
				const tiles = generateTiles(settings, seed, 4);
				const cells = new Set<string>();
				for (const tile of tiles) {
					expect(tile.x).toBeGreaterThanOrEqual(0);
					expect(tile.y).toBeGreaterThanOrEqual(0);
					expect(tile.x + tile.size).toBeLessThanOrEqual(7);
					expect(tile.y + tile.size).toBeLessThanOrEqual(5);
					for (let y = tile.y * 2; y < (tile.y + tile.size) * 2; y++) {
						for (let x = tile.x * 2; x < (tile.x + tile.size) * 2; x++) {
							const key = `${x},${y}`;
							expect(cells.has(key)).toBe(false);
							cells.add(key);
						}
					}
					for (const other of tiles)
						if (adjacent(tile, other))
							expect(tile.shapeId).not.toBe(other.shapeId);
				}
				expect(cells.size).toBe(7 * 5 * 4);
			}
	});

	it("reserves neighbors even for empty tiles, keeping density independent of layout", () => {
		const settings = {
			...defaultSettings,
			rows: 5,
			columns: 7,
			grid: "mixed" as const,
		};
		const full = generateTiles({ ...settings, density: 100 }, 15, 4);
		const sparse = generateTiles({ ...settings, density: 45 }, 15, 4);
		const empty = generateTiles({ ...settings, density: 5 }, 15, 4);
		expect(empty.some((tile) => tile.shapeId === null)).toBe(true);
		expect(sparse.some((tile) => tile.shapeId === null)).toBe(true);
		expect(full.some((tile) => tile.size === 2)).toBe(true);
		expect(full.some((tile) => tile.size === 0.5)).toBe(true);
		expect(sparse.map((tile) => ({ ...tile, shapeId: null }))).toEqual(
			empty.map((tile) => ({ ...tile, shapeId: null })),
		);
		for (let i = 0; i < full.length; i++) {
			expect(
				sparse[i].shapeId === null || sparse[i].shapeId === full[i].shapeId,
			).toBe(true);
		}
	});

	it("remaps every palette reference and preserves custom overrides", () => {
		let doc = reducer(createDocument(42), {
			type: "palette",
			palette: palettes.find((palette) => palette.name === "Poolside")!,
		});
		doc = reducer(doc, {
			type: "tile",
			id: doc.tiles[0].id,
			patch: {
				colorIndex: 2,
				partColors: [0, 1, 2, 3],
				override: { kind: "palette", index: 2 },
			},
		});
		doc = reducer(doc, {
			type: "tile",
			id: doc.tiles[1].id,
			patch: { override: { kind: "custom", color: "#abcdef" } },
		});
		const next = removeColor(doc, 1);
		expect(next.tiles[0]).toMatchObject({
			colorIndex: 1,
			partColors: [0, 0, 1, 2],
			override: { kind: "palette", index: 1 },
		});
		expect(next.tiles[1].override).toEqual({
			kind: "custom",
			color: "#abcdef",
		});
		expect(doc.palette.colors).toHaveLength(4);
		const single = reducer(doc, {
			type: "palette",
			palette: { background: "#fff", colors: ["#111"] },
		});
		expect(single.tiles[0]).toMatchObject({
			colorIndex: 0,
			partColors: [0, 0, 0, 0],
			override: { kind: "palette", index: 0 },
		});
		expect(removeColor(single, 0)).toBe(single);
		expect(removeColor(doc, -1)).toBe(doc);
	});

	it("rejects invalid settings", () => {
		expect(() =>
			generateTiles({ ...defaultSettings, rows: 0 }, 1, 4),
		).toThrow();
		expect(() => generateTiles(defaultSettings, 1, 0)).toThrow();
		expect(() => generateTiles(defaultSettings, 1, 7)).toThrow();
		for (const patch of [
			{ rows: 1 },
			{ columns: 13 },
			{ density: 0 },
			{ opacity: 5 },
			{ opacity: 11 },
			{ rotation: -1 },
			{ rotation: 361 },
			{ spacing: 101 },
		]) {
			expect(() =>
				generateTiles({ ...defaultSettings, ...patch }, 1, 3),
			).toThrow();
		}
		expect(() =>
			reducer(createDocument(1), {
				type: "palette",
				palette: { background: "#fff", colors: Array(7).fill("#000") },
			}),
		).toThrow();
		expect(() =>
			generateTiles(
				{
					...defaultSettings,
					rows: 2,
					columns: 12,
					density: 5,
					opacity: 10,
					rotation: 360,
					spacing: 100,
				},
				1,
				6,
			),
		).not.toThrow();
		expect(() =>
			generateTiles({ ...defaultSettings, opacity: NaN }, 1, 4),
		).toThrow();
	});
});

describe("exports", () => {
	it("renders clipped, transformed, multicolor parts and single-color overrides", () => {
		let doc = createDocument(1);
		doc = reducer(doc, {
			type: "settings",
			patch: { multicolor: true, opacity: 50, spacing: 10, rotation: 20 },
		});
		const tile: Tile = {
			...doc.tiles[0],
			shapeId: "basics-duo",
			partColors: [0, 1],
			override: { kind: "custom", color: "#123456" },
		};
		const content = renderTileContent(doc, tile);
		expect(content).toContain("<clipPath");
		expect(content).toContain('opacity="0.5"');
		expect(content).toContain("rotate(20)");
		expect(content.match(/color="#123456"/g)).toHaveLength(2);
		expect(content).not.toContain("<svg");
		expect(renderTileContent(doc, { ...tile, shapeId: null })).toBe("");
		const svg = renderSvg(doc);
		expect(svg).toContain('viewBox="0 0 400 300"');
		expect(svg).toContain(doc.palette.background);
		const transparent = {
			...doc,
			settings: { ...doc.settings, transparent: true },
		};
		expect(renderSvg(transparent)).not.toContain(
			`fill="${doc.palette.background}"`,
		);
		const css = cssForDocument(doc);
		expect(css).toMatch(/^\.pattern \{\n[\s\S]*\n\}$/);
		expect(css).toContain("background-repeat: repeat");
		expect(
			decodeURIComponent(css.split("data:image/svg+xml,")[1].split('"')[0]),
		).toBe(svg);
		expect(
			renderTileContent(doc, {
				...tile,
				override: { kind: "custom", color: '"><script>alert(1)</script>' },
			}),
		).not.toContain("<script>");
	});

	it("keeps maximum-spacing motifs visible and random factors override uniform rotation", () => {
		const doc = createDocument(1);
		const tile = {
			...doc.tiles[0],
			shapeId: "basics-disc",
			rotationFactor: 0.125,
			spacingFactor: 0.5,
		};
		doc.settings.spacing = 100;
		doc.settings.rotation = 90;
		let content = renderTileContent(doc, tile);
		const scale = Number(content.match(/scale\(([^)]+)\)/)![1]);
		expect(scale).toBeCloseTo(0.2);
		expect(content).toContain("rotate(90)");
		doc.settings.randomRotation = true;
		doc.settings.randomSpacing = true;
		content = renderTileContent(doc, tile);
		expect(content).toContain("rotate(45)");
		expect(content).toContain("scale(0.6)");
		doc.settings.rotation = 180;
		expect(renderTileContent(doc, tile)).toBe(content);
	});

	it("calculates PNG aspect ratio and enforces bounds and pixel limit", () => {
		const doc = createDocument(1);
		expect(pngDimensions(1000, doc)).toEqual({ width: 1000, height: 750 });
		doc.settings.rows = 2;
		expect(pngDimensions(1000, doc)).toEqual({ width: 1000, height: 500 });
		for (const width of [99, 4097, NaN, 200.5])
			expect(() => pngDimensions(width, doc)).toThrow();
		doc.settings.rows = 6;
		expect(() => pngDimensions(4096, doc)).toThrow(/megapixels/);
		doc.settings.columns = 0;
		expect(() => pngDimensions(100, doc)).toThrow();
	});
});
