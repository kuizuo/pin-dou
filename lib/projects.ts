import { z } from "zod";
import type { Pattern, Project } from "./types";
import { readBlobAsDataUrl, saveBlob } from "./pattern";
import { DEFAULT_SETTINGS } from "./types";

const DB_NAME = "pindou-projects-v3";
const STORE = "projects";

type LegacyProject = Project & { versions?: unknown };

function currentProject(value: LegacyProject): Project {
  const project = { ...value };
  delete project.versions;
  return project;
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
        return;
      }
      const store = request.transaction?.objectStore(STORE),
        cursorRequest = store?.openCursor();
      if (!cursorRequest) return;
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if ("versions" in cursor.value)
          cursor.update(currentProject(cursor.value as LegacyProject));
        cursor.continue();
      };
    };
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

export function normalizeProject(value: LegacyProject): Project {
  const project = currentProject(value);
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
      maxColors: Math.min(
        291,
        project.settings.maxColors ?? DEFAULT_SETTINGS.maxColors,
      ),
      colorMerge: Math.min(
        30,
        project.settings.colorMerge ?? DEFAULT_SETTINGS.colorMerge,
      ),
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
  return deleteProjects([id]);
}

export async function deleteProjects(ids: string[]) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE, "readwrite");
  const store = transaction.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await transactionDone(transaction);
  database.close();
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

const SettingsSchema = z.object({
  longestEdge: z.number().min(16).max(192),
  maxColors: z.number().min(1).max(291),
  paletteSize: z.number().min(1).max(291),
  excludedColorIds: z.array(z.string()),
  processingMode: z.enum(["edge", "dominant", "average"]),
  colorMerge: z.number().min(0).max(60),
  background: z.enum(["plain", "fast", "precise", "keep"]),
  mirror: z.boolean().optional(),
  mode: z.enum(["local", "ai"]),
});
const TransformSchema = z.object({
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
});

const PackedCellsSchema = z.object({
  p: z.array(z.string()).max(291),
  d: z.string().max(100000),
  s: z.union([z.literal(1), z.literal(2)]),
});
const CompactSnapshotSchema = z.object({
  w: z.number().int().min(1).max(192),
  h: z.number().int().min(1).max(192),
  c: PackedCellsSchema,
  b: PackedCellsSchema.optional(),
  o: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});
const CompactPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  snapshot: CompactSnapshotSchema,
});
const CompactBackupProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceName: z.string(),
  source: z.number().int().nonnegative(),
  transform: TransformSchema,
  settings: SettingsSchema,
  pattern: CompactPatternSchema,
});
const CompactBackupSchema = z.object({
  schemaVersion: z.literal(4),
  exportedAt: z.string(),
  sources: z.array(z.string().startsWith("data:")),
  projects: z.array(CompactBackupProjectSchema),
});

type PackedCells = z.infer<typeof PackedCellsSchema>;
type CompactSnapshot = z.infer<typeof CompactSnapshotSchema>;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  if (value.length % 4 || !/^[\w+/]*={0,2}$/.test(value))
    throw new Error("Invalid base64");
  const binary = atob(value),
    bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function packCells(cells: Pattern["cells"]): PackedCells {
  const palette = [...new Set(cells.filter((cell): cell is string => !!cell))],
    paletteIndexes = new Map(palette.map((id, index) => [id, index + 1])),
    size = palette.length < 255 ? 1 : 2,
    bytes = new Uint8Array(cells.length * size);
  cells.forEach((cell, index) => {
    const value = cell ? paletteIndexes.get(cell) : 0;
    if (value === undefined) throw new Error("图纸颜色无法编码。");
    if (size === 1) bytes[index] = value;
    else {
      bytes[index * 2] = value & 255;
      bytes[index * 2 + 1] = value >> 8;
    }
  });
  return { p: palette, d: bytesToBase64(bytes), s: size };
}

function unpackCells(packed: PackedCells, count: number) {
  const bytes = base64ToBytes(packed.d);
  if (bytes.length !== count * packed.s) throw new Error("Invalid cell count");
  return Array.from({ length: count }, (_, index) => {
    const value
      = packed.s === 1
        ? bytes[index]
        : bytes[index * 2] | (bytes[index * 2 + 1] << 8);
    if (value > packed.p.length) throw new Error("Invalid palette index");
    return value ? packed.p[value - 1] : null;
  });
}

