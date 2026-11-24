import wand from "magic-wand-tool";
import { describe, expect, it } from "vitest";
import { createBackgroundMask, removeBackgroundCells } from "../lib/background";

function image(width = 10, height = 10) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4)
    pixels.set([255, 0, 255, 255], index);
  for (let y = 3; y < 7; y += 1)
    for (let x = 3; x < 7; x += 1)
      pixels.set([20, 40, 80, 255], (y * width + x) * 4);
  return pixels;
}

describe("纯色背景识别", () => {
  it("只选择与四角连通的背景", () => {
    const mask = createBackgroundMask(image(), 10, 10, wand);
    expect(mask.reduce((sum, value) => sum + value, 0)).toBe(84);
    expect(mask[5 * 10 + 5]).toBe(0);
  });

  it("边缘没有多数背景色时保留原图", () => {
    const pixels = image();
    for (let index = 0; index < 10; index += 1) {
      pixels.set([255, 0, 0, 255], index * 4);
      pixels.set([0, 255, 255, 255], (90 + index) * 4);
      pixels.set([0, 255, 0, 255], index * 10 * 4);
      pixels.set([255, 255, 0, 255], (index * 10 + 9) * 4);
    }
    expect(() => createBackgroundMask(pixels, 10, 10, wand)).toThrow(
      "背景不够统一",
    );
  });

  it("主体碰到一个角时仍能识别其余三角连通的背景", () => {
    const pixels = image();
    pixels.set([20, 40, 80, 255], 0);
    const mask = createBackgroundMask(pixels, 10, 10, wand);
    expect(mask[0]).toBe(0);
    expect(mask[9]).toBe(1);
    expect(mask[5 * 10 + 5]).toBe(0);
  });

  it("透明圆角不会遮住里面真正的纯色背景", () => {
    const pixels = image(20, 20);
    for (const [startX, startY] of [
      [0, 0],
      [17, 0],
      [0, 17],
      [17, 17],
    ]) {
      for (let y = startY; y < startY + 3; y += 1)
        for (let x = startX; x < startX + 3; x += 1)
          pixels.set([0, 0, 0, 0], (y * 20 + x) * 4);
    }
    const mask = createBackgroundMask(pixels, 20, 20, wand);
    expect(mask[10]).toBe(1);
    expect(mask[5 * 20 + 5]).toBe(0);
  });

  it("背景覆盖几乎整张图时拒绝破坏图片", () => {
    const pixels = image();
    for (let y = 3; y < 7; y += 1)
      for (let x = 3; x < 7; x += 1)
        pixels.set([255, 0, 255, 255], (y * 10 + x) * 4);
    expect(() => createBackgroundMask(pixels, 10, 10, wand)).toThrow(
      "没有可靠识别",
    );
  });

  it("大图纯色去背采用单遍 BFS，耗时低且清理抗锯齿浅边不伤主体暗线", () => {
    const size = 256;
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < pixels.length; i += 4)
      pixels.set([252, 252, 252, 255], i);
    for (let y = 64; y < 192; y += 1)
      for (let x = 64; x < 192; x += 1) {
        const isBorder = x === 64 || x === 191 || y === 64 || y === 191;
        pixels.set(
          isBorder ? [20, 20, 20, 255] : [220, 80, 90, 255],
          (y * size + x) * 4,
        );
      }
    const start = performance.now();
    const mask = createBackgroundMask(pixels, size, size);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
    expect(mask[0]).toBe(1);
    expect(mask[64 * size + 64]).toBe(0); // crisp dark outline kept
    expect(mask[128 * size + 128]).toBe(0);
  });

  it("格级二次去背清理角落连通的残余背景格并保留内部白色", () => {
    const width = 8;
    const height = 8;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4)
      pixels.set([248, 248, 248, 255], i);
    // Closed dark box with white interior
    for (let y = 2; y <= 5; y += 1)
      for (let x = 2; x <= 5; x += 1) {
        const isWall = x === 2 || x === 5 || y === 2 || y === 5;
        pixels.set(
          isWall ? [20, 20, 20, 255] : [255, 255, 255, 255],
          (y * width + x) * 4,
        );
      }
    const cleaned = removeBackgroundCells(pixels, width, height);
    expect(cleaned[3]).toBe(0); // outer corner removed
    expect(cleaned[(2 * width + 2) * 4 + 3]).toBe(255); // dark wall kept
    expect(cleaned[(3 * width + 3) * 4 + 3]).toBe(255); // enclosed interior white kept
  });
});
