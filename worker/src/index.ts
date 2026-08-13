import type { Env, ExportedHandler } from "../worker-configuration";

const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const FREE_QUOTA_CODE = "AI_FREE_QUOTA_EXHAUSTED";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROMPT = `Edit input image 0. Apply ONLY a neutral pixelation treatment to the existing image. This is a strict image-to-image conversion, not a redesign, recolor, or enhancement.

CONTENT LOCK: keep the exact canvas aspect ratio, composition, crop, positions, scale, spacing, subject identity, pose, silhouette, logos, and existing words. Keep every existing element. Render existing words as readable blocky pixel lettering without changing the words.

BACKGROUND LOCK: keep the original background content, shape, and color. A solid background must remain the same single solid color. Never remove, replace, decorate, extend, or add detail to the background. Do not isolate the subject or create transparency.

COLOR LOCK: preserve the original colors as closely as possible in every corresponding region, including hue, saturation, brightness, contrast, highlights, shadows, and gradients. Every output color must come from the corresponding source region. Do not color-grade, enhance, recolor, simplify, merge, reduce, substitute, or invent colors. Do not apply a retro palette. Color reduction is handled later by the app.

PIXEL STYLE: change only the spatial rendering into clearly visible chunky square pixel clusters, stair-step diagonals, hard edges, no anti-aliasing, and no smooth curves. Approximate gradients and texture with larger square samples of their original source colors rather than changing the palette.

OUTPUT LOCK: output a clean raster pixel-art image only. No visible grid lines, tile borders, checkerboard, beads, pegboard, frame, new text, new colors, new objects, or new scenery.`;

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function jsonError(
  message: string,
  status: number,
  origin: string,
  code?: string,
) {
  return Response.json(
    { error: message, ...(code ? { code } : {}) },
    {
      status,
      headers: { ...corsHeaders(origin), "cache-control": "no-store" },
    },
  );
}

export function isFreeQuotaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b3036\b|free allocation|spend limit|daily quota|quota exceeded/i.test(
    message,
  );
}

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("origin") || "";
  const allowed = env.ALLOWED_ORIGINS.split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : "";
}

function validDimension(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 256 && number <= 1024
    ? number
    : null;
}

async function verifyTurnstile(token: string, request: Request, env: Env) {
  const form = new URLSearchParams();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.set("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  if (!response.ok)
    return false;
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null) return false;
  const record = result as Record<string, unknown>;
  const localTest
    = env.ALLOWED_ORIGINS.includes("localhost")
      && token === "XXXX.DUMMY.TOKEN.XXXX";
  return record.success === true && (record.action === "pixelize" || localTest);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function imageType(bytes: Uint8Array) {
  if (
    bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
  )
    return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
    return "image/webp";
  return "application/octet-stream";
}

async function pixelize(request: Request, env: Env, origin: string) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_FILE_BYTES + 20_000)
    return jsonError("图片过大，请缩小裁切范围后重试。", 413, origin);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rate = await env.PIXEL_RATE_LIMITER.limit({ key: `pixelize:${ip}` });
  if (!rate.success)
    return jsonError("生成太频繁，请一分钟后再试。", 429, origin);

  let form: FormData;
  try {
    form = await request.formData();
  }
  catch {
    return jsonError("图片请求无法读取。", 400, origin);
  }

  const image = form.get("image"),
    token = form.get("turnstileToken");
  const width = validDimension(form.get("width")),
    height = validDimension(form.get("height"));
  if (
    !(image instanceof File)
    || !IMAGE_TYPES.has(image.type)
    || image.size === 0
    || image.size > MAX_FILE_BYTES
    || typeof token !== "string"
    || !token
    || !width
    || !height
  ) {
    return jsonError("图片或验证信息不完整。", 400, origin);
  }
  if (!(await verifyTurnstile(token, request, env)))
    return jsonError("安全验证已失效，请重新验证。", 403, origin);

  const modelInput = new FormData();
  modelInput.set("prompt", PROMPT);
  modelInput.set("input_image_0", image);
  modelInput.set("guidance", "1");
  modelInput.set("width", String(width));
  modelInput.set("height", String(height));
  const encoded = new Response(modelInput);
  const contentType = encoded.headers.get("content-type");
  if (!encoded.body || !contentType)
    return jsonError("图片请求无法编码。", 400, origin);

  try {
    const output = await env.AI.run(
      MODEL,
      { multipart: { body: encoded.body, contentType } },
    );
    if (!output.image)
      return jsonError("AI 服务没有返回可用图片。", 502, origin);
    const bytes = decodeBase64(output.image);
    const type = imageType(bytes);
    if (type === "application/octet-stream")
      return jsonError("AI 服务返回了无法识别的图片。", 502, origin);
    console.log(
      JSON.stringify({
        event: "pixelize_complete",
        inputBytes: image.size,
        outputBytes: bytes.byteLength,
        width,
        height,
      }),
    );
    return new Response(bytes, {
      headers: {
        ...corsHeaders(origin),
        "cache-control": "no-store",
        "content-type": type,
      },
    });
  }
  catch (error) {
    console.error(
      JSON.stringify({
        event: "pixelize_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    if (isFreeQuotaError(error))
      return jsonError(
        "今日 Cloudflare AI 免费额度已用完，已停止生成，不会产生额外费用。请明天再试，或改用 GPT Image。",
        429,
        origin,
        FREE_QUOTA_CODE,
      );
    return jsonError("AI 图片处理暂时不可用，请稍后重试。", 502, origin);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env);
    if (!origin)
      return Response.json(
        { error: "不允许的请求来源。" },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/pixelize")
      return jsonError("找不到这个图片处理入口。", 404, origin);
    return pixelize(request, env, origin);
  },
} satisfies ExportedHandler<Env>;
