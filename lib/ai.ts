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

function luminance(r: number, g: number, b: number) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function detectAxisPeriod(energy: Float64Array, length: number) {
  const maxStep = Math.min(32, Math.floor(length / 10));
  if (maxStep < 3) return null;

  let totalEnergy = 0;
  for (let i = 1; i < length; i += 1) totalEnergy += energy[i];
  const avgEnergy = totalEnergy / Math.max(1, length - 1);
  if (avgEnergy <= 1) return null;

  const candidates: Array<{ step: number; phase: number; ratio: number }> = [];
  let globalBest = 0;

  for (let step = 3; step <= maxStep; step += 1) {
    let bestPhase = 0;
    let bestPhaseAvg = 0;
    for (let phase = 0; phase < step; phase += 1) {
      let sum = 0;
      let count = 0;
      for (let pos = phase === 0 ? step : phase; pos < length; pos += step) {
        sum += energy[pos];
        count += 1;
      }
      const avg = count ? sum / count : 0;
      if (avg > bestPhaseAvg) {
        bestPhaseAvg = avg;
        bestPhase = phase;
      }
    }
    const ratio = bestPhaseAvg / avgEnergy;
    candidates.push({ step, phase: bestPhase, ratio });
    if (ratio > globalBest) globalBest = ratio;
  }

  if (globalBest < 1.65) return null;

  // Prefer the smallest fundamental period whose peak ratio is strong (avoids harmonics like 2*p)
  for (const candidate of candidates) {
    if (candidate.ratio >= Math.max(1.65, globalBest * 0.86))
      return candidate;
  }
  return null;
}

function buildGridCuts(
  energy: Float64Array,
  length: number,
  step: number,
  phase: number,
) {
  const cuts: number[] = [0];
  const searchRadius = Math.max(1, Math.floor(step * 0.28));
  let pos = phase === 0 ? step : phase;

  while (pos < length - Math.floor(step * 0.4)) {
    const start = Math.max(cuts[cuts.length - 1] + 2, pos - searchRadius);
    const end = Math.min(length - 2, pos + searchRadius);
    let bestPos = pos;
    let bestEnergy = -1;
    for (let cursor = start; cursor <= end; cursor += 1) {
      if (energy[cursor] > bestEnergy) {
        bestEnergy = energy[cursor];
        bestPos = cursor;
      }
    }
    cuts.push(bestPos);
    pos = bestPos + step;
  }
  cuts.push(length);
  return cuts;
}

