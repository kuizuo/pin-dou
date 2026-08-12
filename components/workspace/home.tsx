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

function UploadCard({
  onFile,
  onSample,
}: {
  onFile: (file?: File) => void;
  onSample: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="upload-card">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        capture="environment"
        onChange={event => onFile(event.target.files?.[0])}
      />
      <button
        className="upload-action"
        onClick={() => input.current?.click()}
      >
        <span>
          <Camera size={30} />
        </span>
        <strong>拍照或选择图片</strong>
        <small>JPG、PNG、WebP、HEIC · 不超过 10MB</small>
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
    <main className="workspace new-page">
      <section className="new-project-card">
        <div>
          <span className="eyebrow">新建图纸</span>
          <h1>选择一张图片开始</h1>
          <p>上传后只需裁切画面并选择本机或 AI，详细参数都可以在生成后调整。</p>
        </div>
        <UploadCard
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
    <main className="workspace home-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">MARD 291 色 · AI 生成图纸</span>
          <h1>一张照片，变成真正能照着拼的图纸</h1>
          <p>
            先把照片整理成清晰图纸，再减少零碎颜色并放到合适的豆板上。也可以直接使用原图。
          </p>
          <div className="hero-points">
            <span>
              <Check />
              白色豆与空白格分开
            </span>
            <span>
              <Check />
              作品只保存在设备
            </span>
            <span>
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
      <section className="projects-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">只保存在当前设备</span>
            <h2>我的作品</h2>
          </div>
          <div>
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
            className="status-message"
            role="status"
          >
            {message}
          </p>
        )}
        {projects.length
          ? (
              <div className="project-grid">
                {projects.map(project => (
                  <article
                    className="project-card"
                    key={project.id}
                  >
                    <button
                      className="project-preview"
                      onClick={() => onOpen(project)}
                    >
                      <PatternCanvas
                        pattern={project.pattern}
                        showGrid={false}
                      />
                      <span>
                        {project.pattern.width}
                        ×
                        {project.pattern.height}
                        {" "}
                        豆板
                      </span>
                    </button>
                    <div>
                      <h3>{project.name}</h3>
                      <p>
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
                      <div className="card-actions">
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
              <div className="empty-projects">
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
