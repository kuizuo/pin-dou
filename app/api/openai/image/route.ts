import { Buffer } from "node:buffer";
import { PIXEL_ART_PROMPT } from "../../../../lib/ai-prompt";

export const OPENAI_IMAGE_MODEL = "gpt-image-2";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/edits";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const maxDuration = 120;

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string }>;
};

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function friendlyOpenAiError(status: number) {
  if (status === 401 || status === 403)
    return "OpenAI 密钥无效，或账号还没有图片编辑权限。";
  if (status === 429) return "OpenAI 额度已用完或请求过快，请稍后再试。";
  if (status === 400) return "OpenAI 拒绝了这次图片处理请求，请检查账号权限。";
  return "GPT Image 图片处理暂时不可用，请稍后重试。";
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
    return errorResponse("请填写 OpenAI API Key。", 400);
  if (
    !(image instanceof File)
    || !IMAGE_TYPES.has(image.type)
    || image.size === 0
    || image.size > MAX_IMAGE_BYTES
  ) {
    return errorResponse("图片格式不支持或文件过大。", 400);
  }

  const upstream = new FormData();
  upstream.set("model", OPENAI_IMAGE_MODEL);
  upstream.set("prompt", PIXEL_ART_PROMPT);
  upstream.set("quality", "medium");
  upstream.set("output_format", "png");
  upstream.append("image[]", image, image.name || "source.png");

  let response: Response;
  try {
    response = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey.trim()}` },
      body: upstream,
      signal: AbortSignal.timeout(120_000),
    });
  }
  catch {
    return errorResponse("GPT Image 图片处理暂时不可用，请稍后重试。", 502);
  }
  const payload = (await response.json().catch(() => ({}))) as OpenAiImageResponse;
  if (!response.ok)
    return errorResponse(friendlyOpenAiError(response.status), response.status);

  const output = payload.data?.[0]?.b64_json;
  if (!output) return errorResponse("GPT Image 没有返回可用图片。", 502);
  return new Response(Buffer.from(output, "base64"), {
    headers: { "cache-control": "no-store", "content-type": "image/png" },
  });
}
