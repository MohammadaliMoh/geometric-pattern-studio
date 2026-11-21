import { describe, expect, it, vi } from "vitest";
import {
	createDocument,
	defaultSettings,
	generateTiles,
	reducer,
} from "./core";
import * as library from "./shapes";
import { renderTileContent } from "./render";
import { parseDraft } from "./persistence";

describe("geometric generation", () => {
	it("uses restrained mixed-size targets across odd and even dimensions", () => {
		let hasOddMergeOrigin = false;
		for (let rows = 2; rows <= 12; rows++) {
			for (let columns = 2; columns <= 12; columns++) {
				for (const seed of [42, 123, 987]) {
					const settings = {
						...defaultSettings,
						rows,
						columns,
						grid: "mixed" as const,
					};
					const tiles = generateTiles(settings, seed, 2);
					expect(generateTiles(settings, seed, 2)).toEqual(tiles);
					const large = tiles.filter((tile) => tile.size === 2);
					const small = tiles.filter((tile) => tile.size === 0.5);
					const normal = tiles.filter((tile) => tile.size === 1);
					const base = rows * columns;
					expect(large.length).toBeLessThanOrEqual(Math.floor(base * 0.08));
					expect(small.length).toBe(
						Math.min(Math.floor(base * 0.2), base - large.length * 4) * 4,
					);
					expect(normal.length).toBe(
						base - large.length * 4 - small.length / 4,
					);
					hasOddMergeOrigin ||= large.some(
						(tile) => tile.x % 2 === 1 || tile.y % 2 === 1,
					);
					// The persistence validator independently verifies exact coverage and no overlaps.
					const doc = { ...createDocument(seed), settings, tiles };
					expect(parseDraft(JSON.stringify(doc))).toEqual(doc);
					if (large.length < Math.floor(base * 0.08)) {
						for (let y = 0; y < rows - 1; y++)
							for (let x = 0; x < columns - 1; x++)
								expect(
									large.some(
										(tile) =>
											tile.x < x + 2 &&
											tile.x + 2 > x &&
											tile.y < y + 2 &&
											tile.y + 2 > y,
									),
								).toBe(true);
					}
					if (rows === 3 && columns === 4) {
						expect([large.length, normal.length, small.length]).toEqual([
							0, 10, 8,
						]);
					}
				}
			}
		}
		expect(hasOddMergeOrigin).toBe(true);
	});

	it("avoids regular-grid edge neighbors and diagonals when the pack has enough motifs", () => {
		for (const pack of library.packs) {
			for (const seed of [42, 123, 987]) {
				const settings = { ...defaultSettings, pack, rows: 12, columns: 12 };
				const tiles = generateTiles(settings, seed, 2);
				for (const tile of tiles) {
					for (const other of tiles) {
						if (
							other !== tile &&
							Math.abs(other.x - tile.x) <= 1 &&
							Math.abs(other.y - tile.y) <= 1 &&
							(library.getShapes(pack).length > 4 ||
								other.x === tile.x ||
								other.y === tile.y)
						)
							expect(tile.shapeId).not.toBe(other.shapeId);
					}
				}
				const sparse = generateTiles({ ...settings, density: 5 }, seed, 2);
				expect(sparse.map((tile) => ({ ...tile, shapeId: null }))).toEqual(
					tiles.map((tile) => ({ ...tile, shapeId: null })),
				);
				for (let i = 0; i < tiles.length; i++)
					expect(
						sparse[i].shapeId === null ||
							sparse[i].shapeId === tiles[i].shapeId,
					).toBe(true);
			}
		}
	});

	it("relaxes exhausted neighbor constraints without retry loops", () => {
		const motifs = library.getShapes("Connected");
		const spy = vi.spyOn(library, "getShapes");
		try {
			for (const count of [1, 2, 5]) {
				spy.mockReturnValue(motifs.slice(0, count));
				const tiles = generateTiles(
					{ ...defaultSettings, rows: 12, columns: 12 },
					42,
					2,
				);
				expect(tiles).toHaveLength(144);
				expect(
					tiles.every((tile) =>
						motifs.slice(0, count).some((shape) => shape.id === tile.shapeId),
					),
				).toBe(true);
			}
		} finally {
			spy.mockRestore();
		}
	});
});

describe("geometric rendering", () => {
	it("preserves intrinsic tonal opacity with one color, multicolor, and overrides", () => {
		let doc = reducer(createDocument(42), {
			type: "settings",
			patch: { pack: "Tonal", opacity: 50 },
		});
		doc = reducer(doc, {
			type: "palette",
			palette: { background: "#103BB9", colors: ["#FFFFFF"] },
		});
		for (const shape of library.getShapes("Tonal")) {
			const tile = {
				...doc.tiles[0],
				shapeId: shape.id,
				colorIndex: 0,
				partColors: [0, 0, 0, 0],
			};
			for (const multicolor of [false, true]) {
				doc.settings.multicolor = multicolor;
				for (const override of [
					undefined,
					{ kind: "custom" as const, color: "#abcdef" },
				]) {
					const content = renderTileContent(doc, { ...tile, override });
					for (const opacity of [1, 0.6, 0.4, 0.2, 0.5])
						expect(content).toContain(`opacity="${opacity}"`);
					expect(
						content.match(
							new RegExp(`color="${override?.color ?? "#FFFFFF"}"`, "g"),
						),
					).toHaveLength(4);
				}
			}
		}
	});

	it("fits new geometry at arbitrary angles, normalizes full turns, and retains legacy transforms", () => {
		const doc = createDocument(42);
		for (const pack of ["Connected", "Tonal"] as const) {
			const tile = {
				...doc.tiles[0],
				shapeId: library.getShapes(pack)[0].id,
				rotationFactor: 0.1234,
			};
			doc.settings.rotation = 0;
			const unrotated = renderTileContent(doc, tile);
			doc.settings.rotation = 360;
			expect(renderTileContent(doc, tile)).toBe(unrotated);
			for (const angle of [1, 37, 45, 90, 180, 359]) {
				doc.settings.rotation = angle;
				expect(renderTileContent(doc, tile)).toContain(
					`rotate(${angle}) scale(0.7)`,
				);
				const radians = (angle * Math.PI) / 180;
				expect(
					0.7 * (Math.abs(Math.cos(radians)) + Math.abs(Math.sin(radians))),
				).toBeLessThan(1);
			}
			doc.settings.randomRotation = true;
			expect(renderTileContent(doc, tile)).toContain("rotate(44) scale(0.7)");
			doc.settings.spacing = 25;
			expect(renderTileContent(doc, tile)).toContain(`scale(${0.8 * 0.7})`);
			doc.settings.spacing = 0;
			doc.settings.randomRotation = false;
		}
		const legacy = {
			...doc.tiles[0],
			shapeId: "basics-disc",
			rotationFactor: 0.1234,
		};
		doc.settings.rotation = 360;
		expect(renderTileContent(doc, legacy)).toContain("rotate(360) scale(1)");
		doc.settings.randomRotation = true;
		expect(renderTileContent(doc, legacy)).toContain(
			`rotate(${0.1234 * 360}) scale(1)`,
		);
	});
});
