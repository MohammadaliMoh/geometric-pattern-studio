import { getShapes, type Pack } from './shapes';
export type { Pack, ShapeDefinition } from './shapes';

export interface PatternSettings {
  pack: Pack;
  rows: number;
  columns: number;
  grid: 'regular' | 'mixed';
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
  override?: { kind: 'palette'; index: number } | { kind: 'custom'; color: string };
}

export interface PatternDocument {
  version: 1;
  seed: number;
  settings: PatternSettings;
  palette: { background: string; colors: string[] };
  tiles: Tile[];
}

export type Action =
  | { type: 'settings'; patch: Partial<PatternSettings> }
  | { type: 'refresh' }
  | { type: 'palette'; palette: PatternDocument['palette'] }
  | { type: 'tile'; id: string; patch: Partial<Tile> }
  | { type: 'removeColor'; index: number }
  | { type: 'reset' };

export const defaultSettings: PatternSettings = {
  pack: 'Basics', rows: 8, columns: 8, grid: 'mixed', density: 85,
  spacing: 8, rotation: 0, opacity: 100, randomRotation: false,
  randomSpacing: false, multicolor: false, uniqueNeighbors: true, transparent: false,
};

export const palettes = [
  { name: 'Studio', background: '#f5f0e8', colors: ['#ef6548', '#283d3b', '#e8b44f', '#788c73'] },
  { name: 'Poolside', background: '#ecf7f4', colors: ['#126e82', '#45b5aa', '#f4a261', '#e76f51'] },
  { name: 'Candy', background: '#fff0f5', colors: ['#eb5e9b', '#794bc4', '#f3bf46', '#68bfc1'] },
  { name: 'Midnight', background: '#171b35', colors: ['#a8b4ff', '#f6c177', '#ec718e', '#75c9bd'] },
  { name: 'Earth', background: '#eee5d5', colors: ['#a64b35', '#69764a', '#d19b55', '#463c36'] },
  { name: 'Primary', background: '#fffdf6', colors: ['#ed3e38', '#2457b3', '#f4c430', '#242424'] },
  { name: 'Lilac', background: '#f0ecfa', colors: ['#7356a6', '#b69acb', '#e58d87', '#4d7470'] },
  { name: 'Monochrome', background: '#f5f5f3', colors: ['#202423', '#626866', '#929995', '#bec5c0'] },
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
  if (!Number.isInteger(settings.rows) || !Number.isInteger(settings.columns) ||
      settings.rows < 1 || settings.columns < 1 || settings.rows > 100 || settings.columns > 100) {
    throw new RangeError('Rows and columns must be integers from 1 to 100');
  }
  if (!getShapes(settings.pack).length || !['regular', 'mixed'].includes(settings.grid)) {
    throw new RangeError('Unknown pack or grid');
  }
  for (const value of [settings.density, settings.spacing, settings.opacity]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError('Percentages must be between 0 and 100');
  }
  if (!Number.isFinite(settings.rotation)) throw new RangeError('Rotation must be finite');
}

