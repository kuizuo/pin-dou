import { Buffer } from "node:buffer";

const GEMINI_MODEL = "gemini-3.1-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const maxDuration = 120;

export const PIXEL_ART_PROMPT = `Use the supplied image as the only visual reference. Create a clean, faithful preparation image for a fuse-bead pattern.

Preserve exactly: the subject's identity, number of subjects, face and expression, pose, proportions, direction, crop, composition, and recognizable high-contrast details. Preserve the original main colors.

Simplify only what helps a small grid: replace texture and photographic noise with broad flat color regions, clear closed silhouettes, crisp boundaries, and very limited simple shading. Keep important eyes, facial features, markings, clothing details, and object shapes readable. Use about 12 to 20 visually distinct colors. Do not turn the result into a bead mockup, circular beads, a printed grid, or a low-resolution pixel mosaic; the app will create the final grid afterward.

Place the complete subject in the center with comfortable padding. Use one perfectly uniform pure white background (#FFFFFF), with no shadow, gradient, texture, scenery, or floor line. Do not add, remove, duplicate, or redesign subjects or objects. No text, letters, numbers, border, frame, watermark, decorations, or new props.`;

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
