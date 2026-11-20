import { useEffect, useRef, useState, useReducer, type ReactNode } from "react";
import {
	reducer,
	palettes,
	type PatternDocument,
	type PatternSettings,
	type Tile,
} from "./core";
import { packs, shapes, type Pack } from "./shapes";
import { renderSvg } from "./render";
import { loadDraft, saveDraft } from './persistence';
import ExportDialog from './ExportDialog';

function Icon({
	name,
}: {
	name: "refresh" | "download" | "fit" | "plus" | "minus" | "close";
}) {
	const paths = {
		refresh:
			"M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17",
		download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
		fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
		plus: "M12 5v14M5 12h14",
		minus: "M5 12h14",
		close: "m6 6 12 12M6 18 18 6",
	};
	return (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={paths[name]} />
		</svg>
	);
}
function Motif({ id, color = "currentColor" }: { id: string; color?: string }) {
	return (
		<svg
			viewBox="0 0 100 100"
			aria-hidden="true"
			style={{ color }}
			dangerouslySetInnerHTML={{
				__html: shapes.find((s) => s.id === id)?.parts.join("") ?? "",
			}}
		/>
	);
}
function Section({
	title,
	children,
	className = "",
}: {
	title: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<details className={`control-section ${className}`} open>
			<summary>
				{title}
				<span aria-hidden="true">⌄</span>
			</summary>
			<div className="section-content">{children}</div>
		</details>
	);
}
function NumberControl({
	label,
	value,
	min,
	max,
	step = 1,
	suffix = "",
	disabled = false,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	suffix?: string;
	disabled?: boolean;
	onChange: (n: number) => void;
}) {
	const [text, setText] = useState(String(value));
	useEffect(() => setText(String(value)), [value]);
	function commit() {
		const n = Number(text);
		if (text.trim() && Number.isFinite(n)) {
      const next = Math.max(min, Math.min(max, Math.round(n / step) * step));
      setText(String(next));
      onChange(next);
    } else setText(String(value));
	}
	return (
		<div className={`number-control ${disabled ? "disabled" : ""}`}>
			<div className="control-label">
				<label htmlFor={`range-${label}`}>{label}</label>
				<div className="number-value">
					<input
						aria-label={`${label} value`}
						type="number"
						min={min}
						max={max}
						step={step}
						disabled={disabled}
						value={text}
						onChange={(e) => setText(e.target.value)}
						onBlur={commit}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								commit();
								e.currentTarget.blur();
							}
						}}
					/>
					<span>{suffix}</span>
				</div>
			</div>
			<input
				id={`range-${label}`}
				type="range"
				min={min}
				max={max}
				step={step}
				disabled={disabled}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				style={
					{
						"--range": `${((value - min) / (max - min)) * 100}%`,
					} as React.CSSProperties
				}
			/>
		</div>
	);
}
function DimensionInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const next = text.trim() ? Math.max(2, Math.min(12, Math.round(Number(text)))) : value;
    if (Number.isFinite(next)) { setText(String(next)); onChange(next); } else setText(String(value));
  };
  return <input aria-label={label} type="number" min="2" max="12" value={text} onChange={e => { setText(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 2 && n <= 12) onChange(n); }} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }} />;
}
function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="toggle-row">
			<span>{label}</span>
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
			/>
			<span className="switch" aria-hidden="true" />
		</label>
	);
}
export function ColorField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (color: string) => void;
}) {
	const [text, setText] = useState(value);
	useEffect(() => setText(value), [value]);
	function commit() {
		if (/^#[\da-f]{6}$/i.test(text)) onChange(text.toUpperCase());
		else setText(value);
	}
	return (
		<div className="color-field">
			<input
				aria-label={`${label} color`}
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<input
				aria-label={`${label} hex`}
				value={text}
				maxLength={7}
				spellCheck={false}
				onChange={(e) => setText(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						commit();
						e.currentTarget.blur();
					}
				}}
			/>
		</div>
	);
}
function TileDialog({
	doc,
	tile,
	onSave,
	onClose,
}: {
	doc: PatternDocument;
	tile: Tile;
	onSave: (patch: Partial<Tile>) => void;
	onClose: () => void;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const [shapeId, setShapeId] = useState(
		tile.shapeId ?? shapes.find((s) => s.pack === doc.settings.pack)!.id,
	);
	const [override, setOverride] = useState(tile.override);
	const [custom, setCustom] = useState(
		tile.override?.kind === "custom" ? tile.override.color : "#3459D1",
	);
	useEffect(() => {
		ref.current?.showModal();
	}, []);
	return (
		<dialog
			ref={ref}
			className="tile-dialog"
			onCancel={onClose}
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSave({ shapeId, override });
				}}
			>
				<div className="dialog-heading">
					<div>
						<h2>A little adjustment</h2>
						<p>Make this tile your own.</p>
					</div>
					<button
						type="button"
						className="icon-button"
						aria-label="Close tile editor"
						onClick={onClose}
					>
						<Icon name="close" />
					</button>
				</div>
				<fieldset>
					<legend>Choose a motif</legend>
					<div className="motif-picker">
						{shapes
							.filter((s) => s.pack === doc.settings.pack)
							.map((s) => (
								<button
									type="button"
									key={s.id}
									className={shapeId === s.id ? "selected" : ""}
									aria-label={s.name}
									aria-pressed={shapeId === s.id}
									onClick={() => setShapeId(s.id)}
								>
									<Motif id={s.id} />
								</button>
							))}
					</div>
				</fieldset>
				<fieldset>
					<legend>Tile color</legend>
					<p className="help">An override colors every part of this tile.</p>
					<div className="tile-colors">
						<button
							type="button"
							className={!override ? "selected" : ""}
							aria-pressed={!override}
							onClick={() => setOverride(undefined)}
						>
							Automatic
						</button>
						{doc.palette.colors.map((c, index) => (
							<button
								type="button"
								key={index}
								className={`swatch ${override?.kind === "palette" && override.index === index ? "selected" : ""}`}
								style={{ background: c }}
								aria-label={`Use palette color ${index + 1}`}
								aria-pressed={
									override?.kind === "palette" && override.index === index
								}
								onClick={() => setOverride({ kind: "palette", index })}
							/>
						))}
					</div>
					<label className="custom-color">
						<input
							type="checkbox"
							checked={override?.kind === "custom"}
							onChange={(e) =>
								setOverride(
									e.target.checked
										? { kind: "custom", color: custom }
										: undefined,
								)
							}
						/>
						Custom color
					</label>
					<ColorField
						label="Custom tile"
						value={custom}
						onChange={(color) => {
							setCustom(color);
							setOverride({ kind: "custom", color });
						}}
					/>
				</fieldset>
				<div className="dialog-actions">
					<button
						type="button"
						className="danger-button"
						onClick={() => onSave({ shapeId: null })}
					>
						Clear tile
					</button>
					<div>
						<button type="button" onClick={onClose}>
							Cancel
						</button>
						<button className="primary" type="submit">
							Save tile
						</button>
					</div>
				</div>
			</form>
		</dialog>
	);
}

