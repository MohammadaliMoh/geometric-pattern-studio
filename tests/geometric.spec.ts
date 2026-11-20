import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

for (const seed of [42, 123, 987]) {
	test(`geometric visual fixtures, seed ${seed}`, async ({
		page,
	}, testInfo) => {
		await page.goto("/");
		const checks = await page.evaluate(async (seed) => {
			const corePath = "/src/core.ts",
				renderPath = "/src/render.ts";
			const core: typeof import("../src/core") = await import(
				/* @vite-ignore */ corePath
			);
			const { renderSvg }: typeof import("../src/render") = await import(
				/* @vite-ignore */ renderPath
			);
			type Settings = import("../src/core").PatternSettings;
			const fixtures: [string, Partial<Settings>, boolean?][] = [
				["Connected · Ink · 3 × 4", {}],
				["Connected · monochrome · 3 × 4", {}, true],
				["Connected · 6 × 6", { rows: 6, columns: 6 }],
				["Tonal · one foreground", { pack: "Tonal" }, true],
				["Tonal · multicolor", { pack: "Tonal", multicolor: true }],
				["Connected · mixed · 3 × 4", { grid: "mixed" }],
				["Connected · mixed · 5 × 7", { grid: "mixed", rows: 5, columns: 7 }],
				["Connected · 37° · spacing 18", { rotation: 37, spacing: 18 }],
				[
					"Tonal · random angles · spacing 18",
					{ pack: "Tonal", randomRotation: true, spacing: 18 },
				],
			];
			const style = document.createElement("style");
			style.textContent =
				"body{margin:0;padding:24px;background:#eee;font:14px system-ui}main{display:grid;grid-template-columns:repeat(3,320px);gap:24px}figure{margin:0}figcaption{margin-bottom:8px}svg{display:block;width:320px;height:auto}";
			const heading = document.createElement("h1");
			heading.textContent = `Geometric fixtures · seed ${seed}`;
			document.body.replaceChildren(
				style,
				heading,
				document.createElement("main"),
			);
			return fixtures.map(([label, patch, monochrome]) => {
				const doc = core.createDocument(seed);
				Object.assign(
					doc.settings,
					{
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
					},
					patch,
				);
				doc.palette = { background: "#103BB9", colors: ["#FFFFFF", "#011341"] };
				if (monochrome)
					doc.palette = { background: "#FFFFFF", colors: ["#011341"] };
				doc.tiles = core.generateTiles(
					doc.settings,
					seed,
					doc.palette.colors.length,
				);
				const figure = document.createElement("figure");
				const caption = document.createElement("figcaption");
				caption.textContent = label;
				figure.append(caption);
				figure.append(
					new DOMParser().parseFromString(renderSvg(doc), "image/svg+xml")
						.documentElement,
				);
				document.querySelector("main")!.append(figure);
				return {
					label,
					deterministic:
						JSON.stringify(doc.tiles) ===
						JSON.stringify(
							core.generateTiles(doc.settings, seed, doc.palette.colors.length),
						),
					area: doc.tiles.reduce((sum, tile) => sum + tile.size ** 2, 0),
					expectedArea: doc.settings.rows * doc.settings.columns,
					small: doc.tiles.filter((tile) => tile.size === 0.5).length,
					normal: doc.tiles.filter((tile) => tile.size === 1).length,
				};
			});
		}, seed);
		for (const check of checks) {
			expect(check.deterministic, check.label).toBe(true);
			expect(check.area, check.label).toBe(check.expectedArea);
		}
		expect(
			checks.find((check) => check.label.includes("mixed · 3")),
		).toMatchObject({ small: 8, normal: 10 });
		await page.screenshot({
			path: testInfo.outputPath(`geometric-${seed}.png`),
			fullPage: true,
		});
	});
}

