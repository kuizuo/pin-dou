// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSamplePattern } from "../lib/beads";
import {
  copyPatternPng,
  cropAreaPixels,
  downloadPatternPng,
  renderPattern,
  sharePatternPng,
} from "../lib/pattern";

describe("图纸 PNG 导出", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("施工图可附带颜色用量", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const withoutLegend = renderPattern(createSamplePattern(), false).height;
    expect(withoutLegend).toBe(52 * 34 + 86);
    expect(renderPattern(createSamplePattern()).height).toBeGreaterThan(
      withoutLegend,
    );
  });

  it("颜色块内标色号，下方标数量", () => {
    const fillText = vi.fn(),
      roundRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: vi.fn(),
      fillText,
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect,
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    renderPattern({
      ...createSamplePattern(),
      width: 2,
      height: 1,
      cells: ["A1", "A1"],
    });
    expect(roundRect).toHaveBeenCalledOnce();
    expect(fillText.mock.calls.map(([text]) => text)).toEqual(
      expect.arrayContaining(["A1", "2"]),
    );
  });

  it("共享格线不重复，只有外圈和每 10 格分界线加粗", () => {
    const strokeRect = vi.fn(),
      widths: number[] = [],
      paths: Array<Array<[number, number, number, number]>> = [],
      state = { lineWidth: 1 };
    const context = {
      fillStyle: "",
      strokeStyle: "",
      get lineWidth() {
        return state.lineWidth;
      },
      set lineWidth(value: number) {
        state.lineWidth = value;
      },
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect,
      beginPath: vi.fn(() => paths.push([])),
      moveTo: vi.fn((x: number, y: number) => paths.at(-1)?.push([x, y, 0, 0])),
      lineTo: vi.fn((x: number, y: number) =>
        paths.at(-1)?.at(-1)?.splice(2, 2, x, y),
      ),
      stroke: vi.fn(() => widths.push(state.lineWidth)),
      arc: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context,
    );
    renderPattern(
      {
        ...createSamplePattern(),
        width: 20,
        height: 1,
        cells: Array(20).fill("A1"),
      },
      false,
    );
    expect(strokeRect).not.toHaveBeenCalled();
    expect(widths).toEqual([0.75, 2]);
    expect(paths[1]).toEqual([
      [1, 85, 1, 117],
      [340, 85, 340, 117],
      [679, 85, 679, 117],
      [1, 85, 679, 85],
      [1, 117, 679, 117],
    ]);
  });

  it("生成 PNG 后触发下载", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      callback => callback(new Blob(["png"], { type: "image/png" })),
    );
    await downloadPatternPng({
      ...createSamplePattern(),
      cells: Array(52 * 52).fill(null),
    });
    expect(click).toHaveBeenCalledOnce();
  });

  it("可以把 PNG 图片复制到剪贴板", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal("ClipboardItem", class { constructor(public data: Record<string, Blob>) {} });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      callback => callback(new Blob(["png"], { type: "image/png" })),
    );
    await copyPatternPng(createSamplePattern());
    expect(write).toHaveBeenCalledOnce();
  });

  it("设备支持文件分享时交给系统分享", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: vi.fn(() => true), share });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      callback => callback(new Blob(["png"], { type: "image/png" })),
    );
    expect(await sharePatternPng(createSamplePattern())).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
  });
});

describe("裁切框", () => {
  it("按图片方向把百分比裁切框转换为实际区域", () => {
    const base = {
      rotation: 0 as const,
      flipX: false,
      flipY: false,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      crop: { x: 10, y: 20, width: 50, height: 25 },
    };
    expect(cropAreaPixels(base, 1000, 800)).toEqual({
      x: 100,
      y: 160,
      width: 500,
      height: 200,
      orientedWidth: 1000,
      orientedHeight: 800,
    });
    expect(cropAreaPixels({ ...base, rotation: 90 }, 1000, 800)).toEqual({
      x: 80,
      y: 200,
      width: 400,
      height: 250,
      orientedWidth: 800,
      orientedHeight: 1000,
    });
  });
});
