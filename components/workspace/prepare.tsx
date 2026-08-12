/* eslint-disable @next/next/no-img-element -- local Blob/data URL previews cannot use the Next image optimizer */

import {
  ArrowLeft,
  FlipHorizontal,
  FlipVertical,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  RefreshCw,
  RotateCw,
  Settings,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import type {
  AiProvider,
  AiRequest,
  AiStyleCandidate,
  AiStyleFailure,
} from "@/lib/ai";
import type { GenerationSettings, SourceTransform } from "@/lib/types";
import { AiSettingsDialog } from "@/components/ai-settings-dialog";
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
  draft,
  setDraft,
}: {
  draft: Draft;
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
    [frame, setFrame] = useState({ width: 0, height: 0 });
  const crop: PercentCrop = {
    unit: "%",
    ...(transform.crop || { x: 0, y: 0, width: 100, height: 100 }),
  };
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
  return (
    <div
      ref={area}
      className="source-preview"
      role="group"
      aria-label="图片裁切区域"
    >
      {preview && frame.width
        ? (
            <ReactCrop
              className="crop-frame"
              style={frame}
              crop={crop}
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
      <span className="crop-hint">拖动裁切框移动 · 拉动边角调整大小</span>
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
      className="pattern-preview-dialog"
      aria-labelledby="ai-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="pattern-preview-card">
        <div className="pattern-preview-heading">
          <div>
            <h2 id="ai-preview-title">AI 智能图纸预览</h2>
            <p>检查主体、轮廓和配色，不满意可以返回后重新生成</p>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
          >
            返回
          </Button>
        </div>
        <div className="pattern-preview-scroll">
          <img
            src={src}
            alt="AI 智能图纸大图预览"
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
  onRetry,
}: {
  candidate?: AiStyleCandidate;
  failure?: AiStyleFailure;
  busy: boolean;
  onChoose: (candidate: AiStyleCandidate) => void;
  onPreview: (src: string) => void;
  onRetry: () => void;
}) {
  const title = "AI 智能图纸";
  return (
    <article className={`ai-variant-card${candidate ? " ready" : ""}`}>
      {candidate
        ? (
            <button
              type="button"
              className="ai-variant-preview"
              aria-label="预览 AI 智能图纸大图"
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
            <div className="ai-variant-preview">
              {busy ? <LoaderCircle className="spin" /> : <ImageIcon />}
            </div>
          )}
      <div>
        <strong>{title}</strong>
        <small>
          {failure?.message
            || (candidate
              ? "点击图片查看效果，确认后继续生成"
              : "正在整理主体、轮廓和主要颜色")}
        </small>
      </div>
      {candidate
        ? (
            <Button onClick={() => onChoose(candidate)}>使用这个方案</Button>
          )
        : failure
          ? (
              <Button
                variant="outline"
                onClick={onRetry}
              >
                单独重试
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
  onGenerate,
  onModeChange,
  onRegenerate,
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
  onGenerate: (request?: AiRequest) => void;
  onModeChange: (mode: GenerationSettings["mode"]) => void;
  onRegenerate: () => void;
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
    showVariants
      = aiMode && (busy || candidates.length > 0 || failures.length > 0);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false),
    [previewSrc, setPreviewSrc] = useState(""),
    [turnstileToken, setTurnstileToken] = useState(""),
    [turnstileRefresh, setTurnstileRefresh] = useState(0);
  function chooseMode(mode: GenerationSettings["mode"]) {
    setDraft({ ...draft, settings: { ...settings, mode } });
    onModeChange(mode);
  }
  function runAi(action: (request: AiRequest) => void) {
    const credential
      = aiProvider === "gemini" ? geminiKey.trim() : turnstileToken;
    if (!credential) return setAiSettingsOpen(true);
    action({ provider: aiProvider, credential });
    if (aiProvider === "cloudflare") {
      setTurnstileToken("");
      setTurnstileRefresh(value => value + 1);
    }
  }
  return (
    <main className="prepare-page">
      <header className="prepare-header">
        <div className="prepare-nav">
          <Button
            variant="outline"
            onClick={onBack}
          >
            <ArrowLeft />
            返回
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
              <span className="sample-count">{`${samplePosition}/${sampleTotal}`}</span>
            </Button>
          )}
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            showVariants
              ? onRegenerate()
              : aiMode
                ? runAi(onGenerate)
                : onGenerate()}
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
          {busy ? "正在处理" : showVariants ? "重新生成" : "生成图纸"}
        </Button>
      </header>
      {!showVariants && (
        <section className="prepare-stage">
          <CropPreview
            draft={draft}
            setDraft={setDraft}
          />
          <div className="prepare-controls">
            <div
              className="transform-tools"
              aria-label="图片方向"
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
            </div>
            <fieldset className="generation-mode">
              <legend>生成方式</legend>
              <div className="segmented">
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
              {aiMode && (
                <div className="ai-mode-summary">
                  <p>
                    <WandSparkles />
                    AI 会整理主体、轮廓和配色；图片仅用于本次生成。
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`AI 设置，当前使用${aiProvider === "gemini" ? " Gemini" : " Cloudflare"}`}
                    onClick={() => setAiSettingsOpen(true)}
                  >
                    <Settings />
                  </Button>
                </div>
              )}
            </fieldset>
          </div>
        </section>
      )}
      {showVariants && (
        <section
          className="ai-variants"
          aria-label="AI 处理方案"
        >
          <div className="ai-variants-heading">
            <div>
              <span className="eyebrow">AI 智能图纸</span>
              <h2>
                {busy
                  ? "正在为你整理图纸"
                  : candidates.length
                    ? "打开大图确认效果"
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
          <div className="ai-variant-grid">
            <VariantCard
              candidate={candidates[0]}
              failure={failures[0]}
              busy={busy && !candidates.length}
              onChoose={onChooseCandidate}
              onPreview={setPreviewSrc}
              onRetry={() => runAi(onRetry)}
            />
          </div>
        </section>
      )}
      {!showVariants && message && (
        <p
          className="prepare-message"
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
        onTurnstileToken={setTurnstileToken}
        open={aiSettingsOpen}
        provider={aiProvider}
        turnstileRefresh={turnstileRefresh}
        turnstileToken={turnstileToken}
      />
      {previewSrc && (
        <AiPreviewDialog
          src={previewSrc}
          onClose={() => setPreviewSrc("")}
        />
      )}
    </main>
  );
}
