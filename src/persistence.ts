import { createDocument, type PatternDocument } from './core';
import { shapes } from './shapes';

export const STORAGE_KEY = 'form-study:draft';
const MAX_DRAFT_LENGTH = 1_000_000;
const hex = (value: unknown): value is string => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const object = (value: unknown): boolean => typeof value === 'object' && value !== null && !Array.isArray(value);
const range = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number => range(value, min, max) && Number.isInteger(value);

function check(valid: unknown): asserts valid {
  if (!valid) throw new Error('Invalid pattern document.');
}

export function parseDraft(raw: string): PatternDocument {
  check(typeof raw === 'string' && raw.length <= MAX_DRAFT_LENGTH);
  const doc = JSON.parse(raw) as PatternDocument;
  check(object(doc) && doc.version === 1 && integer(doc.seed, 0, 0xffffffff));
  check(object(doc.settings));
  const settings = doc.settings;
  check(['Basics', 'Arcs', 'Angular', 'Playful'].includes(settings.pack));
  check(integer(settings.rows, 1, 100) && integer(settings.columns, 1, 100));
  check(settings.grid === 'regular' || settings.grid === 'mixed');
  check(range(settings.density, 5, 100) && range(settings.spacing, 0, 100));
  check(range(settings.rotation, 0, 360) && range(settings.opacity, 10, 100) && settings.opacity % 5 === 0);
  for (const key of ['randomRotation', 'randomSpacing', 'multicolor', 'uniqueNeighbors', 'transparent'] as const) {
    check(typeof settings[key] === 'boolean');
  }
  check(object(doc.palette) && hex(doc.palette.background));
  check(Array.isArray(doc.palette.colors) && integer(doc.palette.colors.length, 1, 6) && doc.palette.colors.every(hex));
  check(Array.isArray(doc.tiles) && integer(doc.tiles.length, 1, 576));
  const validIndex = (index: unknown) => integer(index, 0, doc.palette.colors.length - 1);
  const width = settings.columns * 2;
  const height = settings.rows * 2;
  const cells = new Uint8Array(width * height);
  const ids = new Set<string>();
  for (const tile of doc.tiles) {
    check(object(tile));
    check(typeof tile.id === 'string' && tile.id.length > 0 && tile.id.length <= 128 && !ids.has(tile.id));
    ids.add(tile.id);
    check(range(tile.x, 0, settings.columns) && range(tile.y, 0, settings.rows));
    check([0.5, 1, 2].includes(tile.size));
    check(Number.isInteger(tile.x * 2) && Number.isInteger(tile.y * 2));
    check(tile.x + tile.size <= settings.columns && tile.y + tile.size <= settings.rows);
    if (settings.grid === 'regular') check(tile.size === 1 && Number.isInteger(tile.x) && Number.isInteger(tile.y));
    const shape = shapes.find(candidate => candidate.id === tile.shapeId);
    check(tile.shapeId === null || (shape && shape.pack === settings.pack));
    check(validIndex(tile.colorIndex));
    check(Array.isArray(tile.partColors) && tile.partColors.length <= 4 && tile.partColors.every(validIndex));
    if (shape) check(tile.partColors.length === shape.parts.length);
    check(range(tile.rotationFactor, 0, 1) && range(tile.spacingFactor, 0, 1));
    if (tile.override !== undefined) {
      check(object(tile.override));
      check(tile.override.kind === 'palette' ? validIndex(tile.override.index) : tile.override.kind === 'custom' && hex(tile.override.color));
    }
    for (let y = tile.y * 2; y < (tile.y + tile.size) * 2; y++) {
      for (let x = tile.x * 2; x < (tile.x + tile.size) * 2; x++) {
        const index = y * width + x;
        check(cells[index] === 0);
        cells[index] = 1;
      }
    }
  }
  check(cells.every(cell => cell === 1));
  return doc;
}

export function loadDraft(): { document: PatternDocument; notice: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { document: createDocument(), notice: 'No saved draft. Started a new pattern.' };
    try {
      return { document: parseDraft(raw), notice: '' };
    } catch {
      return { document: createDocument(), notice: 'Saved draft was invalid. Started a new pattern.' };
    }
  } catch {
    return { document: createDocument(), notice: 'Local storage is unavailable. Changes may not be saved.' };
  }
}

export function saveDraft(doc: PatternDocument): string {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return '';
  } catch {
    return 'Could not save draft. Local storage may be full or unavailable.';
  }
}
