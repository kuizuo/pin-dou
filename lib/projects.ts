import { z } from "zod";
import type { Pattern, Project, ProjectVersion } from "./types";
import { readBlobAsDataUrl, saveBlob } from "./pattern";
import { DEFAULT_SETTINGS } from "./types";

const DB_NAME = "pindou-projects-v3";
const STORE = "projects";
const AUTO_VERSION_INTERVAL = 5 * 60 * 1000;

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function listProjects() {
  const database = await openDatabase();
  const values = (await requestValue(
    database.transaction(STORE).objectStore(STORE).getAll(),
  )) as Project[];
  database.close();
  return values
    .map(normalizeProject)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function normalizeProject(project: Project): Project {
  const legacyBackground = project.settings.background as string;
  const background
    = legacyBackground === "keep"
      || (!project.processedSource && ["fast", "precise"].includes(legacyBackground))
      ? "keep"
      : "plain";
  return {
    ...project,
    settings: {
      ...DEFAULT_SETTINGS,
      ...project.settings,
      background,
      excludedColorIds: project.settings.excludedColorIds || [],
    },
    backgroundRemoved: project.backgroundRemoved ?? background !== "keep",
  };
}

export async function saveProject(project: Project) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(project);
    await transactionDone(transaction);
  }
  catch (error) {
    if (
      error instanceof DOMException
      && ["QuotaExceededError", "UnknownError"].includes(error.name)
    )
      throw new Error(
        "设备存储空间不足，作品没有被覆盖。请先备份或删除不用的作品。",
      );
    throw error;
  }
  finally {
    database.close();
  }
}

async function saveProjects(projects: Project[]) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite"),
      store = transaction.objectStore(STORE);
    for (const project of projects) store.put(project);
    await transactionDone(transaction);
  }
  catch (error) {
    if (
      error instanceof DOMException
      && ["QuotaExceededError", "UnknownError"].includes(error.name)
    )
      throw new Error("设备存储空间不足，备份没有写入。请先清理不用的作品。");
    throw error;
  }
  finally {
    database.close();
  }
}

export async function deleteProject(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
  database.close();
}

export function addVersion(
  project: Project,
  pattern: Pattern,
  kind: ProjectVersion["kind"],
  reason: ProjectVersion["reason"],
  name: string = reason,
) {
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    name,
    kind,
    reason,
    createdAt: new Date().toISOString(),
    pattern: structuredClone(pattern),
  };
  const versions = [...project.versions, version];
  const automatic = versions.filter(item => item.kind === "auto");
  const keepAutomatic = new Set(automatic.slice(-20).map(item => item.id));
  return {
    ...project,
    name: pattern.name,
    pattern,
    updatedAt: version.createdAt,
    versions: versions.filter(
      item => item.kind === "manual" || keepAutomatic.has(item.id),
    ),
  };
}

function samePatternContent(left: Pattern, right: Pattern) {
  return left.width === right.width
    && left.height === right.height
    && left.sourcePreview === right.sourcePreview
    && JSON.stringify(left.contentBounds) === JSON.stringify(right.contentBounds)
    && left.cells.length === right.cells.length
    && left.cells.every((cell, index) => cell === right.cells[index])
    && left.backgroundCells?.length === right.backgroundCells?.length
    && (left.backgroundCells?.every(
      (cell, index) => cell === right.backgroundCells?.[index],
    ) ?? true);
}

export function addPeriodicVersion(project: Project, pattern: Pattern) {
  const latest = project.versions.at(-1),
    lastBackupAt = new Date(latest?.createdAt ?? project.createdAt).getTime();
  if (
    samePatternContent(project.pattern, pattern)
    || (latest && samePatternContent(latest.pattern, pattern))
    || Date.now() - lastBackupAt < AUTO_VERSION_INTERVAL
  )
    return project;
  return addVersion(project, pattern, "auto", "自动备份");
}

