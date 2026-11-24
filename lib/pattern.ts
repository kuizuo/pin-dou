import type {
  BackgroundMode,
  BeadColor,
  DitheringMode,
  GenerationSettings,
  Pattern,
  ProcessingMode,
  SourceTransform,
} from "./types";
import { removeBackgroundCells, removePlainBackground } from "./background";
import {
  BEAD_COLORS,
  beadById,
  colorDistance,
  CORE_BEAD_COLORS,
  fromLinearChannel,
  labDistance,
  nearestBead,
  nearestBeadByLab,
  patternStats,
  rgbToLab,
  SRGB_TO_LINEAR,
} from "./beads";
import { DEFAULT_TRANSFORM } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function validateImageFile(file: Pick<File, "name" | "type" | "size">) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (
    !IMAGE_TYPES.has(file.type.toLowerCase())
    && !["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension || "")
  ) {
    throw new Error("请选择 JPG、PNG、WebP 或 HEIC 图片。");
  }
  if (file.size > MAX_FILE_BYTES)
    throw new Error("图片超过 10MB，请压缩后再试。");
}

export function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.readAsDataURL(blob);
  });
}

export async function prepareImageFile(file: File) {
  validateImageFile(file);
  if (!/hei[cf]/i.test(file.type) && !/\.hei[cf]$/i.test(file.name))
    return readBlobAsDataUrl(file);
  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.94,
    });
    return readBlobAsDataUrl(Array.isArray(result) ? result[0] : result);
  }
  catch {
    throw new Error("这张 HEIC 图片无法打开，请在相册中转存为 JPG 后再试。");
  }
}

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片无法打开，请换一张再试。"));
    image.src = src;
  });
}

export async function removeBackground(
  dataUrl: string,
  mode: BackgroundMode,
  onProgress?: (message: string) => void,
) {
  if (mode === "keep") return dataUrl;
  return removePlainBackground(dataUrl, onProgress);
}

export function cropAreaPixels(
  transform: SourceTransform,
  imageWidth: number,
  imageHeight: number,
) {
  const swapped = transform.rotation === 90 || transform.rotation === 270,
    width = swapped ? imageHeight : imageWidth,
    height = swapped ? imageWidth : imageHeight;
  const crop = transform.crop || { x: 0, y: 0, width: 100, height: 100 };
  const x = Math.max(0, Math.min(width, (width * crop.x) / 100)),
    y = Math.max(0, Math.min(height, (height * crop.y) / 100));
  return {
    x,
    y,
    width: Math.max(1, Math.min(width - x, (width * crop.width) / 100)),
    height: Math.max(1, Math.min(height - y, (height * crop.height) / 100)),
    orientedWidth: width,
    orientedHeight: height,
  };
}

