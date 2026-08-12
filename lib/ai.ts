import type { AiVariant } from "./types";
import { removePlainBackground } from "./background";

export type AiStyleCandidate = {
  variant: AiVariant;
  image: string;
  originalImage: string;
};
export type AiStyleFailure = { variant: AiVariant; message: string };
export type AiProvider = "cloudflare" | "gemini";
export type AiRequest = { provider: AiProvider; credential: string };

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
    1024 / Math.max(image.naturalWidth, image.naturalHeight),
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
  const ratio = 1024 / Math.max(width, height);
  return {
    blob: await canvasBlob(canvas),
    width: Math.max(256, Math.min(1024, Math.round(width * ratio))),
    height: Math.max(256, Math.min(1024, Math.round(height * ratio))),
  };
}

export async function generatePixelStyle(
  dataUrl: string,
  request: AiRequest,
  onProgress?: (message: string) => void,
) {
  if (!request.credential.trim())
    throw new Error(
      request.provider === "gemini"
        ? "请填写 Gemini API Key。"
        : "请先完成安全验证。",
    );
  onProgress?.("正在准备图片…");
  const input = await compactImage(dataUrl);
  const form = new FormData();
  form.set("image", input.blob, "source.jpg");
  if (request.provider === "gemini")
    form.set("apiKey", request.credential.trim());
  else {
    form.set("turnstileToken", request.credential);
    form.set("width", String(input.width));
    form.set("height", String(input.height));
  }
  onProgress?.(
    `${request.provider === "gemini" ? "Gemini" : "Cloudflare AI"} 正在整理主体、轮廓和配色…`,
  );
  const endpoint
    = request.provider === "gemini"
      ? "/api/gemini/image"
      : process.env.NEXT_PUBLIC_PIXEL_WORKER_URL;
  if (!endpoint) throw new Error("Cloudflare AI 尚未配置。");
  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error || `AI 图片处理失败（${response.status}）。`);
  }
  const originalImage = await blobAsDataUrl(await response.blob());
  const image = await removePlainBackground(originalImage, onProgress);
  return { variant: "pixel", image, originalImage } satisfies AiStyleCandidate;
}
