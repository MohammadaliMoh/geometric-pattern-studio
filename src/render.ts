import type { PatternDocument, Tile } from "./core";
import { shapes } from "./shapes";

function escape(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&apos;",
			})[character]!,
	);
}

function color(value: string | undefined): string {
	// Only CSS colors, never URLs or declarations, may enter exported markup.
	return value &&
		/^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+\-/]+\))$/i.test(value)
		? value
		: "#000000";
}

export function renderTileContent(doc: PatternDocument, tile: Tile): string {
	const shape = shapes.find((item) => item.id === tile.shapeId);
	if (!shape) return "";
	const settings = doc.settings;
	const clipId = `clip-${Array.from(tile.id)
		.map((char) => char.codePointAt(0)!.toString(16))
		.join("-")}`;
	const x = tile.x * 100,
		y = tile.y * 100,
		size = tile.size * 100;
	const spacing = Math.min(
		100,
		Math.max(
			0,
			settings.spacing * (settings.randomSpacing ? tile.spacingFactor : 1),
		),
	);
	const scale = 1 - spacing / 100;
	const rotation =
		settings.rotation +
		(settings.randomRotation ? Math.floor(tile.rotationFactor * 4) * 90 : 0);
	const override =
		tile.override?.kind === "custom"
			? tile.override.color
			: tile.override?.kind === "palette"
				? doc.palette.colors[tile.override.index]
				: undefined;
	const parts = shape.parts
		.map((part, index) => {
			const fill =
				override ??
				doc.palette.colors[
					settings.multicolor
						? (tile.partColors[index] ?? tile.colorIndex)
						: tile.colorIndex
				];
			return `<g color="${escape(color(fill))}">${part}</g>`;
		})
		.join("");
	return `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${size}" height="${size}"/></clipPath></defs><g clip-path="url(#${clipId})"><g opacity="${settings.opacity / 100}" transform="translate(${x + size / 2} ${y + size / 2}) rotate(${rotation}) scale(${tile.size * scale}) translate(-50 -50)">${parts}</g></g>`;
}

export function renderSvg(doc: PatternDocument): string {
	const width = doc.settings.columns * 100,
		height = doc.settings.rows * 100;
	const background = doc.settings.transparent
		? ""
		: `<rect width="${width}" height="${height}" fill="${escape(color(doc.palette.background))}"/>`;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${background}${doc.tiles.map((tile) => renderTileContent(doc, tile)).join("")}</svg>`;
}

export function cssForDocument(doc: PatternDocument): string {
	return `background-image: url("data:image/svg+xml,${encodeURIComponent(renderSvg(doc)).replace(/'/g, "%27")}");\nbackground-size: ${doc.settings.columns * 100}px ${doc.settings.rows * 100}px;\nbackground-repeat: repeat;`;
}

export function pngDimensions(
	width: number,
	doc: PatternDocument,
): { width: number; height: number } {
	if (!Number.isInteger(width) || width < 100 || width > 4096)
		throw new RangeError("PNG width must be an integer from 100 to 4096");
	const { rows, columns } = doc.settings;
	if (
		!Number.isFinite(rows) ||
		!Number.isFinite(columns) ||
		rows <= 0 ||
		columns <= 0
	)
		throw new RangeError("Invalid document dimensions");
	const height = Math.max(1, Math.round((width * rows) / columns));
	if (width * height > 16_000_000)
		throw new RangeError("PNG must not exceed 16 megapixels");
	return { width, height };
}
