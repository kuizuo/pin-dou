import { describe, expect, it } from "vitest";
import {
  BEAD_COLORS,
  beadById,
  createSamplePattern,
  labDistance,
  nearestBead,
  patternContentSize,
  patternStats,
} from "../lib/beads";
import {
  fitPreviewSize,
  imageDataToCells,
  mardPalette,
  mirrorCells,
  PALETTE_SIZES,
  samplePixelTiles,
  validateImageFile,
} from "../lib/pattern";
import { DEFAULT_SETTINGS } from "../lib/types";

describe("MARD 图纸核心处理", () => {
  it("只使用完整 291 色并保留真实色号", () => {
    expect(BEAD_COLORS).toHaveLength(291);
    expect(beadById("T1").hex).toBe("#ffffff");
    expect(beadById("H7").hex).toBe("#000000");
    expect(new Set(BEAD_COLORS.map(color => color.id)).size).toBe(291);
  });

  it("按人眼颜色空间匹配最近的 MARD 色", () => {
    expect(nearestBead({ r: 245, g: 81, b: 162 }).id).toBe("E5");
    expect(nearestBead({ r: 2, g: 2, b: 2 }).id).toBe("H7");
  });

  it("白色豆和空白格不会混在一起", () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 0,
    ]);
    expect(imageDataToCells(pixels, 2, 1, 8)).toEqual(["T1", null]);
  });

  it("只按最外圈有豆区域计算实际图案尺寸", () => {
    const pattern = createSamplePattern(6);
    pattern.cells = [
      null, null, null, null, null, null,
      null, "A1", null, "A2", null, null,
      null, null, null, null, null, null,
      null, "A3", null, null, null, null,
      null, null, null, null, null, null,
      null, null, null, null, null, null,
    ];
    expect(patternContentSize(pattern)).toEqual({ width: 3, height: 3 });
    expect(patternContentSize({ ...pattern, cells: Array(36).fill(null) })).toBeNull();
  });

  it("颜色数量不超过上限并清理零碎小色块", () => {
    const pixels = new Uint8ClampedArray([
      245, 81, 162, 255, 245, 81, 162, 255, 245, 81, 162, 255, 0, 0, 0, 255,
    ]);
    const cells = imageDataToCells(pixels, 2, 2, 2, "edge");
    expect(new Set(cells.filter(Boolean)).size).toBeLessThanOrEqual(2);
    expect(cells).toHaveLength(4);
  });

  it("轮廓增强会保留眼睛和高光这类小而明显的细节", () => {
    const pixels = new Uint8ClampedArray(
      Array.from({ length: 9 }, (_, index) => [
        ...beadById(index === 4 ? "H7" : "T1").rgb,
        255,
      ]).flat(),
    );
    const cells = imageDataToCells(
      pixels,
      3,
      3,
      2,
      "edge",
      [beadById("T1"), beadById("H7")],
      0,
    );
    expect(cells[4]).toBe("H7");
  });

  it("轮廓增强仍会清理与周围近似的小杂点", () => {
    const pixels = new Uint8ClampedArray(
      Array.from({ length: 9 }, (_, index) => [
        ...beadById(index === 4 ? "H2" : "T1").rgb,
        255,
      ]).flat(),
    );
    const cells = imageDataToCells(
      pixels,
      3,
      3,
      2,
      "edge",
      [beadById("T1"), beadById("H2")],
      0,
    );
    expect(cells).toEqual(Array(9).fill("T1"));
  });

  it("MARD 色库档位固定并支持排除色号", () => {
    expect(DEFAULT_SETTINGS.paletteSize).toBe(291);
    expect(DEFAULT_SETTINGS.longestEdge).toBe(65);
    expect(DEFAULT_SETTINGS.maxColors).toBe(12);
    expect(DEFAULT_SETTINGS.colorMerge).toBe(5);
    expect(DEFAULT_SETTINGS.processingMode).toBe("edge");
    expect(DEFAULT_SETTINGS.mode).toBe("local");
    expect(DEFAULT_SETTINGS.mirror).toBe(false);
    for (const size of PALETTE_SIZES)
      expect(mardPalette(size)).toHaveLength(size);
    expect(mardPalette(291, ["H7"]).some(color => color.id === "H7")).toBe(
      false,
    );
  });

  it("水平镜像时逐行翻转图纸", () => {
    expect(mirrorCells(["A1", "A2", null, "B1", "B2", "B3"], 3)).toEqual([
      null,
      "A2",
      "A1",
      "B3",
      "B2",
      "B1",
    ]);
  });

  it("排除色号后使用近似色替代", () => {
    const [r, g, b] = beadById("H7").rgb;
    const [cell] = imageDataToCells(
      new Uint8ClampedArray([r, g, b, 255]),
      1,
      1,
      1,
      "average",
      mardPalette(291, ["H7"]),
    );
    expect(cell).not.toBeNull();
    expect(cell).not.toBe("H7");
  });

  it("颜色合并程度提高后会稳定减少相近色", () => {
    let pair = [BEAD_COLORS[0], BEAD_COLORS[1]],
      bestDistance = Infinity;
    for (const first of BEAD_COLORS)
      for (const second of BEAD_COLORS) {
        const distance = labDistance(first.lab, second.lab);
        if (first !== second && distance > 0.01 && distance < bestDistance) {
          pair = [first, second];
          bestDistance = distance;
        }
      }
    const pixels = new Uint8ClampedArray([
      ...pair[0].rgb,
      255,
      ...pair[1].rgb,
      255,
    ]);
    expect(
      new Set(imageDataToCells(pixels, 2, 1, 2, "average", pair, 0)).size,
    ).toBe(2);
    expect(
      new Set(imageDataToCells(pixels, 2, 1, 2, "average", pair, 30)).size,
    ).toBe(1);
  });

  it("纯色块取样不会被透明边缘杂色带偏", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1)
      pixels.set(
        index < 9 ? [240, 30, 30, 255] : [30, 30, 240, 20],
        index * 4,
      );
    const dominant = samplePixelTiles(pixels, 1, 1, "dominant");
    expect(dominant[0]).toBeGreaterThan(220);
    expect(dominant[2]).toBeLessThan(60);
  });

  it("自然平均按真实光亮混色，不会把明暗平均成脏灰", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1)
      pixels.set(index < 8 ? [0, 0, 0, 255] : [255, 255, 255, 255], index * 4);
    const average = samplePixelTiles(pixels, 1, 1, "average");
    expect(average[0]).toBeGreaterThan(180);
    expect(average[0]).toBeLessThan(195);
  });

  it("纯主色与真实平均使用不同的区域取样", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let index = 0; index < 16; index += 1)
      pixels.set(
        index < 12 ? [240, 30, 30, 255] : [30, 30, 240, 255],
        index * 4,
      );
    const dominant = samplePixelTiles(pixels, 1, 1, "dominant"),
      average = samplePixelTiles(pixels, 1, 1, "average");
    expect(dominant[0]).toBeGreaterThan(220);
    expect(dominant[2]).toBeLessThan(60);
    expect(average[0]).toBeLessThan(dominant[0]);
    expect(average[2]).toBeGreaterThan(dominant[2]);
  });

  it("边缘增强只在明显轮廓附近切换到主色", () => {
    const pixels = new Uint8ClampedArray(3 * 4 * 4 * 4);
    for (let tile = 0; tile < 3; tile += 1)
      for (let pixel = 0; pixel < 16; pixel += 1) {
        const color
          = tile < 2 && pixel < 12 ? [240, 30, 30, 255] : [30, 30, 240, 255];
        const x = tile * 4 + (pixel % 4),
          y = Math.floor(pixel / 4);
        pixels.set(color, (y * 12 + x) * 4);
      }
    const edge = samplePixelTiles(pixels, 3, 1, "edge"),
      dominant = samplePixelTiles(pixels, 3, 1, "dominant"),
      average = samplePixelTiles(pixels, 3, 1, "average");
    expect([...edge.slice(0, 4)]).toEqual([...average.slice(0, 4)]);
    expect([...edge.slice(4, 8)]).toEqual([...dominant.slice(4, 8)]);
    expect(edge).not.toEqual(average);
    expect(edge).not.toEqual(dominant);
  });

  it("示例图案居中放在豆板上", () => {
    const pattern = createSamplePattern(52);
    expect(pattern.cells).toHaveLength(52 * 52);
    expect(patternStats(pattern).length).toBeGreaterThanOrEqual(2);
    expect(pattern.cells.some(cell => cell === null)).toBe(true);
  });

  it("裁切预览按图片比例居中缩放", () => {
    expect(fitPreviewSize(600, 600, 670, 596)).toEqual({
      width: 512.56,
      height: 512.56,
    });
    expect(fitPreviewSize(1200, 600, 670, 596)).toEqual({
      width: 576.2,
      height: 288.1,
    });
  });

  it("拒绝错误格式、超大文件和不完整像素", () => {
    expect(() =>
      validateImageFile({ name: "x.gif", type: "image/gif", size: 10 }),
    ).toThrow("JPG");
    expect(() =>
      validateImageFile({
        name: "x.heic",
        type: "image/heic",
        size: 10 * 1024 * 1024 + 1,
      }),
    ).toThrow("10MB");
    expect(() =>
      imageDataToCells(new Uint8ClampedArray([1, 2, 3]), 1, 1, 8),
    ).toThrow("像素数据不完整");
  });
});
