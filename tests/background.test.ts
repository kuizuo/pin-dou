import wand from "magic-wand-tool";
import { describe, expect, it } from "vitest";
import { createBackgroundMask } from "../lib/background";

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
});
