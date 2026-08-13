import {
  Check,
  Copy,
  Eye,
  FileArchive,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Pencil,
  Save,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { PatternCanvas } from "@/components/pattern-canvas";
import { PatternPreviewDialog } from "@/components/pattern-preview-dialog";
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
  importBackup,
  saveProject,
} from "@/lib/projects";
import { cn } from "@/lib/utils";

function UploadCard({
  className,
  onFile,
  onSample,
}: {
  className?: string;
  onFile: (file?: File) => void;
  onSample: () => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [dragging, setDragging] = useState(false);
  return (
    <div
      className={cn(
        "flex min-h-[360px] flex-col gap-2.5 rounded-[22px] bg-workbench p-[18px] text-workbench-foreground shadow-[0_26px_45px_rgb(24_34_53/0.2)] [transform:rotate(1.5deg)] [&>[data-slot=button]]:border-[#d9ccd0] [&>[data-slot=button]]:bg-white [&>[data-slot=button]]:text-[#182235] max-[641px]:min-h-80! max-[641px]:[transform:none]!",
        className,
      )}
    >
      <input
        className="hidden"
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={event => onFile(event.target.files?.[0])}
      />
      <button
        className="flex min-h-[245px]! flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[#64738a] bg-workbench-raised text-inherit hover:border-primary data-[dragging=true]:border-primary data-[dragging=true]:bg-[#2b3950] data-[dragging=true]:shadow-[inset_0_0_0_3px_rgb(238_51_145/18%)]"
        type="button"
        data-dragging={dragging}
        onClick={() => input.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={event => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="grid size-[62px] place-items-center rounded-[18px] bg-primary text-white">
          <ImagePlus size={30} />
        </span>
        <strong className="text-[1.1rem]">
          {dragging ? "松开即可上传" : "从相册选择图片"}
        </strong>
        <small className="text-center text-workbench-muted">
          JPG、PNG、WebP、HEIC · 不超过 10MB
        </small>
      </button>
      <Button
        variant="outline"
        onClick={onSample}
      >
        <ImagePlus size={17} />
        先看示例
      </Button>
    </div>
  );
}

export function NewProject({
  onFile,
  onSample,
}: {
  onFile: (file?: File) => void;
  onSample: () => void;
}) {
  return (
    <main className="workspace grid min-h-[calc(100dvh-60px)] items-center max-[640px]:min-h-[calc(100dvh-56px)] max-[641px]:w-[calc(100%-20px)]! max-[641px]:pt-2.5! max-[640px]:pb-2.5!">
      <section className="grid grid-cols-[1fr_minmax(320px,420px)] items-center gap-[clamp(32px,7vw,80px)] rounded-3xl border border-border bg-card p-[clamp(24px,5vw,64px)] max-[900px]:grid-cols-[1fr_340px] max-[640px]:grid-cols-1 max-[640px]:gap-5 max-[640px]:rounded-[19px] max-[640px]:px-4 max-[640px]:pt-6 max-[640px]:pb-4">
        <div>
          <span className="eyebrow">新建图纸</span>
          <h1 className="mt-2.5 mb-3.5 text-[clamp(2rem,4vw,3.6rem)] leading-[1.05] max-[640px]:text-[2.2rem]">
            选择一张图片开始
          </h1>
          <p className="max-w-[42ch] leading-[1.75] text-muted-foreground">
            上传后只需裁切画面并选择本机或 AI，详细参数都可以在生成后调整。
          </p>
        </div>
        <UploadCard
          className="min-h-[390px]! [transform:none]! max-[640px]:min-h-80!"
          onFile={onFile}
          onSample={onSample}
        />
      </section>
    </main>
  );
}

export function Home({
  backupStatus,
  localBackupSupported,
  projects,
  onBackupStatusChange,
  onFile,
  onSample,
  onOpen,
  onRefresh,
}: {
  backupStatus: LocalBackupStatus;
  localBackupSupported: boolean;
  projects: Project[];
  onBackupStatusChange: (status: LocalBackupStatus) => void;
  onFile: (file?: File) => void;
  onSample: () => void;
  onOpen: (project: Project) => void;
  onRefresh: () => void;
}) {
  const backup = useRef<HTMLInputElement>(null),
    settingsButton = useRef<HTMLButtonElement>(null),
    [message, setMessage] = useState(""),
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
  async function loadBackup(file?: File) {
    if (!file) return;
    try {
      const count = await importBackup(file);
      setMessage(`已恢复 ${count} 个作品。`);
      await onRefresh();
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "备份恢复失败。");
    }
    finally {
      setSettingsOpen(false);
      if (backup.current) backup.current.value = "";
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
  return (
    <main className="workspace home-page max-[641px]:w-[calc(100%-20px)]! max-[641px]:pt-2.5!">
      <section className="grid min-h-[520px] grid-cols-[1.05fr_0.8fr] items-center gap-[clamp(28px,6vw,80px)] overflow-hidden rounded-[28px] border border-border [background:radial-gradient(circle_at_90%_5%,#e5f8fb_0,transparent_32%),radial-gradient(circle_at_5%_90%,#fde6f0_0,transparent_32%),var(--card)] p-[clamp(28px,5vw,70px)] shadow-[0_20px_60px_rgb(24_34_53/0.07)] max-[901px]:grid-cols-[1fr_340px] max-[641px]:min-h-0 max-[641px]:grid-cols-1 max-[641px]:gap-[22px] max-[641px]:rounded-[19px] max-[641px]:px-4 max-[641px]:pt-7 max-[641px]:pb-4">
        <div>
          <span className="eyebrow">MARD 291 色 · AI 生成图纸</span>
          <h1 className="mt-3 mb-[18px] max-w-[680px] text-[clamp(2.2rem,5.4vw,4.2rem)] leading-[1.02] tracking-[-0.055em] max-[640px]:text-[2.5rem]">
            一张照片，变成真正能照着拼的图纸
          </h1>
          <p className="max-w-[600px] text-[1.05rem] leading-[1.8] text-muted-foreground max-[640px]:text-[0.9rem]">
            先把照片整理成清晰图纸，再减少零碎颜色并放到合适的豆板上。也可以直接使用原图。
          </p>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-[0.82rem] font-bold max-[640px]:mt-[18px] max-[640px]:grid">
            <span className="flex items-center gap-[5px] [&_svg]:w-[17px] [&_svg]:text-success">
              <Check />
              白色豆与空白格分开
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
        <UploadCard
          onFile={onFile}
          onSample={onSample}
        />
      </section>
      <section className="pt-[70px] max-[640px]:pt-11">
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
              onChange={event => void loadBackup(event.target.files?.[0])}
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
                        色 ·
                        {" "}
                        {project.versions.length}
                        {" "}
                        个版本
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
                                <Tooltip>
                                  <TooltipTrigger
                                    render={(
                                      <Button
                                        className="max-[640px]:w-11 max-[640px]:px-0"
                                        size="sm"
                                        aria-label="打开"
                                        onClick={() => onOpen(project)}
                                      >
                                        <FolderOpen />
                                        <span className="max-[640px]:hidden">打开</span>
                                      </Button>
                                    )}
                                  />
                                  <TooltipContent>打开</TooltipContent>
                                </Tooltip>
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
                <p>生成第一张图纸后，原图、设置和版本都会保存在这里。</p>
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
