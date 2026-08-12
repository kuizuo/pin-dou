import { afterEach, describe, expect, it, vi } from "vitest";
import { createSamplePattern } from "../lib/beads";
import {
  addPeriodicVersion,
  addVersion,
  normalizeProject,
  restoreVersion,
} from "../lib/projects";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRANSFORM,
  type Project,
} from "../lib/types";

function project(): Project {
  const pattern = createSamplePattern();
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
    pattern,
    versions: [],
  };
}

describe("作品版本", () => {
  afterEach(() => vi.useRealTimers());

  it("旧去背景作品可继续打开，没有处理结果的旧作品安全保留背景", () => {
    const legacy = project();
    legacy.settings = { ...legacy.settings, background: "fast" as never };
    expect(normalizeProject(legacy).settings.background).toBe("keep");
    expect(
      normalizeProject({ ...legacy, processedSource: new Blob() }).settings
        .background,
    ).toBe("plain");
  });

  it("自动版本只留最近 20 条，手动版本永久保留", () => {
    let value = addVersion(
      project(),
      createSamplePattern(),
      "manual",
      "手动保存",
      "重要版本",
    );
    for (let index = 0; index < 24; index += 1)
      value = addVersion(value, createSamplePattern(), "auto", "重新生成");
    expect(
      value.versions.filter(version => version.kind === "auto"),
    ).toHaveLength(20);
    expect(value.versions.some(version => version.name === "重要版本")).toBe(
      true,
    );
  });

  it("恢复前先备份当前图纸，再复制目标版本", () => {
    const initial = addVersion(
      project(),
      createSamplePattern(),
      "manual",
      "手动保存",
      "保留",
    );
    const restored = restoreVersion(initial, initial.versions[0]);
    expect(restored.versions).toHaveLength(2);
    expect(restored.pattern.id).not.toBe(initial.versions[0].pattern.id);
    expect(restored.versions[0].name).toBe("保留");
    expect(restored.versions[1].name).toBe("恢复前备份");
    expect(restored.versions[1].pattern.id).toBe(initial.pattern.id);
  });

  it("普通改动每五分钟最多自动备份一次，没有改动不备份", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-01-01T00:00:00.000Z");
    let value = addVersion(
      project(),
      createSamplePattern(),
      "auto",
      "首次生成",
    );
    const firstChange = {
      ...value.pattern,
      cells: value.pattern.cells.with(0, "A1"),
    };

    vi.setSystemTime("2026-01-01T00:01:00.000Z");
    value = {
      ...addPeriodicVersion(value, firstChange),
      pattern: firstChange,
    };
    expect(value.versions).toHaveLength(1);

    const secondChange = {
      ...firstChange,
      cells: firstChange.cells.with(1, "A2"),
    };
    vi.setSystemTime("2026-01-01T00:05:00.000Z");
    value = {
      ...addPeriodicVersion(value, secondChange),
      pattern: secondChange,
    };
    expect(value.versions).toHaveLength(2);
    expect(value.versions[1].name).toBe("自动备份");

    vi.setSystemTime("2026-01-01T00:10:00.000Z");
    value = addPeriodicVersion(value, secondChange);
    expect(value.versions).toHaveLength(2);
  });
});
