import { getShapes, shapes, type Pack } from "./shapes";
export type { Pack, ShapeDefinition } from "./shapes";

export interface PatternSettings {
	pack: Pack;
	rows: number;
	columns: number;
	grid: "regular" | "mixed";
	density: number;
	spacing: number;
	rotation: number;
	opacity: number;
	randomRotation: boolean;
	randomSpacing: boolean;
	multicolor: boolean;
	uniqueNeighbors: boolean;
	transparent: boolean;
}

export interface Tile {
	id: string;
	x: number;
	y: number;
	size: number;
	shapeId: string | null;
	colorIndex: number;
	partColors: number[];
	rotationFactor: number;
	spacingFactor: number;
	override?:
		{ kind: "palette"; index: number } | { kind: "custom"; color: string };
}

export interface PatternDocument {
	version: 1;
	seed: number;
	settings: PatternSettings;
	palette: { background: string; colors: string[] };
	tiles: Tile[];
}

export type Action =
	| { type: "settings"; patch: Partial<PatternSettings> }
	| { type: "refresh" }
	| { type: "palette"; palette: PatternDocument["palette"] }
	| { type: "tile"; id: string; patch: Partial<Tile> }
	| { type: "removeColor"; index: number }
	| { type: "reset" };

export const defaultSettings: PatternSettings = {
	pack: "Connected",
	rows: 3,
	columns: 4,
	grid: "regular",
	density: 100,
	spacing: 0,
	rotation: 0,
	opacity: 100,
	randomRotation: false,
	randomSpacing: false,
	multicolor: false,
	uniqueNeighbors: true,
	transparent: false,
};

export const palettes = [
	{
		name: "Ink",
		background: "#103BB9",
		colors: ["#FFFFFF", "#011341"],
	},
	{
		name: "Studio",
		background: "#F5F2EB",
		colors: ["#3459D1", "#E19372", "#263D38"],
	},
	{
		name: "Poolside",
		background: "#ecf7f4",
		colors: ["#126e82", "#45b5aa", "#f4a261", "#e76f51"],
	},
	{
		name: "Candy",
		background: "#fff0f5",
		colors: ["#eb5e9b", "#794bc4", "#f3bf46", "#68bfc1"],
	},
	{
		name: "Midnight",
		background: "#171b35",
		colors: ["#a8b4ff", "#f6c177", "#ec718e", "#75c9bd"],
	},
	{
		name: "Earth",
		background: "#eee5d5",
		colors: ["#a64b35", "#69764a", "#d19b55", "#463c36"],
	},
	{
		name: "Primary",
		background: "#fffdf6",
		colors: ["#ed3e38", "#2457b3", "#f4c430", "#242424"],
	},
	{
		name: "Lilac",
		background: "#f0ecfa",
		colors: ["#7356a6", "#b69acb", "#e58d87", "#4d7470"],
	},
	{
		name: "Monochrome",
		background: "#f5f5f3",
		colors: ["#202423", "#626866", "#929995", "#bec5c0"],
	},
];
export const defaultPalette = palettes[0];

