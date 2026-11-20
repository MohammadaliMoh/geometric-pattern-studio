import { describe, expect, it } from 'vitest';
import { createDocument, defaultSettings, generateTiles, palettes, reducer, removeColor, type Tile } from './core';
import { getShapes, packs, shapes } from './shapes';
import { cssForDocument, pngDimensions, renderSvg, renderTileContent } from './render';

function adjacent(a: Tile, b: Tile): boolean {
  return ((a.x + a.size === b.x || b.x + b.size === a.x) && Math.max(a.y, b.y) < Math.min(a.y + a.size, b.y + b.size)) ||
    ((a.y + a.size === b.y || b.y + b.size === a.y) && Math.max(a.x, b.x) < Math.min(a.x + a.size, b.x + b.size));
}

describe('pattern core', () => {
  it('provides eight original motifs per pack and eight palettes', () => {
    expect(palettes).toHaveLength(8);
    expect(new Set(shapes.map(shape => shape.id)).size).toBe(32);
    for (const pack of packs) expect(getShapes(pack)).toHaveLength(8);
    for (const shape of shapes) for (const part of shape.parts) expect(part).toContain('fill="currentColor"');
  });

  it('is deterministic and retains factors across appearance edits', () => {
    const doc = createDocument(42);
    expect(createDocument(42)).toEqual(doc);
    const edited = reducer(doc, { type: 'settings', patch: { spacing: 22, rotation: 45, multicolor: true, randomSpacing: true, opacity: 40 } });
    expect(edited.tiles).toBe(doc.tiles);
    expect(reducer(doc, { type: 'refresh' }).tiles).not.toEqual(doc.tiles);
    expect(reducer(edited, { type: 'reset' })).toEqual(doc);
    expect(reducer(doc, { type: 'settings', patch: { columns: 3 } }).tiles).not.toEqual(doc.tiles);
  });

  it('covers odd grids without gaps, overlaps, or matching edge neighbors', () => {
    for (const grid of ['regular', 'mixed'] as const) for (let seed = 0; seed < 50; seed++) {
      const settings = { ...defaultSettings, grid, rows: 5, columns: 7, density: 100 };
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
        for (const other of tiles) if (adjacent(tile, other)) expect(tile.shapeId).not.toBe(other.shapeId);
      }
      expect(cells.size).toBe(7 * 5 * 4);
    }
  });

  it('reserves neighbors even for empty tiles, keeping density independent of layout', () => {
    const full = generateTiles({ ...defaultSettings, density: 100 }, 15, 4);
    const sparse = generateTiles({ ...defaultSettings, density: 45 }, 15, 4);
    const empty = generateTiles({ ...defaultSettings, density: 0 }, 15, 4);
    expect(empty.every(tile => tile.shapeId === null)).toBe(true);
    expect(sparse.some(tile => tile.shapeId === null)).toBe(true);
    expect(full.some(tile => tile.size === 2)).toBe(true);
    expect(full.some(tile => tile.size === 0.5)).toBe(true);
    expect(sparse.map(tile => ({ ...tile, shapeId: null }))).toEqual(empty);
    for (let i = 0; i < full.length; i++) {
      expect(sparse[i].shapeId === null || sparse[i].shapeId === full[i].shapeId).toBe(true);
    }
  });

  it('remaps every palette reference and preserves custom overrides', () => {
    let doc = createDocument(42);
    doc = reducer(doc, { type: 'tile', id: doc.tiles[0].id, patch: { colorIndex: 2, partColors: [0, 1, 2, 3], override: { kind: 'palette', index: 2 } } });
    doc = reducer(doc, { type: 'tile', id: doc.tiles[1].id, patch: { override: { kind: 'custom', color: '#abcdef' } } });
    const next = removeColor(doc, 1);
    expect(next.tiles[0]).toMatchObject({ colorIndex: 1, partColors: [0, 0, 1, 2], override: { kind: 'palette', index: 1 } });
    expect(next.tiles[1].override).toEqual({ kind: 'custom', color: '#abcdef' });
    expect(doc.palette.colors).toHaveLength(4);
    const single = reducer(doc, { type: 'palette', palette: { background: '#fff', colors: ['#111'] } });
    expect(single.tiles[0]).toMatchObject({ colorIndex: 0, partColors: [0, 0, 0, 0], override: { kind: 'palette', index: 0 } });
    expect(removeColor(single, 0)).toBe(single);
    expect(removeColor(doc, -1)).toBe(doc);
  });

  it('rejects invalid settings', () => {
    expect(() => generateTiles({ ...defaultSettings, rows: 0 }, 1, 4)).toThrow();
    expect(() => generateTiles(defaultSettings, 1, 0)).toThrow();
    expect(() => generateTiles({ ...defaultSettings, opacity: NaN }, 1, 4)).toThrow();
  });
});

describe('exports', () => {
  it('renders clipped, transformed, multicolor parts and single-color overrides', () => {
    let doc = createDocument(1);
    doc = reducer(doc, { type: 'settings', patch: { multicolor: true, opacity: 50, spacing: 10, rotation: 20 } });
    const tile: Tile = { ...doc.tiles[0], shapeId: 'basics-duo', partColors: [0, 1], override: { kind: 'custom', color: '#123456' } };
    const content = renderTileContent(doc, tile);
    expect(content).toContain('<clipPath');
    expect(content).toContain('opacity="0.5"');
    expect(content).toContain('rotate(20)');
    expect(content.match(/color="#123456"/g)).toHaveLength(2);
    expect(content).not.toContain('<svg');
    expect(renderTileContent(doc, { ...tile, shapeId: null })).toBe('');
    const svg = renderSvg(doc);
    expect(svg).toContain('viewBox="0 0 800 800"');
    expect(svg).toContain(doc.palette.background);
    const transparent = { ...doc, settings: { ...doc.settings, transparent: true } };
    expect(renderSvg(transparent)).not.toContain(`fill="${doc.palette.background}"`);
    const css = cssForDocument(doc);
    expect(css).toContain('background-repeat: repeat');
    expect(decodeURIComponent(css.split('data:image/svg+xml,')[1].split('"')[0])).toBe(svg);
    expect(renderTileContent(doc, { ...tile, override: { kind: 'custom', color: '"><script>alert(1)</script>' } })).not.toContain('<script>');
  });

  it('calculates PNG aspect ratio and enforces bounds and pixel limit', () => {
    const doc = createDocument(1);
    expect(pngDimensions(1000, doc)).toEqual({ width: 1000, height: 1000 });
    doc.settings.rows = 4;
    expect(pngDimensions(1000, doc)).toEqual({ width: 1000, height: 500 });
    for (const width of [99, 4097, NaN, 200.5]) expect(() => pngDimensions(width, doc)).toThrow();
    doc.settings.rows = 8;
    expect(() => pngDimensions(4096, doc)).toThrow(/megapixels/);
    doc.settings.columns = 0;
    expect(() => pngDimensions(100, doc)).toThrow();
  });
});
