export type Pack =
	| "Connected"
	| "Tonal"
	| "Truchet"
	| "Op Art"
	| "Basics"
	| "Arcs"
	| "Angular"
	| "Playful";
export const packs: Pack[] = [
	"Connected",
	"Tonal",
	"Truchet",
	"Op Art",
	"Basics",
	"Arcs",
	"Angular",
	"Playful",
];

export interface ShapeDefinition {
	id: string;
	name: string;
	pack: Pack;
	parts: string[];
}

function orientations(
	id: string,
	name: string,
	pack: Pack,
	parts: string[],
): ShapeDefinition[] {
	return [0, 90, 180, 270].map((angle) => ({
		id: `${id}-${angle}`,
		name: `${name} ${angle}°`,
		pack,
		parts: parts.map(
			(part) => `<g transform="rotate(${angle} 50 50)">${part}</g>`,
		),
	}));
}

function tonalParts(path: string): string[] {
	// Rotate a single quadrant around the tile; interiors never overlap.
	return [1, 0.6, 0.4, 0.2].map(
		(opacity, index) =>
			`<path d="${path}" transform="rotate(${index * 90} 50 50)" fill="currentColor" opacity="${opacity}"/>`,
	);
}

function quarterAnnulus(inner: number, outer: number): string {
	return `M${outer} 0A${outer} ${outer} 0 0 1 0 ${outer}L0 ${inner}A${inner} ${inner} 0 0 0 ${inner} 0Z`;
}

