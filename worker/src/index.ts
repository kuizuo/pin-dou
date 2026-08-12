const MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROMPT = `Transform the reference image into faithful, clean pixel art for a fuse-bead pattern. Preserve the subject's identity, face, pose, proportions, direction, composition, and main colors. Use crisp square pixel clusters, a clear silhouette, flat limited colors, and only a little simple shading. Center the complete subject with generous space around every edge. Put it on one uniform bright magenta background (#ff00ff). Do not add text, borders, decorations, objects, scenery, gradients, shadows on the background, checkerboards, or dithering.`;

function corsHeaders(origin: string) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function jsonError(message: string, status: number, origin: string) {
  return Response.json(
    { error: message },
    {
      status,
      headers: { ...corsHeaders(origin), "cache-control": "no-store" },
    },
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
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.set("remoteip", ip);
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  if (!response.ok) return false;
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
  modelInput.set("width", String(width));
  modelInput.set("height", String(height));
  const encoded = new Response(modelInput);
  const contentType = encoded.headers.get("content-type");
  if (!encoded.body || !contentType)
    return jsonError("图片请求无法编码。", 400, origin);

  try {
    const output = await env.AI.run(MODEL, {
      multipart: { body: encoded.body, contentType },
    });
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
    return jsonError("AI 智能整理暂时不可用，请稍后重试。", 502, origin);
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
