import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const packs = ["Truchet", "Op Art"] as const;
async function draft(page: Page) {
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("form-study:draft")))
		.not.toBeNull();
	await page.waitForTimeout(450);
	return page.evaluate(() =>
		JSON.parse(localStorage.getItem("form-study:draft")!),
	);
}

test("native line motif atlas: exact annuli, stripe cadence, bounds and nonoverlap", async ({
	page,
}, testInfo) => {
	await page.goto("/");
	const atlas = await page.evaluate(async () => {
		const path = "/src/shapes.ts";
		const { shapes }: typeof import("../src/shapes") = await import(
			/* @vite-ignore */ path
		);
		const style = document.createElement("style");
		style.textContent =
			"body{margin:24px;background:#eee;font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,180px);gap:24px}figure{margin:0}svg{display:block;background:#fff}figcaption{margin-top:8px}";
		const heading = document.createElement("h1");
		heading.textContent = "Truchet / Op Art · native SVG motif atlas";
		document.body.replaceChildren(
			style,
			heading,
			document.createElement("main"),
		);
		return shapes
			.filter((shape) => ["Truchet", "Op Art"].includes(shape.pack))
			.map((shape) => {
				const figure = document.createElement("figure");
				figure.append(
					new DOMParser().parseFromString(
						`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 100 100"><title></title><g color="#111">${shape.parts.join("")}</g></svg>`,
						"image/svg+xml",
					).documentElement,
					document.createElement("figcaption"),
				);
				figure.querySelector("title")!.textContent = shape.id;
				figure.querySelector("figcaption")!.textContent =
					`${shape.pack} · ${shape.name} (${shape.id})`;
				document.querySelector("main")!.append(figure);
				const svg = figure.querySelector("svg")!;
				const paths = Array.from(svg.querySelectorAll("path"));
				// isPointInFill uses path-local coordinates, not the enclosing SVG's coordinates.
				const hits = (x: number, y: number) =>
					paths.filter((p) => {
						const screen = new DOMPoint(x, y).matrixTransform(
							svg.getScreenCTM()!,
						);
						return p.isPointInFill(
							screen.matrixTransform(p.getScreenCTM()!.inverse()),
						);
					}).length;
				const box = svg.querySelector("g")!.getBBox();
				let mismatches = 0,
					overlaps = 0;
				if (shape.pack === "Truchet") {
					const corners =
						shape.id === "truchet-a"
							? [
									[0, 0],
									[100, 100],
								]
							: [
									[100, 0],
									[0, 100],
								];
					for (let x = 0.5; x < 100; x += 1)
						for (let y = 0.5; y < 100; y += 1) {
							const distances = corners.map(([cx, cy]) =>
								Math.hypot(x - cx, y - cy),
							);
							if (
								distances.some(
									(r) => Math.abs(r - 42) < 0.02 || Math.abs(r - 58) < 0.02,
								)
							)
								continue;
							const count = hits(x, y);
							if (count > 1) overlaps++;
							if (count > 0 !== distances.some((r) => r > 42 && r < 58))
								mismatches++;
						}
					// Samples immediately inside/outside both exact radial edges, including tile edges.
					for (const [cx, cy] of corners)
						for (const angle of [
							0.0001,
							0.2,
							Math.PI / 4,
							Math.PI / 2 - 0.2,
							Math.PI / 2 - 0.0001,
						])
							for (const r of [41.9, 42.1, 57.9, 58.1]) {
								const x = cx + (cx === 0 ? 1 : -1) * r * Math.cos(angle);
								const y = cy + (cy === 0 ? 1 : -1) * r * Math.sin(angle);
								if (hits(x, y) > 0 !== (r > 42 && r < 58)) mismatches++;
							}
				} else {
					const corner = shape.id.startsWith("op-art-corner");
					const angle = corner ? Number(shape.id.split("-").at(-1)) : 0;
					for (const distance of [
						0.1, 4.9, 5.1, 14.9, 15.1, 24.9, 25.1, 34.9, 35.1, 84.9, 85.1, 94.9,
						95.1, 99.9,
					]) {
						for (const theta of [0.15, 0.65, 1.3]) {
							let x = corner
								? distance * Math.cos(theta)
								: shape.id.endsWith("vertical")
									? distance
									: 37.3;
							let y = corner
								? distance * Math.sin(theta)
								: shape.id.endsWith("horizontal")
									? distance
									: 37.3;
							for (let turn = 0; turn < angle; turn += 90)
								[x, y] = [100 - y, x];
							if (hits(x, y) > 0 !== (distance % 20 > 5 && distance % 20 < 15))
								mismatches++;
						}
					}
				}
				// All Truchet edge profiles are identical, so every A/B neighbor and wrap seam agrees.
				const edgeSamples = [0.1, 41.9, 42.1, 50, 57.9, 58.1, 99.9];
				const edges = [
					edgeSamples.map((n) => hits(n, 0.001) > 0),
					edgeSamples.map((n) => hits(99.999, n) > 0),
					edgeSamples.map((n) => hits(n, 99.999) > 0),
					edgeSamples.map((n) => hits(0.001, n) > 0),
				];
				if (shape.pack === "Op Art") {
					const corner = shape.id.startsWith("op-art-corner");
					const angle = corner ? Number(shape.id.split("-").at(-1)) : 0;
					for (let edge = 0; edge < 4; edge++)
						for (const n of [
							0.1, 4.9, 5.1, 14.9, 15.1, 24.9, 25.1, 94.9, 95.1, 99.9,
						]) {
							let [x, y] = [
								[n, 0.001],
								[99.999, n],
								[n, 99.999],
								[0.001, n],
							][edge];
							for (let turn = 0; turn < angle; turn += 90)
								[x, y] = [100 - y, x];
							const port = corner
								? edge === 0 || edge === 3
								: shape.id.endsWith("horizontal")
									? edge === 1 || edge === 3
									: edge === 0 || edge === 2;
							if (hits(x, y) > 0 !== (port && n % 20 > 5 && n % 20 < 15))
								mismatches++;
						}
				}
				return {
					id: shape.id,
					edges,
					paths: paths.length,
					strokes: paths.filter((p) => getComputedStyle(p).stroke !== "none")
						.length,
					box: { x: box.x, y: box.y, width: box.width, height: box.height },
					mismatches,
					overlaps,
				};
			});
	});
	expect(atlas.map((shape) => shape.id).sort()).toEqual(
		[
			"truchet-a",
			"truchet-b",
			"op-art-horizontal",
			"op-art-vertical",
			...[0, 90, 180, 270].map((angle) => `op-art-corner-${angle}`),
		].sort(),
	);
	for (const shape of atlas) {
		expect(shape.mismatches, shape.id).toBe(0);
		expect(shape.overlaps, shape.id).toBe(0);
		expect(shape.strokes, shape.id).toBe(0);
		if (shape.id.startsWith("op-art")) expect(shape.paths, shape.id).toBe(1);
		const { x, y, width, height } = shape.box;
		expect(x, shape.id).toBeGreaterThanOrEqual(-0.001);
		expect(y, shape.id).toBeGreaterThanOrEqual(-0.001);
		expect(x + width, shape.id).toBeLessThanOrEqual(100.001);
		expect(y + height, shape.id).toBeLessThanOrEqual(100.001);
		if (shape.id.startsWith("truchet")) {
			expect(shape.box).toEqual({ x: 0, y: 0, width: 100, height: 100 });
			for (const edge of shape.edges)
				expect(edge, shape.id).toEqual([
					false,
					false,
					true,
					true,
					true,
					false,
					false,
				]);
		}
	}
	const truchet = atlas.filter((shape) => shape.id.startsWith("truchet"));
	for (const first of truchet)
		for (const second of truchet) {
			// Includes A/A and B/B as well as both mixed orientations, at interior and wrap boundaries.
			expect(first.edges[1], `${first.id} right / ${second.id} left`).toEqual(
				second.edges[3],
			);
			expect(first.edges[2], `${first.id} bottom / ${second.id} top`).toEqual(
				second.edges[0],
			);
		}
	await page.screenshot({
		path: testInfo.outputPath("line-motif-atlas.png"),
		fullPage: true,
	});
});

