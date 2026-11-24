import type { BeadColor, BeadMaterial, Pattern, PatternStats } from "./types";
import { MARD_DATA } from "./mard-data";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const POW25_7 = 6_103_515_625;
const MAX_SL = 1.75;
const MAX_RGB_CACHE = 32_768;

export const SRGB_TO_LINEAR = Float64Array.from({ length: 256 }, (_, value) => {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
});

export function toLinearChannel(value: number) {
  const clamped = value <= 0 ? 0 : value >= 255 ? 255 : value;
  const rounded = Math.round(clamped);
  if (Math.abs(clamped - rounded) < 1e-6) return SRGB_TO_LINEAR[rounded];
  const channel = clamped / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

export function fromLinearChannel(value: number) {
  const clamped = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return 255 * (clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * clamped ** (1 / 2.4) - 0.055);
}

export function rgbToLab([red, green, blue]: [number, number, number]): [
  number,
  number,
  number,
] {
  const r = toLinearChannel(red);
  const g = toLinearChannel(green);
  const b = toLinearChannel(blue);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function labDistance(
  a: [number, number, number],
  b: [number, number, number],
) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function ciede2000(
  l1: number,
  a1: number,
  b1: number,
  l2: number,
  a2: number,
  b2: number,
) {
  if (l1 === l2 && a1 === a2 && b1 === b2) return 0;
  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const meanC = (c1 + c2) * 0.5;
  const mc2 = meanC * meanC;
  const mc7 = mc2 * mc2 * mc2 * meanC;
  const g = 0.5 * (1 - Math.sqrt(mc7 / (mc7 + POW25_7)));
  const ap1 = (1 + g) * a1;
  const ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1);
  const cp2 = Math.hypot(ap2, b2);
  let hp1 = Math.atan2(b1, ap1) * DEG;
  if (hp1 < 0) hp1 += 360;
  let hp2 = Math.atan2(b2, ap2) * DEG;
  if (hp2 < 0) hp2 += 360;
  const dl = l2 - l1;
  const dc = cp2 - cp1;
  const cpProd = cp1 * cp2;
  let dh = hp2 - hp1;
  if (cpProd === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const bigH = 2 * Math.sqrt(cpProd) * Math.sin(dh * 0.5 * RAD);
  const meanL = (l1 + l2) * 0.5;
  const meanCp = (cp1 + cp2) * 0.5;
  let meanH = hp1 + hp2;
  if (cpProd !== 0) {
    if (Math.abs(hp1 - hp2) <= 180) meanH *= 0.5;
    else if (meanH < 360) meanH = (meanH + 360) * 0.5;
    else meanH = (meanH - 360) * 0.5;
  }
  const t
    = 1
      - 0.17 * Math.cos((meanH - 30) * RAD)
      + 0.24 * Math.cos(2 * meanH * RAD)
      + 0.32 * Math.cos((3 * meanH + 6) * RAD)
      - 0.2 * Math.cos((4 * meanH - 63) * RAD);
  const ml50 = meanL - 50;
  const ml50Sq = ml50 * ml50;
  const sl = 1 + (0.015 * ml50Sq) / Math.sqrt(20 + ml50Sq);
  const sc = 1 + 0.045 * meanCp;
  const sh = 1 + 0.015 * meanCp * t;
  const mcp2 = meanCp * meanCp;
  const mcp7 = mcp2 * mcp2 * mcp2 * meanCp;
  const dTheta = (meanH - 275) / 25;
  const rt
    = -2
      * Math.sqrt(mcp7 / (mcp7 + POW25_7))
      * Math.sin(60 * Math.exp(-(dTheta * dTheta)) * RAD);
  const light = dl / sl;
  const chroma = dc / sc;
  const hueTerm = bigH / sh;
  return Math.sqrt(
    Math.max(
      0,
      light * light + chroma * chroma + hueTerm * hueTerm + rt * chroma * hueTerm,
    ),
  );
}

export function colorDistance(
  [L1, a1, b1]: [number, number, number],
  [L2, a2, b2]: [number, number, number],
) {
  return ciede2000(L1, a1, b1, L2, a2, b2);
}

export function beadMaterialOf(id: string): BeadMaterial {
  if (/^(A|B|C|D|E|F|G|H|M)\d+$/.test(id)) return "solid";
  if (id.startsWith("P")) return "pearl";
  if (id.startsWith("Q")) return "glow";
  if (id.startsWith("R") || id.startsWith("T")) return "transparent";
  if (id.startsWith("Y")) return "neon";
  return "special";
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
    material: beadMaterialOf(id),
  };
});

export const CORE_BEAD_COLORS: BeadColor[] = BEAD_COLORS.filter(
  color => color.material === "solid",
);

const COLOR_MAP = new Map(BEAD_COLORS.map(color => [color.id, color]));

