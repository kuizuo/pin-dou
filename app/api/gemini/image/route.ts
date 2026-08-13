import { Buffer } from "node:buffer";

const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const maxDuration = 120;

export const PIXEL_ART_PROMPT = `Edit the supplied image. Apply ONLY a neutral pixelation treatment to the existing image. This is a strict image-to-image conversion, not a redesign, recolor, or enhancement.

CONTENT LOCK: keep the exact canvas aspect ratio, composition, crop, positions, scale, spacing, subject identity, pose, silhouette, logos, and existing words. Keep every existing element. Render existing words as readable blocky pixel lettering without changing the words.

BACKGROUND LOCK: keep the original background content, shape, and color. A solid background must remain the same single solid color. Never remove, replace, decorate, extend, or add detail to the background. Do not isolate the subject or create transparency.

COLOR LOCK: preserve the original colors as closely as possible in every corresponding region, including hue, saturation, brightness, contrast, highlights, shadows, and gradients. Every output color must come from the corresponding source region. Do not color-grade, enhance, recolor, simplify, merge, reduce, substitute, or invent colors. Do not apply a retro palette. Color reduction is handled later by the app.

PIXEL STYLE: change only the spatial rendering into clearly visible chunky square pixel clusters, stair-step diagonals, hard edges, no anti-aliasing, and no smooth curves. Approximate gradients and texture with larger square samples of their original source colors rather than changing the palette.

OUTPUT LOCK: output a clean raster pixel-art image only. No visible grid lines, tile borders, checkerboard, beads, pegboard, frame, new text, new colors, new objects, or new scenery.`;

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }>;
    };
  }>;
  error?: { message?: string };
};

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function friendlyGeminiError(status: number) {
  if (status === 401 || status === 403)
    return "Gemini 密钥无效或没有图片生成权限。";
  if (status === 429) return "Gemini 额度已用完或请求过快，请稍后再试。";
  if (status === 400) return "Gemini 密钥无效，或当前密钥不能使用图片模型。";
  return "Gemini 图片处理暂时不可用，请稍后重试。";
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  }
  catch {
    return errorResponse("图片请求无法读取。", 400);
  }

  const apiKey = form.get("apiKey"),
    image = form.get("image");
  if (typeof apiKey !== "string" || !apiKey.trim())
    return errorResponse("请填写 Gemini API Key。", 400);
  if (
    !(image instanceof File)
    || !IMAGE_TYPES.has(image.type)
    || image.size === 0
    || image.size > MAX_IMAGE_BYTES
  ) {
    return errorResponse("图片格式不支持或文件过大。", 400);
  }

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: PIXEL_ART_PROMPT },
              {
                inlineData: {
                  mimeType: image.type,
                  data: Buffer.from(await image.arrayBuffer()).toString(
                    "base64",
                  ),
                },
              },
            ],
          },
        ],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
      signal: AbortSignal.timeout(120_000),
    });
  }
  catch {
    return errorResponse("Gemini 图片处理暂时不可用，请稍后重试。", 502);
  }
  const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
  if (!response.ok)
    return errorResponse(friendlyGeminiError(response.status), response.status);

  const output = payload.candidates
    ?.flatMap(candidate => candidate.content?.parts || [])
    .find(part => part.inlineData?.data)?.inlineData;
  if (!output?.data || !output.mimeType || !IMAGE_TYPES.has(output.mimeType))
    return errorResponse("Gemini 没有返回可用图片。", 502);
  return new Response(Buffer.from(output.data, "base64"), {
    headers: { "cache-control": "no-store", "content-type": output.mimeType },
  });
}
