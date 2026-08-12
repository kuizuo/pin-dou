import { describe, expect, it } from "vitest";
import {
  replaceAllColor,
  replaceConnectedRegion,
  setCell,
} from "../lib/editor";

describe("像素编辑", () => {
  it("只修改选中的单格", () => {
    expect(setCell(["A", "B", null], 1, "C")).toEqual({
      cells: ["A", "C", null],
      changed: 1,
    });
  });

  it("全局替换同一种颜色", () => {
    expect(replaceAllColor(["A", "B", "A", null], "A", "C")).toEqual({
      cells: ["C", "B", "C", null],
      changed: 2,
    });
  });

  it("只替换相连色块，不影响隔开的同色格", () => {
    const result = replaceConnectedRegion(
      ["A", "A", "B", "A", "B", "B", "B", "B", "A"],
      3,
      0,
      "C",
    );
    expect(result.cells).toEqual(["C", "C", "B", "C", "B", "B", "B", "B", "A"]);
    expect(result.changed).toBe(3);
  });

  it("区域擦除支持空白目标", () => {
    const result = replaceConnectedRegion(["A", "A", "B", "A"], 2, 0, null);
    expect(result.cells).toEqual([null, null, "B", null]);
    expect(result.changed).toBe(3);
  });
});
