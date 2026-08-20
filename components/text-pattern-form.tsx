"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Smile, Type, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Pattern } from "@/lib/types";
import { PatternCanvas } from "@/components/pattern-canvas";
import { Button } from "@/components/ui/button";
import { BEAD_COLORS, beadById } from "@/lib/beads";
import {
  createEmojiPattern,
  createTextPattern,
  emojiError,
  type TextDirection,
  textError,
} from "@/lib/text-pattern";

function TextPatternForm({
  mode,
  onCreate,
}: {
  mode: "text" | "emoji";
  onCreate: (pattern: Pattern) => void;
}) {
  const [value, setValue] = useState("");
  const [size, setSize] = useState(29);
  const [direction, setDirection] = useState<TextDirection>("horizontal");
  const [colorId, setColorId] = useState("H7");
  const [colorQuery, setColorQuery] = useState("");
  const [preview, setPreview] = useState<Pattern | null>(null);
  const error = mode === "text" ? textError(value) : emojiError(value);
  const visibleColors = colorQuery.trim()
    ? BEAD_COLORS.filter(color =>
        color.id.toLowerCase().includes(colorQuery.trim().toLowerCase()))
    : BEAD_COLORS;

  useEffect(() => {
    if (error) return;
    let active = true;
    void document.fonts.ready.then(() => {
      if (!active) return;
      try {
        setPreview(mode === "text"
          ? createTextPattern({ value, size, direction, colorId })
          : createEmojiPattern(value, size));
      }
      catch {
        setPreview(null);
      }
    });
    return () => {
      active = false;
    };
  }, [colorId, direction, error, mode, size, value]);
  const visiblePreview = error ? null : preview;

  return (
    <div className="grid gap-5 bg-workbench text-workbench-foreground">
      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6 max-[700px]:grid-cols-1">
        <div className="grid content-start gap-3">
          <label className="grid gap-1.5 text-xs font-bold">
            {mode === "text" ? "输入文字" : "输入一个 Emoji"}
            <input
              autoComplete="off"
              className="h-11 rounded-lg border border-workbench-border bg-workbench-control px-3 text-base outline-none focus:border-primary"
              placeholder={mode === "text" ? "例如：拼豆" : "例如：🐱"}
              value={value}
              onChange={event => setValue(event.target.value)}
            />
          </label>
          <div className={mode === "text" ? "grid gap-3" : "grid grid-cols-2 gap-2"}>
            <label className="grid gap-1.5 text-xs font-bold">
              <span className="flex items-center justify-between gap-2">
                {mode === "text" ? "单字大小" : "图案大小"}
                <output>
                  {size}
                  {" "}
                  格
                </output>
              </span>
              <input
                className="h-10 w-full accent-primary"
                type="range"
                min="12"
                max="58"
                step="1"
                value={size}
                aria-label={mode === "text" ? "单字大小" : "图案大小"}
                onChange={event => setSize(Number(event.target.value))}
              />
              <small className="font-normal text-workbench-muted">
                豆板会根据内容和排列方向自动调整
              </small>
            </label>
            {mode === "text"
              ? (
                  <fieldset className="grid gap-2">
                    <legend className="mb-1 text-xs font-bold">文字颜色</legend>
                    <div className="flex items-center gap-2 rounded-lg border border-workbench-border bg-workbench-control p-2">
                      <span
                        className="size-8 shrink-0 rounded-lg border border-white/30 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
                        style={{ background: beadById(colorId).hex }}
                      />
                      <span className="min-w-20 text-sm font-extrabold">
                        {beadById(colorId).name}
                      </span>
                      <input
                        aria-label="搜索文字颜色"
                        className="ml-auto h-9 min-w-0 flex-1 rounded-md border border-workbench-border bg-workbench px-2.5 text-sm outline-none focus:border-primary"
                        placeholder="搜索色号，如 H7"
                        value={colorQuery}
                        onChange={event => setColorQuery(event.target.value)}
                      />
                    </div>
                    <div
                      className="grid max-h-[174px] grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 overflow-y-auto rounded-lg border border-workbench-border bg-[#26344a] p-2"
                      aria-label="选择文字颜色"
                    >
                      {visibleColors.map(color => (
                        <button
                          type="button"
                          key={color.id}
                          className="h-9 min-w-0 rounded-md border text-[0.65rem] font-black shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)] outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary"
                          style={{
                            background: color.hex,
                            color: color.lab[0] > 58 ? "#182235" : "#fffaf7",
                          }}
                          aria-label={`选择颜色 ${color.id}`}
                          aria-pressed={colorId === color.id}
                          title={`${color.name} · ${color.hex}`}
                          onClick={() => setColorId(color.id)}
                        >
                          {color.id}
                        </button>
                      ))}
                      {!visibleColors.length
                        ? (
                            <span className="col-span-full py-4 text-center text-xs text-workbench-muted">
                              没有找到这个色号
                            </span>
                          )
                        : null}
                    </div>
                  </fieldset>
                )
              : null}
          </div>
          {mode === "text"
            ? (
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-xs font-bold">排列</legend>
                  <div className="grid grid-cols-2 gap-1">
                    {(["horizontal", "vertical"] as const).map(item => (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        variant={direction === item ? "default" : "workbench"}
                        onClick={() => setDirection(item)}
                      >
                        {item === "horizontal" ? "横排" : "竖排"}
                      </Button>
                    ))}
                  </div>
                </fieldset>
              )
            : (
                <p className="m-0 text-xs leading-5 text-workbench-muted">
                  保留设备上的 Emoji 样式，最多匹配为 12 种 MARD 颜色。
                </p>
              )}
        </div>
        <div className="mx-auto grid h-[280px] w-full max-w-[280px] place-items-center overflow-hidden rounded-xl border border-workbench-border bg-[#26344a] p-3">
          {visiblePreview
            ? (
                <PatternCanvas
                  className="max-h-full max-w-full"
                  pattern={visiblePreview}
                  showGrid={false}
                />
              )
            : <span className="px-3 text-center text-xs text-workbench-muted">输入后在这里预览</span>}
        </div>
      </div>
      <div className="grid gap-2">
        {value && error
          ? (
              <p
                className="m-0 text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )
          : null}
        <Button
          className="w-full"
          disabled={!visiblePreview}
          onClick={() => visiblePreview && onCreate(visiblePreview)}
        >
          创建图纸
        </Button>
      </div>
    </div>
  );
}

export function TextPatternDialog({
  mode,
  onCreate,
}: {
  mode: "text" | "emoji";
  onCreate: (pattern: Pattern) => void;
}) {
  const [open, setOpen] = useState(false);
  const textMode = mode === "text";
  const Icon = textMode ? Type : Smile;
  return (
    <>
      <button
        type="button"
        className="group flex min-h-[210px] cursor-pointer items-center gap-5 rounded-[22px] border border-border bg-workbench p-6 text-left text-workbench-foreground shadow-[0_26px_45px_rgb(24_34_53/0.16)] transition-colors hover:border-primary max-[640px]:min-h-[150px]"
        onClick={() => setOpen(true)}
      >
        <span className="grid size-[70px] shrink-0 place-items-center rounded-[20px] bg-primary text-white">
          <Icon size={34} />
        </span>
        <span className="grid gap-2">
          <strong className="text-xl">
            {textMode ? "创建文字图纸" : "创建 Emoji 图纸"}
          </strong>
          <small className="text-sm leading-6 text-workbench-muted">
            {textMode
              ? "在宽敞的窗口中调整文字、方向、颜色和大小。"
              : "在宽敞的窗口中选择 Emoji、豆板并查看彩色预览。"}
          </small>
          <span className="mt-1 text-sm font-bold text-primary">开始设置 →</span>
        </span>
      </button>
      <Dialog.Root
        open={open}
        onOpenChange={setOpen}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[rgb(19_22_30/0.62)] backdrop-blur-[3px]" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5 max-[640px]:p-2">
            <Dialog.Popup className="my-auto w-full max-w-[760px] rounded-[24px] border border-workbench-border bg-workbench p-6 text-workbench-foreground shadow-[0_30px_90px_rgb(10_18_32/0.42)] outline-none max-[640px]:rounded-[18px] max-[640px]:p-4">
              <header className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="m-0 text-2xl font-black">
                    {textMode ? "文字转图纸" : "Emoji 转图纸"}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1.5 mb-0 text-sm text-workbench-muted">
                    {textMode
                      ? "输入文字并调整样式，右侧会实时显示最终图纸。"
                      : "输入一个 Emoji，右侧会实时显示匹配后的 MARD 豆色。"}
                  </Dialog.Description>
                </div>
                <Button
                  size="icon"
                  variant="workbench"
                  aria-label="关闭设置"
                  onClick={() => setOpen(false)}
                >
                  <X />
                </Button>
              </header>
              <TextPatternForm
                mode={mode}
                onCreate={(pattern) => {
                  setOpen(false);
                  onCreate(pattern);
                }}
              />
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
