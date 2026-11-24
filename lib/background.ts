import { colorDistance, rgbToLab } from "./beads";

type Wand = typeof import("magic-wand-tool")["default"];

const CORNER_THRESHOLD = 38;
const MIN_BACKGROUND_RATIO = 0.05;
const MAX_BACKGROUND_RATIO = 0.96;

function borderPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const positions: number[] = [];
  for (let x = 0; x < width; x += 1) {
    positions.push(x);
    if (height > 1) positions.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    positions.push(y * width);
    if (width > 1) positions.push(y * width + width - 1);
  }
  return positions.map((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    return {
      index,
      x,
      y,
      color: [pixels[offset], pixels[offset + 1], pixels[offset + 2]] as const,
      alpha: pixels[offset + 3],
    };
  });
}

function luminance(red: number, green: number, blue: number) {
  return red * 0.299 + green * 0.587 + blue * 0.114;
}

function saturation(red: number, green: number, blue: number) {
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  return high ? (high - low) / high : 0;
}

export function createBackgroundMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  _wand?: Wand,
  tolerance = CORNER_THRESHOLD,
) {
  if (pixels.length !== width * height * 4)
    throw new Error("图片像素数据不完整。");
  const border = borderPixels(pixels, width, height).filter(
    pixel => pixel.alpha >= 36,
  );
  const buckets = new Map<
    string,
    { count: number; red: number; green: number; blue: number }
  >();
  for (const { color } of border) {
    const key = color.map(channel => Math.round(channel / 32)).join(":");
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += color[0];
    bucket.green += color[1];
    bucket.blue += color[2];
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  if (!dominant)
    throw new Error("背景不够统一，未能去除。图纸已保持不变。");

  const baseR = dominant.red / dominant.count;
  const baseG = dominant.green / dominant.count;
  const baseB = dominant.blue / dominant.count;
  const seeds = border.filter(
    pixel =>
      Math.abs(pixel.color[0] - baseR) <= tolerance
      && Math.abs(pixel.color[1] - baseG) <= tolerance
      && Math.abs(pixel.color[2] - baseB) <= tolerance,
  );
  if (seeds.length < border.length / 2) {
    throw new Error("背景不够统一，未能去除。图纸已保持不变。");
  }

  const neutralLight
    = Math.max(baseR, baseG, baseB) - Math.min(baseR, baseG, baseB) < 14
      && luminance(baseR, baseG, baseB) > 225;
  const channelTol = neutralLight ? Math.max(tolerance, 48) : tolerance;
  const euclidTolSq = (neutralLight ? Math.max(tolerance * 1.55, 62) : tolerance * 1.35) ** 2;

  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const matchesBackground = (index: number) => {
    const offset = index * 4;
    if (pixels[offset + 3] < 36) return false;
    const dr = pixels[offset] - baseR;
    if (dr > channelTol || dr < -channelTol) return false;
    const dg = pixels[offset + 1] - baseG;
    if (dg > channelTol || dg < -channelTol) return false;
    const db = pixels[offset + 2] - baseB;
    if (db > channelTol || db < -channelTol) return false;
    return dr * dr + dg * dg + db * db <= euclidTolSq;
  };

  for (const { index } of seeds) {
    if (visited[index]) continue;
    visited[index] = 1;
    queue[tail++] = index;
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) {
      const next = index - 1;
      if (!visited[next] && matchesBackground(next)) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (x + 1 < width) {
      const next = index + 1;
      if (!visited[next] && matchesBackground(next)) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (y > 0) {
      const next = index - width;
      if (!visited[next] && matchesBackground(next)) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (y + 1 < height) {
      const next = index + width;
      if (!visited[next] && matchesBackground(next)) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  // Trim 1px anti-aliased background fringe on real-sized images without eroding sharp dark outlines
  if (width >= 32 && height >= 32) {
    const fringeTolSq = euclidTolSq * 1.9;
    const fringe: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (visited[index]) continue;
        const offset = index * 4;
        if (pixels[offset + 3] < 36) continue;
        let bgNeighbors = 0;
        if (x > 0 && visited[index - 1]) bgNeighbors += 1;
        if (x + 1 < width && visited[index + 1]) bgNeighbors += 1;
        if (y > 0 && visited[index - width]) bgNeighbors += 1;
        if (y + 1 < height && visited[index + width]) bgNeighbors += 1;
        if (!bgNeighbors) continue;
        const dr = pixels[offset] - baseR;
        const dg = pixels[offset + 1] - baseG;
        const db = pixels[offset + 2] - baseB;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq <= fringeTolSq && bgNeighbors >= 2) fringe.push(index);
      }
    }
    for (const index of fringe) visited[index] = 1;
  }

  let selected = 0;
  let opaque = 0;
  for (let index = 0; index < total; index += 1) {
    if (pixels[index * 4 + 3] < 36) continue;
    opaque += 1;
    selected += visited[index];
  }
  const ratio = opaque ? selected / opaque : 0;
  if (ratio < MIN_BACKGROUND_RATIO || ratio > MAX_BACKGROUND_RATIO) {
    throw new Error("没有可靠识别出纯色背景，图纸已保持不变。");
  }
  return visited;
}

export function removeBackgroundCells(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (pixels.length !== width * height * 4) return pixels;
  const cornerIndices = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ];
  const corners = cornerIndices
    .map((index) => {
      const offset = index * 4;
      return pixels[offset + 3] >= 36
        ? ([pixels[offset], pixels[offset + 1], pixels[offset + 2]] as [
            number,
            number,
            number,
          ])
        : null;
    })
    .filter((value): value is [number, number, number] => value !== null);
  if (!corners.length) return pixels;

  const medianChannel = (channel: 0 | 1 | 2) => {
    const sorted = corners.map(rgb => rgb[channel]).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const background: [number, number, number] = [
    medianChannel(0),
    medianChannel(1),
    medianChannel(2),
  ];
  const backgroundLab = rgbToLab(background);
  const tolerance
    = luminance(...background) > 225 && saturation(...background) < 0.08
      ? 11
      : 6.5;

  const isSimilar = (index: number) => {
    const offset = index * 4;
    if (pixels[offset + 3] < 36) return true;
    const lab = rgbToLab([
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    ]);
    return colorDistance(lab, backgroundLab) <= tolerance;
  };
  const matchingCorners = cornerIndices.filter(index =>
    pixels[index * 4 + 3] >= 36 && isSimilar(index),
  );
  if (matchingCorners.length < Math.min(3, corners.length)) return pixels;

  const output = new Uint8ClampedArray(pixels);
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const enqueue = (index: number) => {
    if (!seen[index] && isSimilar(index)) {
      seen[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    output[index * 4 + 3] = 0;
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  return output;
}

export async function removePlainBackground(
  dataUrl: string,
  onProgress?: (message: string) => void,
) {
  onProgress?.("正在浏览器中删除纯色背景…");
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  }
  catch {
    throw new Error("像素稿无法打开，请重新生成。");
  }
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法处理图片，请更新浏览器后重试。");
  context.drawImage(image, 0, 0);
  const output = context.getImageData(0, 0, canvas.width, canvas.height);
  const mask = createBackgroundMask(output.data, canvas.width, canvas.height);
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (mask[index]) output.data[offset + 3] = 0;
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}