export function snapAiPixelGrid(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
) {
  if (pixels.length !== width * height * 4)
    throw new Error("图片像素数据不完整。");
  if (width < 32 || height < 32) {
    return {
      data: pixels,
      snapped: false,
      stepX: 1,
      stepY: 1,
    };
  }

  const colEnergy = new Float64Array(width);
  const rowEnergy = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    const rowBase = y * width;
    for (let x = 1; x < width; x += 1) {
      const a = (rowBase + x) * 4;
      const b = a - 4;
      colEnergy[x]
        += Math.abs(pixels[a] - pixels[b])
          + Math.abs(pixels[a + 1] - pixels[b + 1])
          + Math.abs(pixels[a + 2] - pixels[b + 2]);
    }
  }
  for (let y = 1; y < height; y += 1) {
    const rowBase = y * width;
    const prevBase = (y - 1) * width;
    for (let x = 0; x < width; x += 1) {
      const a = (rowBase + x) * 4;
      const b = (prevBase + x) * 4;
      rowEnergy[y]
        += Math.abs(pixels[a] - pixels[b])
          + Math.abs(pixels[a + 1] - pixels[b + 1])
          + Math.abs(pixels[a + 2] - pixels[b + 2]);
    }
  }

  const xPeriod = detectAxisPeriod(colEnergy, width);
  const yPeriod = detectAxisPeriod(rowEnergy, height);
  if (!xPeriod || !yPeriod) {
    return { data: pixels, snapped: false, stepX: 1, stepY: 1 };
  }

  // Reject wildly non-square false periods
  const ratio = Math.max(xPeriod.step, yPeriod.step) / Math.min(xPeriod.step, yPeriod.step);
  if (ratio > 1.6) {
    return { data: pixels, snapped: false, stepX: 1, stepY: 1 };
  }

  const xCuts = buildGridCuts(colEnergy, width, xPeriod.step, xPeriod.phase);
  const yCuts = buildGridCuts(rowEnergy, height, yPeriod.step, yPeriod.phase);
  const output = new Uint8ClampedArray(pixels.length);

  for (let cy = 0; cy < yCuts.length - 1; cy += 1) {
    const y0 = yCuts[cy];
    const y1 = yCuts[cy + 1];
    const insetY = y1 - y0 >= 4 ? 1 : 0;
    for (let cx = 0; cx < xCuts.length - 1; cx += 1) {
      const x0 = xCuts[cx];
      const x1 = xCuts[cx + 1];
      const insetX = x1 - x0 >= 4 ? 1 : 0;

      const buckets = new Map<
        number,
        { count: number; r: number; g: number; b: number; a: number }
      >();
      let best: { count: number; r: number; g: number; b: number; a: number } | null = null;
      for (let y = y0 + insetY; y < y1 - insetY; y += 1) {
        for (let x = x0 + insetX; x < x1 - insetX; x += 1) {
          const offset = (y * width + x) * 4;
          const r = pixels[offset];
          const g = pixels[offset + 1];
          const b = pixels[offset + 2];
          const a = pixels[offset + 3];
          const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
          let entry = buckets.get(key);
          if (!entry) {
            entry = { count: 0, r: 0, g: 0, b: 0, a: 0 };
            buckets.set(key, entry);
          }
          entry.count += 1;
          entry.r += r;
          entry.g += g;
          entry.b += b;
          entry.a += a;
          if (!best || entry.count > best.count) best = entry;
        }
      }
      if (!best) continue;
      const fillR = Math.round(best.r / best.count);
      const fillG = Math.round(best.g / best.count);
      const fillB = Math.round(best.b / best.count);
      const fillA = Math.round(best.a / best.count);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * width + x) * 4;
          output[offset] = fillR;
          output[offset + 1] = fillG;
          output[offset + 2] = fillB;
          output[offset + 3] = fillA;
        }
      }
    }
  }

  return {
    data: output,
    snapped: true,
    stepX: xPeriod.step,
    stepY: yPeriod.step,
  };
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
    const gr = generated[offset];
    const gg = generated[offset + 1];
    const gb = generated[offset + 2];
    const sr = source[offset];
    const sg = source[offset + 1];
    const sb = source[offset + 2];
    // Reject severe luminance mismatches caused by slight AI spatial drift (protects dark outlines/eyes)
    if (Math.abs(luminance(gr, gg, gb) - luminance(sr, sg, sb)) > 95)
      continue;
    const generatedColor
      = ((gr >> 4) << 8)
        | ((gg >> 4) << 4)
        | (gb >> 4);
    const sourceColor
      = ((sr >> 4) << 8)
        | ((sg >> 4) << 4)
        | (sb >> 4);
    const colors = matches.get(generatedColor) ?? new Map();
    const match = colors.get(sourceColor) ?? {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    match.count += 1;
    match.red += sr;
    match.green += sg;
    match.blue += sb;
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
      = ((generated[offset] >> 4) << 8)
        | ((generated[offset + 1] >> 4) << 4)
        | (generated[offset + 2] >> 4);
    const color = palette.get(generatedColor);
    if (!color) continue;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
  }
  return output;
}

async function preserveSourceColors(sourceUrl: string, generatedUrl: string) {
  const source = new Image();
  const generated = new Image();
  source.src = sourceUrl;
  generated.src = generatedUrl;
  await Promise.all([source.decode(), generated.decode()]);
  const width = generated.naturalWidth;
  const height = generated.naturalHeight;
  const canvas = document.createElement("canvas");
  const sourceCanvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width = width;
  canvas.height = sourceCanvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context || !sourceContext)
    throw new Error("当前浏览器无法校准图片颜色。");
  context.drawImage(generated, 0, 0, width, height);
  sourceContext.drawImage(source, 0, 0, width, height);
  const output = context.getImageData(0, 0, width, height);
  const snapped = snapAiPixelGrid(output.data, width, height).data;
  output.data.set(
    restoreSourceColors(
      sourceContext.getImageData(0, 0, width, height).data,
      snapped,
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
