import type { AiVariant } from "./types";

export type AiStyleCandidate = {
  variant: AiVariant;
  image: string;
  originalImage: string;
};
export type AiStyleFailure = {
  variant: AiVariant;
  message: string;
  code?: string;
};
export type AiProvider = "cloudflare" | "gemini" | "openai";
export type AiRequest = { provider: AiProvider; credential: string };

export const AI_PROVIDER_NAMES: Record<AiProvider, string> = {
  cloudflare: "Cloudflare AI",
  gemini: "Gemini",
  openai: "GPT Image",
};

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("AI 生成的图片无法读取。"));
    reader.readAsDataURL(blob);
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("图片无法压缩。"))),
      "image/jpeg",
      0.9,
    ),
  );
}

export function restoreSourceColors(
  source: Uint8ClampedArray,
  generated: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (source.length !== generated.length || source.length !== width * height * 4)
    throw new Error("图片颜色数据不完整。");
  const matches = new Map<
    number,
    Map<number, { count: number; red: number; green: number; blue: number }>
  >();
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    if (generated[offset + 3] < 12 || source[offset + 3] < 12) continue;
    const generatedColor
      = ((generated[offset] >> 5) << 6)
        | ((generated[offset + 1] >> 5) << 3)
        | (generated[offset + 2] >> 5);
    const sourceColor
      = ((source[offset] >> 4) << 8)
        | ((source[offset + 1] >> 4) << 4)
        | (source[offset + 2] >> 4);
    const colors = matches.get(generatedColor) ?? new Map();
    const match = colors.get(sourceColor) ?? {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    match.count += 1;
    match.red += source[offset];
    match.green += source[offset + 1];
    match.blue += source[offset + 2];
    colors.set(sourceColor, match);
    matches.set(generatedColor, colors);
  }
  const palette = new Map<number, readonly [number, number, number]>();
  for (const [key, colors] of matches) {
    const best = [...colors.values()].reduce((winner, color) =>
      color.count > winner.count ? color : winner,
    );
    palette.set(key, [
      Math.round(best.red / best.count),
      Math.round(best.green / best.count),
      Math.round(best.blue / best.count),
    ]);
  }
  const output = new Uint8ClampedArray(generated);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    const generatedColor
      = ((generated[offset] >> 5) << 6)
        | ((generated[offset + 1] >> 5) << 3)
        | (generated[offset + 2] >> 5);
    const color = palette.get(generatedColor);
    if (!color) continue;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
  }
  return output;
}

async function preserveSourceColors(sourceUrl: string, generatedUrl: string) {
  const source = new Image(),
    generated = new Image();
  source.src = sourceUrl;
  generated.src = generatedUrl;
  await Promise.all([source.decode(), generated.decode()]);
  const width = generated.naturalWidth,
    height = generated.naturalHeight;
  const canvas = document.createElement("canvas"),
    sourceCanvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width = width;
  canvas.height = sourceCanvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true }),
    sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context || !sourceContext)
    throw new Error("当前浏览器无法校准图片颜色。");
  context.drawImage(generated, 0, 0, width, height);
  sourceContext.drawImage(source, 0, 0, width, height);
  const output = context.getImageData(0, 0, width, height);
  output.data.set(
    restoreSourceColors(
      sourceContext.getImageData(0, 0, width, height).data,
      output.data,
      width,
      height,
    ),
  );
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

async function compactImage(dataUrl: string) {
  const image = new Image();
  image.src = dataUrl;
  try {
    await image.decode();
  }
  catch {
    throw new Error("裁切后的图片无法打开。");
  }
  const scale = Math.min(
    1,
    511 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale)),
    height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理图片。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return {
    blob: await canvasBlob(canvas),
    ...aiOutputSize(width, height),
  };
}

export function aiOutputSize(width: number, height: number) {
  const ratio = 1024 / Math.max(width, height);
  const modelSize = (value: number) =>
    Math.max(256, Math.min(1024, Math.round(value / 64) * 64));
  return { width: modelSize(width * ratio), height: modelSize(height * ratio) };
}

export async function generatePixelStyle(
  dataUrl: string,
  request: AiRequest,
  onProgress?: (message: string) => void,
) {
  if (!request.credential.trim())
    throw new Error(
      request.provider === "cloudflare"
        ? "请先完成安全验证。"
        : `请填写 ${request.provider === "gemini" ? "Gemini" : "OpenAI"} API Key。`,
    );
  onProgress?.("正在准备图片…");
  const input = await compactImage(dataUrl);
  const form = new FormData();
  form.set("image", input.blob, "source.jpg");
  if (request.provider !== "cloudflare")
    form.set("apiKey", request.credential.trim());
  else {
    form.set("turnstileToken", request.credential);
    form.set("width", String(input.width));
    form.set("height", String(input.height));
  }
  onProgress?.(
    `${AI_PROVIDER_NAMES[request.provider]} 正在进行像素化处理…`,
  );
  const endpoint = {
    cloudflare: process.env.NEXT_PUBLIC_PIXEL_WORKER_URL,
    gemini: "/api/gemini/image",
    openai: "/api/openai/image",
  }[request.provider];
  if (!endpoint) throw new Error("Cloudflare AI 尚未配置。");
  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw Object.assign(
      new Error(payload.error || `AI 图片处理失败（${response.status}）。`),
      { code: payload.code },
    );
  }
  const generatedImage = await blobAsDataUrl(await response.blob());
  onProgress?.("正在按原图校准颜色…");
  const originalImage = await preserveSourceColors(dataUrl, generatedImage);
  return {
    variant: "pixel",
    image: originalImage,
    originalImage,
  } satisfies AiStyleCandidate;
}
