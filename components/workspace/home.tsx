import {
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Eye,
  FileArchive,
  FileJson,
  FolderInput,
  FolderOpen,
  Grid2X2,
  ListChecks,
  LoaderCircle,
  Pencil,
  Save,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { UploadCard } from "@/components/new-project-dialog";
import { PatternCanvas } from "@/components/pattern-canvas";
import { PatternPreviewDialog } from "@/components/pattern-preview-dialog";
import { TextPatternDialog } from "@/components/text-pattern-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { patternStats } from "@/lib/beads";
import {
  authorizeAndSync,
  chooseBackupDirectory,
  forgetBackupDirectory,
  type LocalBackupStatus,
  saveManualBackup,
  syncBackup,
} from "@/lib/local-backup";
import {
  copyPatternPng,
  downloadPatternPng,
  renderPattern,
} from "@/lib/pattern";
import {
  deleteProject,
  deleteProjects,
  duplicateProject,
  importBackups,
  readBackupProjects,
  saveProject,
} from "@/lib/projects";
import { CARD_PRESETS, type CardPreset, type Pattern, type Project } from "@/lib/types";
import { cn } from "@/lib/utils";

async function entryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile)
    return new Promise((resolve, reject) =>
      (entry as FileSystemFileEntry).file(file => resolve([file]), reject));
  const reader = (entry as FileSystemDirectoryEntry).createReader(), files: File[] = [];
  while (true) {
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject));
    if (!entries.length) return files;
    files.push(...(await Promise.all(entries.map(entryFiles))).flat());
  }
}

async function droppedJsonFiles(data: DataTransfer) {
  const entries = [...data.items]
    .map(item => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);
  const files = entries.length
    ? (await Promise.all(entries.map(entryFiles))).flat()
    : [...data.files];
  return files.filter(file => file.name.toLowerCase().endsWith(".json"));
}

