import {
  Camera,
  Check,
  Copy,
  FileArchive,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { PatternCanvas } from "@/components/pattern-canvas";
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
  deleteProject,
  downloadBackup,
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
  const input = useRef<HTMLInputElement>(null);
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
        capture="environment"
        onChange={event => onFile(event.target.files?.[0])}
      />
      <button
        className="flex min-h-[245px]! flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[#64738a] bg-workbench-raised text-inherit hover:border-primary"
        onClick={() => input.current?.click()}
      >
        <span className="grid size-[62px] place-items-center rounded-[18px] bg-primary text-white">
          <Camera size={30} />
        </span>
        <strong className="text-[1.1rem]">拍照或选择图片</strong>
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
  projects,
  onFile,
  onSample,
  onOpen,
  onRefresh,
}: {
  projects: Project[];
  onFile: (file?: File) => void;
  onSample: () => void;
  onOpen: (project: Project) => void;
  onRefresh: () => void;
}) {
  const backup = useRef<HTMLInputElement>(null),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<{
      action: "rename" | "delete";
      project: Project;
    } | null>(null),
    [name, setName] = useState(""),
    [saving, setSaving] = useState(false);
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
  return (
    <main className="workspace home-page max-[641px]:w-[calc(100%-20px)]! max-[641px]:pt-2.5!">
      <section className="grid min-h-[520px] grid-cols-[1.05fr_0.8fr] items-center gap-[clamp(28px,6vw,80px)] overflow-hidden rounded-[28px] border border-border [background:radial-gradient(circle_at_90%_5%,#e5f8fb_0,transparent_32%),radial-gradient(circle_at_5%_90%,#fde6f0_0,transparent_32%),var(--card)] p-[clamp(28px,5vw,70px)] shadow-[0_20px_60px_rgb(24_34_53/0.07)] max-[901px]:grid-cols-[1fr_340px] max-[641px]:min-h-0 max-[641px]:grid-cols-1 max-[641px]:gap-[22px] max-[641px]:rounded-[19px] max-[641px]:px-4 max-[641px]:pt-7 max-[641px]:pb-4">
        <div>
          <span className="eyebrow">MARD 291 色 · AI 生成图纸</span>
          <h1 className="mt-3 mb-[18px] max-w-[680px] text-[clamp(2.2rem,5.4vw,4.6rem)] leading-[1.02] tracking-[-0.055em] max-[640px]:text-[2.5rem]">
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
          <div className="flex gap-2 max-[640px]:w-full max-[640px]:gap-1 max-[640px]:[&>*]:flex-1">
            <input
              ref={backup}
              type="file"
              hidden
              accept=".json,.pindou.json,application/json"
              onChange={event => void loadBackup(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              onClick={() => backup.current?.click()}
            >
              <Upload />
              恢复备份
            </Button>
            <Button
              variant="outline"
              disabled={!projects.length}
              onClick={() => void downloadBackup(projects)}
            >
              <FileArchive />
              备份全部
            </Button>
          </div>
        </div>
        {message && (
          <p
            className="flex items-center gap-[9px] rounded-[10px] border border-[#e7bd6c] bg-[#fff5dc] px-3.5 py-3 text-[0.76rem] leading-[1.5] text-[#674b12] [&>div]:ml-auto [&>div]:flex [&>div]:gap-[5px] max-[641px]:flex-wrap max-[641px]:items-start max-[641px]:[&>div]:ml-0 max-[641px]:[&>div]:w-full"
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
                    className="min-w-0 rounded-[18px] border border-border bg-card p-3 shadow-[0_4px_16px_rgb(24_34_53/0.05)]"
                    key={project.id}
                  >
                    <button
                      className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[13px] border-0 bg-[#26344a] [&_canvas]:h-full [&_canvas]:w-full! [&_canvas]:object-contain"
                      onClick={() => onOpen(project)}
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
