import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import worker from "../worker/src";

afterEach(() => vi.unstubAllGlobals());

it("按 Turnstile 接口要求提交验证信息", () => {
  const worker = readFileSync(
    new URL("../worker/src/index.ts", import.meta.url),
    "utf8",
  );
  expect(worker).toContain("const form = new URLSearchParams()");
});

it("直接提交图片给 Cloudflare AI", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ action: "pixelize", success: true })),
  );
  const run = vi.fn(async () => ({ image: "iVBORw==" }));
  const form = new FormData();
  form.set("image", new File(["image"], "source.png", { type: "image/png" }));
  form.set("turnstileToken", "valid-token");
  form.set("width", "256");
  form.set("height", "256");

  const response = await worker.fetch(
    new Request("https://api.pindou.kuizuo.me/v1/pixelize", {
      body: form,
      headers: { origin: "https://pindou.kuizuo.me" },
      method: "POST",
    }),
    {
      AI: { run },
      ALLOWED_ORIGINS: "https://pindou.kuizuo.me",
      PIXEL_RATE_LIMITER: { limit: async () => ({ success: true }) },
      TURNSTILE_SECRET_KEY: "<REDACTED>",
    },
  );

  expect(response.status).toBe(200);
  expect(run).toHaveBeenCalledOnce();
  expect(run.mock.calls[0]).toHaveLength(2);
});
