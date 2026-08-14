import { describe, expect, it } from "vitest";
import { createSamplePattern } from "../lib/beads";
import { normalizeProject } from "../lib/projects";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRANSFORM,
  type Project,
} from "../lib/types";

function project(): Project {
  return {
    id: "p",
    name: "测试",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    source: new Blob(),
    sourceName: "x.png",
    sourceType: "image/png",
    sourceVariant: "original",
    transform: DEFAULT_TRANSFORM,
    settings: DEFAULT_SETTINGS,
    pattern: createSamplePattern(),
  };
}

describe("作品数据", () => {
  it("旧去背景作品可继续打开，没有处理结果的旧作品安全保留背景", () => {
    const legacy = project();
    legacy.settings = { ...legacy.settings, background: "fast" as never };
    expect(normalizeProject(legacy).settings.background).toBe("keep");
    expect(
      normalizeProject({ ...legacy, processedSource: new Blob() }).settings
        .background,
    ).toBe("plain");
  });

  it("旧作品只保留当前图纸", () => {
    const current = project(),
      normalized = normalizeProject({
        ...current,
        versions: [{ pattern: { ...current.pattern, cells: ["A1"] } }],
      });
    expect(normalized.pattern).toBe(current.pattern);
    expect(normalized).not.toHaveProperty("versions");
  });
});
