/* eslint-disable @next/next/no-img-element -- generated preview uses an in-memory data URL */

import {
  Brush,
  Circle,
  CircleHelp,
  Columns2,
  Download,
  Eraser,
  Grid2X2,
  Hand,
  LoaderCircle,
  Maximize2,
  Minus,
  PaintBucket,
  Palette,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Redo2,
  Replace,
  Share2,
  Square,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import type {
  BeadColor,
  GenerationSettings,
  Pattern,
  Project,
} from "@/lib/types";
import {
  PatternCanvas,
  PatternGridAxis,
} from "@/components/pattern-canvas";
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BEAD_COLORS, patternContentSize, patternStats } from "@/lib/beads";
import {
  applyCellEdits,
  findCellEdits,
  replaceAllColor,
  replaceConnectedRegion,
  setCell,
} from "@/lib/editor";
import {
  copyPatternPng,
  downloadPatternPng,
  imageToPattern,
  readBlobAsDataUrl,
  removeBackground,
  renderGenerationSource,
  renderPattern,
  sharePatternPng,
} from "@/lib/pattern";
import { saveProject } from "@/lib/projects";
import { DEFAULT_TRANSFORM } from "@/lib/types";

type WorkbenchTool
  = | "hand"
    | "brush"
    | "eraser"
    | "fill"
    | "replace";
type NoticeTone = "success" | "warning";
type HistoryEntry = Pick<
  Project,
  "backgroundRemoved" | "pattern" | "processedSource" | "settings"
> & { hasManualEdits: boolean };

const EDIT_TOOLS = [
  { id: "brush", label: "画笔", shortcut: "2", icon: Brush },
  { id: "eraser", label: "橡皮", shortcut: "3", icon: Eraser },
  { id: "fill", label: "填充", shortcut: "4", icon: PaintBucket },
] as const;

function colorTileStyle(color: BeadColor) {
  return {
    "--swatch": color.hex,
    "--swatch-foreground": color.lab[0] > 58 ? "#182235" : "#fffaf7",
  } as CSSProperties;
}

function groupColors(colors: BeadColor[]) {
  const groups = new Map<string, BeadColor[]>();
  for (const color of colors) {
    const group = groups.get(color.id[0]);
    if (group) group.push(color);
    else groups.set(color.id[0], [color]);
  }
  return [...groups];
}