function selectedCanvas(
  image: HTMLImageElement,
  transform: SourceTransform,
  crop = transform.crop || { x: 0, y: 0, width: 100, height: 100 },
) {
  const bounds = cropAreaPixels(
      { ...transform, crop },
      image.naturalWidth,
      image.naturalHeight,
    ),
    scale = Math.min(1, 1600 / Math.max(bounds.width, bounds.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理图片，请更新浏览器后重试。");
  context.scale(scale, scale);
  context.translate(
    bounds.orientedWidth / 2 - bounds.x,
    bounds.orientedHeight / 2 - bounds.y,
  );
  const zoom = Math.max(0.25, Math.min(1.75, transform.zoom || 1));
  context.scale(zoom, zoom);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  return canvas;
}

function transformedCanvas(
  image: HTMLImageElement,
  transform: SourceTransform,
) {
  if (transform.crop) return selectedCanvas(image, transform);
  const zoom = Math.max(1, Math.min(3, transform.zoom));
  const cropWidth = image.naturalWidth / zoom,
    cropHeight = image.naturalHeight / zoom;
  const sourceX
    = ((image.naturalWidth - cropWidth) * (transform.offsetX + 1)) / 2;
  const sourceY
    = ((image.naturalHeight - cropHeight) * (transform.offsetY + 1)) / 2;
  const swapped = transform.rotation === 90 || transform.rotation === 270;
  const scale = Math.min(1, 1600 / Math.max(cropWidth, cropHeight));
  const drawWidth = Math.max(1, Math.round(cropWidth * scale)),
    drawHeight = Math.max(1, Math.round(cropHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = swapped ? drawHeight : drawWidth;
  canvas.height = swapped ? drawWidth : drawHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理图片，请更新浏览器后重试。");
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((transform.rotation * Math.PI) / 180);
  context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}

export async function renderSourcePreview(
  dataUrl: string,
  transform: SourceTransform,
) {
  return selectedCanvas(await loadImage(dataUrl), transform, {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  }).toDataURL("image/png");
}

export async function renderGenerationSource(
  dataUrl: string,
  transform: SourceTransform,
) {
  return transformedCanvas(await loadImage(dataUrl), transform).toDataURL(
    "image/png",
  );
}

export function fitPreviewSize(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
) {
  const scale = Math.min(
    (containerWidth * 0.86) / imageWidth,
    (containerHeight * 0.86) / imageHeight,
  );
  return {
    width: Math.max(1, imageWidth * scale),
    height: Math.max(1, imageHeight * scale),
  };
}

export const PALETTE_SIZES = [
  291, 221, 216, 168, 144, 120, 96, 72, 48, 24,
] as const;

const ALPHA_THRESHOLD = 96;

const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

export function mardPalette(
  requestedSize: number,
  excludedColorIds: string[] = [],
) {
  const size = Math.max(
    1,
    Math.min(BEAD_COLORS.length, Math.round(requestedSize)),
  );
  let colors: BeadColor[];
  if (size >= BEAD_COLORS.length) colors = BEAD_COLORS;
  else if (size === CORE_BEAD_COLORS.length) colors = CORE_BEAD_COLORS;
  else {
    const candidates = size < CORE_BEAD_COLORS.length ? CORE_BEAD_COLORS : BEAD_COLORS;
    const black = candidates.find(color => color.id === "H7")
      ?? candidates.reduce((darkest, color) =>
        color.lab[0] < darkest.lab[0] ? color : darkest,
      );
    const white = candidates.find(color => color.id === "H2")
      ?? candidates.reduce((lightest, color) =>
        color.lab[0] > lightest.lab[0] ? color : lightest,
      );
    const selected: BeadColor[] = [black];
    if (size > 1 && white !== black) selected.push(white);

    const distances = new Map<string, number>();
    for (const color of candidates) {
      let minDist = Infinity;
      for (const seed of selected)
        minDist = Math.min(minDist, labDistance(color.lab, seed.lab));
      distances.set(color.id, minDist);
    }

    const target = Math.min(size, candidates.length);
    while (selected.length < target) {
      let next = candidates[0];
      let bestDist = -1;
      for (const color of candidates) {
        const dist = distances.get(color.id) ?? 0;
        if (dist > bestDist) {
          bestDist = dist;
          next = color;
        }
      }
      selected.push(next);
      distances.set(next.id, 0);
      for (const color of candidates) {
        const current = distances.get(color.id) ?? 0;
        if (current === 0) continue;
        const nextDist = labDistance(color.lab, next.lab);
        if (nextDist < current) distances.set(color.id, nextDist);
      }
    }
    colors = selected;
  }
  const excluded = new Set(excludedColorIds);
  const available = colors.filter(color => !excluded.has(color.id));
  return available.length ? available : colors.slice(0, 1);
}

type WeightedPoint = {
  color: BeadColor;
  weight: number;
  sumL: number;
  sumA: number;
  sumB: number;
};

function choosePalette(
  pixels: Uint8ClampedArray,
  maxColors: number,
  availableColors: readonly BeadColor[] = CORE_BEAD_COLORS,
  colorMerge = 0,
) {
  const buckets = new Map<string, WeightedPoint>();
  let totalOpaque = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < ALPHA_THRESHOLD) continue;
    totalOpaque += 1;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const color = nearestBead({ r, g, b }, availableColors);
    const lab = rgbToLab([r, g, b]);
    const existing = buckets.get(color.id);
    if (existing) {
      existing.weight += 1;
      existing.sumL += lab[0];
      existing.sumA += lab[1];
      existing.sumB += lab[2];
    }
    else {
      buckets.set(color.id, {
        color,
        weight: 1,
        sumL: lab[0],
        sumA: lab[1],
        sumB: lab[2],
      });
    }
  }

  const points = [...buckets.values()];
  if (points.length <= maxColors) return points.map(point => point.color);

  const pointLabs = points.map(point => [
    point.sumL / point.weight,
    point.sumA / point.weight,
    point.sumB / point.weight,
  ] as [number, number, number]);

  // Seed with the highest-weight color
  const firstIndex = points.reduce(
    (best, point, index) => (point.weight > points[best].weight ? index : best),
    0,
  );
  const first = points[firstIndex];
  const minUsefulCount = totalOpaque >= 64
    ? Math.max(2, Math.ceil(totalOpaque * 0.0015))
    : 1;
  // Filter 1px noise while preserving small (2+ px) high-contrast details such as eyes and highlights
  const filtered = points.filter(
    point =>
      point.weight >= minUsefulCount
      || (point.weight >= 2 && colorDistance(point.color.lab, first.color.lab) >= 22),
  );
  const candidates = filtered.length >= maxColors ? filtered : points;

  const selected: BeadColor[] = [first.color];
  const selectedIds = new Set<string>([first.color.id]);

  // Pairwise CIEDE2000 distances from each pixel-cluster centroid to current nearest selected color
  const currentDist = Float64Array.from(pointLabs, lab =>
    colorDistance(lab, first.color.lab),
  );

  // Greedy weighted SSE reduction (Facility Location / K-Medoids++), honoring colorMerge spacing
  while (selected.length < maxColors) {
    let bestCandidate: BeadColor | null = null;
    let bestGain = -1;
    let fallbackCandidate: BeadColor | null = null;
    let fallbackGain = -1;

    for (const candidate of candidates) {
      if (selectedIds.has(candidate.color.id)) continue;
      let minSelectedDist = Infinity;
      for (const kept of selected) {
        const d = colorDistance(candidate.color.lab, kept.lab);
        if (d < minSelectedDist) minSelectedDist = d;
      }

      let gain = 0;
      for (let i = 0; i < points.length; i += 1) {
        const before = currentDist[i];
        if (before === 0) continue;
        const dist = colorDistance(pointLabs[i], candidate.color.lab);
        if (dist < before)
          gain += points[i].weight * (before * before - dist * dist);
      }

      if (colorMerge <= 0 || minSelectedDist > colorMerge) {
        if (gain > bestGain) {
          bestGain = gain;
          bestCandidate = candidate.color;
        }
      }
      if (gain > fallbackGain) {
        fallbackGain = gain;
        fallbackCandidate = candidate.color;
      }
    }

    const chosen = bestCandidate ?? fallbackCandidate;
    if (!chosen || (bestGain <= 0 && fallbackGain <= 0)) break;
    selected.push(chosen);
    selectedIds.add(chosen.id);
    for (let i = 0; i < points.length; i += 1) {
      const dist = colorDistance(pointLabs[i], chosen.lab);
      if (dist < currentDist[i]) currentDist[i] = dist;
    }
  }

  // Lloyd / Medoid centroid refinement: allow picking compromise MARD colors in availableColors
  if (selected.length > 1 && availableColors.length > selected.length) {
    const totalSse = (palette: BeadColor[]) => {
      let sse = 0;
      for (let i = 0; i < points.length; i += 1) {
        let best = Infinity;
        for (const color of palette) {
          const d = colorDistance(pointLabs[i], color.lab);
          if (d < best) best = d;
        }
        sse += points[i].weight * best * best;
      }
      return sse;
    };

    let bestSse = totalSse(selected);
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const clusterL = new Float64Array(selected.length);
      const clusterA = new Float64Array(selected.length);
      const clusterB = new Float64Array(selected.length);
      const clusterW = new Float64Array(selected.length);

      for (let i = 0; i < points.length; i += 1) {
        let nearestIndex = 0;
        let nearestDist = Infinity;
        for (let k = 0; k < selected.length; k += 1) {
          const d = colorDistance(pointLabs[i], selected[k].lab);
          if (d < nearestDist) {
            nearestDist = d;
            nearestIndex = k;
          }
        }
        clusterL[nearestIndex] += points[i].sumL;
        clusterA[nearestIndex] += points[i].sumA;
        clusterB[nearestIndex] += points[i].sumB;
        clusterW[nearestIndex] += points[i].weight;
      }

      let improved = false;
      for (let k = 0; k < selected.length; k += 1) {
        if (clusterW[k] === 0) continue;
        // Protect crisp pure black/white anchor beads from being washed out into muddy gray/brown
        const currentL = selected[k].lab[0];
        const centroid: [number, number, number] = [
          clusterL[k] / clusterW[k],
          clusterA[k] / clusterW[k],
          clusterB[k] / clusterW[k],
        ];
        const snapped = nearestBeadByLab(centroid, availableColors);
        if (snapped.id === selected[k].id || selectedIds.has(snapped.id))
          continue;
        if ((currentL < 18 || currentL > 96) && Math.abs(snapped.lab[0] - currentL) > 5)
          continue;
        if (
          colorMerge > 0
          && selected.some(
            (other, idx) =>
              idx !== k && colorDistance(snapped.lab, other.lab) <= colorMerge,
          )
        )
          continue;
        const trial = [...selected];
        trial[k] = snapped;
        const trialSse = totalSse(trial);
        if (trialSse + 1e-6 < bestSse) {
          selectedIds.delete(selected[k].id);
          selectedIds.add(snapped.id);
          selected[k] = snapped;
          bestSse = trialSse;
          improved = true;
        }
      }
      if (!improved) break;
    }
  }

  return selected;
}

function cleanSmallRegions(
  cells: Array<string | null>,
  width: number,
  maxSize = 2,
  maxDistance = 12,
) {
  const height = Math.ceil(cells.length / width);
  const result = [...cells];
  const visited = new Uint8Array(cells.length);
  for (let start = 0; start < cells.length; start += 1) {
    if (visited[start] || !cells[start]) continue;
    const targetId = cells[start]!;
    const queue = [start];
    const region: number[] = [];
    const neighbors = new Map<string, number>();
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      region.push(index);
      const x = index % width;
      for (const next of [
        x ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        index - width,
        index + width,
      ]) {
        if (next < 0 || next >= cells.length) continue;
        if (cells[next] === targetId && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
        else if (cells[next] && cells[next] !== targetId)
          neighbors.set(cells[next]!, (neighbors.get(cells[next]!) ?? 0) + 1);
      }
    }
    if (region.length <= maxSize && neighbors.size) {
      // Protect 1px diagonal strokes: preserve single cell bridged diagonally on 2+ corners
      if (region.length === 1) {
        const idx = region[0];
        const x = idx % width;
        const y = Math.floor(idx / width);
        let diagonalSame = 0;
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (
            nx >= 0 && nx < width && ny >= 0 && ny < height
            && cells[ny * width + nx] === targetId
          )
            diagonalSame += 1;
        }
        if (diagonalSame >= 2) continue;
      }
      const replacement = [...neighbors].sort((a, b) => b[1] - a[1])[0][0];
      if (
        colorDistance(beadById(targetId).lab, beadById(replacement).lab)
        <= maxDistance
      )
        for (const index of region) result[index] = replacement;
    }
  }
  return result;
}