function compactSnapshot(pattern: Pattern): CompactSnapshot {
  return {
    w: pattern.width,
    h: pattern.height,
    c: packCells(pattern.cells),
    b: pattern.backgroundCells
      ? packCells(pattern.backgroundCells)
      : undefined,
    o: pattern.contentBounds,
  };
}

function expandSnapshot(
  snapshot: CompactSnapshot,
  metadata: { id: string; name: string; createdAt: string },
): Pattern {
  const count = snapshot.w * snapshot.h;
  return {
    ...metadata,
    width: snapshot.w,
    height: snapshot.h,
    cells: unpackCells(snapshot.c, count),
    backgroundCells: snapshot.b
      ? unpackCells(snapshot.b, count)
      : undefined,
    contentBounds: snapshot.o,
  };
}

function compactProject(project: Project, source: number) {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    sourceName: project.sourceName,
    source,
    transform: project.transform,
    settings: project.settings,
    pattern: {
      id: project.pattern.id,
      name: project.pattern.name,
      createdAt: project.pattern.createdAt,
      snapshot: compactSnapshot(project.pattern),
    },
  };
}

function dataUrlToBlob(dataUrl: string) {
  const [header, payload] = dataUrl.split(","),
    type = header.match(/data:([^;]+)/)?.[1] || "application/octet-stream";
  const bytes = Uint8Array.from(atob(payload), character =>
    character.charCodeAt(0),
  );
  return new Blob([bytes], { type });
}

export async function createBackupBlob(projects: Project[]) {
  const sources: string[] = [],
    sourceIndexes = new Map<string, number>(),
    compactProjects = [];
  for (const project of projects) {
    const source = await readBlobAsDataUrl(project.source);
    let sourceIndex = sourceIndexes.get(source);
    if (sourceIndex === undefined) {
      sourceIndex = sources.length;
      sources.push(source);
      sourceIndexes.set(source, sourceIndex);
    }
    compactProjects.push(compactProject(project, sourceIndex));
  }
  return new Blob(
    [
      JSON.stringify({
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
        sources,
        projects: compactProjects,
      }),
    ],
    { type: "application/json" },
  );
}

export async function downloadBackup(projects: Project[]) {
  saveBlob(
    await createBackupBlob(projects),
    `拼豆作品备份-${new Date().toLocaleDateString("sv-SE")}.pindou.json`,
  );
}

export async function readBackupProjects(file: File) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  }
  catch {
    throw new Error("备份文件无法读取，现有作品没有改变。");
  }
  const compact = CompactBackupSchema.safeParse(parsed);
  if (!compact.success)
    throw new Error("备份内容不完整或版本不支持，现有作品没有改变。");
  try {
    return compact.data.projects.map((project) => {
      const source = compact.data.sources[project.source];
      if (!source) throw new Error("Invalid source reference");
      const sourceBlob = dataUrlToBlob(source);
      return normalizeProject({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        source: sourceBlob,
        sourceName: project.sourceName,
        sourceType: sourceBlob.type,
        sourceVariant: "original",
        transform: project.transform,
        settings: {
          ...DEFAULT_SETTINGS,
          ...project.settings,
          background: project.settings.background === "keep" ? "keep" : "plain",
          mode: "local",
        },
        pattern: expandSnapshot(project.pattern.snapshot, project.pattern),
      });
    });
  }
  catch {
    throw new Error("备份内容不完整或版本不支持，现有作品没有改变。");
  }
}

export async function importBackup(file: File) {
  return (await importBackups([file])).projects;
}

export async function importBackups(files: File[]) {
  const parsed = await Promise.all(files.map(async (file) => {
      try {
        return { projects: await readBackupProjects(file) };
      }
      catch (error) {
        return { error };
      }
    })), valid = parsed.filter(result => "projects" in result);
  if (!valid.length) throw parsed[0]?.error ?? new Error("没有找到可导入的图纸。");
  const projects = new Map<string, Project>();
  for (const result of valid)
    for (const project of result.projects ?? []) projects.set(project.id, project);
  await saveProjects([...projects.values()]);
  return {
    projects: projects.size,
    files: valid.length,
    skipped: parsed.length - valid.length,
  };
}
