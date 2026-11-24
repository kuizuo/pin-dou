import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PIXEL_ART_PROMPT } from "../app/api/gemini/image/route";
import { aiOutputSize, restoreSourceColors, snapAiPixelGrid } from "../lib/ai";
import { isFreeQuotaError } from "../worker/src/index";

describe("AI 图片尺寸", () => {
  it("线上构建不会带入本地 AI 配置", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { scripts: { deploy: string } };
    expect(packageJson.scripts.deploy).toContain(
      "NEXT_PUBLIC_PIXEL_WORKER_URL=https://api.pindou.kuizuo.me/v1/pixelize",
    );
    expect(packageJson.scripts.deploy).toContain(
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAEO5KesYkFyoUUYE",
    );
  });

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

  it("三个 AI 服务共用拼豆粗像素稿要求", () => {
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

  it("色彩校准遇到构图微偏时不会把深色轮廓漂白成浅色背景", () => {
    // Generated has a dark outline pixel [12, 12, 12] overlapping shifted white source [250, 250, 250]
    const source = new Uint8ClampedArray([
      250, 250, 250, 255,
      250, 250, 250, 255,
    ]);
    const generated = new Uint8ClampedArray([
      12, 12, 12, 255,
      240, 240, 240, 255,
    ]);
    const restored = restoreSourceColors(source, generated, 2, 1);
    expect([...restored.slice(0, 3)]).toEqual([12, 12, 12]);
    expect([...restored.slice(4, 7)]).toEqual([250, 250, 250]);
  });

  it("自动检测 AI 伪像素网格并消除格内抗锯齿模糊", () => {
    const block = 8;
    const cells = 12;
    const size = block * cells;
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let cy = 0; cy < cells; cy += 1)
      for (let cx = 0; cx < cells; cx += 1) {
        const base = (cx + cy) % 2 === 0 ? [240, 60, 60] : [40, 90, 220];
        for (let y = 0; y < block; y += 1)
          for (let x = 0; x < block; x += 1) {
            // Add blurry anti-aliased edge on cell border
            const isEdge = x === 0 || y === 0;
            const color = isEdge
              ? [140, 75, 140, 255]
              : [base[0], base[1], base[2], 255];
            pixels.set(color, ((cy * block + y) * size + cx * block + x) * 4);
          }
      }
    const result = snapAiPixelGrid(pixels, size, size);
    expect(result.snapped).toBe(true);
    expect(result.stepX).toBe(block);
    expect(result.stepY).toBe(block);
    // Border pixel (0, 0) of cell (0, 0) should be snapped cleanly back to red [240, 60, 60]
    expect([...result.data.slice(0, 3)]).toEqual([240, 60, 60]);
  });
});
