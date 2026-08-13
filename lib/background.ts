type Wand = typeof import("magic-wand-tool")["default"];

const CORNER_THRESHOLD = 38;
const MIN_BACKGROUND_RATIO = 0.05;
const MAX_BACKGROUND_RATIO = 0.96;

function borderPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const positions = new Set<number>();
  for (let x = 0; x < width; x += 1) {
    positions.add(x);
    positions.add((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    positions.add(y * width);
    positions.add(y * width + width - 1);
  }
  return [...positions].map((index) => {
    const x = index % width,
      y = Math.floor(index / width);
    const offset = (y * width + x) * 4;
    return {
      x,
      y,
      color: [pixels[offset], pixels[offset + 1], pixels[offset + 2]] as const,
      alpha: pixels[offset + 3],
    };
  });
}

export function createBackgroundMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  wand: Wand,
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
    throw new Error("像素稿的背景不够统一，请重新生成。原图没有被修改。");
  const base = [
    dominant.red / dominant.count,
    dominant.green / dominant.count,
    dominant.blue / dominant.count,
  ];
  const seeds = border.filter(pixel =>
    pixel.color.every(
      (value, channel) => Math.abs(value - base[channel]) <= CORNER_THRESHOLD,
    ),
  );
  if (seeds.length < border.length / 2) {
    throw new Error("像素稿的背景不够统一，请重新生成。原图没有被修改。");
  }

  const visited = new Uint8Array(width * height);
  for (const { x, y } of seeds) {
    const mask = wand.floodFill(
      { data: pixels, width, height, bytes: 4 },
      x,
      y,
      CORNER_THRESHOLD,
      visited,
    );
    if (!mask) continue;
    for (let index = 0; index < mask.data.length; index += 1)
      if (mask.data[index]) visited[index] = 1;
  }
  let selected = 0,
    opaque = 0;
  for (let index = 0; index < visited.length; index += 1) {
    if (pixels[index * 4 + 3] < 36) continue;
    opaque += 1;
    selected += visited[index];
  }
  const ratio = selected / opaque;
  if (ratio < MIN_BACKGROUND_RATIO || ratio > MAX_BACKGROUND_RATIO) {
    throw new Error("没有可靠识别出纯色背景，请重新生成。原图没有被修改。");
  }
  return visited;
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
  const { default: wand } = await import("magic-wand-tool");
  const mask = createBackgroundMask(
    output.data,
    canvas.width,
    canvas.height,
    wand,
  );
  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4;
    if (mask[index]) output.data[offset + 3] = 0;
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}
