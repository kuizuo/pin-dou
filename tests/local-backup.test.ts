// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSamplePattern } from "../lib/beads";
import {
  manualBackupName,
  supportsLocalBackup,
  writeBackupFile,
} from "../lib/local-backup";
import { createBackupBlob } from "../lib/projects";
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
    versions: [],
  };
}

describe("本地文件夹备份", () => {
  afterEach(() => vi.restoreAllMocks());

  it("备份内容保持现有格式", async () => {
    const value = JSON.parse(await (await createBackupBlob([project()])).text());
    expect(value.schemaVersion).toBe(2);
    expect(value.projects[0].name).toBe("备份测试");
    expect(value.projects[0].source).toMatch(/^data:image\/png;base64,/);
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