function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let value = Math.imul(state ^ (state >>> 15), state | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function validateSettings(settings: PatternSettings): void {
	if (
		!Number.isInteger(settings.rows) ||
		!Number.isInteger(settings.columns) ||
		settings.rows < 2 ||
		settings.columns < 2 ||
		settings.rows > 12 ||
		settings.columns > 12
	) {
		throw new RangeError("Rows and columns must be integers from 2 to 12");
	}
	if (
		!getShapes(settings.pack).length ||
		!["regular", "mixed"].includes(settings.grid)
	) {
		throw new RangeError("Unknown pack or grid");
	}
	for (const [value, minimum] of [
		[settings.density, 5],
		[settings.opacity, 10],
	]) {
		if (!Number.isFinite(value) || value < minimum || value > 100)
			throw new RangeError("Density and opacity must be within their ranges");
	}
	if (settings.opacity % 5 !== 0)
		throw new RangeError("Opacity must use steps of 5");
	if (
		!Number.isFinite(settings.spacing) ||
		settings.spacing < 0 ||
		settings.spacing > 100
	)
		throw new RangeError("Spacing must be between 0 and 100");
	if (
		!Number.isFinite(settings.rotation) ||
		settings.rotation < 0 ||
		settings.rotation > 360
	)
		throw new RangeError("Rotation must be between 0 and 360");
}

export function generateTiles(
	settings: PatternSettings,
	seed: number,
	colorCount: number,
): Tile[] {
	validateSettings(settings);
	if (!Number.isFinite(seed)) throw new RangeError("Seed must be finite");
	if (!Number.isInteger(colorCount) || colorCount < 1 || colorCount > 6)
		throw new RangeError("Between one and six colors are required");
	const rand = random(seed);
	const motifs = getShapes(settings.pack);
	const width = settings.columns * 2;
	const height = settings.rows * 2;
	const cells = new Int32Array(width * height).fill(-1);
	const tiles: Tile[] = [];
	const reserved: string[] = [];
	const baseCount = settings.rows * settings.columns;
	const spans = new Float64Array(baseCount).fill(1);
	if (settings.grid === "mixed") {
		const shuffle = (items: number[]) => {
			for (let i = items.length - 1; i > 0; i--) {
				const j = Math.floor(rand() * (i + 1));
				[items[i], items[j]] = [items[j], items[i]];
			}
			return items;
		};
		const origins = Array.from({ length: baseCount }, (_, i) => i).filter(
			(i) =>
				i % settings.columns < settings.columns - 1 &&
				Math.floor(i / settings.columns) < settings.rows - 1,
		);
		let remaining = Math.floor(baseCount * 0.08);
		for (const origin of shuffle(origins)) {
			if (remaining === 0) break;
			const region = [
				origin,
				origin + 1,
				origin + settings.columns,
				origin + settings.columns + 1,
			];
			if (!region.every((i) => spans[i] === 1)) continue;
			for (const i of region) spans[i] = 0;
			spans[origin] = 2;
			remaining--;
		}
		const unmerged = Array.from({ length: baseCount }, (_, i) => i).filter(
			(i) => spans[i] === 1,
		);
		for (const i of shuffle(unmerged).slice(0, Math.floor(baseCount * 0.2)))
			spans[i] = 0.5;
	}
	// Half-cells give merged and subdivided tiles an exact shared-edge representation.
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (cells[y * width + x] !== -1) continue;
			const span =
				spans[Math.floor(y / 2) * settings.columns + Math.floor(x / 2)] * 2;
			const id = tiles.length;
			tiles.push({
				id: `tile-${x}-${y}`,
				x: x / 2,
				y: y / 2,
				size: span / 2,
				shapeId: null,
				colorIndex: 0,
				partColors: [],
				rotationFactor: rand(),
				spacingFactor: rand(),
			});
			for (let dy = 0; dy < span; dy++)
				for (let dx = 0; dx < span; dx++) cells[(y + dy) * width + x + dx] = id;
		}
	}
	// Assign larger tiles first so smaller tiles can avoid their shared-edge neighbors.
	for (const tile of [...tiles].sort((a, b) => b.size - a.size)) {
		const neighbors = new Set<string>();
		const x = tile.x * 2,
			y = tile.y * 2,
			span = tile.size * 2;
		for (let i = 0; i < span; i++) {
			const edges = [
				y > 0 ? (y - 1) * width + x + i : -1,
				y + span < height ? (y + span) * width + x + i : -1,
				x > 0 ? (y + i) * width + x - 1 : -1,
				x + span < width ? (y + i) * width + x + span : -1,
			];
			for (const index of edges)
				if (index >= 0 && reserved[cells[index]])
					neighbors.add(reserved[cells[index]]);
		}
		const diagonals = new Set<string>();
		if (settings.grid === "regular" && motifs.length > 4 && y > 0) {
			for (const dx of [-2, 2]) {
				if (x + dx >= 0 && x + dx < width) {
					const shapeId = reserved[cells[(y - 2) * width + x + dx]];
					if (shapeId) diagonals.add(shapeId);
				}
			}
		}
		const edgeCandidates = settings.uniqueNeighbors
			? motifs.filter((shape) => !neighbors.has(shape.id))
			: motifs;
		const candidates = settings.uniqueNeighbors
			? edgeCandidates.filter((shape) => !diagonals.has(shape.id))
			: motifs;
		const available = candidates.length
			? candidates
			: edgeCandidates.length
				? edgeCandidates
				: motifs;
		const shape = available[Math.floor(rand() * available.length)];
		reserved[cells[y * width + x]] = shape.id;
		tile.shapeId = rand() * 100 < settings.density ? shape.id : null;
		tile.colorIndex = Math.floor(rand() * colorCount);
		tile.partColors = shape.parts.map(() => Math.floor(rand() * colorCount));
	}
	return tiles;
}