function consolidateRareColors(
  cells: Array<string | null>,
  width: number,
  maxRareCount = 2,
  maxDistance = 14,
) {
  const counts = new Map<string, number>();
  let totalOpaque = 0;
  for (const id of cells) {
    if (!id) continue;
    totalOpaque += 1;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (totalOpaque < 100 || counts.size <= 2) return cells;

  const commonIds = [...counts]
    .filter(([, count]) => count > maxRareCount)
    .map(([id]) => id);
  if (!commonIds.length) return cells;

  const rareIds = new Set(
    [...counts]
      .filter(([, count]) => count <= maxRareCount)
      .map(([id]) => id),
  );
  if (!rareIds.size) return cells;

  const result = [...cells];
  for (let index = 0; index < cells.length; index += 1) {
    const id = cells[index];
    if (!id || !rareIds.has(id)) continue;
    const sourceLab = beadById(id).lab;
    const x = index % width;
    const localNeighbors = new Map<string, number>();
    for (const next of [
      x ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      index - width,
      index + width,
    ]) {
      if (next < 0 || next >= cells.length) continue;
      const neighborId = cells[next];
      if (neighborId && !rareIds.has(neighborId))
        localNeighbors.set(neighborId, (localNeighbors.get(neighborId) ?? 0) + 1);
    }

    let replacement: string | null = null;
    if (localNeighbors.size) {
      const candidate = [...localNeighbors].sort((a, b) => b[1] - a[1])[0][0];
      if (colorDistance(sourceLab, beadById(candidate).lab) <= maxDistance)
        replacement = candidate;
    }
    else {
      let bestId = commonIds[0];
      let bestDist = Infinity;
      for (const candidate of commonIds) {
        const d = colorDistance(sourceLab, beadById(candidate).lab);
        if (d < bestDist) {
          bestDist = d;
          bestId = candidate;
        }
      }
      if (bestDist <= maxDistance) replacement = bestId;
    }
    if (replacement) result[index] = replacement;
  }
  return result;
}

function mergeSimilarColors(cells: Array<string | null>, threshold: number) {
  if (threshold <= 0) return cells;
  const counts = new Map<string, number>();
  for (const id of cells) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const representatives: string[] = [];
  const replacements = new Map<string, string>();
  for (const [id] of [...counts].sort((a, b) => b[1] - a[1])) {
    const source = beadById(id);
    const replacement = representatives
      .map(candidate => ({
        candidate,
        distance: colorDistance(source.lab, beadById(candidate).lab),
      }))
      .filter(item => item.distance <= threshold)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (replacement) replacements.set(id, replacement);
    else representatives.push(id);
  }
  return cells.map(id => (id ? (replacements.get(id) ?? id) : null));
}

function mapWithBayerDithering(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly BeadColor[],
) {
  let spread = 9;
  if (palette.length > 1) {
    const nearestDists: number[] = [];
    for (let i = 0; i < palette.length; i += 1) {
      let minDist = Infinity;
      for (let j = 0; j < palette.length; j += 1) {
        if (i === j) continue;
        const d = colorDistance(palette[i].lab, palette[j].lab);
        if (d < minDist) minDist = d;
      }
      nearestDists.push(minDist);
    }
    nearestDists.sort((a, b) => a - b);
    const medianGap = nearestDists[Math.floor(nearestDists.length / 2)];
    spread = Math.max(4, Math.min(14, medianGap * 0.65));
  }

  const cells: Array<string | null> = Array(width * height).fill(null);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      if (pixels[offset + 3] < ALPHA_THRESHOLD) continue;
      const lab = rgbToLab([
        pixels[offset],
        pixels[offset + 1],
        pixels[offset + 2],
      ]);
      const direct = nearestBeadByLab(lab, palette);
      const err = colorDistance(lab, direct.lab);
      // Only dither pixels that actually fall between palette colors; keep flat regions crisp
      if (err <= 2.5) {
        cells[index] = direct.id;
        continue;
      }
      const weight = Math.min(1, (err - 2.5) / 7.5);
      const bayer = BAYER_4X4[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
      const adjustedL = Math.max(0, Math.min(100, lab[0] + bayer * spread * weight));
      cells[index] = nearestBeadByLab([adjustedL, lab[1], lab[2]], palette).id;
    }
  }
  return cells;
}

