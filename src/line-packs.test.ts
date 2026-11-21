import { describe, expect, it } from "vitest";
import {
	createDocument,
	defaultSettings,
	generateTiles,
	reducer,
} from "./core";
import { getShapes, packs, shapes } from "./shapes";
import { parseDraft } from "./persistence";
import { cssForDocument, renderSvg, renderTileContent } from "./render";

const newPacks = ["Truchet", "Op Art"] as const;

function recommended(pack: (typeof newPacks)[number], seed = 42) {
	return reducer(
		reducer(createDocument(seed), { type: "settings", patch: { pack } }),
		{ type: "recommended" },
	);
}

describe("line pack data", () => {
	it("adds only the two complementary Truchet and six coordinated Op Art motifs", () => {
		expect(packs.slice(0, 4)).toEqual([
			"Connected",
			"Tonal",
			"Truchet",
			"Op Art",
		]);
		expect(new Set(shapes.map((shape) => shape.id)).size).toBe(shapes.length);
		expect(getShapes("Truchet").map((shape) => shape.id)).toEqual([
			"truchet-a",
			"truchet-b",
		]);
		expect(getShapes("Op Art")).toHaveLength(6);
		for (const pack of newPacks) {
			for (const shape of getShapes(pack)) {
				expect(shape.parts).toHaveLength(pack === "Truchet" ? 2 : 1);
				for (const part of shape.parts) {
					expect(part).toMatch(/^<path d="[MLhHvVAZ\d .-]+"/);
					expect(part).toContain('fill="currentColor"');
					expect(part).not.toMatch(/stroke|NaN|Infinity/);
				}
			}
		}
	});

	it("uses exact quarter-annulus radii and stripe intervals", () => {
		for (const [index, shape] of getShapes("Truchet").entries()) {
			for (const [partIndex, part] of shape.parts.entries()) {
				expect(part).toContain(
					'd="M58 0A58 58 0 0 1 0 58L0 42A42 42 0 0 0 42 0Z"',
				);
				expect(part).toContain(`rotate(${index * 90 + partIndex * 180} 50 50)`);
			}
		}
		const [horizontal, vertical, ...corners] = getShapes("Op Art");
		for (const start of [5, 25, 45, 65, 85]) {
			expect(horizontal.parts[0]).toContain(`M0 ${start}h100v10H0Z`);
			expect(vertical.parts[0]).toContain(`M${start} 0h10v100H${start}Z`);
			for (const corner of corners) {
				const outer = start + 10;
				expect(corner.parts[0]).toContain(
					`M${outer} 0A${outer} ${outer} 0 0 1 0 ${outer}L0 ${start}A${start} ${start} 0 0 0 ${start} 0Z`,
				);
			}
		}
	});
});