export function generateTiles(settings: PatternSettings, seed: number, colorCount: number): Tile[] {
  validateSettings(settings);
  if (!Number.isFinite(seed)) throw new RangeError('Seed must be finite');
  if (!Number.isInteger(colorCount) || colorCount < 1) throw new RangeError('At least one color is required');
  const rand = random(seed);
  const motifs = getShapes(settings.pack);
  const width = settings.columns * 2;
  const height = settings.rows * 2;
  const cells = new Int32Array(width * height).fill(-1);
  const tiles: Tile[] = [];
  const reserved: string[] = [];
  // Scan half-cells so every placement has an exact, shared edge representation.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[y * width + x] !== -1) continue;
      const fits = (size: number) => x + size <= width && y + size <= height &&
        Array.from({ length: size * size }, (_, i) => cells[(y + Math.floor(i / size)) * width + x + i % size]).every(id => id === -1);
      let span = 2;
      if (settings.grid === 'mixed') {
        const choice = rand();
        span = choice < 0.23 && x % 4 === 0 && y % 4 === 0 && fits(4) ? 4
          : choice < 0.46 || x % 2 !== 0 || y % 2 !== 0 || !fits(2) ? 1 : 2;
      }
      const id = tiles.length;
      tiles.push({
        id: `tile-${x}-${y}`, x: x / 2, y: y / 2, size: span / 2,
        shapeId: null, colorIndex: 0, partColors: [],
        rotationFactor: rand(), spacingFactor: rand(),
      });
      for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) cells[(y + dy) * width + x + dx] = id;
    }
  }
  // Largest first: aligned squares have at most four already-colored edge neighbors.
  for (const tile of [...tiles].sort((a, b) => b.size - a.size)) {
    const neighbors = new Set<string>();
    const x = tile.x * 2, y = tile.y * 2, span = tile.size * 2;
    for (let i = 0; i < span; i++) {
      const edges = [
        y > 0 ? (y - 1) * width + x + i : -1,
        y + span < height ? (y + span) * width + x + i : -1,
        x > 0 ? (y + i) * width + x - 1 : -1,
        x + span < width ? (y + i) * width + x + span : -1,
      ];
      for (const index of edges) if (index >= 0 && reserved[cells[index]]) neighbors.add(reserved[cells[index]]);
    }
    const candidates = settings.uniqueNeighbors ? motifs.filter(shape => !neighbors.has(shape.id)) : motifs;
    const shape = candidates[Math.floor(rand() * candidates.length)];
    reserved[cells[y * width + x]] = shape.id;
    tile.shapeId = rand() * 100 < settings.density ? shape.id : null;
    tile.colorIndex = Math.floor(rand() * colorCount);
    tile.partColors = shape.parts.map(() => Math.floor(rand() * colorCount));
  }
  return tiles;
}

export function createDocument(seed = Math.floor(Math.random() * 4294967296)): PatternDocument {
  const settings = { ...defaultSettings };
  const palette = { background: defaultPalette.background, colors: [...defaultPalette.colors] };
  return { version: 1, seed, settings, palette, tiles: generateTiles(settings, seed, palette.colors.length) };
}

function remapTiles(tiles: Tile[], remap: (index: number) => number): Tile[] {
  return tiles.map(tile => ({ ...tile, colorIndex: remap(tile.colorIndex), partColors: tile.partColors.map(remap),
    ...(tile.override?.kind === 'palette' ? { override: { kind: 'palette' as const, index: remap(tile.override.index) } } : {}),
  }));
}

export function removeColor(doc: PatternDocument, index: number): PatternDocument {
  if (!Number.isInteger(index) || index < 0 || index >= doc.palette.colors.length || doc.palette.colors.length <= 1) return doc;
  const remap = (value: number) => value === index ? 0 : value > index ? value - 1 : value;
  return { ...doc, palette: { ...doc.palette, colors: doc.palette.colors.filter((_, i) => i !== index) }, tiles: remapTiles(doc.tiles, remap) };
}

export function reducer(doc: PatternDocument, action: Action): PatternDocument {
  switch (action.type) {
    case 'settings': {
      const settings = { ...doc.settings, ...action.patch };
      validateSettings(settings);
      const regenerate = (['pack', 'rows', 'columns', 'grid', 'density', 'uniqueNeighbors'] as const).some(key => settings[key] !== doc.settings[key]);
      return { ...doc, settings, tiles: regenerate ? generateTiles(settings, doc.seed, doc.palette.colors.length) : doc.tiles };
    }
    case 'refresh': {
      const seed = (doc.seed + 1) >>> 0;
      return { ...doc, seed, tiles: generateTiles(doc.settings, seed, doc.palette.colors.length) };
    }
    case 'palette': {
      if (!action.palette.colors.length) throw new RangeError('At least one color is required');
      return { ...doc, palette: { background: action.palette.background, colors: [...action.palette.colors] },
        tiles: remapTiles(doc.tiles, index => index % action.palette.colors.length) };
    }
    case 'tile': return { ...doc, tiles: doc.tiles.map(tile => tile.id === action.id ? { ...tile, ...action.patch, id: tile.id } : tile) };
    case 'removeColor': return removeColor(doc, action.index);
    case 'reset': return createDocument(doc.seed);
  }
}