for (const seed of [42, 123, 987]) {
	test(`line compositions and CSS repetition · seed ${seed}`, async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		const checks = await page.evaluate(async (seed) => {
			const corePath = "/src/core.ts",
				renderPath = "/src/render.ts";
			const core: typeof import("../src/core") = await import(
				/* @vite-ignore */ corePath
			);
			const render: typeof import("../src/render") = await import(
				/* @vite-ignore */ renderPath
			);
			const style = document.createElement("style");
			style.textContent =
				"body{margin:24px;background:#eee;font:14px system-ui}main{display:grid;grid-template-columns:repeat(2,480px);gap:24px}figure{margin:0}svg{display:block;width:480px;height:480px}figcaption{margin-bottom:8px}";
			const heading = document.createElement("h1");
			heading.textContent = `Line packs · seed ${seed}`;
			document.body.replaceChildren(
				style,
				heading,
				document.createElement("main"),
			);
			const checks = [];
			for (const pack of ["Truchet", "Op Art"] as const) {
				for (const custom of [false, true]) {
					let doc = core.createDocument(seed);
					doc.settings.pack = pack;
					doc = core.reducer(doc, { type: "recommended" });
					Object.assign(
						doc.settings,
						{ rows: 8, columns: 8 },
						custom ? { spacing: 12, rotation: 0, multicolor: true } : {},
					);
					if (custom)
						doc.palette = {
							background: "#fff0f5",
							colors: ["#123456", "#d12965"],
						};
					doc.tiles = core.generateTiles(
						doc.settings,
						seed,
						doc.palette.colors.length,
					);
					if (pack === "Op Art" && !custom) {
						const small = core.reducer(doc, {
							type: "settings",
							patch: { rows: 4, columns: 4 },
						});
						const figure = document.createElement("figure");
						const caption = document.createElement("figcaption");
						caption.textContent = "Op Art · 4 × 4 tiles · recommended rhythm";
						figure.append(
							caption,
							new DOMParser().parseFromString(
								render.renderSvg(small),
								"image/svg+xml",
							).documentElement,
						);
						document.querySelector("main")!.append(figure);
					}
					const svg = render.renderSvg(doc);
					const figure = document.createElement("figure");
					const caption = document.createElement("figcaption");
					caption.textContent = `${pack} · 8 × 8 · ${custom ? "custom spacing / colors" : "recommended"}`;
					figure.append(
						caption,
						new DOMParser().parseFromString(svg, "image/svg+xml")
							.documentElement,
					);
					document.querySelector("main")!.append(figure);
					let seamErrors = 0;
					if (pack === "Truchet" && !custom) {
						const image = new Image();
						image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
						await image.decode();
						const canvas = document.createElement("canvas");
						canvas.width = canvas.height = 1600;
						const context = canvas.getContext("2d")!;
						for (const x of [0, 800])
							for (const y of [0, 800]) context.drawImage(image, x, y);
						const pixels = context.getImageData(0, 0, 1600, 1600).data;
						const isInk = (x: number, y: number) => {
							const index = (y * 1600 + x) * 4;
							return [32, 36, 35, 255].every(
								(channel, i) => Math.abs(pixels[index + i] - channel) <= 1,
							);
						};
						// Probe both sides of every interior seam, including the exported 800-unit wrap seams.
						for (let boundary = 100; boundary < 1600; boundary += 100)
							for (let center = 50; center < 1600; center += 100)
								for (const offset of [-6, 0, 6])
									for (const side of [-1, 0]) {
										if (!isInk(boundary + side, center + offset)) seamErrors++;
										if (!isInk(center + offset, boundary + side)) seamErrors++;
									}
					}
					checks.push({
						pack,
						seamErrors,
						deterministic:
							JSON.stringify(doc.tiles) ===
							JSON.stringify(
								core.generateTiles(
									doc.settings,
									seed,
									doc.palette.colors.length,
								),
							),
						count: doc.tiles.length,
						valid: !new DOMParser()
							.parseFromString(svg, "image/svg+xml")
							.querySelector("parsererror"),
					});
					if (!custom) {
						const css = render.cssForDocument(doc);
						for (const repeats of [2]) {
							const repeat = document.createElement("figure");
							const caption = document.createElement("figcaption"),
								pattern = document.createElement("div");
							caption.textContent = `${pack} · CSS ${repeats} × ${repeats} repetition`;
							pattern.style.width = "480px";
							pattern.style.height = "480px";
							repeat.append(caption, pattern);
							const repeatStyle = document.createElement("style");
							repeatStyle.textContent = css.replace(
								".pattern",
								`.repeat-${pack.replace(" ", "")}-${repeats}`,
							);
							repeat.querySelector("div")!.className =
								`repeat-${pack.replace(" ", "")}-${repeats}`;
							repeat.querySelector("div")!.style.backgroundSize =
								`${480 / repeats}px ${480 / repeats}px`;
							repeat.append(repeatStyle);
							document.querySelector("main")!.append(repeat);
						}
					}
				}
			}
			return checks;
		}, seed);
		for (const check of checks)
			expect(check).toMatchObject({
				deterministic: true,
				count: 64,
				valid: true,
				seamErrors: 0,
			});
		await page.screenshot({
			path: testInfo.outputPath(`line-compositions-${seed}.png`),
			fullPage: true,
		});
	});
}