test("native SVG atlas has exact Connected bounds and four intrinsic Tonal levels", async ({
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
			"body{margin:24px;background:#eee;font:14px system-ui}main{display:grid;grid-template-columns:repeat(6,150px);gap:20px}figure{margin:0}svg{display:block;background:#103BB9}figcaption{margin-top:6px}";
		const heading = document.createElement("h1");
		heading.textContent = "Connected and Tonal motif atlas";
		document.body.replaceChildren(
			style,
			heading,
			document.createElement("main"),
		);
		return shapes
			.filter((shape) => ["Connected", "Tonal"].includes(shape.pack))
			.map((shape) => {
				const figure = document.createElement("figure");
				figure.append(
					new DOMParser().parseFromString(
						`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 100 100"><title></title><g color="#fff">${shape.parts.join("")}</g></svg>`,
						"image/svg+xml",
					).documentElement,
					document.createElement("figcaption"),
				);
				figure.querySelector("title")!.textContent =
					`${shape.pack}: ${shape.name}`;
				figure.querySelector("figcaption")!.textContent = shape.name;
				document.querySelector("main")!.append(figure);
				const box = figure.querySelector<SVGGElement>("svg > g")!.getBBox();
				return {
					id: shape.id,
					pack: shape.pack,
					box: { x: box.x, y: box.y, width: box.width, height: box.height },
					opacities: Array.from(figure.querySelectorAll("[opacity]"), (part) =>
						Number(part.getAttribute("opacity")),
					).sort(),
				};
			});
	});
	expect(new Set(atlas.map((shape) => shape.id)).size).toBe(atlas.length);
	const connected = atlas.filter((shape) => shape.pack === "Connected");
	expect(connected).toHaveLength(18);
	expect(atlas.filter((shape) => shape.pack === "Tonal")).toHaveLength(12);
	let halfTiles = 0;
	for (const shape of atlas) {
		const { x, y, width, height } = shape.box;
		expect(x, shape.id).toBeGreaterThanOrEqual(-0.001);
		expect(y, shape.id).toBeGreaterThanOrEqual(-0.001);
		expect(x + width, shape.id).toBeLessThanOrEqual(100.001);
		expect(y + height, shape.id).toBeLessThanOrEqual(100.001);
		if (shape.pack === "Connected") {
			const half = Math.abs(width * height - 5000) < 0.01;
			if (half) halfTiles++;
			expect(
				[width, height].sort((a, b) => a - b),
				shape.id,
			).toEqual(half ? [50, 100] : [100, 100]);
			if (half)
				expect(x === 0 || x === 50 || y === 0 || y === 50, shape.id).toBe(true);
		} else {
			expect(shape.opacities, shape.id).toEqual([0.2, 0.4, 0.6, 1]);
		}
	}
	expect(halfTiles).toBe(4);
	await page.screenshot({
		path: testInfo.outputPath("geometric-atlas.png"),
		fullPage: true,
	});
});

for (const transparent of [true, false]) {
	test(`Tonal SVG/CSS/PNG pixels agree with overrides, opacity and ${transparent ? "transparent" : "opaque"} background`, async ({
		page,
	}) => {
		await page.goto("/");
		const downloaded = page.waitForEvent("download");
		const reference = await page.evaluate(async (transparent) => {
			const corePath = "/src/core.ts",
				renderPath = "/src/render.ts",
				shapesPath = "/src/shapes.ts",
				downloadPath = "/src/download.ts";
			const core: typeof import("../src/core") = await import(
				/* @vite-ignore */ corePath
			);
			const render: typeof import("../src/render") = await import(
				/* @vite-ignore */ renderPath
			);
			const { shapes }: typeof import("../src/shapes") = await import(
				/* @vite-ignore */ shapesPath
			);
			const { downloadPng }: typeof import("../src/download") = await import(
				/* @vite-ignore */ downloadPath
			);
			const doc = core.createDocument(42);
			Object.assign(doc.settings, {
				pack: "Tonal",
				rows: 2,
				columns: 3,
				opacity: 50,
				transparent,
				multicolor: true,
				rotation: 37,
				spacing: 18,
				randomRotation: false,
				randomSpacing: false,
			});
			doc.palette = {
				background: "#103BB9",
				colors: ["#FFFFFF", "#011341", "#ff6600"],
			};
			doc.tiles = core.generateTiles(doc.settings, 42, 3);
			const tonal = shapes.filter((shape) => shape.pack === "Tonal");
			doc.tiles.forEach((tile, index) => {
				tile.shapeId = tonal[index].id;
				tile.partColors = [0, 1, 2, 0];
			});
			doc.tiles[1].override = { kind: "custom", color: "#12ab34" };
			doc.tiles[2].override = { kind: "palette", index: 2 };
			const svg = render.renderSvg(doc);
			const css = render.cssForDocument(doc);
			const decoded = decodeURIComponent(
				css.match(/data:image\/svg\+xml,([^"]+)/)![1],
			);
			document.body.replaceChildren(
				new DOMParser().parseFromString(svg, "image/svg+xml").documentElement,
			);
			const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
			const colors = Array.from(parsed.querySelectorAll("g[color]"), (part) =>
				part.getAttribute("color"),
			);
			const image = new Image();
			image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = 300;
			canvas.height = 200;
			const context = canvas.getContext("2d")!;
			context.drawImage(image, 0, 0);
			const pixels = context.getImageData(0, 0, 300, 200).data;
			const alphaCounts = [26, 51, 77, 128].map((alpha) => {
				let count = 0;
				for (let i = 3; i < pixels.length; i += 4)
					if (Math.abs(pixels[i] - alpha) <= 1) count++;
				return count;
			});
			await downloadPng(doc, 300);
			return {
				sameCss: svg === decoded,
				valid: !parsed.querySelector("parsererror"),
				background: !!parsed.querySelector("svg > rect"),
				colors,
				alphaCounts,
				png: canvas.toDataURL("image/png"),
			};
		}, transparent);
		expect(reference.sameCss).toBe(true);
		expect(reference.valid).toBe(true);
		expect(reference.background).toBe(!transparent);
		expect(reference.colors.slice(4, 8)).toEqual(Array(4).fill("#12ab34"));
		expect(reference.colors.slice(8, 12)).toEqual(Array(4).fill("#ff6600"));
		if (transparent)
			for (const count of reference.alphaCounts)
				expect(count).toBeGreaterThan(100);
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
	});
}