function mapWithFloydSteinbergDithering(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly BeadColor[],
) {
  const strength = 0.65;
  const maxErr = 48;
  const buffer = new Float32Array(width * height * 3);
  const opaque = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    if (pixels[offset + 3] < ALPHA_THRESHOLD) continue;
    opaque[i] = 1;
    buffer[i * 3] = pixels[offset];
    buffer[i * 3 + 1] = pixels[offset + 1];
    buffer[i * 3 + 2] = pixels[offset + 2];
  }

  const cells: Array<string | null> = Array(width * height).fill(null);
  const diffuse = (
    fromIndex: number,
    nx: number,
    ny: number,
    er: number,
    eg: number,
    eb: number,
    factor: number,
  ) => {
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
    const next = ny * width + nx;
    if (!opaque[next]) return;
    // Prevent error bleeding across sharp object boundaries
    const fo = fromIndex * 4;
    const no = next * 4;
    const edgeDiff
      = Math.abs(pixels[fo] - pixels[no])
        + Math.abs(pixels[fo + 1] - pixels[no + 1])
        + Math.abs(pixels[fo + 2] - pixels[no + 2]);
    if (edgeDiff > 150) return;
    buffer[next * 3] += er * factor;
    buffer[next * 3 + 1] += eg * factor;
    buffer[next * 3 + 2] += eb * factor;
  };

  for (let y = 0; y < height; y += 1) {
    const reverse = (y & 1) === 1;
    const dir = reverse ? -1 : 1;
    const startX = reverse ? width - 1 : 0;
    const endX = reverse ? -1 : width;
    for (let x = startX; x !== endX; x += dir) {
      const index = y * width + x;
      if (!opaque[index]) continue;
      const r = Math.max(0, Math.min(255, buffer[index * 3]));
      const g = Math.max(0, Math.min(255, buffer[index * 3 + 1]));
      const b = Math.max(0, Math.min(255, buffer[index * 3 + 2]));
      const chosen = nearestBead({ r, g, b }, palette);
      cells[index] = chosen.id;

      const er = Math.max(-maxErr, Math.min(maxErr, (r - chosen.rgb[0]) * strength));
      const eg = Math.max(-maxErr, Math.min(maxErr, (g - chosen.rgb[1]) * strength));
      const eb = Math.max(-maxErr, Math.min(maxErr, (b - chosen.rgb[2]) * strength));
      diffuse(index, x + dir, y, er, eg, eb, 7 / 16);
      diffuse(index, x - dir, y + 1, er, eg, eb, 3 / 16);
      diffuse(index, x, y + 1, er, eg, eb, 5 / 16);
      diffuse(index, x + dir, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return cells;
}

export function imageDataToCells(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number,
  processingMode: ProcessingMode = "edge",
  availableColors: readonly BeadColor[] = CORE_BEAD_COLORS,
  colorMerge = 5,
  dithering: DitheringMode = "none",
) {
  if (pixels.length !== width * height * 4)
    throw new Error("图片像素数据不完整。请重新选择图片。");
  const mergeThreshold = Math.max(0, Math.min(30, colorMerge));
  const palette = choosePalette(
    pixels,
    Math.max(1, Math.min(291, maxColors)),
    availableColors,
    mergeThreshold,
  );
  if (!palette.length) return Array<string | null>(width * height).fill(null);

  // Direct mapping from actual sampled pixel color to selected palette (zero double-quantization)
  let cells: Array<string | null>;
  if (dithering === "bayer")
    cells = mapWithBayerDithering(pixels, width, height, palette);
  else if (dithering === "floyd-steinberg")
    cells = mapWithFloydSteinbergDithering(pixels, width, height, palette);
  else {
    cells = Array.from({ length: width * height }, (_, index) => {
      const offset = index * 4;
      if (pixels[offset + 3] < ALPHA_THRESHOLD) return null;
      return nearestBead(
        { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] },
        palette,
      ).id;
    });
  }

  if (dithering === "none") {
    if (processingMode === "edge")
      cells = cleanSmallRegions(cells, width, 2, 12);
    else if (processingMode === "dominant")
      cells = cleanSmallRegions(cells, width, 4, 18);

    if (processingMode !== "average")
      cells = consolidateRareColors(cells, width, 2, 14);
  }

  return mergeSimilarColors(cells, mergeThreshold);
}

export function adjustImagePixels(
  pixels: Uint8ClampedArray,
  contrast = 0,
  saturation = 0,
) {
  const c = Math.max(-30, Math.min(30, contrast));
  const s = Math.max(-30, Math.min(30, saturation));
  if (c === 0 && s === 0) return pixels;

  const cFactor = 1 + c / 60;
  const sFactor = 1 + s / 50;
  const output = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < 12) {
      output[i + 3] = a;
      continue;
    }
    let r = (pixels[i] - 128) * cFactor + 128;
    let g = (pixels[i + 1] - 128) * cFactor + 128;
    let b = (pixels[i + 2] - 128) * cFactor + 128;
    if (s !== 0) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      r = lum + (r - lum) * sFactor;
      g = lum + (g - lum) * sFactor;
      b = lum + (b - lum) * sFactor;
    }
    output[i] = Math.max(0, Math.min(255, Math.round(r)));
    output[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    output[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    output[i + 3] = a;
  }
  return output;
}

