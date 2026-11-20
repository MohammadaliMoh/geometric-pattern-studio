# Form study

A local, browser-only geometric pattern playground. React, TypeScript, Vite, and plain CSS; no accounts, API, remote assets, or runtime services.

## Run locally

Use Node.js 22.12+ (or a current supported release).

```sh
npm install
npm run dev
```

Open **http://localhost:3030**. Development and production preview both use port **3030**, with strict port checking.

```sh
npm run build
npm run preview
```

## Play

- Pick one of four original eight-motif packs. Explore regular or mixed-size grids, density, spacing, rotation, opacity, and multicolor parts.
- Layout changes (pack, dimensions, grid, density, neighbor rules) and Refresh clear tile edits. Appearance and palette changes preserve geometry. Random appearance factors stay stable while adjusting sliders.
- Click a tile, or Tab to it and press Enter/Space, to change its motif or color. Save applies; Escape/Cancel discards. Clear leaves an empty, selectable tile. Choose Automatic to remove a manual color override.
- Press Space outside interactive controls/dialogs to refresh. Zoom and Fit affect only the preview.
- Edit foreground/background colors, choose a palette, swap colors, or add/remove foreground colors. Custom tile colors remain unchanged by palette changes.

## Export

- **SVG:** standalone editable vector artwork, with per-tile clipping.
- **CSS:** a `.pattern` rule embedding that same SVG. The whole composition repeats; adjacent repeats do not promise connected motifs. Copy failure exposes selectable CSS.
- **PNG:** choose a width of 100–4096 pixels; height follows the composition ratio. Images exceeding 16 megapixels are rejected. Transparency is supported in all formats. The preview checkerboard is never exported.

## Current draft only

The current document, including concrete tiles and manual edits, is automatically saved after a short debounce to `form-study:draft` in localStorage. It is restored after validation; invalid or inaccessible storage falls back safely with a notice. An ordinary page exit also attempts to flush the draft.

**Browser storage is not a backup.** Clearing site data loses the draft. Storage is scoped to this browser and origin; private browsing or storage restrictions can prevent saving. Downloads preserve artwork, not editable project documents. Reset replaces the current draft after confirmation. There are no named saves, gallery, import, undo, uploads, or cloud sync.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

If Chromium cannot be downloaded, use an existing compatible Chrome/Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:browser
```

Unit tests cover deterministic generation, grid coverage/edge neighbors, stable edits, reference remapping, export helpers, and invalid/storage-failure recovery. Browser tests cover editing, palettes, layouts, keyboard use, reset, reload, valid SVG/XML, preview/export matching, CSS fallback/download, PNG size/alpha, and screenshots at 1440 and 390 px. Screenshots are written to `test-results/`.

## Code map

- `src/core.ts`, `src/shapes.ts`: types, original motifs, generation, reducer.
- `src/render.ts`, `src/download.ts`: shared SVG/CSS rendering and browser downloads.
- `src/persistence.ts`: draft validation and storage access.
- `src/App.tsx`, `src/ExportDialog.tsx`, `src/style.css`: editor and export UI.
