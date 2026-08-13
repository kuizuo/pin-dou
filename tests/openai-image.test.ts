import { afterEach, describe, expect, it, vi } from "vitest";
import { OPENAI_IMAGE_MODEL, POST } from "../app/api/openai/image/route";
import { PIXEL_ART_PROMPT } from "../lib/ai-prompt";

afterEach(() => vi.unstubAllGlobals());

describe("GPT Image 图片整理", () => {
  it("把用户图片和拼豆提示词交给 GPT Image 并返回图片", async () => {
    const upstream = vi.fn().mockResolvedValue(
      Response.json({ data: [{ b64_json: "AQID" }] }),
    );
    vi.stubGlobal("fetch", upstream);
    const form = new FormData();
    form.set("apiKey", "user-openai-key");
    form.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "source.png", {
        type: "image/png",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/openai/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
    const [url, options] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/edits");
    expect((options.headers as Record<string, string>).authorization).toBe(
      "Bearer user-openai-key",
    );
    const body = options.body as FormData;
    expect(body.get("model")).toBe(OPENAI_IMAGE_MODEL);
    expect(body.get("prompt")).toBe(PIXEL_ART_PROMPT);
    expect(body.get("quality")).toBe("medium");
    expect(body.get("output_format")).toBe("png");
    expect(body.get("image[]")).toBeInstanceOf(File);
  });

  it("没有密钥时不发送图片", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const form = new FormData();
    form.set(
      "image",
      new File([new Uint8Array([1])], "source.png", { type: "image/png" }),
    );

    const response = await POST(
      new Request("http://localhost/api/openai/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请填写 OpenAI API Key。",
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