type TileSample = { r: number; g: number; b: number; weight: number };

function rgbLuminance(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function rgbSaturation(r: number, g: number, b: number) {
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  return high ? (high - low) / high : 0;
}

function weightedMedian(
  samples: TileSample[],
  channel: "r" | "g" | "b",
  totalWeight: number,
) {
  const sorted = [...samples].sort((a, b) => a[channel] - b[channel]);
  let weight = 0;
  const half = totalWeight * 0.5;
  for (const sample of sorted) {
    weight += sample.weight;
    if (weight >= half) return sample[channel];
  }
  return sorted[sorted.length - 1][channel];
}

function dominantClusterColor(samples: TileSample[]): [number, number, number] {
  const clusters = new Map<number, { samples: TileSample[]; weight: number }>();
  for (const sample of samples) {
    const key
      = ((sample.r >> 4) << 8) | ((sample.g >> 4) << 4) | (sample.b >> 4);
    const cluster = clusters.get(key);
    if (cluster) {
      cluster.samples.push(sample);
      cluster.weight += sample.weight;
    }
    else {
      clusters.set(key, { samples: [sample], weight: sample.weight });
    }
  }
  let best: { samples: TileSample[]; weight: number } | null = null;
  for (const cluster of clusters.values()) {
    if (!best || cluster.weight > best.weight) best = cluster;
  }
  return [
    Math.round(weightedMedian(best!.samples, "r", best!.weight)),
    Math.round(weightedMedian(best!.samples, "g", best!.weight)),
    Math.round(weightedMedian(best!.samples, "b", best!.weight)),
  ];
}

function sampleTileStats(
  pixels: Uint8ClampedArray,
  stride: number,
  tileX: number,
  tileY: number,
  scale: number,
  mode: ProcessingMode,
) {
  const samples: TileSample[] = [];
  let red = 0;
  let green = 0;
  let blue = 0;
  let alphaSum = 0;
  let totalWeight = 0;

  for (let y = 0; y < scale; y += 1) {
    const rowOffset = (tileY * scale + y) * stride + tileX * scale;
    for (let x = 0; x < scale; x += 1) {
      const offset = (rowOffset + x) * 4;
      const pixelAlpha = pixels[offset + 3];
      if (pixelAlpha < 12) continue;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const w = pixelAlpha / 255;
      red += SRGB_TO_LINEAR[r] * w;
      green += SRGB_TO_LINEAR[g] * w;
      blue += SRGB_TO_LINEAR[b] * w;
      alphaSum += pixelAlpha;
      totalWeight += w;
      if (mode !== "average") samples.push({ r, g, b, weight: w });
    }
  }

  if (!totalWeight) {
    return {
      average: [0, 0, 0, 0] as const,
      dominant: [0, 0, 0, 0] as const,
      feature: null as readonly [number, number, number, number] | null,
    };
  }

  const alpha = Math.round(alphaSum / (scale * scale));
  const average = [
    Math.round(fromLinearChannel(red / totalWeight)),
    Math.round(fromLinearChannel(green / totalWeight)),
    Math.round(fromLinearChannel(blue / totalWeight)),
    alpha,
  ] as const;

  if (mode === "average") return { average, dominant: average, feature: null };

  const modeRgb = dominantClusterColor(samples);
  const dominant = [modeRgb[0], modeRgb[1], modeRgb[2], alpha] as const;
  if (mode === "dominant") return { average, dominant, feature: null };

  // In "edge" mode: detect thin dark outlines (e.g. eyes, lineart) & vibrant accents on muted backgrounds
  const modeLight = rgbLuminance(...modeRgb);
  const modeSat = rgbSaturation(...modeRgb);
  let feature: readonly [number, number, number, number] | null = null;

  if (modeLight > 75) {
    const darkCutoff = Math.min(68, modeLight - 30);
    const darkSamples: TileSample[] = [];
    let darkWeight = 0;
    for (const sample of samples) {
      const maxChan = Math.max(sample.r, sample.g, sample.b);
      if (maxChan <= 96 && rgbLuminance(sample.r, sample.g, sample.b) <= darkCutoff) {
        darkSamples.push(sample);
        darkWeight += sample.weight;
      }
    }
    if (darkSamples.length && darkWeight / totalWeight >= 0.16) {
      const darkRgb = dominantClusterColor(darkSamples);
      feature = [darkRgb[0], darkRgb[1], darkRgb[2], alpha];
    }
  }

  if (!feature && modeSat < 0.25) {
    const accentSamples: TileSample[] = [];
    let accentWeight = 0;
    for (const sample of samples) {
      if (rgbSaturation(sample.r, sample.g, sample.b) >= Math.max(0.42, modeSat + 0.25)) {
        accentSamples.push(sample);
        accentWeight += sample.weight;
      }
    }
    if (accentSamples.length && accentWeight / totalWeight >= 0.22) {
      const accentRgb = dominantClusterColor(accentSamples);
      feature = [accentRgb[0], accentRgb[1], accentRgb[2], alpha];
    }
  }

  return { average, dominant, feature };
}

export function samplePixelTiles(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  mode: ProcessingMode,
) {
  const scale = Math.sqrt(sourcePixels.length / (width * height * 4));
  const stride = width * scale;
  if (!Number.isInteger(scale) || scale < 1)
    throw new Error("取样图片像素不完整。");

  const averages = new Uint8ClampedArray(width * height * 4);
  const dominants = mode === "average" ? null : new Uint8ClampedArray(width * height * 4);
  const features = mode === "edge"
    ? Array<readonly [number, number, number, number] | null>(width * height).fill(null)
    : null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const stats = sampleTileStats(sourcePixels, stride, x, y, scale, mode);
      averages.set(stats.average, offset);
      if (dominants) dominants.set(stats.dominant, offset);
      if (features) features[index] = stats.feature;
    }
  }

  if (mode === "average") return averages;
  if (mode === "dominant") return dominants!;

  const result = new Uint8ClampedArray(averages);
  const labs = Array.from({ length: width * height }, (_, index) => {
    const offset = index * 4;
    return averages[offset + 3] < ALPHA_THRESHOLD
      ? null
      : rgbToLab([averages[offset], averages[offset + 1], averages[offset + 2]]);
  });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const currentLab = labs[index];
      if (!currentLab) continue;
      if (features![index]) {
        result.set(features![index]!, offset);
        continue;
      }
      let contrast = 0;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighborLab = labs[ny * width + nx];
        if (!neighborLab) continue;
        contrast = Math.max(contrast, colorDistance(currentLab, neighborLab));
      }
      const dominantLab = rgbToLab([
        dominants![offset],
        dominants![offset + 1],
        dominants![offset + 2],
      ]);
      if (contrast >= 9 && colorDistance(currentLab, dominantLab) >= 1.5)
        result.set(dominants!.subarray(offset, offset + 4), offset);
    }
  }
  return result;
}