export function createDocument(
	seed = Math.floor(Math.random() * 4294967296),
): PatternDocument {
	const settings = { ...defaultSettings };
	const palette = {
		background: defaultPalette.background,
		colors: [...defaultPalette.colors],
	};
	return {
		version: 1,
		seed,
		settings,
		palette,
		tiles: generateTiles(settings, seed, palette.colors.length),
	};
}

function remapTiles(tiles: Tile[], remap: (index: number) => number): Tile[] {
	return tiles.map((tile) => ({
		...tile,
		colorIndex: remap(tile.colorIndex),
		partColors: tile.partColors.map(remap),
		...(tile.override?.kind === "palette"
			? {
					override: {
						kind: "palette" as const,
						index: remap(tile.override.index),
					},
				}
			: {}),
	}));
}

export function removeColor(
	doc: PatternDocument,
	index: number,
): PatternDocument {
	if (
		!Number.isInteger(index) ||
		index < 0 ||
		index >= doc.palette.colors.length ||
		doc.palette.colors.length <= 1
	)
		return doc;
	const remap = (value: number) =>
		value === index ? 0 : value > index ? value - 1 : value;
	return {
		...doc,
		palette: {
			...doc.palette,
			colors: doc.palette.colors.filter((_, i) => i !== index),
		},
		tiles: remapTiles(doc.tiles, remap),
	};
}

export function reducer(doc: PatternDocument, action: Action): PatternDocument {
	switch (action.type) {
		case "settings": {
			const settings = { ...doc.settings, ...action.patch };
			validateSettings(settings);
			const regenerate = (
				[
					"pack",
					"rows",
					"columns",
					"grid",
					"density",
					"uniqueNeighbors",
				] as const
			).some((key) => settings[key] !== doc.settings[key]);
			return {
				...doc,
				settings,
				tiles: regenerate
					? generateTiles(settings, doc.seed, doc.palette.colors.length)
					: doc.tiles,
			};
		}
		case "refresh": {
			const seed = (doc.seed + 1) >>> 0;
			return {
				...doc,
				seed,
				tiles: generateTiles(doc.settings, seed, doc.palette.colors.length),
			};
		}
		case "palette": {
			if (action.palette.colors.length < 1 || action.palette.colors.length > 6)
				throw new RangeError("Between one and six colors are required");
			return {
				...doc,
				palette: {
					background: action.palette.background,
					colors: [...action.palette.colors],
				},
				tiles: remapTiles(
					doc.tiles,
					(index) => index % action.palette.colors.length,
				),
			};
		}
		case "tile":
			return {
				...doc,
				tiles: doc.tiles.map((tile) =>
					tile.id === action.id
						? {
								...tile,
								...action.patch,
								id: tile.id,
								partColors: action.patch.shapeId
									? Array.from(
											{
												length:
													shapes.find((s) => s.id === action.patch.shapeId)
														?.parts.length ?? 1,
											},
											(_, i) => tile.partColors[i] ?? tile.colorIndex,
										)
									: (action.patch.partColors ?? tile.partColors),
							}
						: tile,
				),
			};
		case "removeColor":
			return removeColor(doc, action.index);
		case "reset":
			return createDocument(doc.seed);
	}
}
