import { afterEach, describe, expect, it, vi } from "vitest";
import { PIXEL_ART_PROMPT, POST } from "../app/api/gemini/image/route";

afterEach(() => vi.unstubAllGlobals());

describe("Gemini 图片整理", () => {
  it("把用户图片和拼豆提示词交给 Gemini 并返回图片", async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { inlineData: { data: "AQID", mimeType: "image/png" } },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", upstream);
    const form = new FormData();
    form.set("apiKey", "user-gemini-key");
    form.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "source.png", {
        type: "image/png",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/gemini/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      1, 2, 3,
    ]);
    const [url, options] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("gemini-3.1-flash-image:generateContent");
    expect((options.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "user-gemini-key",
    );
    const body = JSON.parse(String(options.body));
    expect(body.contents[0].parts[0].text).toBe(PIXEL_ART_PROMPT);
    expect(body.contents[0].parts[1].inlineData).toEqual({
      data: "AQID",
      mimeType: "image/png",
    });
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
      new Request("http://localhost/api/gemini/image", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "请填写 Gemini API Key。",
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
