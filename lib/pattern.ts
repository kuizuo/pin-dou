import type {
  BackgroundMode,
  GenerationSettings,
  Pattern,
  ProcessingMode,
  SourceTransform,
} from "./types";
import { removePlainBackground } from "./background";
import {
  BEAD_COLORS,
  beadById,
  labDistance,
  nearestBead,
  patternStats,
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

export function mardPalette(
  requestedSize: number,
  excludedColorIds: string[] = [],
) {
  const size = Math.max(
      1,
      Math.min(BEAD_COLORS.length, Math.round(requestedSize)),
    ),
    core = BEAD_COLORS.filter(color =>
      /^(A|B|C|D|E|F|G|H|M)\d+$/.test(color.id),
    );
  let colors: typeof BEAD_COLORS;
  if (size >= BEAD_COLORS.length) colors = BEAD_COLORS;
  else if (size === core.length) colors = core;
  else {
    const candidates = size < core.length ? core : BEAD_COLORS,
      selected = [
        candidates.reduce(
          (darkest, color) =>
            color.rgb[0] + color.rgb[1] + color.rgb[2]
            < darkest.rgb[0] + darkest.rgb[1] + darkest.rgb[2]
              ? color
              : darkest,
          candidates[0],
        ),
      ];
    const distances = new Map(
      candidates.map(color => [
        color.id,
        color === selected[0]
          ? 0
          : Math.hypot(
              color.rgb[0] - selected[0].rgb[0],
              color.rgb[1] - selected[0].rgb[1],
              color.rgb[2] - selected[0].rgb[2],
            ),
      ]),
    );
    while (selected.length < Math.min(size, candidates.length)) {
      const next = candidates.reduce(
        (best, color) =>
          (distances.get(color.id) ?? 0) > (distances.get(best.id) ?? 0)
            ? color
            : best,
        candidates[0],
      );
      selected.push(next);
      distances.set(next.id, 0);
      for (const color of candidates)
        distances.set(
          color.id,
          Math.min(
            distances.get(color.id) ?? Infinity,
            Math.hypot(
              color.rgb[0] - next.rgb[0],
              color.rgb[1] - next.rgb[1],
              color.rgb[2] - next.rgb[2],
            ),
          ),
        );
    }
    colors = selected;
  }
  const excluded = new Set(excludedColorIds),
    available = colors.filter(color => !excluded.has(color.id));
  return available.length ? available : colors.slice(0, 1);
}

function choosePalette(
  pixels: Uint8ClampedArray,
  maxColors: number,
  availableColors = BEAD_COLORS,
) {
  const histogram = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 36) continue;
    const color = nearestBead(
      { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] },
      availableColors,
    );
    histogram.set(color.id, (histogram.get(color.id) ?? 0) + 1);
  }
  const points = [...histogram].map(([id, weight]) => ({
    color: beadById(id),
    weight,
  }));
  if (points.length <= maxColors) return points.map(point => point.color);
  const centroids: Array<[number, number, number]> = [
    [...points.sort((a, b) => b.weight - a.weight)[0].color.lab],
  ];
  while (centroids.length < maxColors) {
    const next = points.reduce(
      (best, point) => {
        const distance
          = Math.min(
            ...centroids.map(centroid =>
              labDistance(point.color.lab, centroid),
            ),
          ) * Math.sqrt(point.weight);
        return distance > best.distance ? { point, distance } : best;
      },
      { point: points[0], distance: -1 },
    );
    centroids.push([...next.point.color.lab]);
  }
  for (let pass = 0; pass < 6; pass += 1) {
    const totals = centroids.map(() => ({ l: 0, a: 0, b: 0, weight: 0 }));
    for (const point of points) {
      const group = centroids.reduce(
        (best, centroid, index) =>
          labDistance(point.color.lab, centroid) < best.distance
            ? { index, distance: labDistance(point.color.lab, centroid) }
            : best,
        { index: 0, distance: Infinity },
      ).index;
      totals[group].l += point.color.lab[0] * point.weight;
      totals[group].a += point.color.lab[1] * point.weight;
      totals[group].b += point.color.lab[2] * point.weight;
      totals[group].weight += point.weight;
    }
    totals.forEach((total, index) => {
      if (total.weight)
        centroids[index] = [
          total.l / total.weight,
          total.a / total.weight,
          total.b / total.weight,
        ];
    });
  }
  const selected: typeof BEAD_COLORS = [];
  for (const centroid of centroids) {
    const color = availableColors.reduce(
      (best, candidate) =>
        labDistance(candidate.lab, centroid) < labDistance(best.lab, centroid)
          ? candidate
          : best,
      availableColors[0],
    );
    if (!selected.some(item => item.id === color.id)) selected.push(color);
  }
  return selected;
}

