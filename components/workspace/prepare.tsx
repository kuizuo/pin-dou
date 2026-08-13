/* eslint-disable @next/next/no-img-element -- local Blob/data URL previews cannot use the Next image optimizer */

import {
  ArrowLeft,
  CircleAlert,
  Crop as CropIcon,
  FlipHorizontal,
  FlipVertical,
  ImageIcon,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  RotateCw,
  Settings,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
} from "react-image-crop";
import type {
  AiProvider,
  AiRequest,
  AiStyleCandidate,
  AiStyleFailure,
} from "@/lib/ai";
import type { GenerationSettings, SourceTransform } from "@/lib/types";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
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
import { fitPreviewSize, renderSourcePreview } from "@/lib/pattern";
import { DEFAULT_TRANSFORM } from "@/lib/types";

export type Draft = {
  file: File;
  dataUrl: string;
  transform: SourceTransform;
  settings: GenerationSettings;
};

function CropPreview({
  aspect,
  draft,
  onReplaceFile,
  setDraft,
}: {
  aspect?: number;
  draft: Draft;
  onReplaceFile: (file?: File) => void;
  setDraft: (draft: Draft) => void;
}) {
  const { transform } = draft,
    orientation = `${transform.rotation}:${transform.flipX}:${transform.flipY}`,
    area = useRef<HTMLDivElement>(null),
    [preview, setPreview] = useState<{
      url: string;
      width: number;
      height: number;
    } | null>(null),
    [frame, setFrame] = useState({ width: 0, height: 0 }),
    [dragging, setDragging] = useState(false),
    draftRef = useRef(draft),
    setDraftRef = useRef(setDraft);
  const crop: PercentCrop = {
    unit: "%",
    ...(transform.crop || { x: 0, y: 0, width: 100, height: 100 }),
  };
  useEffect(() => {
    draftRef.current = draft;
    setDraftRef.current = setDraft;
  }, [draft, setDraft]);
  useEffect(() => {
    let active = true;
    const previewTransform = {
      ...DEFAULT_TRANSFORM,
      rotation: transform.rotation,
      flipX: transform.flipX,
      flipY: transform.flipY,
    };
    void renderSourcePreview(draft.dataUrl, previewTransform).then(
      async (url) => {
        const image = new Image();
        image.src = url;
        try {
          await image.decode();
        }
        catch {
          /* the visible image remains the fallback */
        }
        if (active) {
          const next = {
              url,
              width: image.naturalWidth,
              height: image.naturalHeight,
            },
            box = area.current;
          if (box)
            setFrame(
              fitPreviewSize(
                next.width,
                next.height,
                box.clientWidth,
                box.clientHeight,
              ),
            );
          setPreview(next);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [
    draft.dataUrl,
    orientation,
    transform.flipX,
    transform.flipY,
    transform.rotation,
  ]);
  useEffect(() => {
    const box = area.current;
    if (!box || !preview) return;
    const resize = () => {
      const next = fitPreviewSize(
        preview.width,
        preview.height,
        box.clientWidth,
        box.clientHeight,
      );
      setFrame(current =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    return () => observer.disconnect();
  }, [preview]);
  useEffect(() => {
    if (!aspect || !preview) return;
    const next = centerCrop(
        makeAspectCrop(
          { unit: "%", width: 90 },
          aspect,
          preview.width,
          preview.height,
        ),
        preview.width,
        preview.height,
      ),
      current = draftRef.current;
    setDraftRef.current({
      ...current,
      transform: {
        ...current.transform,
        crop: {
          x: next.x,
          y: next.y,
          width: next.width,
          height: next.height,
        },
      },
    });
  }, [aspect, preview]);
  return (
    <div
      ref={area}
      className="relative grid h-[min(66dvh,720px)] min-h-[440px] place-items-center overflow-hidden bg-[#f8f3f5] [background-image:linear-gradient(45deg,#eee5e8_25%,transparent_25%),linear-gradient(-45deg,#eee5e8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee5e8_75%),linear-gradient(-45deg,transparent_75%,#eee5e8_75%)] [background-position:0_0,0_12px,12px_-12px,-12px_0] [background-size:24px_24px] max-[901px]:h-[min(58dvh,590px)] max-[901px]:min-h-[400px] max-[641px]:h-[48dvh] max-[641px]:min-h-80"
      role="group"
      aria-label="图片裁切区域"
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={event =>
        !event.currentTarget.contains(event.relatedTarget as Node)
        && setDragging(false)}
      onDragOver={event => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onReplaceFile(event.dataTransfer.files[0]);
      }}
    >
      {preview && frame.width
        ? (
            <ReactCrop
              className="crop-frame rounded-lg border border-[#b9aeb2] bg-card shadow-[0_18px_45px_rgb(65_37_49/0.18)] [&_img]:block [&_img]:size-full"
              style={frame}
              crop={crop}
              aspect={aspect}
              minWidth={48}
              minHeight={48}
              keepSelection
              ruleOfThirds
              onChange={(_, percent) =>
                setDraft({
                  ...draft,
                  transform: {
                    ...transform,
                    crop: {
                      x: percent.x,
                      y: percent.y,
                      width: percent.width,
                      height: percent.height,
                    },
                  },
                })}
            >
              <img
                src={preview.url}
                alt="待处理原图"
                draggable={false}
              />
            </ReactCrop>
          )
        : (
            <LoaderCircle className="spin" />
          )}
      <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[rgb(15_23_38/0.8)] px-2.5 py-1.5 text-[0.68rem] whitespace-nowrap text-white">
        拖动裁切框移动 · 拉动边角调整大小
      </span>
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-[18px] border-2 border-dashed border-primary bg-[rgb(24_34_53/0.82)] text-base font-extrabold text-white backdrop-blur-sm">
          松开即可替换图片
        </div>
      )}
    </div>
  );
}

function AiPreviewDialog({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => returnFocus.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="pattern-preview-dialog max-[641px]:h-auto! max-[641px]:max-h-[78dvh]! max-[641px]:overflow-hidden!"
      aria-labelledby="ai-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="pattern-preview-card max-[641px]:h-auto! max-[641px]:max-h-[78dvh]!">
        <div className="pattern-preview-heading max-[641px]:flex-col! max-[641px]:items-start!">
          <div>
            <h2 id="ai-preview-title">AI 处理效果预览</h2>
            <p>检查像素效果和原图颜色，不满意可以重新生成</p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
          >
            返回
          </Button>
        </div>
        <div className="pattern-preview-scroll max-[641px]:max-h-[calc(78dvh-68px)]! max-[641px]:p-3!">
          <img
            src={src}
            alt="AI 处理效果大图预览"
          />
        </div>
      </div>
    </dialog>
  );
}

function VariantCard({
  candidate,
  failure,
  busy,
  onChoose,
  onPreview,
  onQuotaFallback,
  onRetry,
}: {
  candidate?: AiStyleCandidate;
  failure?: AiStyleFailure;
  busy: boolean;
  onChoose: (candidate: AiStyleCandidate) => void;
  onPreview: (src: string) => void;
  onQuotaFallback: () => void;
  onRetry: () => void;
}) {
  const quotaExceeded = failure?.code === "AI_FREE_QUOTA_EXHAUSTED",
    title = quotaExceeded ? "今日免费额度已用完" : "AI 处理效果";
  return (
    <article
      className={`grid min-w-0 grid-cols-[140px_minmax(0,1fr)_auto] items-center gap-3 rounded-[15px] border p-2.5 [&_small]:mt-1 [&_small]:block [&_small]:text-[0.67rem] [&_small]:leading-[1.4] [&_small]:[overflow-wrap:anywhere] [&_strong]:block max-[901px]:grid-cols-[108px_minmax(0,1fr)] max-[641px]:grid-cols-[82px_minmax(0,1fr)_auto] ${quotaExceeded ? "border-destructive bg-destructive/10 [&_small]:text-destructive [&_strong]:text-destructive" : `border-border [&_small]:text-muted-foreground ${candidate ? "bg-card" : "bg-muted"}`}`}
    >
      {candidate
        ? (
            <button
              type="button"
              className="relative grid h-[108px] w-[140px] place-items-center overflow-hidden rounded-[10px] border-0 bg-[#eee7e9] p-0 text-muted-foreground [&_img]:size-full [&_img]:object-contain [&_span]:absolute [&_span]:right-1.5 [&_span]:bottom-1.5 [&_span]:flex [&_span]:items-center [&_span]:gap-1 [&_span]:rounded-[7px] [&_span]:bg-[rgb(24_34_53/0.78)] [&_span]:px-1.5 [&_span]:py-1 [&_span]:text-[0.6rem] [&_span]:text-white [&_span_svg]:size-[13px] max-[901px]:w-[108px] max-[641px]:h-[74px] max-[641px]:w-[82px]"
              aria-label="预览 AI 处理效果大图"
              onClick={() => onPreview(candidate.image)}
            >
              <img
                src={candidate.image}
                alt={`${title}预览`}
              />
              <span>
                <Maximize2 />
                查看大图
              </span>
            </button>
          )
        : (
            <div className="relative grid h-[108px] w-[140px] place-items-center overflow-hidden rounded-[10px] bg-[#eee7e9] text-muted-foreground max-[901px]:w-[108px] max-[641px]:h-[74px] max-[641px]:w-[82px]">
              {busy
                ? <LoaderCircle className="spin" />
                : quotaExceeded
                  ? <CircleAlert className="text-destructive" />
                  : <ImageIcon />}
            </div>
          )}
      <div>
        <strong>{title}</strong>
        <small>
          {failure?.message
            || (candidate
              ? "点击图片查看效果，满意后继续生成图纸"
              : "正在转换为像素风格并保留原图颜色")}
        </small>
      </div>
      {candidate
        ? (
            <div className="flex gap-2 max-[901px]:col-span-full max-[901px]:w-full max-[901px]:[&>button]:flex-1">
              <Button
                variant="outline"
                onClick={onRetry}
              >
                重新生成
              </Button>
              <Button onClick={() => onChoose(candidate)}>
                使用这个方案
              </Button>
            </div>
          )
        : failure
          ? quotaExceeded
            ? (
                <Button
                  className="max-[901px]:col-span-full! max-[901px]:w-full! max-[641px]:col-auto! max-[641px]:w-auto! max-[641px]:px-2.5!"
                  onClick={onQuotaFallback}
                >
                  改用 Gemini
                </Button>
              )
            : (
                <Button
                  className="max-[901px]:col-span-full! max-[901px]:w-full! max-[641px]:col-auto! max-[641px]:w-auto! max-[641px]:px-2.5!"
                  variant="outline"
                  onClick={onRetry}
                >
                  重试
                </Button>
              )
          : null}
    </article>
  );
}

export function Prepare({
  draft,
  setDraft,
  onBack,
  onFile,
  onGenerate,
  onModeChange,
  onReturnToImage,
  busy,
  message,
  candidates,
  failures,
  aiProvider,
  onAiProviderChange,
  geminiKey,
  onGeminiKeyChange,
  onChooseCandidate,
  onRetry,
  onSwitchSample,
  samplePosition,
  sampleTotal,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  onBack: () => void;
  onFile: (file?: File) => void;
  onGenerate: (request?: AiRequest) => void;
  onModeChange: (mode: GenerationSettings["mode"]) => void;
  onReturnToImage: () => void;
  busy: boolean;
  message: string;
  candidates: AiStyleCandidate[];
  failures: AiStyleFailure[];
  aiProvider: AiProvider;
  onAiProviderChange: (provider: AiProvider) => void;
  geminiKey: string;
  onGeminiKeyChange: (value: string) => void;
  onChooseCandidate: (candidate: AiStyleCandidate) => void;
  onRetry: (request: AiRequest) => void;
  onSwitchSample?: () => void;
  samplePosition: number;
  sampleTotal: number;
}) {
  const { transform, settings } = draft,
    aiMode = settings.mode === "ai",
    quotaExceeded = failures[0]?.code === "AI_FREE_QUOTA_EXHAUSTED",
    showVariants
      = aiMode && (busy || candidates.length > 0 || failures.length > 0);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false),
    [previewSrc, setPreviewSrc] = useState(""),
    [cropAspect, setCropAspect] = useState<number>(),
    [replacementFile, setReplacementFile] = useState<File | null>(null),
    [turnstileToken, setTurnstileToken] = useState(""),
    [turnstileRefresh, setTurnstileRefresh] = useState(0);
  const uploadInput = useRef<HTMLInputElement>(null),
    turnstileTime = useRef(0);
  function chooseMode(mode: GenerationSettings["mode"]) {
    setDraft({ ...draft, settings: { ...settings, mode } });
    onModeChange(mode);
  }
  function runAi(action: (request: AiRequest) => void) {
    const credential
      = aiProvider === "gemini"
        ? geminiKey.trim()
        : Date.now() - turnstileTime.current < 290_000
          ? turnstileToken
          : "";
    if (!credential) return setAiSettingsOpen(true);
    action({ provider: aiProvider, credential });
    if (aiProvider === "cloudflare") {
      setTurnstileToken("");
      setTurnstileRefresh(value => value + 1);
    }
  }
  return (
    <main className="mx-auto w-[min(1320px,calc(100%-40px))] pt-7 pb-[120px] max-[640px]:w-[calc(100%-20px)] max-[640px]:pt-2.5 max-[640px]:pb-[104px]">
      <header className="mb-3.5 flex min-h-[58px] items-center justify-between gap-2 max-[640px]:items-start">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            ref={uploadInput}
            type="file"
            hidden
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            onChange={(event) => {
              setReplacementFile(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
          <Button
            variant="outline"
            onClick={showVariants ? onReturnToImage : onBack}
          >
            <ArrowLeft />
            返回
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => uploadInput.current?.click()}
          >
            <ImagePlus />
            重新上传
          </Button>
          {!showVariants && onSwitchSample && sampleTotal > 1 && (
            <Button
              variant="outline"
              aria-label={`切换示例，当前第 ${samplePosition} 张，共 ${sampleTotal} 张`}
              disabled={busy}
              onClick={onSwitchSample}
            >
              <RefreshCw />
              切换示例
              <span className="text-[0.65rem] text-muted-foreground">
                {`${samplePosition}/${sampleTotal}`}
              </span>
            </Button>
          )}
        </div>
        {!showVariants && (
          <Button
            className="max-[640px]:px-2.5"
            disabled={busy}
            onClick={() => aiMode ? runAi(onGenerate) : onGenerate()}
          >
            {busy
              ? (
                  <LoaderCircle className="spin" />
                )
              : aiMode
                ? (
                    <Sparkles />
                  )
                : (
                    <WandSparkles />
                  )}
            {busy ? "正在处理" : "生成图纸"}
          </Button>
        )}
      </header>
      {!showVariants && (
        <section className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_18px_50px_rgb(69_43_53/0.08)]">
          <CropPreview
            aspect={cropAspect}
            draft={draft}
            onReplaceFile={file => setReplacementFile(file || null)}
            setDraft={setDraft}
          />
          <div className="flex min-h-[86px] items-center justify-between gap-[18px] border-t border-border p-3 max-[901px]:flex-col max-[901px]:items-stretch max-[641px]:gap-3">
            <div
              className="flex min-w-0 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:min-h-11 [&>*]:flex-none [&>button.active]:border-primary! [&>button.active]:bg-accent! [&>button.active]:text-accent-foreground! [&_[data-slot=button]]:border-border! [&_[data-slot=button]]:bg-muted! [&_[data-slot=button]]:text-foreground! max-[641px]:grid max-[641px]:w-full max-[641px]:grid-cols-3 max-[641px]:gap-1.5 max-[641px]:overflow-visible max-[641px]:p-0 max-[641px]:[&>*]:w-full max-[641px]:[&>*]:min-w-0 max-[641px]:[&>*]:px-1.5"
              aria-label="图片方向与裁切比例"
            >
              <Button
                variant="workbench"
                onClick={() =>
                  setDraft({
                    ...draft,
                    transform: {
                      ...transform,
                      rotation: ((transform.rotation + 90)
                        % 360) as SourceTransform["rotation"],
                    },
                  })}
              >
                <RotateCw />
                旋转
              </Button>
              <Button
                variant="workbench"
                onClick={() =>
                  setDraft({
                    ...draft,
                    transform: { ...transform, flipX: !transform.flipX },
                  })}
              >
                <FlipHorizontal />
                水平翻转
              </Button>
              <Button
                variant="workbench"
                onClick={() =>
                  setDraft({
                    ...draft,
                    transform: { ...transform, flipY: !transform.flipY },
                  })}
              >
                <FlipVertical />
                垂直翻转
              </Button>
              <Button
                className={cropAspect === 1 ? "active" : ""}
                variant="workbench"
                aria-pressed={cropAspect === 1}
                onClick={() =>
                  setCropAspect(current => current === 1 ? undefined : 1)}
              >
                <CropIcon />
                正方形
              </Button>
            </div>
            <fieldset className="m-0 flex min-w-0 items-center justify-end gap-2.5 border-0 p-0 max-[901px]:w-full max-[901px]:justify-between max-[641px]:grid max-[641px]:grid-cols-[minmax(0,1fr)_44px] max-[641px]:gap-2">
              <legend className="sr-only">生成方式</legend>
              <div className="flex gap-[5px] [&_button]:inline-flex [&_button]:min-h-11 [&_button]:items-center [&_button]:justify-center [&_button]:gap-1.5 [&_button]:rounded-[10px] [&_button]:border [&_button]:border-border [&_button]:bg-muted [&_button]:px-4 [&_button]:font-[750] [&_button]:whitespace-nowrap [&_button]:text-foreground [&_button.active]:border-primary [&_button.active]:bg-accent [&_button.active]:text-accent-foreground [&_button.active]:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&_svg]:w-[17px] max-[641px]:min-w-0 max-[641px]:gap-1 max-[641px]:[&_button]:min-w-0 max-[641px]:[&_button]:flex-1 max-[641px]:[&_button]:px-2">
                <button
                  type="button"
                  aria-pressed={!aiMode}
                  className={!aiMode ? "active" : ""}
                  onClick={() => chooseMode("local")}
                >
                  本地处理
                </button>
                <button
                  type="button"
                  aria-pressed={aiMode}
                  className={aiMode ? "active" : ""}
                  onClick={() => chooseMode("ai")}
                >
                  <Sparkles />
                  AI 处理
                </button>
              </div>
              <Button
                className="flex-none max-[641px]:size-11! max-[641px]:p-0!"
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={`AI 设置，当前使用${aiProvider === "gemini" ? " Gemini" : " Cloudflare"}`}
                onClick={() => setAiSettingsOpen(true)}
              >
                <Settings />
              </Button>
            </fieldset>
          </div>
        </section>
      )}
      {showVariants && (
        <section
          className="rounded-[20px] border border-border bg-card p-5 shadow-[0_12px_36px_rgb(69_43_53/0.06)] max-[641px]:px-2.5 max-[641px]:py-3.5"
          aria-label="AI 图片处理方案"
        >
          <div className="mb-3.5 flex items-end justify-between gap-[18px] [&_h2]:mt-1 [&_h2]:mb-0 [&_h2]:text-xl [&>p]:m-0 [&>p]:flex [&>p]:items-center [&>p]:gap-1.5 [&>p]:text-[0.72rem] [&>p]:text-muted-foreground max-[641px]:flex-col max-[641px]:items-start">
            <div>
              <span className="eyebrow">AI 图片处理</span>
              <h2>
                {busy
                  ? "正在处理图片"
                  : candidates.length
                    ? "打开大图确认效果"
                    : quotaExceeded
                      ? "今日免费额度已用完"
                      : "这次没有生成成功"}
              </h2>
            </div>
            {message && (
              <p role="status">
                {busy && <LoaderCircle className="spin" />}
                {message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            <VariantCard
              candidate={candidates[0]}
              failure={failures[0]}
              busy={busy && !candidates.length}
              onChoose={onChooseCandidate}
              onPreview={setPreviewSrc}
              onQuotaFallback={() => {
                onAiProviderChange("gemini");
                setAiSettingsOpen(true);
              }}
              onRetry={() => runAi(onRetry)}
            />
          </div>
        </section>
      )}
      {!showVariants && message && (
        <p
          className="mt-3.5 flex items-center gap-2 rounded-[11px] border border-[#e7bd6c] bg-[#fff5dc] px-3.5 py-[11px] text-[0.74rem] text-[#674b12]"
          role="status"
        >
          {busy && <LoaderCircle className="spin" />}
          {message}
        </p>
      )}
      <AiSettingsDialog
        geminiKey={geminiKey}
        onClose={() => setAiSettingsOpen(false)}
        onGeminiKeyChange={onGeminiKeyChange}
        onProviderChange={onAiProviderChange}
        onTurnstileToken={(token) => {
          turnstileTime.current = token ? Date.now() : 0;
          setTurnstileToken(token);
        }}
        open={aiSettingsOpen}
        provider={aiProvider}
        turnstileRefresh={turnstileRefresh}
        turnstileToken={turnstileToken}
      />
      <AlertDialog
        open={Boolean(replacementFile)}
        onOpenChange={open => !open && setReplacementFile(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>替换当前图片？</AlertDialogTitle>
            <AlertDialogDescription>
              替换后，当前裁切、旋转、翻转和生成结果都会重置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const file = replacementFile;
                setReplacementFile(null);
                onFile(file || undefined);
              }}
            >
              确认替换
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {previewSrc && (
        <AiPreviewDialog
          src={previewSrc}
          onClose={() => setPreviewSrc("")}
        />
      )}
    </main>
  );
}