export default function App() {
  const [initial] = useState(loadDraft);
	const [doc, dispatch] = useReducer(reducer, initial.document);
	const [selectedTile, setSelectedTile] = useState<string | null>(null);
	const [zoom, setZoom] = useState(1);
	const [status, setStatus] = useState(initial.notice);
  useEffect(() => {
    const save = () => { const notice = saveDraft(doc); if (notice) setStatus(notice); };
    const timer = window.setTimeout(save, 350);
    window.addEventListener('pagehide', save);
    return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', save); };
  }, [doc]);
	const [exportOpen, setExportOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });
  useEffect(() => {
    const element = canvasRef.current!;
    const observer = new ResizeObserver(() => setCanvasSize({ width: element.clientWidth - 8, height: element.clientHeight - 8 }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
	const settings = doc.settings;
  const boardWidth = Math.min(canvasSize.width, canvasSize.height * settings.columns / settings.rows);
	const patch = (patch: Partial<PatternSettings>) =>
		dispatch({ type: "settings", patch });
	const refresh = () => {
		dispatch({ type: "refresh" });
		setStatus("A fresh composition. Tile edits cleared.");
	};
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const el = e.target as HTMLElement;
			if (
				e.code === "Space" &&
				!e.repeat &&
				!document.querySelector("dialog[open]") &&
				!el.closest("input,textarea,select,button,summary,[contenteditable]")
			) {
				e.preventDefault();
				dispatch({ type: "refresh" });
				setStatus("A fresh composition. Tile edits cleared.");
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
	function setColor(index: number, color: string) {
		dispatch({
			type: "palette",
			palette: {
				...doc.palette,
				colors: doc.palette.colors.map((c, i) => (i === index ? color : c)),
			},
		});
	}
	const activeTile = doc.tiles.find((t) => t.id === selectedTile);
	return (
		<div className="app-shell">
			<header className="app-header">
				<a className="brand" href="./" aria-label="Form study home">
					<span className="brand-mark" aria-hidden="true">
						<i />
						<i />
						<i />
						<i />
					</span>
					<span>
						Form study
						<span className="brand-caption">The pattern playground</span>
					</span>
				</a>
				<div className="workspace-label">
					<span />
					Your local studio
				</div>
				<button
					className="quiet-button reset"
					onClick={() => {
						if (
							window.confirm(
								"Reset to defaults? This replaces your current draft and tile edits.",
							)
						) {
							dispatch({ type: "reset" });
							setZoom(1);
							setStatus("Back to a fresh start.");
						}
					}}
				>
					Reset to defaults
				</button>
			</header>
			<main className="studio">
				<aside className="library">
					<div className="panel-heading">
						<h2>Shape library</h2>
						<span>32 motifs</span>
					</div>
					<p className="help">
						A few simple shapes.
						<br />
						Endless ways to play.
					</p>
					<div className="pack-list">
						{packs.map((pack: Pack) => (
							<button
								key={pack}
								aria-pressed={settings.pack === pack}
								className={`pack-card ${settings.pack === pack ? "active" : ""}`}
								onClick={() => patch({ pack })}
							>
								<span className="pack-preview">
									{shapes
										.filter((s) => s.pack === pack)
										.slice(0, 4)
										.map((s, i) => (
											<Motif
												key={s.id}
												id={s.id}
												color={["#3459D1", "#263044", "#D88365", "#3459D1"][i]}
											/>
										))}
								</span>
								<span className="pack-title">
									{pack}
									<span className="pack-count">
										8 shapes {settings.pack === pack ? "●" : ""}
									</span>
								</span>
							</button>
						))}
					</div>
					<div className="studio-note">
						<span className="note-art" aria-hidden="true">
							✳
						</span>
						<p>
							No right way.
							<br />
							Just your way.
						</p>
						<span>Click any tile to make it yours.</span>
					</div>
				</aside>
				<section className="workspace" aria-label="Pattern workspace">
					<div className="workspace-toolbar">
						<div>
							<h1>Your next happy accident.</h1>
							<p>Start with a shape. See where it goes.</p>
						</div>
						<div className="toolbar-actions">
							<button onClick={refresh} title="Refresh pattern (Space)">
								<Icon name="refresh" />
								<span>Refresh</span>
							</button>
							<button className="primary" onClick={() => setExportOpen(true)}>
								<Icon name="download" />
								<span>Export</span>
							</button>
						</div>
					</div>
					<div className="canvas-stage">
						<div className="canvas-scroll" ref={canvasRef}>
							<div
								className="artboard"
								data-testid="artboard"
								style={{
									width: boardWidth * zoom,
                  height: boardWidth * settings.rows / settings.columns * zoom,
								}}
							>
								<div
									className="pattern-svg"
									data-testid="pattern-svg"
									dangerouslySetInnerHTML={{ __html: renderSvg(doc) }}
								/>
								<div className="tile-overlay">
									{doc.tiles.map((tile, index) => (
										<button
											key={tile.id}
											aria-label={`Edit tile ${index + 1}${tile.shapeId ? "" : " (empty)"}`}
											onClick={() => setSelectedTile(tile.id)}
											style={{
												left: `${(tile.x / settings.columns) * 100}%`,
												top: `${(tile.y / settings.rows) * 100}%`,
												width: `${(tile.size / settings.columns) * 100}%`,
												height: `${(tile.size / settings.rows) * 100}%`,
											}}
										/>
									))}
								</div>
							</div>
						</div>
					</div>
					<div className="canvas-footer">
						<span className="composition-info">
							{settings.columns} × {settings.rows}
							<span />
							{settings.grid === "mixed" ? "Mixed-size" : "Regular"} grid
						</span>
						<div className="zoom-controls">
							<button
								className="icon-button"
								aria-label="Zoom out"
								disabled={zoom <= 0.5}
								onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
							>
								<Icon name="minus" />
							</button>
							<span>{Math.round(zoom * 100)}%</span>
							<button
								className="icon-button"
								aria-label="Zoom in"
								disabled={zoom >= 2}
								onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
							>
								<Icon name="plus" />
							</button>
							<button
								className="icon-button fit"
								aria-label="Fit to view"
								onClick={() => setZoom(1)}
							>
								<Icon name="fit" />
							</button>
						</div>
					</div>
					<div className="workspace-hint">
						<span>↵</span> Select a tile to edit{" "}
						<span className="key">space</span> for a fresh start
					</div>
				</section>
				<aside className="controls" aria-label="Pattern controls">
					<div className="controls-title">
						<h2>Make it yours</h2>
						<span className="live-dot" title="Changes appear immediately" />
					</div>
					<Section title="Layout">
						<div className="segmented" aria-label="Grid mode">
							{(["regular", "mixed"] as const).map((grid) => (
								<button
									key={grid}
									aria-pressed={settings.grid === grid}
									className={settings.grid === grid ? "selected" : ""}
									onClick={() => patch({ grid })}
								>
									{grid === "regular" ? "Regular grid" : "Mixed sizes"}
								</button>
							))}
						</div>
						<div className="dimensions">
							{(["columns", "rows"] as const).map((key) => (
								<label key={key}>
									{key === "columns" ? "Columns" : "Rows"}
									<DimensionInput label={key === 'columns' ? 'Columns' : 'Rows'} value={settings[key]} onChange={n => patch({ [key]: n })} />
								</label>
							))}
						</div>
						<NumberControl
							label="Density"
							value={settings.density}
							min={5}
							max={100}
							suffix="%"
							onChange={(density) => patch({ density })}
						/>
						<Toggle
							label="Unique neighbors"
							checked={settings.uniqueNeighbors}
							onChange={(uniqueNeighbors) => patch({ uniqueNeighbors })}
						/>
						<p className="help layout-help">
							Layout changes, shape packs, and Refresh create a new pattern and
							clear tile edits.
						</p>
					</Section>
					<Section title="Shape & rhythm">
						<NumberControl
							label="Spacing"
							value={settings.spacing}
							min={0}
							max={100}
							suffix="%"
							onChange={(spacing) => patch({ spacing })}
						/>
						<Toggle
							label="Random spacing"
							checked={settings.randomSpacing}
							onChange={(randomSpacing) => patch({ randomSpacing })}
						/>
						<NumberControl
							label="Rotation"
							value={settings.rotation}
							min={0}
							max={360}
							suffix="°"
							disabled={settings.randomRotation}
							onChange={(rotation) => patch({ rotation })}
						/>
						<Toggle
							label="Random rotation"
							checked={settings.randomRotation}
							onChange={(randomRotation) => patch({ randomRotation })}
						/>
						<NumberControl
							label="Opacity"
							value={settings.opacity}
							min={10}
							max={100}
							step={5}
							suffix="%"
							onChange={(opacity) => patch({ opacity })}
						/>
					</Section>
					<Section title="Color story">
						<div className="palette-presets">
							{palettes.map((p) => (
								<button
									key={p.name}
									aria-label={`Use ${p.name} palette`}
									title={p.name}
									onClick={() =>
										dispatch({
											type: "palette",
											palette: {
												background: p.background,
												colors: [...p.colors],
											},
										})
									}
								>
									{p.colors.map((c, i) => (
										<span key={i} style={{ background: c }} />
									))}
								</button>
							))}
						</div>
						<div className="color-label">Background</div>
						<ColorField
							label="Background"
							value={doc.palette.background}
							onChange={(background) =>
								dispatch({
									type: "palette",
									palette: { ...doc.palette, background },
								})
							}
						/>
						<div className="color-label foreground-heading">
							Foreground <span>{doc.palette.colors.length}/6</span>
						</div>
						<div className="foreground-colors">
							{doc.palette.colors.map((color, index) => (
								<div className="foreground-row" key={index}>
									<ColorField
										label={`Foreground ${index + 1}`}
										value={color}
										onChange={(c) => setColor(index, c)}
									/>
									<button
										className="icon-button"
										aria-label={`Swap color ${index + 1} with background`}
										title="Swap with background"
										onClick={() =>
											dispatch({
												type: "palette",
												palette: {
													background: color,
													colors: doc.palette.colors.map((c, i) =>
														i === index ? doc.palette.background : c,
													),
												},
											})
										}
									>
										⇄
									</button>
									<button
										className="icon-button"
										aria-label={`Remove color ${index + 1}`}
										disabled={doc.palette.colors.length === 1}
										onClick={() => dispatch({ type: "removeColor", index })}
									>
										<Icon name="minus" />
									</button>
								</div>
							))}
						</div>
						<div className="palette-actions">
							<button
								disabled={doc.palette.colors.length >= 6}
								onClick={() =>
									dispatch({
										type: "palette",
										palette: {
											...doc.palette,
											colors: [...doc.palette.colors, "#D88365"],
										},
									})
								}
							>
								<Icon name="plus" />
								Add color
							</button>
							<button
								onClick={() => {
									const p =
										palettes[Math.floor(Math.random() * palettes.length)];
									dispatch({
										type: "palette",
										palette: {
											background: p.background,
											colors: [...p.colors],
										},
									});
								}}
							>
								Shuffle palette
							</button>
						</div>
						<Toggle
							label="Multicolor tiles"
							checked={settings.multicolor}
							onChange={(multicolor) => patch({ multicolor })}
						/>
						<Toggle
							label="Transparent background"
							checked={settings.transparent}
							onChange={(transparent) => patch({ transparent })}
						/>
					</Section>
				</aside>
			</main>
			<footer className="app-footer">
				<span>Small shapes. Infinite possibilities.</span>
				<span role="status" aria-live="polite">
					{status || "Made to play. Yours to keep."}
				</span>
				<span>SVG · CSS · PNG</span>
			</footer>
			{activeTile && (
				<TileDialog
					key={activeTile.id}
					doc={doc}
					tile={activeTile}
					onClose={() => setSelectedTile(null)}
					onSave={(tilePatch) => {
						dispatch({ type: "tile", id: activeTile.id, patch: tilePatch });
						setSelectedTile(null);
						setStatus(
							tilePatch.shapeId === null
								? "Tile cleared. Select it again to restore a motif."
								: "Tile updated.",
						);
					}}
				/>
			)}
			{exportOpen && <ExportDialog doc={doc} onClose={() => setExportOpen(false)} />}
		</div>
	);
}