// Each motif is drawn in a 100 × 100 local coordinate system.
export const shapes: ShapeDefinition[] = [
	...[0, 90].map((angle, index) => ({
		id: `truchet-${index === 0 ? "a" : "b"}`,
		name: `Truchet ${index === 0 ? "A" : "B"}`,
		pack: "Truchet" as const,
		parts: [angle, angle + 180].map(
			(rotation) =>
				`<path d="${quarterAnnulus(42, 58)}" transform="rotate(${rotation} 50 50)" fill="currentColor"/>`,
		),
	})),
	{
		id: "op-art-horizontal",
		name: "Horizontal bands",
		pack: "Op Art",
		parts: [
			`<path d="${[5, 25, 45, 65, 85].map((y) => `M0 ${y}h100v10H0Z`).join("")}" fill="currentColor"/>`,
		],
	},
	{
		id: "op-art-vertical",
		name: "Vertical bands",
		pack: "Op Art",
		parts: [
			`<path d="${[5, 25, 45, 65, 85].map((x) => `M${x} 0h10v100H${x}Z`).join("")}" fill="currentColor"/>`,
		],
	},
	...[0, 90, 180, 270].map((angle) => ({
		id: `op-art-corner-${angle}`,
		name: `Corner bands ${angle}°`,
		pack: "Op Art" as const,
		parts: [
			`<path d="${[5, 25, 45, 65, 85].map((inner) => quarterAnnulus(inner, inner + 10)).join("")}" transform="rotate(${angle} 50 50)" fill="currentColor"/>`,
		],
	})),

	{
		id: "connected-square",
		name: "Square",
		pack: "Connected",
		parts: ['<rect width="100" height="100" fill="currentColor"/>'],
	},
	{
		id: "connected-disc",
		name: "Disc",
		pack: "Connected",
		parts: ['<circle cx="50" cy="50" r="50" fill="currentColor"/>'],
	},
	...orientations("connected-quarter", "Quarter-disc", "Connected", [
		'<path d="M0 0H100A100 100 0 0 1 0 100Z" fill="currentColor"/>',
	]),
	...orientations("connected-semicircle", "Semicircle", "Connected", [
		'<path d="M0 0H100A50 50 0 0 1 0 0Z" fill="currentColor"/>',
	]),
	// Two downward semicircles stack without overlap and span the full tile.
	...orientations("connected-paired", "Paired semicircles", "Connected", [
		'<path d="M0 0H100A50 50 0 0 1 0 0Z" fill="currentColor"/>',
		'<path d="M0 50H100A50 50 0 0 1 0 50Z" fill="currentColor"/>',
	]),
	...orientations("connected-rounded", "Three rounded corners", "Connected", [
		'<path d="M0 0H50A50 50 0 0 1 100 50A50 50 0 0 1 50 100A50 50 0 0 1 0 50Z" fill="currentColor"/>',
	]),
	...orientations(
		"tonal-quarter",
		"Tonal quarter-discs",
		"Tonal",
		tonalParts("M0 0H50A50 50 0 0 1 0 50Z"),
	),
	...orientations(
		"tonal-triangle",
		"Tonal triangles",
		"Tonal",
		tonalParts("M0 0H50L0 50Z"),
	),
	...orientations(
		"tonal-lens",
		"Tonal lenses",
		"Tonal",
		tonalParts("M0 0A50 50 0 0 1 50 50A50 50 0 0 1 0 0Z"),
	),
	{
		id: "basics-disc",
		name: "Disc",
		pack: "Basics",
		parts: ['<circle cx="50" cy="50" r="44" fill="currentColor"/>'],
	},
	{
		id: "basics-duo",
		name: "Duo",
		pack: "Basics",
		parts: [
			'<path d="M6 6H48V94H6Z" fill="currentColor"/>',
			'<path d="M56 6H94V94H56Z" fill="currentColor"/>',
		],
	},
	{
		id: "basics-window",
		name: "Window",
		pack: "Basics",
		parts: [
			'<path d="M6 6H46V46H6ZM54 54H94V94H54Z" fill="currentColor"/>',
			'<path d="M54 6H94V46H54ZM6 54H46V94H6Z" fill="currentColor"/>',
		],
	},
	{
		id: "basics-ring",
		name: "Ring",
		pack: "Basics",
		parts: [
			'<path fill-rule="evenodd" d="M50 4a46 46 0 1 0 0 92 46 46 0 1 0 0-92Zm0 23a23 23 0 1 1 0 46 23 23 0 1 1 0-46Z" fill="currentColor"/>',
		],
	},
	{
		id: "basics-step",
		name: "Step",
		pack: "Basics",
		parts: ['<path d="M6 6H50V50H94V94H6Z" fill="currentColor"/>'],
	},
	{
		id: "basics-capsules",
		name: "Capsules",
		pack: "Basics",
		parts: [
			'<rect x="6" y="8" width="38" height="84" rx="19" fill="currentColor"/>',
			'<rect x="56" y="8" width="38" height="84" rx="19" fill="currentColor"/>',
		],
	},
	{
		id: "basics-cross",
		name: "Cross",
		pack: "Basics",
		parts: [
			'<path d="M34 6H66V34H94V66H66V94H34V66H6V34H34Z" fill="currentColor"/>',
		],
	},
	{
		id: "basics-orbit",
		name: "Orbit",
		pack: "Basics",
		parts: [
			'<circle cx="30" cy="30" r="24" fill="currentColor"/>',
			'<circle cx="72" cy="72" r="22" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-quarter",
		name: "Quarter",
		pack: "Arcs",
		parts: ['<path d="M6 94V6A88 88 0 0 1 94 94Z" fill="currentColor"/>'],
	},
	{
		id: "arcs-rainbow",
		name: "Rainbow",
		pack: "Arcs",
		parts: [
			'<path d="M6 94V50a44 44 0 0 1 88 0v44H76V50a26 26 0 0 0-52 0v44Z" fill="currentColor"/>',
			'<path d="M32 94V50a18 18 0 0 1 36 0v44Z" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-crescent",
		name: "Crescent",
		pack: "Arcs",
		parts: [
			'<path d="M76 8a46 46 0 1 0 0 84A49 49 0 0 1 76 8Z" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-lens",
		name: "Lens",
		pack: "Arcs",
		parts: ['<path d="M6 50Q50-34 94 50Q50 134 6 50Z" fill="currentColor"/>'],
	},
	{
		id: "arcs-wave",
		name: "Wave",
		pack: "Arcs",
		parts: [
			'<path d="M6 24Q28 0 50 24T94 24V50Q72 74 50 50T6 50Z" fill="currentColor"/>',
			'<path d="M6 58Q28 34 50 58T94 58V84Q72 108 50 84T6 84Z" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-fan",
		name: "Fan",
		pack: "Arcs",
		parts: [
			'<path d="M6 94V6A88 88 0 0 1 94 94H70A64 64 0 0 0 6 30Z" fill="currentColor"/>',
			'<path d="M6 94V46A48 48 0 0 1 54 94Z" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-twin",
		name: "Twin arches",
		pack: "Arcs",
		parts: [
			'<path d="M6 48a22 22 0 0 1 44 0v46H6Z" fill="currentColor"/>',
			'<path d="M50 6h44v46a22 22 0 0 1-44 0Z" fill="currentColor"/>',
		],
	},
	{
		id: "arcs-petal",
		name: "Petal",
		pack: "Arcs",
		parts: [
			'<path d="M6 94V50A44 44 0 0 1 50 6h44v44a44 44 0 0 1-44 44Z" fill="currentColor"/>',
		],
	},
	{
		id: "angular-peak",
		name: "Peak",
		pack: "Angular",
		parts: ['<path d="M6 94 50 6 94 94Z" fill="currentColor"/>'],
	},
	{
		id: "angular-chevron",
		name: "Chevron",
		pack: "Angular",
		parts: ['<path d="M6 6 50 44 94 6V48L50 88 6 48Z" fill="currentColor"/>'],
	},
	{
		id: "angular-bolt",
		name: "Bolt",
		pack: "Angular",
		parts: [
			'<path d="M52 4 14 56H44L34 96 86 38H56L68 4Z" fill="currentColor"/>',
		],
	},
	{
		id: "angular-diamond",
		name: "Diamond split",
		pack: "Angular",
		parts: [
			'<path d="M50 4 96 50H50Z" fill="currentColor"/>',
			'<path d="M50 4V50H4ZM4 50H50V96Z" fill="currentColor"/>',
			'<path d="M50 50H96L50 96Z" fill="currentColor"/>',
		],
	},
	{
		id: "angular-zigzag",
		name: "Zigzag",
		pack: "Angular",
		parts: ['<path d="M6 10H38L62 42H94V90H62L38 58H6Z" fill="currentColor"/>'],
	},
	{
		id: "angular-kite",
		name: "Kite",
		pack: "Angular",
		parts: [
			'<path d="M50 4 94 34 50 96Z" fill="currentColor"/>',
			'<path d="M50 4V96L6 34Z" fill="currentColor"/>',
		],
	},
	{
		id: "angular-stairs",
		name: "Stairs",
		pack: "Angular",
		parts: ['<path d="M6 94V64H34V36H62V8H94V94Z" fill="currentColor"/>'],
	},
	{
		id: "angular-hourglass",
		name: "Hourglass",
		pack: "Angular",
		parts: [
			'<path d="M6 6H94L50 50Z" fill="currentColor"/>',
			'<path d="M6 94 50 50 94 94Z" fill="currentColor"/>',
		],
	},
	{
		id: "playful-flower",
		name: "Flower",
		pack: "Playful",
		parts: [
			'<path d="M50 28C14-18-18 44 28 50-18 86 44 118 50 72 86 118 118 56 72 50 118 14 56-18 50 28Z" fill="currentColor"/>',
			'<circle cx="50" cy="50" r="12" fill="currentColor"/>',
		],
	},
	{
		id: "playful-spark",
		name: "Spark",
		pack: "Playful",
		parts: [
			'<path d="M50 4 61 35 94 22 72 50 94 78 61 65 50 96 39 65 6 78 28 50 6 22 39 35Z" fill="currentColor"/>',
		],
	},
	{
		id: "playful-bean",
		name: "Bean",
		pack: "Playful",
		parts: [
			'<path d="M22 12C72-12 110 44 84 80S14 98 8 64 46 56 46 38 8 40 22 12Z" fill="currentColor"/>',
		],
	},
	{
		id: "playful-confetti",
		name: "Confetti",
		pack: "Playful",
		parts: [
			'<circle cx="24" cy="25" r="17" fill="currentColor"/>',
			'<path d="m60 8 34 16-18 34-30-16Z" fill="currentColor"/>',
			'<path d="m12 74 34-24 16 44Z" fill="currentColor"/>',
			'<circle cx="80" cy="80" r="13" fill="currentColor"/>',
		],
	},
	{
		id: "playful-squiggle",
		name: "Squiggle",
		pack: "Playful",
		parts: [
			'<path d="M8 12C92-8 96 42 50 48S8 82 92 70V92C-6 110-14 40 44 30S64 18 8 34Z" fill="currentColor"/>',
		],
	},
	{
		id: "playful-heart",
		name: "Heart",
		pack: "Playful",
		parts: [
			'<path d="M50 92 12 52C-14 18 28-12 50 20 72-12 114 18 88 52Z" fill="currentColor"/>',
		],
	},
	{
		id: "playful-bubbles",
		name: "Bubbles",
		pack: "Playful",
		parts: [
			'<circle cx="32" cy="38" r="28" fill="currentColor"/>',
			'<circle cx="73" cy="69" r="23" fill="currentColor"/>',
			'<circle cx="78" cy="16" r="10" fill="currentColor"/>',
		],
	},
	{
		id: "playful-crown",
		name: "Crown",
		pack: "Playful",
		parts: [
			'<path d="M14 88 6 20 32 44 50 8 68 44 94 20 86 88Z" fill="currentColor"/>',
			'<circle cx="50" cy="68" r="10" fill="currentColor"/>',
		],
	},
];

export function getShapes(pack: Pack): ShapeDefinition[] {
	return shapes.filter((shape) => shape.pack === pack);
}
