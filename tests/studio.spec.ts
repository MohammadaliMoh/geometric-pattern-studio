import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const key = "form-study:draft";
async function draft(page: Page) {
	await page.waitForTimeout(450);
	return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function geometry(page: Page) {
	return (await draft(page)).tiles.map(
		(t: { x: number; y: number; size: number; shapeId: string }) => [
			t.x,
			t.y,
			t.size,
			t.shapeId,
		],
	);
}
test.beforeEach(async ({ page }) => {
	await page.goto("/");
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await expect(page.getByTestId("artboard")).toBeVisible();
});

test("refresh, grid modes, numeric controls and stable appearance edits", async ({
	page,
}) => {
	const errors: string[] = [];
	page.on("pageerror", (e) => errors.push(e.message));
	const start = await geometry(page);
	await page.getByRole("button", { name: "Refresh", exact: true }).click();
	expect(await geometry(page)).not.toEqual(start);
	await page.getByRole("button", { name: "Mixed sizes", exact: true }).click();
	expect(
		(await draft(page)).tiles.some((t: { size: number }) => t.size !== 1),
	).toBe(true);
	await page.getByRole("button", { name: "Regular grid", exact: true }).click();
	await expect(page.getByRole("button", { name: /Edit tile/ })).toHaveCount(12);
	await page
		.getByRole("spinbutton", { name: "Columns", exact: true })
		.fill("7");
	await page.getByRole("spinbutton", { name: "Rows", exact: true }).fill("5");
	await expect(page.getByRole("button", { name: /Edit tile/ })).toHaveCount(35);
	await page.getByRole("spinbutton", { name: "Density value" }).fill("67");
	await page.getByRole("spinbutton", { name: "Density value" }).blur();
	expect((await draft(page)).settings.density).toBe(67);
	const beforeColor = await geometry(page);
	await page.getByRole("button", { name: "Use Candy palette" }).click();
	await page.getByRole("spinbutton", { name: "Spacing value" }).fill("100");
	await page.getByRole("spinbutton", { name: "Spacing value" }).blur();
	expect(await geometry(page)).toEqual(beforeColor);
	await page.getByLabel("Random rotation", { exact: true }).check();
	await expect(
		page.getByRole("spinbutton", { name: "Rotation value" }),
	).toBeDisabled();
	await page.getByRole("button", { name: "Zoom in" }).click();
	await expect(page.locator(".zoom-controls")).toContainText("125%");
	await page.getByRole("button", { name: "Fit to view" }).click();
	await page
		.getByRole("spinbutton", { name: "Columns", exact: true })
		.fill("12");
	await page.getByRole("spinbutton", { name: "Rows", exact: true }).fill("12");
	await expect(page.getByRole("button", { name: /Edit tile/ })).toHaveCount(
		144,
	);
	await page.getByRole("spinbutton", { name: "Rows", exact: true }).fill("2");
	const wide = await page.getByTestId("artboard").boundingBox();
	expect(Math.abs(wide!.width / wide!.height - 6)).toBeLessThan(0.02);
	await page
		.getByRole("spinbutton", { name: "Columns", exact: true })
		.fill("1");
	await page.getByRole("spinbutton", { name: "Columns", exact: true }).blur();
	await expect(
		page.getByRole("spinbutton", { name: "Columns", exact: true }),
	).toHaveValue("2");
	expect(errors).toEqual([]);
});

test("geometric defaults, library counts, Tonal editing and reload", async ({
	page,
}) => {
	const initial = await draft(page);
	expect(initial.settings).toMatchObject({
		pack: "Connected",
		rows: 3,
		columns: 4,
	});
	expect(initial.palette).toEqual({
		background: "#103BB9",
		colors: ["#FFFFFF", "#011341"],
	});
	await expect(page.locator(".panel-heading").first()).toContainText(
		"62 motifs",
	);
	await expect(page.getByRole("button", { name: /^Connected/ })).toContainText(
		"18 shapes",
	);
	const tonal = page.getByRole("button", { name: /^Tonal/ });
	await expect(tonal).toContainText("12 shapes");
	await tonal.click();
	await page.getByRole("button", { name: "Edit tile 1", exact: true }).click();
	await expect(page.locator(".motif-picker button")).toHaveCount(12);
	await page
		.getByRole("button", { name: "Tonal lenses 270°", exact: true })
		.click();
	await page.getByLabel("Custom tile hex").fill("#123456");
	await page.getByLabel("Custom tile hex").blur();
	await page.getByRole("button", { name: "Save tile" }).click();
	const edited = await draft(page);
	expect(edited.tiles[0]).toMatchObject({
		shapeId: "tonal-lens-270",
		override: { kind: "custom", color: "#123456" },
	});
	await page.reload();
	expect((await draft(page)).tiles).toEqual(edited.tiles);
	for (const opacity of [1, 0.6, 0.4, 0.2])
		await expect(
			page
				.getByTestId("pattern-svg")
				.locator(`[color="#123456"] [opacity="${opacity}"]`),
		).toHaveCount(1);
});

test("tile save, cancel, clear, restore, palette overrides and reload", async ({
	page,
}) => {
	await page.getByRole("button", { name: /^Basics/ }).click();
	const tile = page.getByRole("button", { name: "Edit tile 1", exact: true });
	await tile.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.getByRole("button", { name: "Duo", exact: true }).click();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await tile.click();
	await page.getByRole("button", { name: "Duo", exact: true }).click();
	await page.getByLabel("Custom tile hex").fill("#123456");
	await page.getByLabel("Custom tile hex").blur();
	await page.getByRole("button", { name: "Save tile" }).click();
	expect((await draft(page)).tiles[0]).toMatchObject({
		shapeId: "basics-duo",
		override: { kind: "custom", color: "#123456" },
	});
	await page.getByRole("button", { name: "Use Primary palette" }).click();
	expect((await draft(page)).tiles[0].override.color).toBe("#123456");
	await page.reload();
	expect((await draft(page)).tiles[0].shapeId).toBe("basics-duo");
	await tile.click();
	await page.getByRole("button", { name: "Clear tile", exact: true }).click();
	await page
		.getByRole("button", { name: "Edit tile 1 (empty)", exact: true })
		.click();
	await page.getByRole("button", { name: "Window", exact: true }).click();
	await page.getByRole("button", { name: "Automatic", exact: true }).click();
	await page.getByRole("button", { name: "Save tile" }).click();
	const restored = await draft(page);
	expect(restored.tiles[0].shapeId).toBe("basics-window");
	expect(restored.tiles[0].override).toBeUndefined();
	await page.reload();
	expect((await draft(page)).tiles).toEqual(restored.tiles);
});

test("SVG XML and CSS match preview, transparency, clipboard fallback, PNG downloads", async ({
	page,
}) => {
	await page.getByLabel("Transparent background", { exact: true }).check();
	await page.getByRole("button", { name: "Export", exact: true }).click();
	const svgDownload = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download SVG" }).click();
	const svg = await readFile((await (await svgDownload).path())!, "utf8");
	const result = await page.evaluate((svg) => {
		const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
		const normalized = new DOMParser().parseFromString(svg, "text/html");
		return {
			valid: !parsed.querySelector("parsererror"),
			same: document
				.querySelector('[data-testid="pattern-svg"] svg')!
				.isEqualNode(normalized.querySelector("svg")),
			background: !!parsed.documentElement.querySelector(":scope > rect"),
		};
	}, svg);
	expect(result).toEqual({ valid: true, same: true, background: false });
	await page.getByRole("button", { name: "CSS", exact: true }).click();
	await page.evaluate(() =>
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: () => Promise.reject(new Error("Denied")) },
		}),
	);
	await page.getByRole("button", { name: "Copy CSS" }).click();
	const css = await page
		.getByRole("textbox", { name: "CSS to copy" })
		.inputValue();
	expect(css).toContain(".pattern {");
	expect(
		decodeURIComponent(css.match(/data:image\/svg\+xml,([^"]+)/)![1]),
	).toBe(svg);
	const cssDownload = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download CSS" }).click();
	expect((await cssDownload).suggestedFilename()).toBe("form-study.css");
	await page.getByRole("button", { name: "PNG", exact: true }).click();
	await page.getByRole("spinbutton", { name: "PNG width" }).fill("800");
	const pngDownload = page.waitForEvent("download");
	await page.getByRole("button", { name: "Download PNG" }).click();
	const png = await readFile((await (await pngDownload).path())!);
	expect(png.readUInt32BE(16)).toBe(800);
	expect(png.readUInt32BE(20)).toBe(600);
	expect(png[25]).toBe(6);
	await page.getByRole("button", { name: "Close export", exact: true }).click();
	await page.getByRole("spinbutton", { name: "Rows", exact: true }).fill("6");
	await page.getByRole("button", { name: "Export", exact: true }).click();
	await page.getByRole("button", { name: "PNG", exact: true }).click();
	await page.getByRole("spinbutton", { name: "PNG width" }).fill("4096");
	await expect(
		page.getByRole("button", { name: "Download PNG" }),
	).toBeDisabled();
	await expect(page.getByRole("dialog")).toContainText("16 megapixels");
});

test("Space refresh respects inputs, reset confirms, invalid storage recovers", async ({
	page,
}) => {
	const initial = await draft(page);
	await page.locator("body").click({ position: { x: 10, y: 150 } });
	await page.keyboard.press("Space");
	expect((await draft(page)).seed).not.toBe(initial.seed);
	const next = await draft(page);
	await page.getByRole("spinbutton", { name: "Columns", exact: true }).focus();
	await page.keyboard.press("Space");
	expect((await draft(page)).seed).toBe(next.seed);
	await page
		.getByRole("spinbutton", { name: "Columns", exact: true })
		.fill("9");
	page.once("dialog", (dialog) => dialog.dismiss());
	await page.getByRole("button", { name: "Reset to defaults" }).click();
	expect((await draft(page)).settings.columns).toBe(9);
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "Reset to defaults" }).click();
	expect((await draft(page)).settings.columns).toBe(4);
	await page.goto("about:blank");
	await page.addInitScript(
		(k) => localStorage.setItem(k, '{"version":99}'),
		key,
	);
	await page.goto("/");
	await expect(page.getByRole("status")).toContainText("invalid");
	await expect(page.getByRole("button", { name: /Edit tile/ })).toHaveCount(12);
});

test("desktop and mobile layouts keep artwork usable and keyboard accessible", async ({
	page,
}) => {
	for (const width of [1440, 390]) {
		await page.setViewportSize({ width, height: 1000 });
		const board = await page.getByTestId("artboard").boundingBox();
		expect(board!.width).toBeGreaterThan(250);
		expect(Math.abs(board!.width / board!.height - 4 / 3)).toBeLessThan(0.02);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth),
		).toBe(width);
		await page.screenshot({
			path: `test-results/studio-${width}.png`,
			fullPage: true,
		});
	}
	await page.getByRole("button", { name: "Edit tile 1", exact: true }).focus();
	await page.keyboard.press("Space");
	await expect(page.getByRole("dialog")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await page.locator("summary").filter({ hasText: "Shape & rhythm" }).click();
	await expect(
		page.getByRole("slider", { name: "Spacing", exact: true }),
	).not.toBeVisible();
});