export type PatternStructureReport = {
  floatingIndices: number[];
  diagonalOnlyIndices: number[];
  componentCount: number;
};

export function analyzePatternStructure(
  cells: Array<string | null>,
  width: number,
): PatternStructureReport {
  const height = Math.ceil(cells.length / width);
  const visited = new Uint8Array(cells.length);
  const components: number[][] = [];
  const diagonalOnlyIndices: number[] = [];

  for (let index = 0; index < cells.length; index += 1) {
    if (!cells[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const hasOrthogonal
      = (x > 0 && Boolean(cells[index - 1]))
        || (x + 1 < width && Boolean(cells[index + 1]))
        || (y > 0 && Boolean(cells[index - width]))
        || (y + 1 < height && Boolean(cells[index + width]));
    if (!hasOrthogonal) {
      const hasDiagonal
        = (x > 0 && y > 0 && Boolean(cells[index - width - 1]))
          || (x + 1 < width && y > 0 && Boolean(cells[index - width + 1]))
          || (x > 0 && y + 1 < height && Boolean(cells[index + width - 1]))
          || (x + 1 < width && y + 1 < height && Boolean(cells[index + width + 1]));
      if (hasDiagonal) diagonalOnlyIndices.push(index);
    }

    if (visited[index]) continue;
    const queue = [index];
    const component: number[] = [];
    visited[index] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      const cx = current % width;
      const cy = Math.floor(current / width);
      const nexts = [
        cx > 0 ? current - 1 : -1,
        cx + 1 < width ? current + 1 : -1,
        cy > 0 ? current - width : -1,
        cy + 1 < height ? current + width : -1,
      ];
      for (const next of nexts) {
        if (next >= 0 && cells[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }
    components.push(component);
  }

  const maxComponent = components.reduce(
    (max, component) => Math.max(max, component.length),
    0,
  );
  const floatingIndices: number[] = [];
  if (components.length > 1 && maxComponent >= 8) {
    for (const component of components) {
      if (component.length <= 2 && component.length * 4 <= maxComponent)
        floatingIndices.push(...component);
    }
  }

  return {
    floatingIndices,
    diagonalOnlyIndices,
    componentCount: components.length,
  };
}

export function cleanFloatingBeads(cells: Array<string | null>, width: number) {
  const { floatingIndices } = analyzePatternStructure(cells, width);
  if (!floatingIndices.length) return { cells, removed: 0 };
  const next = [...cells];
  for (const index of floatingIndices) next[index] = null;
  return { cells: next, removed: floatingIndices.length };
}

function sampleSource(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  mode: ProcessingMode,
  contrast = 0,
  saturation = 0,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width * 8;
  canvas.height = height * 8;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理图片，请更新浏览器后重试。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const raw = adjustImagePixels(
    context.getImageData(0, 0, canvas.width, canvas.height).data,
    contrast,
    saturation,
  );
  return samplePixelTiles(raw, width, height, mode);
}

export function mirrorCells(cells: Array<string | null>, width: number) {
  const mirrored: Array<string | null> = [];
  for (let offset = 0; offset < cells.length; offset += width)
    mirrored.push(...cells.slice(offset, offset + width).reverse());
  return mirrored;
}

export function patternLayout(
  sourceWidth: number,
  sourceHeight: number,
  requestedSize: number,
) {
  const size = Math.max(16, Math.min(192, Math.round(requestedSize)));
  const sourceMax = Math.max(sourceWidth, sourceHeight);
  const contentWidth = Math.max(1, Math.round((sourceWidth / sourceMax) * size)),
    contentHeight = Math.max(1, Math.round((sourceHeight / sourceMax) * size));
  return {
    width: size,
    height: size,
    contentWidth,
    contentHeight,
    x: Math.floor((size - contentWidth) / 2),
    y: Math.floor((size - contentHeight) / 2),
  };
}

export async function imageToPattern(
  dataUrl: string,
  fileName: string,
  settings: GenerationSettings,
  transform: SourceTransform = DEFAULT_TRANSFORM,
  restoreSourceUrl?: string,
) {
  const image = await loadImage(dataUrl);
  const source = transformedCanvas(image, transform);
  const { width, height, contentWidth, contentHeight, x, y } = patternLayout(
    source.width,
    source.height,
    settings.longestEdge,
  );
  const availableColors = mardPalette(
    settings.paletteSize,
    settings.excludedColorIds,
  );
  let sampled: Uint8ClampedArray = sampleSource(
    source,
    contentWidth,
    contentHeight,
    settings.processingMode,
    settings.contrast ?? 0,
    settings.saturation ?? 0,
  );
  if (settings.background === "plain")
    sampled = removeBackgroundCells(sampled, contentWidth, contentHeight);
  const content = imageDataToCells(
    sampled,
    contentWidth,
    contentHeight,
    settings.maxColors,
    settings.processingMode,
    availableColors,
    settings.colorMerge,
    settings.dithering ?? "none",
  );
  let cells: Array<string | null> = Array(width * height).fill(null);
  for (let row = 0; row < contentHeight; row += 1)
    cells.splice(
      (row + y) * width + x,
      contentWidth,
      ...content.slice(row * contentWidth, (row + 1) * contentWidth),
    );
  if (settings.mirror) cells = mirrorCells(cells, width);
  return {
    id: crypto.randomUUID(),
    name: fileName.replace(/\.[^.]+$/, "") || "我的图纸",
    width,
    height,
    cells,
    createdAt: new Date().toISOString(),
    sourcePreview: restoreSourceUrl ?? dataUrl,
    contentBounds: { x, y, width: contentWidth, height: contentHeight },
  } satisfies Pattern;
}

export function drawPatternGrid(
  context: CanvasRenderingContext2D,
  columns: number,
  rows: number,
  cell: number,
  offsetX = 0,
  offsetY = 0,
  startColumn = 0,
  startRow = 0,
) {
  const width = columns * cell,
    height = rows * cell;
  context.beginPath();
  for (let column = 1; column < columns; column += 1) {
    if ((startColumn + column) % 10 === 0) continue;
    const x = offsetX + column * cell + 0.5;
    context.moveTo(x, offsetY + 1);
    context.lineTo(x, offsetY + height - 1);
  }
  for (let row = 1; row < rows; row += 1) {
    if ((startRow + row) % 10 === 0) continue;
    const y = offsetY + row * cell + 0.5;
    context.moveTo(offsetX + 1, y);
    context.lineTo(offsetX + width - 1, y);
  }
  context.strokeStyle = "#d5dae2";
  context.lineWidth = 0.75;
  context.stroke();
  context.beginPath();
  for (let column = 0; column <= columns; column += 1) {
    if (column !== 0 && column !== columns && (startColumn + column) % 10 !== 0)
      continue;
    const x
      = offsetX
        + (column === 0 ? 1 : column === columns ? width - 1 : column * cell);
    context.moveTo(x, offsetY + 1);
    context.lineTo(x, offsetY + height - 1);
  }
  for (let row = 0; row <= rows; row += 1) {
    if (row !== 0 && row !== rows && (startRow + row) % 10 !== 0) continue;
    const y
      = offsetY + (row === 0 ? 1 : row === rows ? height - 1 : row * cell);
    context.moveTo(offsetX + 1, y);
    context.lineTo(offsetX + width - 1, y);
  }
  context.strokeStyle = "#667085";
  context.lineWidth = 2;
  context.stroke();
}

export function needsLightBeadOutline(
  rgb: [number, number, number],
  showCodes: boolean,
  showGrid: boolean,
) {
  return !showCodes && !showGrid && rgb.every(channel => channel >= 235);
}

export function patternGridMarks(size: number) {
  const marks = [1];
  for (let mark = 10; mark < size; mark += 10) marks.push(mark);
  if (size > 1) marks.push(size);
  return marks;
}

export function visiblePatternGridMarks(size: number, length: number) {
  const marks = patternGridMarks(size);
  if (!length) return marks;

  return marks.reduce<number[]>((visible, mark) => {
    const previous = visible.at(-1);
    const distance = previous === undefined
      ? Infinity
      : ((mark - previous) / size) * length;
    const requiredSpace = (String(previous).length + String(mark).length) * 3 + 4;
    if (distance < requiredSpace) visible.pop();
    visible.push(mark);
    return visible;
  }, []);
}

export function renderPattern(pattern: Pattern, includeLegend = true) {
  const cellSize = 34,
    pagePadding = 48,
    header = 56,
    tickSpace = 20,
    footerSpace = 40,
    stats = patternStats(pattern),
    total = stats.reduce((sum, item) => sum + item.count, 0),
    boardX = pagePadding,
    boardY = header + tickSpace,
    boardWidth = pattern.width * cellSize,
    boardHeight = pattern.height * cellSize,
    itemWidth = 112,
    itemHeight = 110;
  const canvas = document.createElement("canvas");
  canvas.width = boardWidth + pagePadding * 2;
  const legendColumns = Math.max(
      1,
      Math.floor((boardWidth - 48) / itemWidth),
    ),
    legendRows = Math.ceil(stats.length / legendColumns),
    legendTop = boardY + boardHeight + 36;
  canvas.height
    = includeLegend
      ? legendTop + 60 + legendRows * itemHeight + 28
      : boardY + boardHeight + footerSpace;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法导出图片。");
  const drawTag = (text: string, x: number, y: number) => {
    context.font = "700 15px sans-serif";
    const width
      = Math.ceil(context.measureText?.(text).width ?? text.length * 10) + 28;
    context.beginPath();
    context.roundRect(x, y, width, 34, 17);
    context.fillStyle = "#fde7f1";
    context.fill();
    context.fillStyle = "#b61f65";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(text, x + 14, y + 17);
    return width;
  };
  context.fillStyle = "#fffaf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#182235";
  context.font = "700 26px sans-serif";
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.fillText(pattern.name, pagePadding, 43);
  const nameWidth = context.measureText?.(pattern.name).width ?? pattern.name.length * 26,
    boardTagX = pagePadding + nameWidth + 16,
    boardTagWidth = drawTag(
      `${pattern.width} × ${pattern.height} 豆板`,
      boardTagX,
      18,
    );
  drawTag("MARD", boardTagX + boardTagWidth + 8, 18);
  const brandRight = canvas.width - pagePadding,
    logoX = brandRight - 163;
  context.beginPath();
  context.roundRect(logoX, 18, 32, 32, 7);
  context.fillStyle = "#fff7f8";
  context.fill();
  [
    "#f551a2", "#ffd651", "#7544d8", "#45bcd2",
    "#32aa70", "#f7f4ef", "#f7f4ef", "#ff9b52",
    "#264774", "#17161b", "#17161b", "#ee8fc4",
    "#ad8de8", "#f7f4ef", "#f7f4ef", "#83cf5b",
  ].forEach((color, index) => {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(
      logoX + 3 + (index % 4) * 7,
      21 + Math.floor(index / 4) * 7,
      5,
      5,
      2.5,
    );
    context.fill();
  });
  context.fillStyle = "#182235";
  context.font = "700 17px sans-serif";
  context.textAlign = "right";
  context.fillText("拼豆图纸生成器", brandRight, 43);
  pattern.cells.forEach((id, index) => {
    const x = boardX + (index % pattern.width) * cellSize,
      y = boardY + Math.floor(index / pattern.width) * cellSize;
    if (id) {
      const color = beadById(id),
        [r, g, b] = color.rgb;
      context.fillStyle = color.hex;
      context.fillRect(x, y, cellSize, cellSize);
      context.fillStyle
        = r * 299 + g * 587 + b * 114 > 145000 ? "#182235" : "#ffffff";
      context.font = "700 9px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(id, x + cellSize / 2, y + cellSize / 2);
    }
  });
  drawPatternGrid(
    context,
    pattern.width,
    pattern.height,
    cellSize,
    boardX,
    boardY,
  );
  context.fillStyle = "#667085";
  context.font = "700 13px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "bottom";
  for (let column = 10; column <= pattern.width; column += 10)
    context.fillText(String(column), boardX + column * cellSize, boardY - 5);
  context.textAlign = "right";
  context.textBaseline = "middle";
  for (let row = 10; row <= pattern.height; row += 10)
    context.fillText(String(row), boardX - 8, boardY + row * cellSize);
  if (includeLegend) {
    context.fillStyle = "#182235";
    context.font = "700 22px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText("颜色用量", pagePadding, legendTop + 24);
    drawTag(`共 ${stats.length} 色 · ${total} 粒`, pagePadding + 112, legendTop);
    stats.forEach(({ color, count }, index) => {
      const centerX
          = pagePadding
            + (index % legendColumns) * itemWidth
            + 34,
        top = legendTop + 60 + Math.floor(index / legendColumns) * itemHeight;
      context.beginPath();
      context.roundRect(centerX - 34, top, 68, 64, 14);
      context.fillStyle = color.hex;
      context.fill();
      context.strokeStyle = "#b8bfca";
      context.lineWidth = 1;
      context.stroke();
      const [r, g, b] = color.rgb;
      context.fillStyle
        = r * 299 + g * 587 + b * 114 > 145000 ? "#182235" : "#ffffff";
      context.font = "700 21px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(color.id, centerX, top + 32);
      context.fillStyle = "#182235";
      context.font = "700 20px sans-serif";
      context.fillText(String(count), centerX, top + 88);
    });
  }
  return canvas;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPatternPng(pattern: Pattern) {
  const blob = await patternPngBlob(pattern);
  saveBlob(blob, `${pattern.name}-施工图.png`);
}

export async function patternPngBlob(pattern: Pattern) {
  const blob = await new Promise<Blob | null>(resolve =>
    renderPattern(pattern).toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG 生成失败，请重试。");
  return blob;
}

export async function copyPatternPng(pattern: Pattern) {
  const blob = await patternPngBlob(pattern);
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined")
    throw new Error("当前浏览器不支持复制图片，请使用下载。");
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export async function sharePatternPng(pattern: Pattern) {
  const blob = await patternPngBlob(pattern);
  const file = new File([blob], `${pattern.name}-施工图.png`, {
    type: "image/png",
  });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${pattern.name}施工图` });
    return "shared" as const;
  }
  saveBlob(blob, file.name);
  return "downloaded" as const;
}

export { saveBlob };
