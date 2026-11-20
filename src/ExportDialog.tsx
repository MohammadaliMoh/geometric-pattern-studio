import { useEffect, useRef, useState } from "react";
import type { PatternDocument } from "./core";
import { renderSvg, cssForDocument, pngDimensions } from "./render";
import { downloadText, downloadPng } from "./download";

export default function ExportDialog({
	doc,
	onClose,
}: {
	doc: PatternDocument;
	onClose: () => void;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const [format, setFormat] = useState<"SVG" | "CSS" | "PNG">("SVG");
	const [width, setWidth] = useState("1600");
	const [status, setStatus] = useState("");
	const [fallback, setFallback] = useState(false);
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		ref.current?.showModal();
	}, []);
	let dimensions = "";
	let dimensionError = "";
	try {
		const size = pngDimensions(Number(width), doc);
		dimensions = `${size.width} × ${size.height} px`;
	} catch (error) {
		dimensionError = (error as Error).message;
	}
	async function download() {
		setBusy(true);
		try {
			if (format === "PNG") await downloadPng(doc, Number(width));
			else
				downloadText(
					format === "SVG" ? renderSvg(doc) : cssForDocument(doc),
					`form-study.${format.toLowerCase()}`,
					format === "SVG" ? "image/svg+xml" : "text/css",
				);
			setStatus(`${format} downloaded. A little piece of your creativity.`);
		} catch (error) {
			setStatus(`Could not export: ${(error as Error).message}`);
		} finally {
			setBusy(false);
		}
	}
	async function copy() {
		try {
			await navigator.clipboard.writeText(cssForDocument(doc));
			setStatus("CSS copied to clipboard.");
		} catch {
			setFallback(true);
			setStatus("Clipboard unavailable. Select and copy the CSS below.");
		}
	}
	return (
		<dialog
			ref={ref}
			className="export-dialog"
			onCancel={onClose}
			onClick={(e) => {
				if (e.target === e.currentTarget && !busy) onClose();
			}}
			aria-labelledby="export-title"
		>
			<div className="dialog-heading">
				<div>
					<h2 id="export-title">Take it with you.</h2>
					<p>Your pattern, ready for its next home.</p>
				</div>
				<button
					className="icon-button"
					aria-label="Close export"
					onClick={onClose}
				>
					×
				</button>
			</div>
			<div className="segmented export-tabs" aria-label="Export format">
				{(["SVG", "CSS", "PNG"] as const).map((f) => (
					<button
						key={f}
						aria-pressed={format === f}
						className={format === f ? "selected" : ""}
						onClick={() => {
							setFormat(f);
							setStatus("");
							setFallback(false);
						}}
					>
						{f}
					</button>
				))}
			</div>
			<p className="export-description">
				{format === "SVG"
					? "Crisp at any size. An editable vector file, with no watermarks or external assets."
					: format === "CSS"
						? "Repeat the whole composition as a background. The SVG is embedded directly in a .pattern rule; no extra files needed."
						: "A high-resolution image, rendered from the exact same artwork. Choose a width; we’ll keep the proportions."}
			</p>
			{format === "PNG" && (
				<>
					<label className="export-width">
						Image width (px)
						<input
							aria-label="PNG width"
							type="number"
							min="100"
							max="4096"
							value={width}
							onChange={(e) => setWidth(e.target.value)}
						/>
					</label>
					<p className="export-dimensions">
						{dimensionError || `${dimensions} · maximum 16 megapixels`}
					</p>
				</>
			)}
			<p className="help">
				{doc.settings.transparent
					? "Transparent background included."
					: "Includes your background color."}{" "}
				Preview zoom does not affect the file.
			</p>
			<p role="status" className="export-status">
				{status}
			</p>
			{fallback && (
				<textarea
					className="css-fallback"
					aria-label="CSS to copy"
					readOnly
					value={cssForDocument(doc)}
					onFocus={(e) => e.currentTarget.select()}
				/>
			)}
			<div className="export-actions">
				{format === "CSS" && <button onClick={copy}>Copy CSS</button>}
				<button
					className="primary"
					disabled={busy || (format === "PNG" && !!dimensionError)}
					onClick={download}
				>
					{busy ? "Preparing…" : `Download ${format}`}
				</button>
			</div>
		</dialog>
	);
}