type PaletteSearchIndex = {
  sorted: BeadColor[];
  originalIndex: Int32Array;
  ls: Float64Array;
  as: Float64Array;
  bs: Float64Array;
  rgbCache: Map<number, BeadColor>;
};

const PALETTE_INDEX_CACHE = new WeakMap<readonly BeadColor[], PaletteSearchIndex>();

function paletteSearchIndex(colors: readonly BeadColor[]): PaletteSearchIndex {
  const cached = PALETTE_INDEX_CACHE.get(colors);
  if (cached) return cached;
  const order = Array.from({ length: colors.length }, (_, index) => index).sort(
    (a, b) => colors[a].lab[0] - colors[b].lab[0] || a - b,
  );
  const sorted = order.map(index => colors[index]);
  const index: PaletteSearchIndex = {
    sorted,
    originalIndex: Int32Array.from(order),
    ls: Float64Array.from(sorted, color => color.lab[0]),
    as: Float64Array.from(sorted, color => color.lab[1]),
    bs: Float64Array.from(sorted, color => color.lab[2]),
    rgbCache: new Map(),
  };
  PALETTE_INDEX_CACHE.set(colors, index);
  return index;
}

export function nearestBeadByLab(
  [l, a, b]: [number, number, number],
  colors: readonly BeadColor[] = CORE_BEAD_COLORS,
): BeadColor {
  if (colors.length <= 24) {
    let best = colors[0];
    let bestDist = ciede2000(l, a, b, best.lab[0], best.lab[1], best.lab[2]);
    for (let index = 1; index < colors.length; index += 1) {
      const color = colors[index];
      const dl = Math.abs(l - color.lab[0]);
      if (dl >= bestDist * MAX_SL) continue;
      const dist = ciede2000(l, a, b, color.lab[0], color.lab[1], color.lab[2]);
      if (dist < bestDist) {
        best = color;
        bestDist = dist;
      }
    }
    return best;
  }

  const { sorted, originalIndex, ls, as, bs } = paletteSearchIndex(colors);
  const count = sorted.length;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ls[mid] < l) lo = mid + 1;
    else hi = mid;
  }

  let bestPos = lo;
  let bestOrig = originalIndex[lo];
  let bestDist = ciede2000(l, a, b, ls[lo], as[lo], bs[lo]);

  let left = lo - 1;
  let right = lo + 1;
  while (left >= 0 || right < count) {
    if (left >= 0) {
      const l2 = ls[left];
      const dl = l - l2;
      if (dl >= bestDist * MAX_SL) left = -1;
      else {
        const ml50 = (l + l2) * 0.5 - 50;
        const sl = 1 + (0.015 * ml50 * ml50) / Math.sqrt(20 + ml50 * ml50);
        if (dl / sl <= bestDist) {
          const dist = ciede2000(l, a, b, l2, as[left], bs[left]);
          if (
            dist < bestDist
            || (dist === bestDist && originalIndex[left] < bestOrig)
          ) {
            bestDist = dist;
            bestPos = left;
            bestOrig = originalIndex[left];
          }
        }
        left -= 1;
      }
    }
    if (right < count) {
      const l2 = ls[right];
      const dl = l2 - l;
      if (dl >= bestDist * MAX_SL) right = count;
      else {
        const ml50 = (l + l2) * 0.5 - 50;
        const sl = 1 + (0.015 * ml50 * ml50) / Math.sqrt(20 + ml50 * ml50);
        if (dl / sl <= bestDist) {
          const dist = ciede2000(l, a, b, l2, as[right], bs[right]);
          if (
            dist < bestDist
            || (dist === bestDist && originalIndex[right] < bestOrig)
          ) {
            bestDist = dist;
            bestPos = right;
            bestOrig = originalIndex[right];
          }
        }
        right += 1;
      }
    }
  }
  return sorted[bestPos];
}

export function nearestBead(
  rgb: { r: number; g: number; b: number },
  colors: readonly BeadColor[] = CORE_BEAD_COLORS,
) {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  const key = (r << 16) | (g << 8) | b;
  const index = paletteSearchIndex(colors);
  const cached = index.rgbCache.get(key);
  if (cached) return cached;
  const result = nearestBeadByLab(rgbToLab([r, g, b]), colors);
  if (index.rgbCache.size >= MAX_RGB_CACHE) index.rgbCache.clear();
  index.rgbCache.set(key, result);
  return result;
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

export function patternContentSize(pattern: Pattern) {
  let minX = pattern.width,
    minY = pattern.height,
    maxX = -1,
    maxY = -1;
  for (let index = 0; index < pattern.cells.length; index += 1) {
    if (!pattern.cells[index]) continue;
    const x = index % pattern.width,
      y = Math.floor(index / pattern.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { width: maxX - minX + 1, height: maxY - minY + 1 };
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
