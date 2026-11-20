import type { PatternDocument } from "./core";
import { pngDimensions, renderSvg } from "./render";

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	try {
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}

export function downloadText(
	text: string,
	filename: string,
	mime: string,
): void {
	downloadBlob(new Blob([text], { type: mime }), filename);
}

export async function downloadPng(
	doc: PatternDocument,
	width: number,
): Promise<void> {
	const dimensions = pngDimensions(width, doc);
	const url = URL.createObjectURL(
		new Blob([renderSvg(doc)], { type: "image/svg+xml;charset=utf-8" }),
	);
	try {
		const image = new Image();
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Could not load pattern image."));
			image.src = url;
		});
		const canvas = document.createElement("canvas");
		canvas.width = dimensions.width;
		canvas.height = dimensions.height;
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas is unavailable.");
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(result) =>
					result ? resolve(result) : reject(new Error("Could not encode PNG.")),
				"image/png",
			);
		});
		downloadBlob(blob, "form-study.png");
	} finally {
		URL.revokeObjectURL(url);
	}
}