describe("recommended settings", () => {
	it.each(newPacks)(
		"selecting %s alone preserves palette and all other controls",
		(pack) => {
			const before = reducer(createDocument(123), {
				type: "settings",
				patch: {
					grid: "mixed",
					rows: 5,
					columns: 7,
					density: 67,
					spacing: 24,
					rotation: 37,
					opacity: 55,
					randomRotation: true,
					randomSpacing: true,
					multicolor: true,
					uniqueNeighbors: false,
					transparent: true,
				},
			});
			const selected = reducer(before, { type: "settings", patch: { pack } });
			expect(selected.settings).toEqual({ ...before.settings, pack });
			expect(selected.palette).toBe(before.palette);
			expect(selected.seed).toBe(before.seed);
			expect(selected.tiles).toEqual(
				generateTiles(
					selected.settings,
					before.seed,
					before.palette.colors.length,
				),
			);
		},
	);

	it.each(newPacks)(
		"applies the complete %s preset in one transition, preserving only seed and pack",
		(pack) => {
			let before = reducer(createDocument(987), {
				type: "settings",
				patch: {
					pack,
					grid: "mixed",
					rows: 5,
					columns: 7,
					density: 67,
					spacing: 24,
					rotation: 37,
					opacity: 55,
					randomRotation: true,
					randomSpacing: true,
					multicolor: true,
					uniqueNeighbors: pack === "Truchet",
					transparent: true,
				},
			});
			before = reducer(before, {
				type: "tile",
				id: before.tiles[0].id,
				patch: {
					shapeId: null,
					override: { kind: "custom", color: "#ff0000" },
				},
			});
			const snapshot = JSON.stringify(before);
			const after = reducer(before, { type: "recommended" });
			expect(JSON.stringify(before)).toBe(snapshot);
			expect(after.seed).toBe(987);
			expect(after.settings).toEqual({
				...defaultSettings,
				pack,
				rows: 8,
				columns: 8,
				uniqueNeighbors: pack === "Op Art",
			});
			expect(after.palette).toEqual({
				background: "#F5F5F3",
				colors: ["#202423"],
			});
			expect(after.tiles).toEqual(generateTiles(after.settings, 987, 1));
			expect(after.tiles).toHaveLength(64);
			expect(
				after.tiles.every((tile) => !tile.override && tile.shapeId !== null),
			).toBe(true);
			expect(parseDraft(JSON.stringify(after))).toEqual(after);
			expect(reducer(after, { type: "recommended" })).toEqual(after);
		},
	);

	it("does not apply a preset to any existing pack", () => {
		for (const pack of packs.filter(
			(pack) => pack !== "Truchet" && pack !== "Op Art",
		)) {
			const doc = reducer(createDocument(42), {
				type: "settings",
				patch: { pack },
			});
			expect(reducer(doc, { type: "recommended" })).toBe(doc);
		}
	});

	it("generates varied deterministic Truchet layouts instead of forced alternation", () => {
		const layouts = [];
		for (const seed of [42, 123, 987]) {
			const doc = recommended("Truchet", seed);
			expect(recommended("Truchet", seed)).toEqual(doc);
			expect(new Set(doc.tiles.map((tile) => tile.shapeId)).size).toBe(2);
			for (const axis of ["x", "y"] as const) {
				expect(
					doc.tiles.some((tile) =>
						doc.tiles.some(
							(other) =>
								other[axis] === tile[axis] + 1 &&
								other[axis === "x" ? "y" : "x"] ===
									tile[axis === "x" ? "y" : "x"] &&
								other.shapeId === tile.shapeId,
						),
					),
				).toBe(true);
			}
			layouts.push(JSON.stringify(doc.tiles.map((tile) => tile.shapeId)));
		}
		expect(new Set(layouts).size).toBe(3);
	});

	it.each(newPacks)(
		"retains %s appearance, refresh, clipping and shared export behavior",
		(pack) => {
			let doc = recommended(pack);
			doc = reducer(doc, {
				type: "tile",
				id: doc.tiles[0].id,
				patch: {
					override: { kind: "custom", color: "#abcdef" },
				},
			});
			const edited = reducer(doc, {
				type: "settings",
				patch: { spacing: 15, rotation: 37, multicolor: true, opacity: 50 },
			});
			expect(edited.tiles).toBe(doc.tiles);
			expect(renderTileContent(edited, edited.tiles[0])).toContain(
				'color="#abcdef"',
			);
			expect(renderTileContent(edited, edited.tiles[0])).toContain(
				"rotate(37) scale(0.88)",
			);
			expect(renderTileContent(edited, edited.tiles[0])).toContain(
				'clip-path="url(',
			);
			const cssSvg = decodeURIComponent(
				cssForDocument(edited).match(/data:image\/svg\+xml,([^"]+)/)![1],
			);
			expect(cssSvg).toBe(renderSvg(edited));
			expect(parseDraft(JSON.stringify(edited))).toEqual(edited);
			const fresh = reducer(edited, { type: "refresh" });
			expect(fresh.seed).toBe(43);
			expect(fresh.settings).toBe(edited.settings);
			expect(fresh.palette).toBe(edited.palette);
			expect(fresh.tiles).toEqual(generateTiles(fresh.settings, 43, 1));
			expect(fresh.tiles.every((tile) => !tile.override)).toBe(true);
			expect(fresh.tiles.map((tile) => tile.shapeId)).not.toEqual(
				edited.tiles.map((tile) => tile.shapeId),
			);
		},
	);
});