function cleanSmallRegions(cells: Array<string | null>, width: number) {
  const result = [...cells],
    visited = new Uint8Array(cells.length);
  for (let start = 0; start < cells.length; start += 1) {
    if (visited[start] || !cells[start]) continue;
    const queue = [start],
      region: number[] = [],
      neighbors = new Map<string, number>();
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
        if (cells[next] === cells[start] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
        else if (cells[next])
          neighbors.set(cells[next]!, (neighbors.get(cells[next]!) ?? 0) + 1);
      }
    }
    if (region.length <= 2 && neighbors.size) {
      const replacement = [...neighbors].sort((a, b) => b[1] - a[1])[0][0];
      if (
        labDistance(beadById(cells[start]!).lab, beadById(replacement).lab)
        <= 12
      )
        for (const index of region) result[index] = replacement;
    }
  }
  return result;
}

function mergeSimilarColors(cells: Array<string | null>, threshold: number) {
  if (threshold <= 0) return cells;
  const counts = new Map<string, number>();
  for (const id of cells) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  const representatives: string[] = [],
    replacements = new Map<string, string>();
  for (const [id] of [...counts].sort((a, b) => b[1] - a[1])) {
    const source = beadById(id);
    const replacement = representatives
      .map(candidate => ({
        candidate,
        distance: labDistance(source.lab, beadById(candidate).lab),
      }))
      .filter(item => item.distance <= threshold)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
    if (replacement) replacements.set(id, replacement);
    else representatives.push(id);
  }
  return cells.map(id => (id ? (replacements.get(id) ?? id) : null));
}

export function imageDataToCells(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors: number,
  processingMode: ProcessingMode = "edge",
  availableColors = BEAD_COLORS,
  colorMerge = 5,
) {
  if (pixels.length !== width * height * 4)
    throw new Error("图片像素数据不完整。请重新选择图片。");
  const palette = choosePalette(
    pixels,
    Math.max(1, Math.min(30, maxColors)),
    availableColors,
  );
  let cells = Array.from({ length: width * height }, (_, index) => {
    const offset = index * 4;
    return pixels[offset + 3] < 36
      ? null
      : nearestBead(
        { r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] },
        palette,
      ).id;
  });
  if (processingMode === "edge") cells = cleanSmallRegions(cells, width);
  return mergeSimilarColors(cells, Math.max(0, Math.min(30, colorMerge)));
}

function toLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number) {
  return 255 * (value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055);
}

function tileRepresentative(
  pixels: Uint8ClampedArray,
  stride: number,
  tileX: number,
  tileY: number,
  mode: "average" | "dominant",
) {
  const buckets = new Map<
    number,
    { count: number; red: number; green: number; blue: number; alpha: number }
  >();
  let red = 0,
    green = 0,
    blue = 0,
    alpha = 0,
    weight = 0;
  for (let y = 0; y < 4; y += 1)
    for (let x = 0; x < 4; x += 1) {
      const offset = ((tileY * 4 + y) * stride + tileX * 4 + x) * 4,
        pixelAlpha = pixels[offset + 3];
      if (pixelAlpha < 12) continue;
      const pixelWeight = pixelAlpha / 255;
      red += toLinear(pixels[offset]) * pixelWeight;
      green += toLinear(pixels[offset + 1]) * pixelWeight;
      blue += toLinear(pixels[offset + 2]) * pixelWeight;
      alpha += pixelAlpha;
      weight += pixelWeight;
      const bucket
        = ((pixels[offset] >> 4) << 8)
          | ((pixels[offset + 1] >> 4) << 4)
          | (pixels[offset + 2] >> 4);
      const current = buckets.get(bucket) ?? {
        count: 0,
        red: 0,
        green: 0,
        blue: 0,
        alpha: 0,
      };
      current.count += pixelWeight;
      current.red += pixels[offset] * pixelWeight;
      current.green += pixels[offset + 1] * pixelWeight;
      current.blue += pixels[offset + 2] * pixelWeight;
      current.alpha += pixelAlpha * pixelWeight;
      buckets.set(bucket, current);
    }
  if (!weight) return [0, 0, 0, 0] as const;
  if (mode === "average")
    return [
      Math.round(fromLinear(red / weight)),
      Math.round(fromLinear(green / weight)),
      Math.round(fromLinear(blue / weight)),
      Math.round(alpha / 16),
    ] as const;
  const winner = [...buckets.values()].reduce((best, item) =>
    item.count > best.count ? item : best,
  );
  return [
    Math.round(winner.red / winner.count),
    Math.round(winner.green / winner.count),
    Math.round(winner.blue / winner.count),
    Math.round(winner.alpha / winner.count),
  ] as const;
}

export function samplePixelTiles(
  sourcePixels: Uint8ClampedArray,
  width: number,
  height: number,
  mode: ProcessingMode,
) {
  const stride = width * 4;
  if (sourcePixels.length !== stride * height * 4 * 4)
    throw new Error("取样图片像素不完整。");
  const averages = new Uint8ClampedArray(width * height * 4),
    dominants = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      averages.set(
        tileRepresentative(sourcePixels, stride, x, y, "average"),
        offset,
      );
      if (mode !== "average")
        dominants.set(
          tileRepresentative(sourcePixels, stride, x, y, "dominant"),
          offset,
        );
    }
  if (mode === "average") return averages;
  if (mode === "dominant") return dominants;
  const result = new Uint8ClampedArray(averages);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (averages[offset + 3] < 36) continue;
      let contrast = 0;
      for (const next of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        if (next[0] < 0 || next[0] >= width || next[1] < 0 || next[1] >= height)
          continue;
        const neighbor = (next[1] * width + next[0]) * 4;
        contrast = Math.max(
          contrast,
          Math.hypot(
            averages[offset] - averages[neighbor],
            averages[offset + 1] - averages[neighbor + 1],
            averages[offset + 2] - averages[neighbor + 2],
          ),
        );
      }
      if (contrast >= 42)
        result.set(dominants.slice(offset, offset + 4), offset);
    }
  return result;
}

