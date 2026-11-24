import { describe, expect, it } from "vitest";
import {
  BEAD_COLORS,
  beadById,
  colorDistance,
  CORE_BEAD_COLORS,
  createSamplePattern,
  labDistance,
  nearestBead,
  nearestBeadByLab,
  patternContentSize,
  patternStats,
  rgbToLab,
} from "../lib/beads";
import {
  adjustImagePixels,
  analyzePatternStructure,
  cleanFloatingBeads,
  fitPreviewSize,
  imageDataToCells,
  mardPalette,
  mirrorCells,
  PALETTE_SIZES,
  patternLayout,
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

  it("人眼色差计算符合标准样例", () => {
    expect(colorDistance([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(
      2.0425,
      3,
    );
  });

  it("白色豆和空白格不会混在一起，默认 221 实色使用标准白 H2", () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 0,
    ]);
    expect(imageDataToCells(pixels, 2, 1, 8)).toEqual(["H2", null]);
    expect(imageDataToCells(pixels, 2, 1, 8, "edge", BEAD_COLORS)).toEqual([
      "T1",
      null,
    ]);
    expect(imageDataToCells(new Uint8ClampedArray(16), 2, 2, 8)).toEqual(
      Array(4).fill(null),
    );
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

  it("限制颜色数量时保留面积较小但明显不同的颜色", () => {
    const pixels = new Uint8ClampedArray([
      ...Array(80).fill([...beadById("T1").rgb, 255]),
      ...Array(15).fill([...beadById("H9").rgb, 255]),
      ...Array(5).fill([...beadById("F4").rgb, 255]),
    ].flat());
    const cells = imageDataToCells(
      pixels,
      10,
      10,
      2,
      "average",
      [beadById("T1"), beadById("H9"), beadById("F4")],
      0,
    );
    expect(cells).toContain("F4");
    expect(new Set(cells).size).toBe(2);
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

  it("MARD 色库档位固定，默认 221 实色排除特殊材质且各档保留黑白", () => {
    expect(CORE_BEAD_COLORS).toHaveLength(221);
    expect(CORE_BEAD_COLORS.every(color => color.material === "solid")).toBe(
      true,
    );
    expect(DEFAULT_SETTINGS.paletteSize).toBe(221);
    expect(DEFAULT_SETTINGS.longestEdge).toBe(65);
    expect(DEFAULT_SETTINGS.maxColors).toBe(12);
    expect(DEFAULT_SETTINGS.colorMerge).toBe(5);
    expect(DEFAULT_SETTINGS.processingMode).toBe("edge");
    expect(DEFAULT_SETTINGS.dithering).toBe("none");
    expect(DEFAULT_SETTINGS.mode).toBe("local");
    expect(DEFAULT_SETTINGS.mirror).toBe(false);
    for (const size of PALETTE_SIZES) {
      const palette = mardPalette(size);
      expect(palette).toHaveLength(size);
      expect(palette.some(color => color.id === "H7")).toBe(true);
      expect(palette.some(color => color.id === "H2")).toBe(true);
    }
    expect(mardPalette(221).every(color => color.material === "solid")).toBe(
      true,
    );
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

  it("格数固定为正方形豆板边长并把图案居中", () => {
    expect(patternLayout(200, 100, 29)).toEqual({
      width: 29,
      height: 29,
      contentWidth: 29,
      contentHeight: 15,
      x: 0,
      y: 7,
    });
    expect(patternLayout(100, 200, 29)).toEqual({
      width: 29,
      height: 29,
      contentWidth: 15,
      contentHeight: 29,
      x: 7,
      y: 0,
    });
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

  it("中位色取样不会被少量高光和噪点拉偏", () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let index = 0; index < 64; index += 1)
      pixels.set(
        index < 48 ? [112, 74, 46, 255] : [255, 255, 255, 255],
        index * 4,
      );
    const dominant = samplePixelTiles(pixels, 1, 1, "dominant"),
      average = samplePixelTiles(pixels, 1, 1, "average");
    expect([...dominant.slice(0, 3)]).toEqual([112, 74, 46]);
    expect(average[0]).toBeGreaterThan(dominant[0]);
  });

  it("纯色块选择真实主色，不会把多个颜色拼成不存在的颜色", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4),
      colors = [
        ...Array(7).fill([240, 20, 20, 255]),
        ...Array(5).fill([20, 240, 20, 255]),
        ...Array(4).fill([20, 20, 240, 255]),
      ];
    colors.forEach((color, index) => pixels.set(color, index * 4));
    const dominant = samplePixelTiles(pixels, 1, 1, "dominant");
    expect(dominant[0]).toBeGreaterThan(220);
    expect(dominant[1]).toBeLessThan(40);
    expect(dominant[2]).toBeLessThan(40);
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

  it("L 轴剪枝的 CIEDE2000 最近邻匹配与暴力全量扫描完全一致", () => {
    for (let r = 0; r <= 255; r += 51)
      for (let g = 0; g <= 255; g += 51)
        for (let b = 0; b <= 255; b += 51) {
          const lab = rgbToLab([r, g, b]);
          let expected = CORE_BEAD_COLORS[0];
          let bestDist = colorDistance(lab, expected.lab);
          for (let index = 1; index < CORE_BEAD_COLORS.length; index += 1) {
            const d = colorDistance(lab, CORE_BEAD_COLORS[index].lab);
            if (d < bestDist) {
              bestDist = d;
              expected = CORE_BEAD_COLORS[index];
            }
          }
          expect(nearestBeadByLab(lab, CORE_BEAD_COLORS).id).toBe(expected.id);
          expect(nearestBead({ r, g, b }, CORE_BEAD_COLORS).id).toBe(
            expected.id,
          );
        }
  });

  it("轮廓增强在瓦片内保留穿过肤色的细暗轮廓线", () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y += 1)
      for (let x = 0; x < 8; x += 1) {
        // 2 rows (25%) of crisp dark outline across warm skin tile
        const color = y < 2 ? [20, 18, 20, 255] : [250, 215, 190, 255];
        pixels.set(color, (y * 8 + x) * 4);
      }
    const edge = samplePixelTiles(pixels, 1, 1, "edge");
    const dominant = samplePixelTiles(pixels, 1, 1, "dominant");
    expect(edge[0]).toBeLessThan(40);
    expect(dominant[0]).toBeGreaterThan(220);
  });

  it("降色质心重选能为合并的两个相近色块选出中间折中 MARD 色", () => {
    const lightBlue = beadById("C6"); // [80, 170, 240]
    const midBlue = beadById("C7"); // [54, 119, 210]
    const darkBlue = beadById("C16"); // [21, 87, 168]
    const pixels = new Uint8ClampedArray([
      ...Array(20).fill([...lightBlue.rgb, 255]),
      ...Array(20).fill([...darkBlue.rgb, 255]),
      ...Array(40).fill([...beadById("H2").rgb, 255]),
    ].flat());
    const cells = imageDataToCells(
      pixels,
      10,
      8,
      2,
      "average",
      [beadById("H2"), lightBlue, midBlue, darkBlue],
      0,
    );
    expect(cells).toContain("C7");
  });

  it("可控抖动（Bayer 与 Floyd-Steinberg）能在渐变区生成过渡纹理", () => {
    const width = 12;
    const height = 6;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const v = Math.round(40 + (x / (width - 1)) * 180);
        pixels.set([v, v, v, 255], (y * width + x) * 4);
      }
    const twoTone = [beadById("H7"), beadById("H2")];
    const bayer = imageDataToCells(pixels, width, height, 2, "average", twoTone, 0, "bayer");
    const fs = imageDataToCells(pixels, width, height, 2, "average", twoTone, 0, "floyd-steinberg");
    const flat = imageDataToCells(pixels, width, height, 2, "average", twoTone, 0, "none");
    // In a smooth gradient, dithering should differ from hard threshold and use both colors
    expect(new Set(bayer).size).toBe(2);
    expect(new Set(fs).size).toBe(2);
    expect(bayer).not.toEqual(flat);
    expect(fs).not.toEqual(flat);
  });

  it("清理小区域时保护 1px 对角斜线不被打断", () => {
    const bg = beadById("H2").rgb;
    const line = beadById("H11").rgb; // subtle light gray ΔE < 12 from H2
    const size = 5;
    const pixels = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y += 1)
      for (let x = 0; x < size; x += 1)
        pixels.set([...(x === y ? line : bg), 255], (y * size + x) * 4);
    const cells = imageDataToCells(
      pixels,
      size,
      size,
      2,
      "edge",
      [beadById("H2"), beadById("H11")],
      0,
    );
    // Interior diagonal points (1,1), (2,2), (3,3) have 2 diagonal neighbors and must survive
    expect(cells[1 * size + 1]).toBe("H11");
    expect(cells[2 * size + 2]).toBe("H11");
    expect(cells[3 * size + 3]).toBe("H11");
  });

  it("检测悬空浮豆与对角弱连接并支持一键清理浮豆", () => {
    const width = 6;
    const cells: Array<string | null> = Array(width * width).fill(null);
    // 4x4 main block at (0..3, 0..3)
    for (let y = 0; y < 4; y += 1)
      for (let x = 0; x < 4; x += 1) cells[y * width + x] = "A5";
    // Diagonal-only weak bead at (4, 4) touching corner (3, 3)
    cells[4 * width + 4] = "A5";
    // Completely isolated floating bead at (5, 0)
    cells[5] = "H7";

    const report = analyzePatternStructure(cells, width);
    expect(report.diagonalOnlyIndices).toContain(4 * width + 4);
    expect(report.floatingIndices).toContain(5);
    expect(report.floatingIndices).toContain(4 * width + 4);

    const cleaned = cleanFloatingBeads(cells, width);
    expect(cleaned.removed).toBe(2);
    expect(cleaned.cells[5]).toBeNull();
    expect(cleaned.cells[4 * width + 4]).toBeNull();
    expect(cleaned.cells[0]).toBe("A5");
  });

  it("对比度与饱和度预处理按预期拉开色差", () => {
    const pixels = new Uint8ClampedArray([160, 140, 140, 255, 96, 116, 116, 255]);
    const boosted = adjustImagePixels(pixels, 20, 20);
    expect(boosted[0]).toBeGreaterThan(pixels[0]);
    expect(boosted[4]).toBeLessThan(pixels[4]);
    expect(boosted[0] - boosted[1]).toBeGreaterThan(pixels[0] - pixels[1]);
  });
});