for (const pack of packs) {
	test(`${pack} selection, recommended settings, tile edit, reload and responsive UI`, async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		await page.evaluate(() => localStorage.clear());
		await page.reload();
		await page.getByRole("spinbutton", { name: "Spacing value" }).fill("18");
		await page.getByRole("spinbutton", { name: "Spacing value" }).blur();
		await page.getByRole("button", { name: new RegExp(`^${pack}`) }).click();
		expect((await draft(page)).settings).toMatchObject({ pack, spacing: 18 });
		await expect(page.locator(".pack-guidance")).toBeVisible();
		await expect(page.locator(".pack-guidance")).toContainText(/clear/i);
		await page
			.getByRole("button", { name: "Use recommended settings", exact: true })
			.click();
		const recommended = await draft(page);
		expect(recommended.settings).toMatchObject({
			pack,
			grid: "regular",
			density: 100,
			spacing: 0,
			rotation: 0,
			opacity: 100,
			randomRotation: false,
			randomSpacing: false,
			multicolor: false,
		});
		await page
			.getByRole("button", { name: "Edit tile 1", exact: true })
			.click();
		await expect(page.locator(".motif-picker button")).toHaveCount(
			pack === "Truchet" ? 2 : 6,
		);
		await page.locator(".motif-picker button").last().click();
		await page.getByLabel("Custom tile hex").fill("#123456");
		await page.getByLabel("Custom tile hex").blur();
		await page.getByRole("button", { name: "Save tile" }).click();
		const edited = await draft(page);
		expect(edited.tiles[0]).toMatchObject({
			shapeId: pack === "Truchet" ? "truchet-b" : "op-art-corner-270",
			override: { kind: "custom", color: "#123456" },
		});
		await page.reload();
		expect((await draft(page)).tiles).toEqual(edited.tiles);
		const beforeZoom = await page.getByTestId("pattern-svg").innerHTML();
		await page.getByRole("button", { name: "Zoom in", exact: true }).click();
		expect(await page.getByTestId("pattern-svg").innerHTML()).toBe(beforeZoom);
		await page.getByRole("button", { name: "Export", exact: true }).click();
		const svgDownload = page.waitForEvent("download");
		await page
			.getByRole("button", { name: "Download SVG", exact: true })
			.click();
		const exportedSvg = await readFile(
			(await (await svgDownload).path())!,
			"utf8",
		);
		await page.getByRole("button", { name: "CSS", exact: true }).click();
		const cssDownload = page.waitForEvent("download");
		await page
			.getByRole("button", { name: "Download CSS", exact: true })
			.click();
		const exportedCss = await readFile(
			(await (await cssDownload).path())!,
			"utf8",
		);
		expect(
			decodeURIComponent(exportedCss.match(/data:image\/svg\+xml,([^"]+)/)![1]),
		).toBe(exportedSvg);
		const equivalent = await page.evaluate((svg) => {
			const parsed = new DOMParser().parseFromString(svg, "text/html");
			return document
				.querySelector('[data-testid="pattern-svg"] svg')!
				.isEqualNode(parsed.querySelector("svg"));
		}, exportedSvg);
		expect(equivalent).toBe(true);
		await page
			.getByRole("button", { name: "Close export", exact: true })
			.click();
		await page
			.getByRole("button", { name: "Fit to view", exact: true })
			.click();
		await page.screenshot({
			path: testInfo.outputPath(`${pack}-desktop.png`),
			fullPage: true,
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(page.getByTestId("artboard")).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await page.screenshot({
			path: testInfo.outputPath(`${pack}-narrow.png`),
			fullPage: true,
		});
		await page
			.getByRole("button", { name: "Use recommended settings", exact: true })
			.click();
		expect(
			(await draft(page)).tiles.every(
				(tile: { override?: unknown }) => !tile.override,
			),
		).toBe(true);
	});

	test(`${pack} SVG/CSS/PNG exports agree with custom colors, spacing and transparency`, async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		const downloaded = page.waitForEvent("download");
		const reference = await page.evaluate(async (pack) => {
			const corePath = "/src/core.ts",
				renderPath = "/src/render.ts",
				downloadPath = "/src/download.ts",
				shapesPath = "/src/shapes.ts";
			const core: typeof import("../src/core") = await import(
				/* @vite-ignore */ corePath
			);
			const render: typeof import("../src/render") = await import(
				/* @vite-ignore */ renderPath
			);
			const { downloadPng }: typeof import("../src/download") = await import(
				/* @vite-ignore */ downloadPath
			);
			const { shapes }: typeof import("../src/shapes") = await import(
				/* @vite-ignore */ shapesPath
			);
			const doc = core.createDocument(42);
			Object.assign(doc.settings, {
				pack,
				rows: 2,
				columns: 3,
				spacing: 12,
				opacity: 65,
				transparent: true,
				rotation: 0,
				randomRotation: false,
				randomSpacing: false,
				multicolor: true,
			});
			doc.palette = {
				background: "#103bb9",
				colors: ["#fff", "#011341", "#ff6600"],
			};
			doc.tiles = core.generateTiles(doc.settings, 42, 3);
			const motifs = shapes.filter((shape) => shape.pack === pack);
			doc.tiles.forEach((tile, index) => {
				tile.shapeId = motifs[index % motifs.length].id;
			});
			doc.tiles[1].override = { kind: "custom", color: "#12ab34" };
			doc.tiles[2].override = { kind: "palette", index: 2 };
			const svg = render.renderSvg(doc),
				css = render.cssForDocument(doc);
			document.body.replaceChildren(
				new DOMParser().parseFromString(svg, "image/svg+xml").documentElement,
			);
			const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
			const image = new Image();
			image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = 300;
			canvas.height = 200;
			canvas.getContext("2d")!.drawImage(image, 0, 0);
			await downloadPng(doc, 300);
			return {
				svg,
				css,
				valid: !parsed.querySelector("parsererror"),
				background: !!parsed.querySelector("svg > rect"),
				png: canvas.toDataURL(),
			};
		}, pack);
		expect(reference.valid).toBe(true);
		expect(reference.background).toBe(false);
		expect(reference.svg).toContain("#12ab34");
		expect(reference.svg).toContain("#ff6600");
		expect(
			decodeURIComponent(
				reference.css.match(/data:image\/svg\+xml,([^"]+)/)![1],
			),
		).toBe(reference.svg);
		const png = await readFile((await (await downloaded).path())!);
		const comparison = await page.evaluate(
			async ({ actual, expected }) => {
				async function pixels(src: string) {
					const image = new Image();
					image.src = src;
					await image.decode();
					const canvas = document.createElement("canvas");
					canvas.width = image.width;
					canvas.height = image.height;
					const context = canvas.getContext("2d")!;
					context.drawImage(image, 0, 0);
					return {
						width: image.width,
						height: image.height,
						data: context.getImageData(0, 0, image.width, image.height).data,
					};
				}
				const a = await pixels(actual),
					b = await pixels(expected);
				let maxDelta = 0;
				for (let i = 0; i < a.data.length; i++)
					maxDelta = Math.max(maxDelta, Math.abs(a.data[i] - b.data[i]));
				return { width: a.width, height: a.height, maxDelta };
			},
			{
				actual: `data:image/png;base64,${png.toString("base64")}`,
				expected: reference.png,
			},
		);
		expect(comparison).toEqual({ width: 300, height: 200, maxDelta: 0 });
		await testInfo.attach(`${pack}.svg`, {
			body: reference.svg,
			contentType: "image/svg+xml",
		});
		await testInfo.attach(`${pack}.css`, {
			body: reference.css,
			contentType: "text/css",
		});
		await testInfo.attach(`${pack}.png`, {
			body: png,
			contentType: "image/png",
		});
	});
}