function sampleSource(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  mode: ProcessingMode,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width * 4;
  canvas.height = height * 4;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理图片，请更新浏览器后重试。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return samplePixelTiles(
    context.getImageData(0, 0, canvas.width, canvas.height).data,
    width,
    height,
    mode,
  );
}

export function mirrorCells(cells: Array<string | null>, width: number) {
  const mirrored: Array<string | null> = [];
  for (let offset = 0; offset < cells.length; offset += width)
    mirrored.push(...cells.slice(offset, offset + width).reverse());
  return mirrored;
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
  const longestEdge = Math.max(
    16,
    Math.min(104, Math.round(settings.longestEdge)),
  );
  const ratio = longestEdge / Math.max(source.width, source.height);
  const contentWidth = Math.max(1, Math.round(source.width * ratio)),
    contentHeight = Math.max(1, Math.round(source.height * ratio));
  const availableColors = mardPalette(
    settings.paletteSize,
    settings.excludedColorIds,
  );
  const content = imageDataToCells(
    sampleSource(source, contentWidth, contentHeight, settings.processingMode),
    contentWidth,
    contentHeight,
    settings.maxColors,
    settings.processingMode,
    availableColors,
    settings.colorMerge,
  );
  const width = contentWidth,
    height = contentHeight,
    x = 0,
    y = 0;
  let cells: Array<string | null> = Array(width * height).fill(null);
  for (let row = 0; row < contentHeight; row += 1)
    cells.splice(
      (row + y) * width + x,
      contentWidth,
      ...content.slice(row * contentWidth, (row + 1) * contentWidth),
    );
  let backgroundCells: Array<string | null> | undefined;
  if (restoreSourceUrl) {
    const restoredSource = transformedCanvas(
      await loadImage(restoreSourceUrl),
      transform,
    );
    const restoredContent = imageDataToCells(
      sampleSource(
        restoredSource,
        contentWidth,
        contentHeight,
        settings.processingMode,
      ),
      contentWidth,
      contentHeight,
      settings.maxColors,
      settings.processingMode,
      availableColors,
      settings.colorMerge,
    );
    backgroundCells = Array(width * height).fill(null);
    for (let row = 0; row < contentHeight; row += 1)
      backgroundCells.splice(
        (row + y) * width + x,
        contentWidth,
        ...restoredContent.slice(row * contentWidth, (row + 1) * contentWidth),
      );
  }
  if (settings.mirror) {
    cells = mirrorCells(cells, width);
    if (backgroundCells) backgroundCells = mirrorCells(backgroundCells, width);
  }
  return {
    id: crypto.randomUUID(),
    name: fileName.replace(/\.[^.]+$/, "") || "我的图纸",
    width,
    height,
    cells,
    backgroundCells,
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

export function renderPattern(pattern: Pattern, includeLegend = true) {
  const cellSize = 34,
    header = 84,
    stats = patternStats(pattern),
    boardHeight = pattern.height * cellSize,
    itemWidth = 112,
    itemHeight = 110;
  const canvas = document.createElement("canvas");
  canvas.width = pattern.width * cellSize + 2;
  const legendColumns = Math.max(
      1,
      Math.floor((canvas.width - 48) / itemWidth),
    ),
    legendRows = Math.ceil(stats.length / legendColumns),
    legendTop = header + boardHeight + 30;
  canvas.height
    = includeLegend && stats.length
      ? legendTop + 38 + legendRows * itemHeight + 24
      : header + boardHeight + 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法导出图片。");
  context.fillStyle = "#fffaf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#182235";
  context.font = "700 26px sans-serif";
  context.fillText(pattern.name, 18, 32);
  context.font = "15px sans-serif";
  context.fillText(
    `${pattern.width} × ${pattern.height} 豆板 · ${stats.reduce((sum, item) => sum + item.count, 0)} 粒 · MARD`,
    18,
    60,
  );
  pattern.cells.forEach((id, index) => {
    const x = (index % pattern.width) * cellSize,
      y = Math.floor(index / pattern.width) * cellSize + header;
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
  drawPatternGrid(context, pattern.width, pattern.height, cellSize, 0, header);
  if (includeLegend && stats.length) {
    context.fillStyle = "#182235";
    context.font = "700 22px sans-serif";
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText("颜色用量", 24, legendTop + 20);
    stats.forEach(({ color, count }, index) => {
      const centerX = 24 + (index % legendColumns) * itemWidth + itemWidth / 2,
        top = legendTop + 38 + Math.floor(index / legendColumns) * itemHeight;
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
