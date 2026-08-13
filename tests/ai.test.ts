import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIXEL_ART_PROMPT } from "../app/api/gemini/image/route";
import { aiOutputSize, restoreSourceColors } from "../lib/ai";
import { isFreeQuotaError } from "../worker/src/index";

describe("AI 图片尺寸", () => {
  it("保留横竖比例并使用模型稳定支持的尺寸", () => {
    expect(aiOutputSize(576, 204)).toEqual({ width: 1024, height: 384 });
    expect(aiOutputSize(204, 576)).toEqual({ width: 384, height: 1024 });
  });

  it("保留原图对应区域的主色", () => {
    const source = new Uint8ClampedArray([
      8, 78, 32, 255,
      8, 78, 32, 255,
      60, 205, 96, 255,
      60, 205, 96, 255,
    ]);
    const generated = new Uint8ClampedArray([
      80, 110, 92, 255,
      82, 112, 94, 255,
      112, 180, 124, 255,
      114, 182, 126, 255,
    ]);
    expect([...restoreSourceColors(source, generated, 4, 1)]).toEqual([
      8, 78, 32, 255,
      8, 78, 32, 255,
      60, 205, 96, 255,
      60, 205, 96, 255,
    ]);
  });

  it("Cloudflare 与 Gemini 都明确生成拼豆用粗像素稿", () => {
    const worker = readFileSync(
      new URL("../worker/src/index.ts", import.meta.url),
      "utf8",
    );
    expect(worker).toContain("modelInput.set(\"guidance\", \"1\")");
    for (const prompt of [worker, PIXEL_ART_PROMPT]) {
      expect(prompt).toContain("chunky square pixel clusters");
      expect(prompt).toContain("strict image-to-image conversion");
      expect(prompt).toContain("BACKGROUND LOCK");
      expect(prompt).toContain("COLOR LOCK");
      expect(prompt).toContain("A solid background must remain");
      expect(prompt).toContain("Do not color-grade");
      expect(prompt).toContain("Color reduction is handled later by the app");
      expect(prompt).not.toContain("12 to 20 colors");
      expect(prompt).toContain("No visible grid lines");
      expect(prompt).not.toContain("#ff00ff");
      expect(prompt).not.toContain("#FFFFFF");
    }
  });

  it("只把免费额度或费用上限识别为额度耗尽", () => {
    expect(isFreeQuotaError(new Error("Workers AI error 3036"))).toBe(true);
    expect(isFreeQuotaError(new Error("AI Gateway spend limit reached"))).toBe(
      true,
    );
    expect(isFreeQuotaError(new Error("Failed to fetch"))).toBe(false);
  });
});
