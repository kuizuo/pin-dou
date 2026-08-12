import type { BeadColor, Pattern, PatternStats } from "./types";
import { MARD_DATA } from "./mard-data";

export function rgbToLab([red, green, blue]: [number, number, number]): [
  number,
  number,
  number,
] {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const x
    = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z
    = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const curve = (value: number) =>
    value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = curve(x),
    fy = curve(y),
    fz = curve(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labDistance(
  a: [number, number, number],
  b: [number, number, number],
) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const toHex = (value: number) => value.toString(16).padStart(2, "0");

export const BEAD_COLORS: BeadColor[] = MARD_DATA.split("\n").map((row) => {
  const [id, red, green, blue] = row.split(",");
  const rgb: [number, number, number] = [
    Number(red),
    Number(green),
    Number(blue),
  ];
  return {
    id,
    name: `MARD ${id}`,
    rgb,
    lab: rgbToLab(rgb),
    hex: `#${rgb.map(toHex).join("")}`,
  };
});

const COLOR_MAP = new Map(BEAD_COLORS.map(color => [color.id, color]));

export function nearestBead(
  rgb: { r: number; g: number; b: number },
  colors = BEAD_COLORS,
) {
  const lab = rgbToLab([rgb.r, rgb.g, rgb.b]);
  return colors.reduce(
    (best, color) =>
      labDistance(lab, color.lab) < labDistance(lab, best.lab) ? color : best,
    colors[0],
  );
}

export function beadById(id: string | null) {
  return (id && COLOR_MAP.get(id)) || BEAD_COLORS[0];
}

export function patternStats(pattern: Pattern): PatternStats {
  const counts = new Map<string, number>();
  for (const id of pattern.cells)
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([id, count]) => ({ color: beadById(id), count }))
    .sort((a, b) => b.count - a.count);
}

export function createSamplePattern(boardSize = 52): Pattern {
  const cells: Array<string | null> = Array(boardSize * boardSize).fill(null);
  const size = Math.min(42, boardSize - 6);
  const offset = Math.floor((boardSize - size) / 2);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const nx = (x - size / 2) / (size / 2),
        ny = (y - size / 2) / (size / 2);
      const face = (nx * nx) / 0.72 + (ny + 0.02) ** 2 / 0.72 < 0.92;
      const ears
        = Math.hypot(nx + 0.58, ny + 0.64) < 0.34
          || Math.hypot(nx - 0.58, ny + 0.64) < 0.34;
      const eye
        = Math.hypot(nx + 0.27, ny + 0.05) < 0.08
          || Math.hypot(nx - 0.27, ny + 0.05) < 0.08;
      const blush
        = Math.hypot(nx + 0.43, ny - 0.26) < 0.13
          || Math.hypot(nx - 0.43, ny - 0.26) < 0.13;
      const mouth
        = Math.abs(ny - 0.22 - Math.abs(nx) * 0.15) < 0.035
          && Math.abs(nx) < 0.22;
      cells[(y + offset) * boardSize + x + offset]
        = eye || mouth ? "H7" : blush ? "E5" : face || ears ? "A15" : null;
    }
  return {
    id: crypto.randomUUID(),
    name: "糖糖猫",
    width: boardSize,
    height: boardSize,
    cells,
    createdAt: new Date().toISOString(),
    sourcePreview: "/samples/sample-cat.svg",
    contentBounds: { x: offset, y: offset, width: size, height: size },
  };
}