function ControlTooltip({
  children,
  label,
  side = "bottom",
}: {
  children: ReactElement;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

function OverflowTooltip({ text }: { text: string }) {
  const label = useRef<HTMLElement>(null);
  const [truncated, setTruncated] = useState(false),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const element = label.current;
    if (!element) return;
    const check = () => setTruncated(element.scrollWidth > element.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, truncated]);
  const content = (
    <strong
      ref={label}
      tabIndex={truncated ? 0 : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {text}
    </strong>
  );
  if (!truncated) return content;
  return (
    <Tooltip
      open={open}
      onOpenChange={setOpen}
    >
      <TooltipTrigger
        delay={0}
        closeOnClick={false}
        render={content}
      />
      <TooltipContent side="top">{text}</TooltipContent>
    </Tooltip>
  );
}

function PresetNumberControl({
  disabled = false,
  label,
  max,
  min,
  onChange,
  presets,
  suffix,
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  presets: readonly number[];
  suffix: string;
  value: number;
}) {
  const input = useRef<HTMLInputElement>(null),
    isCustomValue = !presets.includes(value),
    [customizing, setCustomizing] = useState(isCustomValue);

  function commitInput(element: HTMLInputElement) {
    const parsed = element.valueAsNumber;
    if (!Number.isFinite(parsed)) {
      element.value = String(value);
      setCustomizing(isCustomValue);
      return;
    }
    const next = Math.min(max, Math.max(min, Math.round(parsed)));
    element.value = String(next);
    setCustomizing(!presets.includes(next));
    if (next !== value) onChange(next);
  }

  return (
    <fieldset
      className="panel-number-control"
      disabled={disabled}
    >
      <legend>
        {label}
        <small>
          {min}
          –
          {max}
          {suffix}
        </small>
      </legend>
      <div>
        {presets.map(preset => (
          <button
            key={preset}
            type="button"
            aria-pressed={value === preset}
            onClick={() => {
              setCustomizing(false);
              onChange(preset);
            }}
          >
            {preset}
            {suffix}
          </button>
        ))}
        {customizing || isCustomValue
          ? (
              <label data-active="true">
                <input
                  key={value}
                  ref={input}
                  aria-label={`自定义${label}`}
                  type="number"
                  inputMode="numeric"
                  min={min}
                  max={max}
                  defaultValue={value}
                  onBlur={event => commitInput(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span>{suffix}</span>
              </label>
            )
          : (
              <button
                type="button"
                onClick={() => {
                  setCustomizing(true);
                  requestAnimationFrame(() => {
                    input.current?.focus();
                    input.current?.select();
                  });
                }}
              >
                自定义
              </button>
            )}
      </div>
    </fieldset>
  );
}

async function generatedProjectPattern(
  project: Project,
  onProgress: (message: string) => void = () => {},
) {
  const originalUrl = await readBlobAsDataUrl(
    project.generatedSource ?? project.source,
  );
  const transform = project.generatedSource
    ? DEFAULT_TRANSFORM
    : project.transform;
  let processedSource = project.processedSource,
    sourceUrl = originalUrl;
  if (project.settings.background !== "keep") {
    if (processedSource && project.backgroundRemoved)
      sourceUrl = await readBlobAsDataUrl(processedSource);
    else {
      sourceUrl = await removeBackground(
        originalUrl,
        project.settings.background,
        onProgress,
      );
      processedSource = await fetch(sourceUrl).then(response => response.blob());
    }
  }
  return {
    originalUrl,
    pattern: await imageToPattern(
      sourceUrl,
      project.sourceName,
      project.settings,
      transform,
      project.settings.background === "keep" ? undefined : originalUrl,
    ),
    processedSource,
    transform,
  };
}

function PatternComparisonDialog({
  original,
  current,
  name,
  onClose,
}: {
  original: string;
  current: string;
  name: string;
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
      className="pattern-preview-dialog pattern-comparison-dialog max-[641px]:h-[min(78dvh,680px)]!"
      aria-labelledby="pattern-comparison-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="pattern-preview-card">
        <div className="pattern-preview-heading">
          <div>
            <h2 id="pattern-comparison-title">对比原图</h2>
            <p>{name}</p>
          </div>
          <Button
            className="pattern-preview-close"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭对比"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="pattern-comparison-grid max-[641px]:gap-1.5! max-[641px]:p-2!">
          <figure>
            <figcaption className="max-[641px]:px-2! max-[641px]:py-2! max-[641px]:text-center!">原图</figcaption>
            <div className="max-[641px]:p-1.5!">
              <img
                className="max-[641px]:max-h-[calc(78dvh-122px)]!"
                src={original}
                alt={`${name}原图`}
              />
            </div>
          </figure>
          <figure>
            <figcaption className="max-[641px]:px-2! max-[641px]:py-2! max-[641px]:text-center!">当前图纸</figcaption>
            <div className="max-[641px]:p-1.5!">
              <img
                className="max-[641px]:max-h-[calc(78dvh-122px)]!"
                src={current}
                alt={`${name}当前图纸`}
              />
            </div>
          </figure>
        </div>
      </div>
    </dialog>
  );
}

const PROCESSING_MODE_GUIDES = [
  {
    id: "edge",
    title: "轮廓增强",
    description: "平滑零散杂色，同时保留眼睛、鳍线和外轮廓。",
    suitable: "适合人物、动漫和有清晰轮廓的图片",
  },
  {
    id: "average",
    title: "自然平均",
    description: "保留原图的渐变、光影和柔和过渡，画面更接近原图。",
    suitable: "适合照片、写实插画和有丰富明暗的图片",
  },
  {
    id: "dominant",
    title: "纯色块",
    description: "每格选择主要颜色，减少细碎变化，色块更整齐。",
    suitable: "适合图标、像素画和扁平风格图片",
  },
] as const;

function ProcessingModeGuideDialog({ onClose }: { onClose: () => void }) {
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
      className="pattern-preview-dialog processing-mode-guide-dialog"
      aria-labelledby="processing-mode-guide-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="pattern-preview-card max-h-[88dvh]">
        <div className="pattern-preview-heading">
          <div>
            <h2 id="processing-mode-guide-title">三种处理模式有什么不同？</h2>
            <p>同一张图片、相同格数和颜色数量下的效果对比</p>
          </div>
          <Button
            className="pattern-preview-close"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭处理模式说明"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="grid min-h-0 grid-cols-4 items-start gap-3 overflow-auto overscroll-contain bg-muted p-4 max-[720px]:grid-flow-col max-[720px]:grid-cols-none max-[720px]:auto-cols-[min(76vw,280px)] max-[720px]:snap-x max-[720px]:snap-mandatory max-[720px]:p-3">
          <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card max-[720px]:snap-start">
            <img
              className="aspect-square w-full border-b border-border object-cover"
              src="/help/processing-mode-source.png"
              alt="三种处理模式使用的原图"
            />
            <figcaption className="grid gap-1.5 p-3">
              <strong className="text-sm">原图</strong>
              <span className="text-xs leading-relaxed text-muted-foreground">
                单主体卡通图，包含渐变、宽色带和少量高对比细节。
              </span>
              <small className="mt-1 text-[0.68rem] leading-relaxed font-semibold text-foreground">
                三种模式均使用这张图和相同设置
              </small>
            </figcaption>
          </figure>
          {PROCESSING_MODE_GUIDES.map(item => (
            <figure
              key={item.id}
              className="m-0 overflow-hidden rounded-xl border border-border bg-card max-[720px]:snap-start"
            >
              <img
                className="aspect-square w-full border-b border-border object-cover [image-rendering:pixelated]"
                src={`/help/processing-mode-${item.id}.png`}
                alt={`${item.title}处理效果示例`}
              />
              <figcaption className="grid gap-1.5 p-3">
                <strong className="text-sm">{item.title}</strong>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
                <small className="mt-1 text-[0.68rem] leading-relaxed font-semibold text-foreground">
                  {item.suitable}
                </small>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </dialog>
  );
}

function ToolColorProperties({
  selected,
  colors,
  disabled,
  onSelect,
}: {
  selected: string;
  colors: BeadColor[];
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <aside
      className="workbench-tool-properties max-[980px]:top-[calc(var(--workbench-control-size)+20px)]! max-[980px]:h-[calc(var(--workbench-control-size)+8px)]! max-[980px]:p-[3px]! min-[980px]:top-16! min-[980px]:right-auto! min-[980px]:bottom-auto! min-[980px]:left-3! min-[980px]:grid! min-[980px]:h-auto! min-[980px]:w-[170px]! min-[980px]:gap-2! min-[980px]:overflow-visible! min-[980px]:p-2.5!"
      aria-label="编辑颜色"
    >
      <div className="workbench-tool-properties-heading min-[980px]:justify-between! min-[980px]:p-0!">
        <span>颜色</span>
      </div>
      <div className="workbench-tool-colors min-[980px]:flex-wrap! min-[980px]:overflow-visible!">
        {colors.map(color => (
          <button
            type="button"
            key={color.id}
            className="workbench-tool-color max-[980px]:size-[var(--workbench-control-size)]! max-[980px]:min-h-[var(--workbench-control-size)]! max-[980px]:min-w-[var(--workbench-control-size)]!"
            style={colorTileStyle(color)}
            aria-label={`选择颜色 ${color.id}`}
            aria-pressed={selected === color.id}
            disabled={disabled}
            onClick={() => onSelect(color.id)}
          >
            {color.id}
          </button>
        ))}
      </div>
    </aside>
  );
}

export function Result({
  project,
  onChange,
  onDelete,
  onPendingChange,
}: {
  project: Project;
  onChange: (project: Project) => void;
  onDelete: () => Promise<void>;
  onPendingChange: (pending: boolean) => void;
}) {
  const isBlankCard = !project.pattern.contentBounds;
  const [pattern, setPattern] = useState(project.pattern);
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [tool, setTool] = useState<WorkbenchTool>("hand");
  const [selected, setSelected] = useState(
    patternStats(project.pattern)[0]?.color.id || "H7",
  );
  const [quickColorIds, setQuickColorIds] = useState(() =>
    patternStats(project.pattern)
      .map(({ color }) => color.id),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]),
    [future, setFuture] = useState<HistoryEntry[]>([]);
  const [replaceSource, setReplaceSource] = useState<{
    id: string;
    index: number;
  } | null>(null);
  const [grid, setGrid] = useState(true),
    [codes, setCodes] = useState(false),
    [shape, setShape] = useState<"square" | "circle">("square");
  const [scale, setScale] = useState(1),
    [spacePanning, setSpacePanning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [draftSettings, setDraftSettings] = useState<GenerationSettings>({
    ...project.settings,
    excludedColorIds: [...project.settings.excludedColorIds],
  });
  const [preview, setPreview] = useState<string | null>(null),
    [notice, setNoticeText] = useState("已保存"),
    [noticeTone, setNoticeTone] = useState<NoticeTone>("success");
  const [comparison, setComparison] = useState<{
    original: string;
    current: string;
  } | null>(null);
  const [saving, setSaving] = useState(false),
    [adjusting, setAdjusting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false),
    [pendingLongestEdge, setPendingLongestEdge] = useState<number | null>(null),
    [deleting, setDeleting] = useState(false),
    [processingGuideOpen, setProcessingGuideOpen] = useState(false);
  const canvasRef = useRef<HTMLElement>(null),
    fitTarget = useRef<HTMLDivElement>(null),
    transformRef = useRef<ReactZoomPanPinchRef>(null);
  const patternRef = useRef(pattern),
    projectRef = useRef(project),
    strokeStart = useRef<Pattern | null>(null),
    strokeChanged = useRef(0);
  const adjustmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    adjustingRef = useRef(false),
    draftSettingsRef = useRef(draftSettings);
  const pendingCallback = useRef(onPendingChange);
  const keyboardActions = useRef<{
    chooseTool: (tool: WorkbenchTool) => void;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
  } | null>(null);

  const contentSize = useMemo(() => patternContentSize(pattern), [pattern]);
  const physicalSize = contentSize
    ? [contentSize.width, contentSize.height]
        .sort((a, b) => b - a)
        .map(size => `${size / 2} cm`)
        .join(" × ")
    : null;
  const quickColors = quickColorIds.flatMap(
    id => BEAD_COLORS.find(color => color.id === id) || [],
  );
  const busy = saving || adjusting || deleting;
  const isEditing = tool !== "hand";
  const showToolColors = ["brush", "eraser", "fill", "replace"].includes(tool);
  const settingsPending
    = JSON.stringify(draftSettings) !== JSON.stringify(project.settings);
  function setNotice(message: string, tone: NoticeTone = "success") {
    setNoticeText(message);
    setNoticeTone(tone);
  }

  useEffect(() => {
    pendingCallback.current = onPendingChange;
  }, [onPendingChange]);
  useEffect(() => {
    pendingCallback.current(settingsPending);
  }, [settingsPending]);
  useEffect(() => () => pendingCallback.current(false), []);
  useEffect(
    () => () => {
      if (adjustmentTimer.current) clearTimeout(adjustmentTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!projectRef.current.pattern.contentBounds) return;
    let cancelled = false;
    void generatedProjectPattern(projectRef.current)
      .then(({ pattern: generated }) => {
        if (!cancelled)
          setHasManualEdits(
            findCellEdits(patternRef.current.cells, generated.cells).length > 0,
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [project.id]);
  useEffect(() => {
    if (!settingsPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [settingsPending]);
  useEffect(() => {
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (fitTarget.current)
          transformRef.current?.zoomToElement(fitTarget.current, undefined, 0);
      });
    };
    const observer = new ResizeObserver(fit);
    if (canvasRef.current) observer.observe(canvasRef.current);
    fit();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pattern.id]);

  function chooseTool(next: WorkbenchTool) {
    if (busy) return;
    setReplaceSource(null);
    setTool(next);
    setNotice(
      next === "hand"
        ? "拖动画布查看"
        : next === "eraser"
          ? "橡皮已启用"
          : `当前颜色 ${selected}`,
    );
  }

  function beginStroke() {
    if (!isEditing || busy) return;
    strokeStart.current = patternRef.current;
    strokeChanged.current = 0;
  }

  function updatePattern(next: Pattern) {
    patternRef.current = next;
    setPattern(next);
  }

  function historyEntry(
    value: Project,
    valuePattern = value.pattern,
    valueHasManualEdits = hasManualEdits,
  ) {
    return {
      backgroundRemoved: value.backgroundRemoved,
      hasManualEdits: valueHasManualEdits,
      pattern: valuePattern,
      processedSource: value.processedSource,
      settings: value.settings,
    } satisfies HistoryEntry;
  }

  function syncHistoryEntry(entry: HistoryEntry) {
    updatePattern(entry.pattern);
    setHasManualEdits(entry.hasManualEdits);
    const settings = {
      ...entry.settings,
      excludedColorIds: [...entry.settings.excludedColorIds],
    };
    draftSettingsRef.current = settings;
    setDraftSettings(settings);
  }

  function editCell(index: number) {
    if (!isEditing || busy) return;
    const current = patternRef.current;
    if (tool === "replace") {
      const source = current.cells[index];
      if (!source) return setNotice("请选择一个有颜色的格子");
      setReplaceSource({ id: source, index });
      return setNotice(`已选 ${source}，现在选择替换色`);
    }
    const result
      = tool === "brush"
        ? setCell(current.cells, index, selected)
        : tool === "eraser"
          ? setCell(current.cells, index, null)
          : replaceConnectedRegion(
              current.cells,
              current.width,
              index,
              selected,
            );
    if (!result.changed) return setNotice("没有需要修改的格子");
    strokeChanged.current += result.changed;
    updatePattern({ ...current, cells: result.cells });
    setNotice(
      tool === "fill"
        ? `已填充 ${result.changed} 格`
        : tool === "eraser"
          ? "已改为空白格"
          : `正在使用 ${selected}`,
    );
  }

  async function endStroke() {
    const before = strokeStart.current,
      after = patternRef.current,
      changed = strokeChanged.current;
    strokeStart.current = null;
    strokeChanged.current = 0;
    if (!before || !changed || before === after) return;
    setSaving(true);
    setNotice("正在保存…");
    const next = {
      ...projectRef.current,
      pattern: after,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProject(next);
      projectRef.current = next;
      onChange(next);
      setHistory(items => [
        ...items.slice(-29),
        historyEntry(projectRef.current, before),
      ]);
      setFuture([]);
      setHasManualEdits(true);
      setNotice(`已保存这一笔 · ${changed} 格`);
    }
    catch (error) {
      updatePattern(before);
      setNotice(
        error instanceof Error ? error.message : "保存失败，刚才的修改已撤回。",
      );
    }
    finally {
      setSaving(false);
    }
  }

  function cancelStroke() {
    if (strokeStart.current) updatePattern(strokeStart.current);
    strokeStart.current = null;
    strokeChanged.current = 0;
    setNotice("已切换为双指移动，未保存刚才的一笔");
  }

  async function replaceColor(target: string) {
    if (!replaceSource || busy) return;
    const before = patternRef.current,
      result = replaceAllColor(before.cells, replaceSource.id, target);
    setReplaceSource(null);
    if (!result.changed) return setNotice("没有需要替换的格子");
    setSaving(true);
    setNotice("正在保存整色替换…");
    const nextPattern = { ...before, cells: result.cells };
    const next = {
      ...projectRef.current,
      pattern: nextPattern,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProject(next);
      projectRef.current = next;
      updatePattern(nextPattern);
      onChange(next);
      setHistory(items => [
        ...items.slice(-29),
        historyEntry(projectRef.current, before),
      ]);
      setFuture([]);
      setHasManualEdits(true);
      setSelected(target);
      setNotice(`已替换 ${result.changed} 格`);
    }
    catch (error) {
      setNotice(
        error instanceof Error ? error.message : "整色替换失败，原图纸已保留。",
      );
    }
    finally {
      setSaving(false);
    }
  }

  function chooseColor(id: string) {
    if (replaceSource) return void replaceColor(id);
    setSelected(id);
    setNotice(`当前颜色 ${id}`);
  }

  function addQuickColor(id: string) {
    setQuickColorIds(ids => (ids.includes(id) ? ids : [...ids, id]));
    setNotice(`${id} 已加入快捷颜色`);
  }

  async function undo() {
    const previous = history.at(-1),
      current = historyEntry(projectRef.current, patternRef.current);
    if (!previous || busy) return;
    setSaving(true);
    const next = {
      ...projectRef.current,
      ...previous,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProject(next);
      projectRef.current = next;
      syncHistoryEntry(previous);
      onChange(next);
      setHistory(items => items.slice(0, -1));
      setFuture(items => [...items.slice(-29), current]);
      setNotice("已撤销上一笔");
    }
    catch (error) {
      setNotice(
        error instanceof Error ? error.message : "撤销失败，图纸没有改变。",
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function redo() {
    const nextEntry = future.at(-1),
      current = historyEntry(projectRef.current, patternRef.current);
    if (!nextEntry || busy) return;
    setSaving(true);
    const next = {
      ...projectRef.current,
      ...nextEntry,
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProject(next);
      projectRef.current = next;
      syncHistoryEntry(nextEntry);
      onChange(next);
      setHistory(items => [...items.slice(-29), current]);
      setFuture(items => items.slice(0, -1));
      setNotice("已重做上一笔");
    }
    catch (error) {
      setNotice(
        error instanceof Error ? error.message : "重做失败，图纸没有改变。",
      );
    }
    finally {
      setSaving(false);
    }
  }

  async function applyAdjustments(
    requestedSettings: GenerationSettings,
    discardManualEdits = false,
  ) {
    if (adjustingRef.current || saving) return;
    if (
      JSON.stringify(requestedSettings)
      === JSON.stringify(projectRef.current.settings)
    )
      return;
    adjustingRef.current = true;
    setAdjusting(true);
    setNotice("正在保存调整…");
    const current = projectRef.current;
    let applied = false;
    try {
      const {
        originalUrl,
        pattern: generatedCurrent,
        processedSource: savedProcessedSource,
        transform,
      } = await generatedProjectPattern(current, setNotice);
      let processedSource = savedProcessedSource;
      const edits = findCellEdits(
        patternRef.current.cells,
        generatedCurrent.cells,
      );
      const settings = requestedSettings;
      const backgroundRemoved = settings.background !== "keep";
      let sourceUrl = originalUrl;
      if (backgroundRemoved) {
        if (
          processedSource
          && current.backgroundRemoved
          && current.settings.background === settings.background
        )
          sourceUrl = await readBlobAsDataUrl(processedSource);
        else {
          sourceUrl = await removeBackground(
            originalUrl,
            settings.background,
            setNotice,
          );
          processedSource = await fetch(sourceUrl).then(response =>
            response.blob(),
          );
        }
      }
      const generatedPattern = await imageToPattern(
        sourceUrl,
        current.sourceName,
        settings,
        transform,
        backgroundRemoved ? originalUrl : undefined,
      );
      const nextPattern = edits.length && !discardManualEdits
        ? {
            ...generatedPattern,
            cells: applyCellEdits(
              generatedPattern.cells,
              edits,
              generatedPattern.width,
              current.settings.mirror !== settings.mirror,
            ),
          }
        : generatedPattern;
      const next = {
        ...current,
        name: nextPattern.name,
        pattern: nextPattern,
        settings,
        processedSource,
        backgroundRemoved,
        updatedAt: new Date().toISOString(),
      };
      await saveProject(next);
      projectRef.current = next;
      updatePattern(nextPattern);
      onChange(next);
      setHistory(items => [
        ...items.slice(-29),
        historyEntry(current),
      ]);
      setFuture([]);
      setHasManualEdits(edits.length > 0 && !discardManualEdits);
      setReplaceSource(null);
      setTool("hand");
      setNotice(
        discardManualEdits && edits.length
          ? "格数已更新，手工编辑已舍弃"
          : "调整已保存",
      );
      applied = true;
    }
    catch (error) {
      const savedSettings = {
        ...current.settings,
        excludedColorIds: [...current.settings.excludedColorIds],
      };
      draftSettingsRef.current = savedSettings;
      setDraftSettings(savedSettings);
      setNotice(
        error instanceof Error ? error.message : "调整失败，原图纸已保留。",
        "warning",
      );
    }
    finally {
      adjustingRef.current = false;
      setAdjusting(false);
      if (
        applied && JSON.stringify(draftSettingsRef.current)
        !== JSON.stringify(projectRef.current.settings)
      )
        scheduleAdjustments(draftSettingsRef.current);
    }
  }

  function scheduleAdjustments(next: GenerationSettings) {
    draftSettingsRef.current = next;
    setDraftSettings(next);
    if (adjustmentTimer.current) clearTimeout(adjustmentTimer.current);
    adjustmentTimer.current = setTimeout(
      () => void applyAdjustments(draftSettingsRef.current),
      500,
    );
  }

  function requestLongestEdge(longestEdge: number) {
    if (
      hasManualEdits
      && longestEdge !== projectRef.current.settings.longestEdge
    ) {
      setPendingLongestEdge(longestEdge);
      return;
    }
    scheduleAdjustments({
      ...draftSettingsRef.current,
      longestEdge,
    });
  }

  function confirmLongestEdge() {
    if (pendingLongestEdge === null) return;
    const next = {
      ...draftSettingsRef.current,
      longestEdge: pendingLongestEdge,
    };
    setPendingLongestEdge(null);
    draftSettingsRef.current = next;
    setDraftSettings(next);
    void applyAdjustments(next, true);
  }

  async function confirmDelete() {
    if (adjustmentTimer.current) clearTimeout(adjustmentTimer.current);
    setDeleting(true);
    try {
      await onDelete();
    }
    catch (error) {
      setDeleteOpen(false);
      setNotice(
        error instanceof Error ? error.message : "删除失败，图纸仍然保留。",
      );
    }
    finally {
      setDeleting(false);
    }
  }

  async function openComparison() {
    try {
      const source = projectRef.current.generatedSource;
      setComparison({
        original: source
          ? await readBlobAsDataUrl(source)
          : await renderGenerationSource(
              await readBlobAsDataUrl(projectRef.current.source),
              projectRef.current.transform,
            ),
        current: renderPattern(patternRef.current, false).toDataURL("image/png"),
      });
    }
    catch (error) {
      setNotice(
        error instanceof Error ? error.message : "原图对比无法打开。",
      );
    }
  }

  async function copy() {
    try {
      await copyPatternPng(patternRef.current);
      setNotice("图纸已复制到剪贴板");
      return true;
    }
    catch (error) {
      setNotice(
        error instanceof Error ? error.message : "复制失败，请改用下载。",
      );
      return false;
    }
  }

  async function share() {
    try {
      const result = await sharePatternPng(patternRef.current);
      setNotice(
        result === "shared"
          ? "图纸已交给系统分享"
          : "当前设备不支持分享，已下载图纸",
      );
    }
    catch (error) {
      setNotice(
        error instanceof DOMException && error.name === "AbortError"
          ? "已取消分享"
          : error instanceof Error
            ? error.message
            : "分享失败，请改用下载。",
      );
    }
  }

  useEffect(() => {
    keyboardActions.current = { chooseTool, undo, redo };
  });

  useEffect(() => {
    function inputActive(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      return (
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        || target.isContentEditable
      );
    }
    function keyDown(event: KeyboardEvent) {
      if (inputActive(event) || preview) return;
      if (event.key === " ") {
        event.preventDefault();
        setSpacePanning(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) void keyboardActions.current?.redo();
        else void keyboardActions.current?.undo();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const shortcut: Record<string, WorkbenchTool> = {
        1: "hand",
        2: "brush",
        3: "eraser",
        4: "fill",
        5: "replace",
        b: "brush",
        e: "eraser",
        f: "fill",
        h: "hand",
        r: "replace",
      };
      const key = event.key.toLowerCase();
      if (shortcut[key]) {
        event.preventDefault();
        keyboardActions.current?.chooseTool(shortcut[key]);
      }
      else if (event.key === "Escape")
        keyboardActions.current?.chooseTool("hand");
      else if (["+", "="].includes(event.key))
        transformRef.current?.zoomIn(0.25, 0);
      else if (event.key === "-") transformRef.current?.zoomOut(0.25, 0);
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpacePanning(false);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, [preview]);

  return (
    <main
      className={`pattern-workbench max-[769px]:[--workbench-control-size:clamp(34px,8.15vw,40px)]! max-[769px]:[--panel-control-size:44px]! min-[642px]:[&.has-panel]:grid-cols-[minmax(0,1fr)_var(--workbench-panel-width)]! max-[641px]:h-[calc(100dvh-56px)]! max-[641px]:[--workbench-control-size:32px]! max-[641px]:[--panel-control-size:40px]! max-[641px]:[&.has-panel]:grid-rows-[minmax(300px,50dvh)_minmax(0,1fr)]!${panelOpen ? " has-panel" : ""}`}
    >
      <section
        ref={canvasRef}
        className={`workbench-canvas${showToolColors ? " has-tool-properties" : ""}`}
        aria-label="拼豆图纸工作台"
        data-tool={spacePanning ? "hand" : tool}
      >
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.1}
          maxScale={5}
          centerOnInit
          centerZoomedOut
          limitToBounds
          smooth={false}
          wheel={{ wheelDisabled: true }}
          trackPadPanning={{ disabled: false, velocityDisabled: true }}
          panning={{
            disabled: false,
            excluded: isEditing && !spacePanning ? ["pattern-canvas"] : [],
            velocityDisabled: true,
            allowMiddleClickPan: true,
          }}
          pinch={{ disabled: false, allowPanning: true }}
          doubleClick={{ disabled: isEditing, mode: "reset" }}
          zoomAnimation={{ disabled: true }}
          onTransform={(_, state) => setScale(state.scale)}
        >
          <TransformComponent
            wrapperClass="workbench-transform-wrapper max-[980px]:inset-[calc(var(--workbench-control-size)*2+32px)_8px_calc(var(--workbench-control-size)+20px)]! max-[980px]:[.has-tool-properties_&]:inset-[calc(var(--workbench-control-size)*3+44px)_8px_calc(var(--workbench-control-size)+20px)]! max-[641px]:inset-[calc(var(--workbench-control-size)*2+32px)_8px_8px]! max-[641px]:[.has-tool-properties_&]:inset-[calc(var(--workbench-control-size)*3+44px)_8px_8px]! min-[980px]:inset-[58px_16px_54px]!"
            contentClass="workbench-transform-content"
          >
            <div
              ref={fitTarget}
              className="workbench-board max-[641px]:w-[min(84vmin,760px)]! max-[641px]:p-2!"
            >
              <div className="workbench-board-frame">
                <PatternGridAxis
                  side="top"
                  size={pattern.width}
                />
                <PatternGridAxis
                  side="left"
                  size={pattern.height}
                />
                <div className="pattern-grid-surface">
                  <PatternCanvas
                    pattern={pattern}
                    showGrid={grid}
                    showCodes={codes}
                    shape={shape}
                    editable={isEditing && !spacePanning && !busy}
                    continuous={["brush", "eraser"].includes(tool)}
                    highlightIndex={replaceSource?.index}
                    showCellTooltip={isEditing && !spacePanning && !busy}
                    onStrokeStart={beginStroke}
                    onPaint={editCell}
                    onStrokeEnd={() => void endStroke()}
                    onStrokeCancel={cancelStroke}
                  />
                </div>
                <PatternGridAxis
                  side="right"
                  size={pattern.height}
                />
                <PatternGridAxis
                  side="bottom"
                  size={pattern.width}
                />
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>

        <div
          className="workbench-status max-[980px]:top-[calc(var(--workbench-control-size)+20px)]! max-[980px]:max-w-[calc(100%-16px)]! max-[980px]:[.has-tool-properties_&]:top-[calc(var(--workbench-control-size)*2+32px)]! max-[641px]:px-2! min-[980px]:top-3! min-[980px]:left-3! min-[980px]:max-w-[220px]!"
          data-tone={busy ? "busy" : noticeTone}
          role="status"
          aria-live="polite"
        >
          {busy
            ? (
                <LoaderCircle className="spin" />
              )
            : noticeTone === "warning"
              ? <TriangleAlert className="status-warning-icon" />
              : (
                  <span className="status-dot" />
                )}
          <OverflowTooltip text={notice} />
        </div>

        <div
          className="workbench-toolbar @max-[1121px]/workbench-canvas:[&_kbd]:hidden! max-[980px]:right-auto! max-[980px]:w-max! max-[980px]:max-w-[calc(100%-var(--workbench-control-size)*3-34px)]! max-[980px]:gap-0.5! max-[980px]:rounded-[10px]! max-[980px]:p-[3px]! min-[980px]:right-auto! min-[980px]:left-1/2! min-[980px]:w-max! min-[980px]:max-w-[calc(100%-430px)]! min-[980px]:-translate-x-1/2!"
          role="toolbar"
          aria-label="编辑工具"
        >
          <ControlTooltip label="抓手（1、H、Esc 或按住空格）">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={tool === "hand" || spacePanning}
              aria-label="抓手"
              onClick={() => chooseTool("hand")}
            >
              <Hand />
              <span>抓手</span>
              <kbd>1</kbd>
            </Button>
          </ControlTooltip>
          <i />
          {EDIT_TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
            <ControlTooltip
              key={id}
              label={`${label}（${shortcut}）`}
            >
              <Button
                variant="outline"
                size="sm"
                aria-pressed={tool === id}
                aria-label={label}
                disabled={busy}
                onClick={() => chooseTool(id)}
              >
                <Icon />
                <span>{label}</span>
                <kbd>{shortcut}</kbd>
              </Button>
            </ControlTooltip>
          ))}
          <ControlTooltip label="整色替换（5 或 R）">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={tool === "replace"}
              aria-label="整色替换"
              disabled={busy}
              onClick={() => chooseTool("replace")}
            >
              <Replace />
              <span>整色替换</span>
              <kbd>5</kbd>
            </Button>
          </ControlTooltip>
        </div>

        {showToolColors && (
          <ToolColorProperties
            selected={selected}
            colors={quickColors}
            disabled={busy}
            onSelect={chooseColor}
          />
        )}

        <div
          className="workbench-actions max-[980px]:top-2! max-[980px]:gap-0.5! max-[980px]:rounded-[10px]! max-[980px]:p-[3px]! min-[980px]:top-3! min-[980px]:right-3! max-[641px]:max-w-[calc(50%-12px)]!"
          aria-label="图纸操作"
        >
          <ControlTooltip label="分享图纸">
            <Button
              variant="outline"
              size="sm"
              aria-label="分享图纸"
              onClick={() => void share()}
            >
              <Share2 />
              <span>分享</span>
            </Button>
          </ControlTooltip>
          <ControlTooltip label="预览并下载图纸">
            <Button
              variant="outline"
              size="sm"
              aria-label="预览并下载图纸"
              onClick={() =>
                setPreview(
                  renderPattern(patternRef.current).toDataURL("image/png"),
                )}
            >
              <Download />
              <span>下载</span>
            </Button>
          </ControlTooltip>
          <ControlTooltip label={panelOpen ? "收起设置" : "展开设置"}>
            <Button
              variant="outline"
              size="sm"
              aria-label={panelOpen ? "收起设置" : "展开设置"}
              aria-expanded={panelOpen}
              aria-controls="workbench-panel"
              onClick={() => setPanelOpen(value => !value)}
            >
              {panelOpen
                ? (
                    <>
                      <PanelBottomClose className="min-[642px]:hidden!" />
                      <PanelRightClose className="max-[641px]:hidden!" />
                    </>
                  )
                : (
                    <>
                      <PanelBottomOpen className="min-[642px]:hidden!" />
                      <PanelRightOpen className="max-[641px]:hidden!" />
                    </>
                  )}
              <span>{panelOpen ? "收起设置" : "展开设置"}</span>
            </Button>
          </ControlTooltip>
        </div>

        <div
          className="workbench-lower-left @max-[841px]/workbench-canvas:[&>button]:w-[var(--workbench-control-size)]! @max-[841px]/workbench-canvas:[&>button]:px-0! @max-[841px]/workbench-canvas:[&>button>span]:hidden! max-[980px]:gap-0.5! max-[980px]:rounded-[10px]! max-[980px]:p-[3px]! max-[641px]:bottom-3! min-[980px]:right-auto! min-[980px]:bottom-3! min-[980px]:left-3!"
          aria-label="画布与历史控制"
        >
          <ControlTooltip
            label="缩小画布"
            side="top"
          >
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="缩小画布"
              onClick={() => transformRef.current?.zoomOut(0.25, 0)}
            >
              <Minus />
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label="恢复 100% 缩放"
            side="top"
          >
            <Button
              variant="outline"
              size="sm"
              className="min-w-15! max-[641px]:min-w-13!"
              aria-label="恢复 100% 缩放"
              onClick={() => transformRef.current?.resetTransform(200)}
            >
              {Math.round(scale * 100)}
              %
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label="放大画布"
            side="top"
          >
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="放大画布"
              onClick={() => transformRef.current?.zoomIn(0.25, 0)}
            >
              <Plus />
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label="显示完整豆板"
            side="top"
          >
            <Button
              variant="outline"
              size="sm"
              aria-label="显示完整豆板"
              onClick={() =>
                fitTarget.current
                && transformRef.current?.zoomToElement(
                  fitTarget.current,
                  undefined,
                  200,
                )}
            >
              <Maximize2 />
              <span>完整豆板</span>
            </Button>
          </ControlTooltip>
          <i />
          <ControlTooltip
            label="撤销（⌘Z）"
            side="top"
          >
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!history.length || busy}
              aria-label="撤销"
              onClick={() => void undo()}
            >
              <Undo2 />
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label="重做（⇧⌘Z）"
            side="top"
          >
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!future.length || busy}
              aria-label="重做"
              onClick={() => void redo()}
            >
              <Redo2 />
            </Button>
          </ControlTooltip>
        </div>

        <div
          className="workbench-lower-right @max-[841px]/workbench-canvas:[&>button]:w-[var(--workbench-control-size)]! @max-[841px]/workbench-canvas:[&>button]:px-0! @max-[841px]/workbench-canvas:[&>button>span]:hidden! max-[980px]:gap-0.5! max-[980px]:rounded-[10px]! max-[980px]:p-[3px]! max-[641px]:bottom-3! min-[980px]:right-3! min-[980px]:bottom-3!"
          aria-label="图纸显示方式"
        >
          <ControlTooltip
            label="显示网格"
            side="top"
          >
            <Button
              variant="outline"
              size="sm"
              aria-pressed={grid}
              aria-label="显示网格"
              onClick={() => setGrid(value => !value)}
            >
              <Grid2X2 />
              <span>网格</span>
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label="显示色号"
            side="top"
          >
            <Button
              variant="outline"
              size="sm"
              aria-pressed={codes}
              aria-label="显示色号"
              onClick={() =>
                setCodes((value) => {
                  if (!value) setGrid(true);
                  return !value;
                })}
            >
              <Palette />
              <span>色号</span>
            </Button>
          </ControlTooltip>
          <ControlTooltip
            label={shape === "square" ? "切换为圆豆" : "切换为方格"}
            side="top"
          >
            <Button
              variant="outline"
              size="sm"
              aria-pressed={shape === "circle"}
              aria-label={shape === "square" ? "切换为圆豆" : "切换为方格"}
              onClick={() =>
                setShape(value => (value === "square" ? "circle" : "square"))}
            >
              {shape === "square" ? <Square /> : <Circle />}
              <span>{shape === "square" ? "方格" : "圆豆"}</span>
            </Button>
          </ControlTooltip>
        </div>
      </section>

      {panelOpen && (
        <>
          <aside
            id="workbench-panel"
            className="workbench-panel min-[642px]:static! min-[642px]:z-auto! min-[642px]:h-auto! min-[642px]:w-[var(--workbench-panel-width)]! min-[642px]:border-t-0! min-[642px]:border-l! min-[642px]:border-l-border! min-[642px]:shadow-[-12px_0_30px_rgb(65_37_49/0.07)]! max-[641px]:static! max-[641px]:z-auto! max-[641px]:h-auto! max-[641px]:min-h-0! max-[641px]:max-h-none! max-[641px]:overflow-hidden! max-[641px]:shadow-none!"
            role="dialog"
            aria-label="图纸设置"
          >
            <header className="workbench-panel-header max-[641px]:min-h-12! max-[641px]:py-0.5!">
              <strong>设置</strong>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="关闭设置"
                onClick={() => setPanelOpen(false)}
              >
                <X />
              </Button>
            </header>
            <div className="workbench-panel-scroll">
              <section
                className="panel-section max-[641px]:gap-[11px]! max-[641px]:px-3! max-[641px]:pt-2.5! max-[641px]:pb-[calc(14px+env(safe-area-inset-bottom))]!"
                aria-label="调整图纸"
              >
                <div className="panel-size-row">
                  <strong>实际图案尺寸</strong>
                  <output>{physicalSize ? `约 ${physicalSize}` : "暂无图案内容"}</output>
                </div>
                {!isBlankCard && (
                  <>
                    <div className="panel-switches">
                      <div className="panel-switch-row">
                        <strong>去除纯色背景</strong>
                        <Switch
                          aria-label="去除纯色背景"
                          checked={draftSettings.background === "plain"}
                          onCheckedChange={checked =>
                            scheduleAdjustments({
                              ...draftSettingsRef.current,
                              background: checked ? "plain" : "keep",
                            })}
                        />
                      </div>
                      <div className="panel-switch-row">
                        <strong>水平镜像</strong>
                        <Switch
                          aria-label="水平镜像图纸"
                          checked={draftSettings.mirror}
                          onCheckedChange={checked =>
                            scheduleAdjustments({
                              ...draftSettingsRef.current,
                              mirror: checked,
                            })}
                        />
                      </div>
                    </div>
                    <PresetNumberControl
                      key={`${draftSettings.longestEdge}-${pendingLongestEdge ?? "idle"}`}
                      label="豆板格数"
                      min={16}
                      max={192}
                      suffix="格"
                      presets={[29, 52, 78, 104]}
                      value={draftSettings.longestEdge}
                      onChange={requestLongestEdge}
                    />
                    <PresetNumberControl
                      label="颜色上限"
                      min={1}
                      max={291}
                      suffix="色"
                      presets={[8, 12, 16, 20]}
                      value={draftSettings.maxColors}
                      onChange={maxColors =>
                        scheduleAdjustments({
                          ...draftSettingsRef.current,
                          maxColors,
                        })}
                    />
                    <label className="panel-range max-[641px]:[&_input]:h-[34px]! max-[641px]:[&_input]:min-h-[34px]!">
                      <span>
                        颜色合并程度
                        <output>{draftSettings.colorMerge}</output>
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        value={draftSettings.colorMerge}
                        onChange={event =>
                          scheduleAdjustments({
                            ...draftSettingsRef.current,
                            colorMerge: Number(event.target.value),
                          })}
                      />
                      <small>
                        <span>0 · 保留细节</span>
                        <span>30 · 大幅简化</span>
                      </small>
                    </label>
                    <fieldset>
                      <legend>
                        处理模式
                        <Button
                          className="float-right -mt-1 min-h-6! text-muted-foreground"
                          variant="ghost"
                          size="xs"
                          aria-label="查看处理模式说明"
                          onClick={() => setProcessingGuideOpen(true)}
                        >
                          说明
                          <CircleHelp />
                        </Button>
                      </legend>
                      <div className="panel-processing-modes max-[641px]:[&_button]:min-h-[52px]!">
                        {(
                          [
                            {
                              id: "edge",
                              title: "轮廓增强",
                              description: "平滑杂色，突出轮廓",
                            },
                            {
                              id: "average",
                              title: "自然平均",
                              description: "保留渐变与光影",
                            },
                            {
                              id: "dominant",
                              title: "纯色块",
                              description: "每块采用主要颜色",
                            },
                          ] as const
                        ).map(item => (
                          <button
                            type="button"
                            key={item.id}
                            className={
                              draftSettings.processingMode === item.id
                                ? "active"
                                : ""
                            }
                            aria-pressed={
                              draftSettings.processingMode === item.id
                            }
                            onClick={() =>
                              scheduleAdjustments({
                                ...draftSettingsRef.current,
                                processingMode: item.id,
                              })}
                          >
                            <strong>{item.title}</strong>
                            <small>{item.description}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </>
                )}
                <fieldset className="panel-palette">
                  <legend>
                    调色盘
                    <small>双击添加颜色</small>
                  </legend>
                  <div className="panel-palette-picker">
                    <div
                      className="panel-palette-scroll"
                      aria-label="选择拼豆颜色"
                    >
                      <div className="panel-color-groups">
                        {groupColors(BEAD_COLORS).map(([series, colors]) => (
                          <section
                            className="color-series"
                            key={series}
                          >
                            <div className="color-series-heading">{series}</div>
                            <div className="panel-all-colors">
                              {colors.map(color => (
                                <button
                                  type="button"
                                  key={color.id}
                                  className={
                                    selected === color.id ? "selected" : ""
                                  }
                                  style={colorTileStyle(color)}
                                  aria-label={`选择颜色 ${color.id}`}
                                  aria-pressed={selected === color.id}
                                  onClick={() => chooseColor(color.id)}
                                  onDoubleClick={() => addQuickColor(color.id)}
                                >
                                  {color.id}
                                </button>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </div>
                  </div>
                </fieldset>
                {!isBlankCard && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void openComparison()}
                  >
                    <Columns2 />
                    对比原图
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 />
                  删除
                </Button>
              </section>
            </div>
          </aside>
        </>
      )}

      <AlertDialog
        open={pendingLongestEdge !== null}
        onOpenChange={open => !open && setPendingLongestEdge(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>修改格数并重排图纸？</AlertDialogTitle>
            <AlertDialogDescription>
              更改格数会按新尺寸重排图纸，当前手工编辑不会保留。是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmLongestEdge}
            >
              继续修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={open => !open && !deleting && setDeleteOpen(false)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{`删除“${project.name}”？`}</AlertDialogTitle>
            <AlertDialogDescription>
              删除后只能通过已有备份恢复，这个操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? <LoaderCircle className="spin" /> : <Trash2 />}
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {preview && (
        <PatternPreviewDialog
          src={preview}
          name={pattern.name}
          onClose={() => setPreview(null)}
          onCopy={copy}
          onDownload={() => void downloadPatternPng(patternRef.current)}
        />
      )}
      {comparison && (
        <PatternComparisonDialog
          original={comparison.original}
          current={comparison.current}
          name={pattern.name}
          onClose={() => setComparison(null)}
        />
      )}
      {processingGuideOpen && (
        <ProcessingModeGuideDialog
          onClose={() => setProcessingGuideOpen(false)}
        />
      )}
    </main>
  );
}
