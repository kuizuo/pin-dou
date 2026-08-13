import type { Project } from "./types";
import { saveBlob } from "./pattern";
import { createBackupBlob, downloadBackup } from "./projects";

const DB_NAME = "pindou-local-backup-v1";
const STORE = "settings";
const DIRECTORY_KEY = "backup-directory";
const AUTO_BACKUP_NAME = "拼豆作品自动备份.pindou.json";

type PermissionDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission: (options: { mode: "readwrite" }) => Promise<PermissionState>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options: {
    id: string;
    mode: "readwrite";
  }) => Promise<FileSystemDirectoryHandle>;
};

export type LocalBackupStatus = {
  state: "not-configured" | "needs-permission" | "ready" | "saved" | "error";
  folderName?: string;
  message?: string;
  savedAt?: string;
};

let cachedDirectory: PermissionDirectoryHandle | null | undefined;

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storedDirectory() {
  if (cachedDirectory !== undefined) return cachedDirectory;
  const database = await openDatabase();
  try {
    const value = await requestValue(
      database.transaction(STORE).objectStore(STORE).get(DIRECTORY_KEY),
    );
    cachedDirectory = value
      && typeof value === "object"
      && (value as FileSystemHandle).kind === "directory"
      ? value as PermissionDirectoryHandle
      : null;
    return cachedDirectory;
  }
  finally {
    database.close();
  }
}

async function storeDirectory(handle: FileSystemDirectoryHandle) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(handle, DIRECTORY_KEY);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    cachedDirectory = handle as PermissionDirectoryHandle;
  }
  finally {
    database.close();
  }
}

function errorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "没有文件夹写入权限。";
    if (error.name === "NotFoundError") return "原文件夹已不可用。";
    if (error.name === "QuotaExceededError") return "设备存储空间不足。";
  }
  return "无法写入本地文件夹。";
}

async function permission(
  handle: PermissionDirectoryHandle,
  request: boolean,
) {
  const options = { mode: "readwrite" } as const;
  const current = await handle.queryPermission(options);
  return current === "prompt" && request
    ? handle.requestPermission(options)
    : current;
}

export function supportsLocalBackup() {
  if (typeof window === "undefined") return false;
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  try {
    return typeof picker === "function" && window.self === window.top;
  }
  catch {
    return false;
  }
}

export async function chooseBackupDirectory() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("当前浏览器不支持选择本地文件夹。");
  const handle = await picker.call(window, {
    id: "pindou-backup",
    mode: "readwrite",
  }) as PermissionDirectoryHandle;
  await permission(handle, true);
  await storeDirectory(handle);
  return handle;
}

export async function forgetBackupDirectory() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(DIRECTORY_KEY);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    cachedDirectory = null;
  }
  finally {
    database.close();
  }
}

export async function localBackupStatus(): Promise<LocalBackupStatus> {
  let handle: PermissionDirectoryHandle | null = null;
  try {
    handle = await storedDirectory();
    if (!handle) return { state: "not-configured" };
    return {
      state: (await permission(handle, false)) === "granted"
        ? "ready"
        : "needs-permission",
      folderName: handle.name,
    };
  }
  catch (error) {
    return {
      state: "error",
      folderName: handle?.name,
      message: errorMessage(error),
    };
  }
}

export async function writeBackupFile(
  directory: FileSystemDirectoryHandle,
  blob: Blob,
  fileName: string,
) {
  const file = await directory.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  }
  catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

async function performAutomaticBackup(
  projects: Project[],
): Promise<LocalBackupStatus> {
  let handle: PermissionDirectoryHandle | null = null;
  try {
    handle = await storedDirectory();
    if (!handle) return { state: "not-configured" };
    if ((await permission(handle, false)) !== "granted")
      return { state: "needs-permission", folderName: handle.name };
    await writeBackupFile(handle, await createBackupBlob(projects), AUTO_BACKUP_NAME);
    return {
      state: "saved",
      folderName: handle.name,
      savedAt: new Date().toISOString(),
    };
  }
  catch (error) {
    return {
      state: "error",
      folderName: handle?.name,
      message: errorMessage(error),
    };
  }
}

let automaticBackup = Promise.resolve<LocalBackupStatus>({
  state: "not-configured",
});

export function syncBackup(projects: Project[]) {
  automaticBackup = automaticBackup.then(
    () => performAutomaticBackup(projects),
    () => performAutomaticBackup(projects),
  );
  return automaticBackup;
}

export async function authorizeAndSync(projects: Project[]) {
  let handle: PermissionDirectoryHandle | null = null;
  try {
    handle = await storedDirectory();
    if (!handle) return { state: "not-configured" } as LocalBackupStatus;
    if ((await permission(handle, true)) !== "granted")
      return { state: "needs-permission", folderName: handle.name } as LocalBackupStatus;
    return performAutomaticBackup(projects);
  }
  catch (error) {
    return {
      state: "error",
      folderName: handle?.name,
      message: errorMessage(error),
    } as LocalBackupStatus;
  }
}

export function manualBackupName(date = new Date()) {
  const values = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ];
  const [year, ...parts] = values.map((value, index) =>
    String(value).padStart(index === 6 ? 3 : 2, "0"));
  return `拼豆作品备份-${year}-${parts.slice(0, 2).join("-")}_${parts.slice(2).join("-")}.pindou.json`;
}

export async function saveManualBackup(projects: Project[]) {
  const fileName = manualBackupName();
  let handle: PermissionDirectoryHandle | null;
  try {
    handle = await storedDirectory();
  }
  catch {
    await downloadBackup(projects);
    return "无法读取本地文件夹设置，已改为浏览器下载。";
  }
  if (!handle) {
    await downloadBackup(projects);
    return "备份已下载。";
  }
  let blob: Blob | undefined;
  try {
    if ((await permission(handle, true)) !== "granted") throw new DOMException("", "NotAllowedError");
    blob = await createBackupBlob(projects);
    await writeBackupFile(handle, blob, fileName);
    return `备份已保存到“${handle.name}”。`;
  }
  catch (error) {
    saveBlob(blob ?? await createBackupBlob(projects), fileName);
    return `${errorMessage(error)}已改为浏览器下载。`;
  }
}
