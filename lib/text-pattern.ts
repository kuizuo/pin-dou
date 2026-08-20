import type { Pattern } from "./types";
import { BEAD_COLORS } from "./beads";
import { imageDataToCells } from "./pattern";

export type TextDirection = "horizontal" | "vertical";

export type TextPatternOptions = {
  value: string;
  size: number;
  direction: TextDirection;
  colorId: string;
};

const EMOJI_PART = /[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u20E3]/u;

export function textCharacters(value: string) {
  const clean = value.replace(/\s/gu, "");
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(clean)]
    .map(item => item.segment);
}

export function textError(value: string) {
  const characters = textCharacters(value);
  if (!characters.length) return "请输入 1–5 个字符。";
  if (characters.length > 5) return "最多输入 5 个字符。";
  if (characters.some(character => EMOJI_PART.test(character)))
    return "文字图纸不支持 Emoji，请使用 Emoji 转图纸。";
  return "";
}

export function emojiCharacters(value: string) {
  const clean = value.replace(/\s/gu, "");
  if (!clean) return [];
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(clean)]
    .map(item => item.segment);
}

export function emojiError(value: string) {
  const characters = emojiCharacters(value);
  if (!characters.length) return "请输入一个 Emoji。";
  if (characters.length !== 1) return "每张图纸只能使用一个 Emoji。";
  if (!EMOJI_PART.test(characters[0])) return "请输入 Emoji，不要输入普通文字。";
  return "";
}

export function textPatternSize(
  characterCount: number,
  requestedSize: number,
  direction: TextDirection,
) {
  const size = Math.max(12, Math.min(58, Math.round(requestedSize)));
  const length = Math.max(1, characterCount);
  const longEdge = 4 + size * length + Math.max(0, length - 1);
  const shortEdge = size + 4;
  return direction === "horizontal"
    ? { width: longEdge, height: shortEdge, size }
    : { width: shortEdge, height: longEdge, size };
}

function pattern(
  name: string,
  width: number,
  height: number,
  cells: Array<string | null>,
): Pattern {
  const now = new Date().toISOString();
  let minX = width, minY = height, maxX = -1, maxY = -1;
  cells.forEach((cell, index) => {
    if (!cell) return;
    const x = index % width, y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  });
  return {
    id: crypto.randomUUID(),
    name,
    width,
    height,
    cells,
    createdAt: now,
    contentBounds: maxX < 0
      ? undefined
      : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

export function createTextPattern(options: TextPatternOptions) {
  const error = textError(options.value);
  if (error) throw new Error(error);
  const characters = textCharacters(options.value);
  const margin = 2, gap = 1, horizontal = options.direction === "horizontal";
  const { size, width, height } = textPatternSize(
    characters.length,
    options.size,
    options.direction,
  );
  const scale = 8, pixelWidth = width * scale, pixelHeight = height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法生成文字图纸。");
  context.fillStyle = "#000";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const slotPixels = size * scale, marginPixels = margin * scale;
  const fontSize = Math.floor(slotPixels * 0.86);
  const fontFamily = getComputedStyle(document.body).fontFamily;
  context.font = `500 ${fontSize}px ${fontFamily}`;
  characters.forEach((character, index) => {
    const offset = marginPixels + slotPixels / 2 + index * (slotPixels + gap * scale);
    const x = horizontal ? offset : pixelWidth / 2;
    const y = horizontal ? pixelHeight / 2 : offset;
    context.fillText(character, x, y, slotPixels * 0.9);
  });
  const source = context.getImageData(0, 0, pixelWidth, pixelHeight).data;
  const cells = Array.from({ length: width * height }, (_, index) => {
    const cellX = index % width, cellY = Math.floor(index / width);
    let coverage = 0;
    for (let y = 0; y < scale; y += 1)
      for (let x = 0; x < scale; x += 1)
        coverage += source[((cellY * scale + y) * pixelWidth + cellX * scale + x) * 4 + 3];
    return coverage / (scale * scale) >= 74 ? options.colorId : null;
  });
  return pattern(characters.join(""), width, height, cells);
}

export function createEmojiPattern(value: string, requestedSize: number) {
  const error = emojiError(value);
  if (error) throw new Error(error);
  const emoji = emojiCharacters(value)[0];
  const size = Math.max(12, Math.min(58, Math.round(requestedSize)));
  const scale = 8, pixels = size * scale;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = pixels;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("当前浏览器无法生成 Emoji 图纸。");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.floor(pixels * 0.82)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  context.fillText(emoji, pixels / 2, pixels / 2);
  const source = context.getImageData(0, 0, pixels, pixels).data;
  const sampled = new Uint8ClampedArray(size * size * 4);
  for (let cellY = 0; cellY < size; cellY += 1)
    for (let cellX = 0; cellX < size; cellX += 1) {
      let red = 0, green = 0, blue = 0, alpha = 0;
      for (let y = 0; y < scale; y += 1)
        for (let x = 0; x < scale; x += 1) {
          const offset = ((cellY * scale + y) * pixels + cellX * scale + x) * 4;
          const weight = source[offset + 3] / 255;
          red += source[offset] * weight;
          green += source[offset + 1] * weight;
          blue += source[offset + 2] * weight;
          alpha += weight;
        }
      const target = (cellY * size + cellX) * 4;
      if (alpha >= scale * scale * 0.18) {
        sampled[target] = red / alpha;
        sampled[target + 1] = green / alpha;
        sampled[target + 2] = blue / alpha;
        sampled[target + 3] = 255;
      }
    }
  return pattern(
    emoji,
    size,
    size,
    imageDataToCells(sampled, size, size, 12, "edge", BEAD_COLORS, 5),
  );
}