export function restoreVersion(project: Project, version: ProjectVersion) {
  const backup = addVersion(
    project,
    project.pattern,
    "auto",
    "恢复版本",
    "恢复前备份",
  );
  const pattern = {
    ...structuredClone(version.pattern),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  return {
    ...backup,
    name: pattern.name,
    pattern,
    updatedAt: pattern.createdAt,
  };
}

export function duplicateProject(project: Project) {
  const now = new Date().toISOString();
  return {
    ...structuredClone(project),
    id: crypto.randomUUID(),
    name: `${project.name} 副本`,
    createdAt: now,
    updatedAt: now,
    pattern: {
      ...structuredClone(project.pattern),
      id: crypto.randomUUID(),
      name: `${project.name} 副本`,
      createdAt: now,
    },
  } satisfies Project;
}

const CellSchema = z.string().nullable();
const PatternSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    width: z.number().int().min(1).max(104),
    height: z.number().int().min(1).max(104),
    cells: z.array(CellSchema),
    backgroundCells: z.array(CellSchema).optional(),
    createdAt: z.string(),
    sourcePreview: z.string().optional(),
    contentBounds: z
      .object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      })
      .optional(),
  })
  .refine(
    pattern =>
      pattern.cells.length === pattern.width * pattern.height
      && (!pattern.backgroundCells
        || pattern.backgroundCells.length === pattern.cells.length),
    "图纸格数不完整",
  );
const VersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["auto", "manual"]),
  createdAt: z.string(),
  reason: z.enum([
    "首次生成",
    "重新生成",
    "参数调整",
    "整色替换",
    "自动备份",
    "恢复版本",
    "手动保存",
  ]),
  pattern: PatternSchema,
});
const BackupProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  source: z.string().startsWith("data:"),
  sourceName: z.string(),
  sourceType: z.string(),
  generatedSource: z.string().startsWith("data:").optional(),
  sourceVariant: z.enum(["original", "ai-pixel", "ai-cartoon", "ai-realistic"]),
  processedSource: z.string().startsWith("data:").optional(),
  backgroundRemoved: z.boolean().optional(),
  transform: z.object({
    rotation: z.union([
      z.literal(0),
      z.literal(90),
      z.literal(180),
      z.literal(270),
    ]),
    flipX: z.boolean(),
    flipY: z.boolean(),
    zoom: z.number().min(1).max(3),
    offsetX: z.number().min(-1).max(1),
    offsetY: z.number().min(-1).max(1),
    crop: z
      .object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        width: z.number().positive().max(100),
        height: z.number().positive().max(100),
      })
      .optional(),
  }),
  settings: z.object({
    longestEdge: z.number().min(16).max(104),
    maxColors: z.number().min(1).max(60),
    paletteSize: z.number().min(1).max(291),
    excludedColorIds: z.array(z.string()),
    processingMode: z.enum(["edge", "dominant", "average"]),
    colorMerge: z.number().min(0).max(60),
    background: z.enum(["plain", "fast", "precise", "keep"]),
    mode: z.enum(["local", "ai"]),
  }),
  pattern: PatternSchema,
  versions: z.array(VersionSchema),
});
const BackupSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.string(),
  projects: z.array(BackupProjectSchema),
});

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(","),
    type = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const bytes = Uint8Array.from(atob(payload), character =>
    character.charCodeAt(0),
  );
  return new Blob([bytes], { type });
}

export async function downloadBackup(projects: Project[]) {
  const portable = await Promise.all(
    projects.map(async project => ({
      ...project,
      source: await readBlobAsDataUrl(project.source),
      generatedSource: project.generatedSource
        ? await readBlobAsDataUrl(project.generatedSource)
        : undefined,
      processedSource: project.processedSource
        ? await readBlobAsDataUrl(project.processedSource)
        : undefined,
    })),
  );
  const blob = new Blob(
    [
      JSON.stringify({
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        projects: portable,
      }),
    ],
    { type: "application/json" },
  );
  saveBlob(
    blob,
    `拼豆作品备份-${new Date().toLocaleDateString("sv-SE")}.pindou.json`,
  );
}

export async function importBackup(file: File) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  }
  catch {
    throw new Error("备份文件无法读取，现有作品没有改变。");
  }
  const result = BackupSchema.safeParse(parsed);
  if (!result.success)
    throw new Error("备份内容不完整或版本不支持，现有作品没有改变。");
  const projects = result.data.projects.map((project) => {
    const hydrated = {
      ...project,
      source: dataUrlToBlob(project.source),
      generatedSource: project.generatedSource
        ? dataUrlToBlob(project.generatedSource)
        : undefined,
      processedSource: project.processedSource
        ? dataUrlToBlob(project.processedSource)
        : undefined,
    } as Project;
    return normalizeProject(hydrated);
  });
  await saveProjects(projects);
  return projects.length;
}