export function Home({
  backupStatus,
  localBackupSupported,
  projects,
  onBackupStatusChange,
  onCreateCard,
  onCreatePattern,
  onFile,
  onSample,
  onOpen,
  onRefresh,
}: {
  backupStatus: LocalBackupStatus;
  localBackupSupported: boolean;
  projects: Project[];
  onBackupStatusChange: (status: LocalBackupStatus) => void;
  onCreateCard: (preset: CardPreset) => void;
  onCreatePattern: (pattern: Pattern) => void;
  onFile: (file?: File) => void;
  onSample: () => void;
  onOpen: (project: Project) => void;
  onRefresh: () => void;
}) {
  const backup = useRef<HTMLInputElement>(null),
    projectFolder = useRef<HTMLInputElement>(null),
    settingsButton = useRef<HTMLButtonElement>(null),
    [creationTab, setCreationTab] = useState<"image" | "card" | "text" | "emoji">("image"),
    [cardSampleBusy, setCardSampleBusy] = useState(false),
    [message, setMessage] = useState(""),
    [importDragging, setImportDragging] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [directoryBusy, setDirectoryBusy] = useState(false),
    [backingUp, setBackingUp] = useState(false),
    [selectionMode, setSelectionMode] = useState(false),
    [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set()),
    [batchDeleteOpen, setBatchDeleteOpen] = useState(false),
    [batchDeleting, setBatchDeleting] = useState(false),
    [preview, setPreview] = useState<{ project: Project; src: string } | null>(null),
    [pending, setPending] = useState<{
      action: "rename" | "delete";
      project: Project;
    } | null>(null),
    [name, setName] = useState(""),
    [saving, setSaving] = useState(false);
  const backupStatusText
    = backupStatus.state === "not-configured"
      ? "尚未设置本地文件夹"
      : backupStatus.state === "needs-permission"
        ? "需要重新授权后才能继续自动同步"
        : backupStatus.state === "error"
          ? backupStatus.message || "最近一次同步失败"
          : backupStatus.state === "saved" && backupStatus.savedAt
            ? `已于 ${new Date(backupStatus.savedAt).toLocaleTimeString("zh-CN")} 自动同步`
            : "自动同步已开启";

  async function backupAll() {
    setBackingUp(true);
    try {
      setMessage(await saveManualBackup(projects));
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "备份失败。");
    }
    finally {
      setBackingUp(false);
      setSettingsOpen(false);
    }
  }

  function openBackupSettings() {
    setSettingsOpen(true);
    if (backupStatus.state === "needs-permission" && !directoryBusy)
      void reauthorizeDirectory();
  }

  async function chooseDirectory() {
    setDirectoryBusy(true);
    try {
      await chooseBackupDirectory();
      onBackupStatusChange(await syncBackup(projects));
      setMessage("本地备份文件夹已设置。");
    }
    catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        onBackupStatusChange({
          state: "error",
          folderName: backupStatus.folderName,
          message: error instanceof Error ? error.message : "无法选择文件夹。",
        });
    }
    finally {
      setDirectoryBusy(false);
    }
  }

  async function reauthorizeDirectory() {
    setDirectoryBusy(true);
    try {
      onBackupStatusChange(await authorizeAndSync(projects));
    }
    finally {
      setDirectoryBusy(false);
    }
  }

  async function forgetDirectory() {
    setDirectoryBusy(true);
    try {
      await forgetBackupDirectory();
      onBackupStatusChange({ state: "not-configured" });
      setMessage("已停止使用本地备份文件夹，已有备份不会删除。");
    }
    catch (error) {
      onBackupStatusChange({
        ...backupStatus,
        state: "error",
        message: error instanceof Error ? error.message : "无法更新文件夹设置。",
      });
    }
    finally {
      setDirectoryBusy(false);
    }
  }
  async function openCardSample() {
    setCardSampleBusy(true);
    try {
      const response = await fetch("/samples/sample-card.pindou.json");
      if (!response.ok) throw new Error();
      const file = new File([await response.blob()], "sample-card.pindou.json", {
        type: "application/json",
      });
      const [sample] = await readBackupProjects(file);
      if (!sample) throw new Error();
      const now = new Date().toISOString();
      const project = {
        ...sample,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        pattern: {
          ...sample.pattern,
          id: crypto.randomUUID(),
          createdAt: now,
        },
      };
      await saveProject(project);
      await onRefresh();
      onOpen(project);
    }
    catch {
      setMessage("示例图纸无法打开，请稍后再试。");
    }
    finally {
      setCardSampleBusy(false);
    }
  }

  async function loadProjects(files: File[]) {
    if (!files.length) {
      setMessage("没有找到可导入的图纸文件。");
      return;
    }
    try {
      const result = await importBackups(files);
      setMessage(
        `已导入 ${result.projects} 个作品${result.skipped ? `，跳过 ${result.skipped} 个无法识别的文件` : ""}。`,
      );
      await onRefresh();
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "图纸导入失败。");
    }
    finally {
      setSettingsOpen(false);
      if (backup.current) backup.current.value = "";
      if (projectFolder.current) projectFolder.current.value = "";
    }
  }
  async function copy(project: Project) {
    try {
      await saveProject(duplicateProject(project));
      await onRefresh();
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "复制失败。");
    }
  }
  async function copyPreview(project: Project) {
    try {
      await copyPatternPng(project.pattern);
      return true;
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "复制失败，请改用下载。");
      return false;
    }
  }
  async function confirmProjectAction() {
    if (!pending) return;
    const nextName = name.trim();
    if (pending.action === "rename" && !nextName) return;
    setSaving(true);
    try {
      if (pending.action === "delete") await deleteProject(pending.project.id);
      else if (nextName !== pending.project.name)
        await saveProject({
          ...pending.project,
          name: nextName,
          pattern: { ...pending.project.pattern, name: nextName },
          updatedAt: new Date().toISOString(),
        });
      setPending(null);
      await onRefresh();
    }
    catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : pending.action === "delete"
            ? "删除失败。"
            : "重命名失败。",
      );
    }
    finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function confirmBatchDelete() {
    if (!selectedIds.size) return;
    const count = selectedIds.size;
    setBatchDeleting(true);
    try {
      await deleteProjects([...selectedIds]);
      setBatchDeleteOpen(false);
      stopSelecting();
      await onRefresh();
      setMessage(`已删除 ${count} 个作品。`);
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "批量删除失败。");
    }
    finally {
      setBatchDeleting(false);
    }
  }
  const creationTabs = [
    { id: "image", label: "图片转图纸", disabled: false },
    { id: "card", label: "卡片风格", disabled: false },
    { id: "text", label: "文字转图纸", disabled: false },
    { id: "emoji", label: "Emoji 转图纸", disabled: false },
  ] as const;
  return (
    <main className="workspace home-page max-[641px]:w-[calc(100%-20px)]! max-[641px]:pt-2.5!">
      <div
        className="mb-4 flex w-fit rounded-[14px] border border-border bg-muted p-1"
        role="tablist"
        aria-label="新建图纸方式"
      >
        {creationTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            disabled={tab.disabled}
            aria-selected={creationTab === tab.id}
            aria-disabled={tab.disabled}
            title={tab.disabled ? "即将上线" : undefined}
            onClick={() => {
              if (!tab.disabled) setCreationTab(tab.id);
            }}
            className={cn(
              "min-h-9 cursor-pointer rounded-[10px] px-4 text-[0.8rem] font-bold transition-colors",
              tab.disabled
                ? "cursor-not-allowed text-muted-foreground/50"
                : creationTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className="grid min-h-[520px] grid-cols-[1.05fr_0.8fr] items-center gap-[clamp(28px,6vw,80px)] overflow-hidden rounded-[28px] border border-border [background:radial-gradient(circle_at_90%_5%,#e5f8fb_0,transparent_32%),radial-gradient(circle_at_5%_90%,#fde6f0_0,transparent_32%),var(--card)] p-[clamp(28px,5vw,70px)] shadow-[0_20px_60px_rgb(24_34_53/0.07)] max-[901px]:grid-cols-[1fr_340px] max-[641px]:min-h-0 max-[641px]:grid-cols-1 max-[641px]:gap-[22px] max-[641px]:rounded-[19px] max-[641px]:px-4 max-[641px]:pt-7 max-[641px]:pb-4">
        <div>
          <span className="eyebrow">
            {creationTab === "image"
              ? "MARD 291 色 · AI 生成图纸"
              : creationTab === "card"
                ? "MARD 291 色 · 标准卡面图纸"
                : creationTab === "text"
                  ? "MARD 291 色 · 像素文字"
                  : "MARD 291 色 · 彩色 Emoji"}
          </span>
          <h1 className="mt-3 mb-[18px] max-w-[680px] text-[clamp(2.2rem,5.4vw,4.2rem)] leading-[1.02] tracking-[-0.055em] max-[640px]:text-[2.5rem]">
            {creationTab === "image"
              ? "一张照片，变成真正能照着拼的图纸"
              : creationTab === "card"
                ? "用标准卡面尺寸，直接开始拼"
                : creationTab === "text"
                  ? "把喜欢的字，直接变成拼豆图纸"
                  : "把一个 Emoji，变成彩色拼豆图纸"}
          </h1>
          <p className="max-w-[600px] text-[1.05rem] leading-[1.8] text-muted-foreground max-[640px]:text-[0.9rem]">
            {creationTab === "image"
              ? "先把照片整理成清晰图纸，再减少零碎颜色并放到合适的豆板上。也可以直接使用原图。"
              : creationTab === "card"
                ? "选择银行卡或身份证尺寸，创建空白图纸后直接在网格里画。"
                : creationTab === "text"
                  ? "输入 1–5 个字符，选择横排或竖排、粗细和颜色，确认预览后开始拼。"
                  : "输入一个 Emoji，保留它在当前设备上的样子，并自动匹配为最多 12 种豆色。"}
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-[0.82rem] font-bold max-[640px]:mt-[18px] max-[640px]:grid">
            <span className="flex items-center gap-[5px] [&_svg]:w-[17px] [&_svg]:text-success">
              <Check />
              {creationTab === "image"
                ? "白色豆与空白格分开"
                : creationTab === "card"
                  ? "标准卡面尺寸"
                  : creationTab === "text"
                    ? "1–5 个字符"
                    : "一个彩色 Emoji"}
            </span>
            <span className="flex items-center gap-[5px] [&_svg]:w-[17px] [&_svg]:text-success">
              <Check />
              作品只保存在设备
            </span>
            <span className="flex items-center gap-[5px] [&_svg]:w-[17px] [&_svg]:text-success">
              <Check />
              无需注册
            </span>
          </div>
        </div>
        {creationTab === "image"
          ? (
              <UploadCard
                onFile={onFile}
                onSample={onSample}
              />
            )
          : creationTab === "card"
            ? (
                <div className="grid gap-3">
                  {CARD_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      className="group flex min-h-[160px] cursor-pointer items-center gap-5 rounded-[22px] border border-border bg-workbench p-5 text-left text-workbench-foreground shadow-[0_26px_45px_rgb(24_34_53/0.16)] transition-colors hover:border-primary"
                      onClick={() => onCreateCard(preset)}
                    >
                      <span className="grid size-[62px] shrink-0 place-items-center rounded-[18px] bg-primary text-white">
                        <CreditCard size={30} />
                      </span>
                      <span className="grid gap-1.5">
                        <strong className="text-[1.15rem]">{preset.name}</strong>
                        <small className="text-workbench-muted">
                          {preset.description}
                        </small>
                      </span>
                    </button>
                  ))}
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={cardSampleBusy}
                    onClick={() => void openCardSample()}
                  >
                    <Grid2X2 />
                    使用示例图纸
                  </Button>
                </div>
              )
            : (
                <TextPatternDialog
                  key={creationTab}
                  mode={creationTab}
                  onCreate={onCreatePattern}
                />
              )}
      </section>
      <section
        className="relative pt-[70px] max-[640px]:pt-11"
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setImportDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setImportDragging(false);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          setImportDragging(false);
          void droppedJsonFiles(event.dataTransfer)
            .then(loadProjects)
            .catch(error => setMessage(
              error instanceof Error ? error.message : "无法读取拖入的文件夹。",
            ));
        }}
      >
        {importDragging
          ? (
              <div className="pointer-events-none absolute inset-x-0 top-12 z-20 grid min-h-44 place-items-center rounded-[18px] border-2 border-dashed border-primary bg-background/95 text-center shadow-lg">
                <div className="grid gap-1.5">
                  <FolderInput className="mx-auto size-7 text-primary" />
                  <strong>松开即可导入图纸</strong>
                  <small className="text-muted-foreground">
                    支持 .pindou.json 文件或文件夹
                  </small>
                </div>
              </div>
            )
          : null}
        <div className="mb-5 flex items-end justify-between gap-6 max-[640px]:flex-col max-[640px]:items-start">
          <div>
            <span className="eyebrow">只保存在当前设备</span>
            <h2 className="mt-[5px] text-[1.9rem]">我的作品</h2>
          </div>
          <div className="flex gap-2 max-[640px]:self-end max-[640px]:gap-1">
            <input
              ref={backup}
              type="file"
              hidden
              accept=".json,.pindou.json,application/json"
              onChange={event => void loadProjects([...(event.target.files || [])])}
            />
            <input
              ref={projectFolder}
              type="file"
              hidden
              multiple
              {...{ webkitdirectory: "" }}
              onChange={event => void loadProjects(
                [...(event.target.files || [])].filter(file =>
                  file.name.toLowerCase().endsWith(".pindou.json")),
              )}
            />
            {selectionMode
              ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={stopSelecting}
                    >
                      取消
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedIds(
                        selectedIds.size === projects.length
                          ? new Set()
                          : new Set(projects.map(project => project.id)),
                      )}
                    >
                      {selectedIds.size === projects.length ? "取消全选" : "全选"}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!selectedIds.size}
                      onClick={() => setBatchDeleteOpen(true)}
                    >
                      <Trash2 />
                      {selectedIds.size ? `删除 ${selectedIds.size} 个` : "删除"}
                    </Button>
                  </>
                )
              : (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Upload />
                          导入
                          <ChevronDown />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => backup.current?.click()}>
                          <FileJson />
                          导入 JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => projectFolder.current?.click()}>
                          <FolderInput />
                          导入文件夹
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      disabled={!projects.length}
                      onClick={() => setSelectionMode(true)}
                    >
                      <ListChecks />
                      批量删除
                    </Button>
                    <Tooltip>
                      <TooltipTrigger
                        render={(
                          <Button
                            ref={settingsButton}
                            data-backup-settings
                            variant="outline"
                            size="icon"
                            aria-label="备份设置"
                            onClick={openBackupSettings}
                          >
                            <Settings />
                          </Button>
                        )}
                      />
                      <TooltipContent>备份设置</TooltipContent>
                    </Tooltip>
                  </>
                )}
          </div>
        </div>
        {message && (
          <p
            className="mt-0 mb-4 flex items-center gap-[9px] rounded-[10px] border border-[#e7bd6c] bg-[#fff5dc] px-3.5 py-3 text-[0.76rem] leading-[1.5] text-[#674b12] [&>div]:ml-auto [&>div]:flex [&>div]:gap-[5px] max-[641px]:flex-wrap max-[641px]:items-start max-[641px]:[&>div]:ml-0 max-[641px]:[&>div]:w-full"
            role="status"
          >
            {message}
          </p>
        )}
        {projects.length
          ? (
              <div className="grid grid-cols-3 gap-4 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                {projects.map(project => (
                  <article
                    className={cn(
                      "min-w-0 rounded-[18px] border border-border bg-card p-3 shadow-[0_4px_16px_rgb(24_34_53/0.05)]",
                      selectionMode && selectedIds.has(project.id)
                      && "border-primary shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary),transparent_72%)]",
                    )}
                    key={project.id}
                  >
                    <button
                      className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[13px] border-0 bg-[#26344a] [&_canvas]:h-full [&_canvas]:w-full! [&_canvas]:object-contain"
                      aria-pressed={selectionMode
                        ? selectedIds.has(project.id)
                        : undefined}
                      onClick={() => selectionMode
                        ? toggleSelected(project.id)
                        : onOpen(project)}
                    >
                      <PatternCanvas
                        pattern={project.pattern}
                        showGrid={false}
                      />
                      <span className="absolute right-2 bottom-2 rounded-[7px] bg-[rgb(24_34_53/0.78)] px-[7px] py-1 text-[0.65rem] text-white">
                        {project.pattern.width}
                        ×
                        {project.pattern.height}
                        {" "}
                        豆板
                      </span>
                      {selectionMode && (
                        <span
                          className={cn(
                            "absolute top-2 left-2 grid size-7 place-items-center rounded-full border-2 border-white bg-[rgb(24_34_53/0.72)] text-white shadow-sm [&_svg]:size-4",
                            selectedIds.has(project.id) && "bg-primary",
                          )}
                        >
                          {selectedIds.has(project.id) && <Check />}
                        </span>
                      )}
                    </button>
                    <div>
                      <h3 className="mt-3 mb-[3px] text-[0.98rem]">
                        {project.name}
                      </h3>
                      <p className="mt-0 mb-3 text-[0.7rem] text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
                        {" "}
                        ·
                        {" "}
                        {patternStats(project.pattern).length}
                        {" "}
                        色
                      </p>
                      <div className="flex gap-1 max-[640px]:gap-1 [&>:first-child]:mr-auto">
                        {selectionMode
                          ? (
                              <Button
                                size="sm"
                                variant={selectedIds.has(project.id)
                                  ? "default"
                                  : "outline"}
                                onClick={() => toggleSelected(project.id)}
                              >
                                {selectedIds.has(project.id) && <Check />}
                                {selectedIds.has(project.id) ? "已选择" : "选择"}
                              </Button>
                            )
                          : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => onOpen(project)}
                                >
                                  <FolderOpen />
                                  打开
                                </Button>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={(
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="预览"
                                        onClick={() => setPreview({
                                          project,
                                          src: renderPattern(project.pattern).toDataURL("image/png"),
                                        })}
                                      >
                                        <Eye />
                                      </Button>
                                    )}
                                  />
                                  <TooltipContent>预览</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={(
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="编辑名称"
                                        onClick={() => {
                                          setName(project.name);
                                          setPending({ action: "rename", project });
                                        }}
                                      >
                                        <Pencil />
                                      </Button>
                                    )}
                                  />
                                  <TooltipContent>编辑名称</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={(
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="复制"
                                        onClick={() => void copy(project)}
                                      >
                                        <Copy />
                                      </Button>
                                    )}
                                  />
                                  <TooltipContent>复制</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={(
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="删除"
                                        onClick={() =>
                                          setPending({ action: "delete", project })}
                                      >
                                        <Trash2 />
                                      </Button>
                                    )}
                                  />
                                  <TooltipContent>删除</TooltipContent>
                                </Tooltip>
                              </>
                            )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          : (
              <div className="flex flex-col items-center gap-[7px] rounded-[18px] border border-dashed border-border px-5 py-[55px] text-center text-muted-foreground [&_p]:m-0 [&_p]:text-[0.8rem] [&_strong]:text-[var(--ink)]">
                <Grid2X2 size={26} />
                <strong>还没有作品</strong>
                <p>生成第一张图纸后，原图、设置和当前图纸都会保存在这里。</p>
              </div>
            )}
      </section>
      <AlertDialog
        open={batchDeleteOpen}
        onOpenChange={open => !batchDeleting && setBatchDeleteOpen(open)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {`删除选中的 ${selectedIds.size} 个作品？`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              删除后只能通过已有备份恢复，这个操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={batchDeleting}
              onClick={() => void confirmBatchDelete()}
            >
              {batchDeleting
                ? <LoaderCircle className="spin" />
                : <Trash2 />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {preview && (
        <PatternPreviewDialog
          src={preview.src}
          name={preview.project.name}
          onClose={() => setPreview(null)}
          onCopy={() => copyPreview(preview.project)}
          onDownload={() => void downloadPatternPng(preview.project.pattern)}
        />
      )}
      <AlertDialog
        open={settingsOpen}
        onOpenChange={open => !directoryBusy && setSettingsOpen(open)}
      >
        <AlertDialogContent
          className="max-w-md!"
          finalFocus={settingsButton}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>备份设置</AlertDialogTitle>
            <AlertDialogDescription>
              下载、恢复备份，或设置自动同步文件夹。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => backup.current?.click()}
            >
              <Upload />
              恢复备份
            </Button>
            <Button
              variant="outline"
              disabled={!projects.length || backingUp}
              onClick={() => void backupAll()}
            >
              {backingUp
                ? <LoaderCircle className="spin" />
                : <FileArchive />}
              备份全部
            </Button>
          </div>
          {localBackupSupported
            ? (
                <>
                  <div
                    className="rounded-xl border border-border bg-muted/55 p-3.5"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <strong className="block text-sm">
                      {backupStatus.folderName || "未选择文件夹"}
                    </strong>
                    <small className="mt-1 block leading-relaxed text-muted-foreground">
                      {backupStatusText}
                    </small>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {backupStatus.folderName && (
                      <Button
                        variant="ghost"
                        disabled={directoryBusy}
                        onClick={() => void forgetDirectory()}
                      >
                        停止使用
                      </Button>
                    )}
                    {backupStatus.state === "needs-permission" && (
                      <Button
                        variant="outline"
                        disabled={directoryBusy}
                        onClick={() => void reauthorizeDirectory()}
                      >
                        重新授权
                      </Button>
                    )}
                    <Button
                      disabled={directoryBusy}
                      onClick={() => void chooseDirectory()}
                    >
                      {directoryBusy && <LoaderCircle className="spin" />}
                      {backupStatus.folderName ? "更换文件夹" : "选择文件夹"}
                    </Button>
                  </div>
                </>
              )
            : (
                <p className="m-0 rounded-xl bg-muted/55 p-3.5 text-sm leading-relaxed text-muted-foreground">
                  当前浏览器不支持本地文件夹备份，仍可下载和恢复备份。
                </p>
              )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={directoryBusy}>关闭</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open && !saving) setPending(null);
        }}
      >
        <AlertDialogContent size="sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmProjectAction();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pending?.action === "delete"
                  ? `删除“${pending.project.name}”？`
                  : "编辑图纸名称"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pending?.action === "delete"
                  ? "删除后只能通过已有备份恢复，这个操作无法撤销。"
                  : "输入一个便于识别的作品名称。"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {pending?.action === "rename" && (
              <input
                className="mt-4 min-h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="图纸名称"
                autoFocus
                value={name}
                onChange={event => setName(event.target.value)}
              />
            )}
            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant={
                  pending?.action === "delete" ? "destructive" : "default"
                }
                disabled={
                  saving || (pending?.action === "rename" && !name.trim())
                }
              >
                {saving
                  ? (
                      <LoaderCircle className="spin" />
                    )
                  : pending?.action === "delete"
                    ? (
                        <Trash2 />
                      )
                    : (
                        <Save />
                      )}
                {pending?.action === "delete" ? "确认删除" : "保存名称"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
