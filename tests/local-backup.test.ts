// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BEAD_COLORS, createSamplePattern } from "../lib/beads";
import {
  manualBackupName,
  supportsLocalBackup,
  writeBackupFile,
} from "../lib/local-backup";
import { createBackupBlob, readBackupProjects } from "../lib/projects";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRANSFORM,
  type Project,
} from "../lib/types";

function project(): Project {
  const pattern = createSamplePattern(2);
  return {
    id: "backup-test",
    name: "备份测试",
    createdAt: "2026-08-13T08:00:00.000Z",
    updatedAt: "2026-08-13T08:00:00.000Z",
    source: new Blob(["image"], { type: "image/png" }),
    sourceName: "test.png",
    sourceType: "image/png",
    sourceVariant: "original",
    transform: DEFAULT_TRANSFORM,
    settings: DEFAULT_SETTINGS,
    pattern,
  };
}

describe("本地文件夹备份", () => {
  afterEach(() => vi.restoreAllMocks());

  it("新版备份只保留一份原图和当前图纸", async () => {
    const value = JSON.parse(await (await createBackupBlob([project()])).text());
    expect(value.schemaVersion).toBe(4);
    expect(value.projects[0].name).toBe("备份测试");
    expect(value.sources).toHaveLength(1);
    expect(value.projects[0].source).toBe(0);
    expect(value.projects[0].generatedSource).toBeUndefined();
    expect(value.projects[0].processedSource).toBeUndefined();
    expect(JSON.stringify(value.projects)).not.toContain("sourcePreview");
    expect(value.projects[0].pattern.snapshot.w).toBe(2);
    expect(value.projects[0].snapshots).toBeUndefined();
    expect(value.projects[0].versions).toBeUndefined();
  });

  it("完整还原当前图纸", async () => {
    const value = project();
    const backup = await createBackupBlob([value]),
      [restored] = await readBackupProjects(
        new File([backup], "backup.pindou.json"),
      );
    expect(await restored.source.text()).toBe("image");
    expect(restored.pattern.cells).toEqual(value.pattern.cells);
    expect(restored).not.toHaveProperty("versions");
  });

  it("大图作品的精简备份至少缩小八成", async () => {
    const value = project();
    value.source = new Blob([new Uint8Array(1024 * 1024)], {
      type: "image/png",
    });
    const projects = Array.from({ length: 6 }, (_, index) => ({
        ...value,
        id: `copy-${index}`,
      })),
      backup = await createBackupBlob(projects),
      uncompressedSources = value.source.size * 4 / 3 * projects.length;
    expect(backup.size).toBeLessThan(uncompressedSources * 0.2);
    expect(JSON.parse(await backup.text()).sources).toHaveLength(1);
  });

  it("可完整备份并恢复 192 格与 291 色图纸", async () => {
    const value = project(), count = 192 * 192;
    value.settings = { ...value.settings, longestEdge: 192, maxColors: 291 };
    value.pattern = {
      ...value.pattern,
      width: 192,
      height: 192,
      cells: Array.from({ length: count }, (_, index) =>
        BEAD_COLORS[index % BEAD_COLORS.length].id),
    };
    const backup = await createBackupBlob([value]), raw = JSON.parse(await backup.text());
    const [restored] = await readBackupProjects(
      new File([backup], "192.pindou.json"),
    );
    expect(raw.projects[0].pattern.snapshot.c.s).toBe(2);
    expect(restored.pattern.cells).toEqual(value.pattern.cells);
    expect(restored.settings.maxColors).toBe(291);
  });

  it("拒绝旧版备份且不改变现有作品", async () => {
    const backup = JSON.parse(await (await createBackupBlob([project()])).text());
    backup.schemaVersion = 3;
    await expect(readBackupProjects(
      new File([JSON.stringify(backup)], "legacy.pindou.json"),
    )).rejects.toThrow("版本不支持");
  });

  it("拒绝损坏的紧凑格子且不返回部分作品", async () => {
    const backup = JSON.parse(await (await createBackupBlob([project()])).text());
    backup.projects[0].pattern.snapshot.c.d = "broken";
    await expect(readBackupProjects(
      new File([JSON.stringify(backup)], "broken.pindou.json"),
    )).rejects.toThrow("备份内容不完整");
  });

  it("完整写入后才关闭文件", async () => {
    const write = vi.fn().mockResolvedValue(undefined),
      close = vi.fn().mockResolvedValue(undefined),
      abort = vi.fn().mockResolvedValue(undefined),
      getFileHandle = vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue({ write, close, abort }),
      });
    await writeBackupFile(
      { getFileHandle } as unknown as FileSystemDirectoryHandle,
      new Blob(["backup"]),
      "backup.pindou.json",
    );
    expect(getFileHandle).toHaveBeenCalledWith("backup.pindou.json", {
      create: true,
    });
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(abort).not.toHaveBeenCalled();
  });

  it("手动备份文件名使用本地日期和毫秒", () => {
    expect(manualBackupName(new Date(2026, 7, 13, 17, 20, 9, 42))).toBe(
      "拼豆作品备份-2026-08-13_17-20-09-042.pindou.json",
    );
  });

  it("写入失败时放弃未完成的文件", async () => {
    const abort = vi.fn().mockResolvedValue(undefined),
      directory = {
        getFileHandle: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue({
            write: vi.fn().mockRejectedValue(new Error("写入失败")),
            close: vi.fn(),
            abort,
          }),
        }),
      } as unknown as FileSystemDirectoryHandle;
    await expect(
      writeBackupFile(directory, new Blob(["backup"]), "backup.pindou.json"),
    ).rejects.toThrow("写入失败");
    expect(abort).toHaveBeenCalledOnce();
  });

  it("只在顶层页面且存在文件夹选择能力时开启", () => {
    expect(supportsLocalBackup()).toBe(false);
    Object.defineProperty(window, "showDirectoryPicker", {
      configurable: true,
      value: vi.fn(),
    });
    expect(supportsLocalBackup()).toBe(true);
    delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker;
  });
});
