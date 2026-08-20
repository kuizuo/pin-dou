"use client";

import { useEffect, useRef, useState } from "react";
import type { Pattern } from "@/lib/types";
import { beadById } from "@/lib/beads";
import {
  drawPatternGrid,
  needsLightBeadOutline,
  visiblePatternGridMarks,
} from "@/lib/pattern";

type Props = {
  pattern: Pattern;
  showGrid?: boolean;
  showCodes?: boolean;
  shape?: "square" | "circle";
  className?: string;
  editable?: boolean;
  onPaint?: (index: number) => void;
  onStrokeStart?: () => void;
  onStrokeEnd?: () => void;
  onStrokeCancel?: () => void;
  continuous?: boolean;
  highlightIndex?: number | null;
  showCellTooltip?: boolean;
};

type AxisProps = {
  side: "top" | "right" | "bottom" | "left";
  size: number;
};

export function PatternGridAxis({ side, size }: AxisProps) {
  const horizontal = side === "top" || side === "bottom";
  const ref = useRef<HTMLDivElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    const axis = ref.current;
    if (!axis) return;
    const updateLength = () => setLength(horizontal ? axis.clientWidth : axis.clientHeight);
    updateLength();
    const observer = new ResizeObserver(updateLength);
    observer.observe(axis);
    return () => observer.disconnect();
  }, [horizontal]);

  return (
    <div
      ref={ref}
      className={`pattern-grid-axis is-${side}`}
      aria-hidden="true"
    >
      {visiblePatternGridMarks(size, length).map(mark => (
        <span
          key={mark}
          style={horizontal
            ? { left: `${((mark - 0.5) / size) * 100}%` }
            : { top: `${((mark - 0.5) / size) * 100}%` }}
        >
          {mark}
        </span>
      ))}
    </div>
  );
}

export function PatternCanvas({
  pattern,
  showGrid = true,
  showCodes = false,
  shape = "square",
  className = "",
  editable = false,
  onPaint,
  onStrokeStart,
  onStrokeEnd,
  onStrokeCancel,
  continuous = false,
  highlightIndex = null,
  showCellTooltip = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activePointers = useRef(new Set<number>());
  const drawingPointer = useRef<number | null>(null);
  const lastPainted = useRef<number | null>(null);
  const strokeOpen = useRef(false);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null),
    [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const cell = showCodes
      ? 24
      : Math.max(
          7,
          Math.min(
            18,
            Math.floor(1040 / Math.max(pattern.width, pattern.height)),
          ),
        );
    const dpr = window.devicePixelRatio || 1;
    canvas.width = pattern.width * cell * dpr;
    canvas.height = pattern.height * cell * dpr;
    canvas.style.aspectRatio = `${pattern.width} / ${pattern.height}`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.scale(dpr, dpr);
    context.clearRect(0, 0, pattern.width * cell, pattern.height * cell);

    pattern.cells.forEach((id, index) => {
      const x = (index % pattern.width) * cell;
      const y = Math.floor(index / pattern.width) * cell;

      if (id) {
        const bead = beadById(id);
        context.fillStyle = bead.hex;
        if (shape === "circle") {
          context.beginPath();
          context.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
          context.fill();
        }
        else {
          context.fillRect(x, y, cell, cell);
        }
        if (needsLightBeadOutline(bead.rgb, showCodes, showGrid)) {
          context.strokeStyle = "#b9c0cc";
          context.lineWidth = 1;
          if (shape === "circle") context.stroke();
          else context.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        }
      }

      if (showCodes && id && cell >= 18) {
        const [r, g, b] = beadById(id).rgb;
        context.fillStyle
          = r * 299 + g * 587 + b * 114 > 145000 ? "#182235" : "#fff";
        context.font = `700 ${Math.max(7, cell * 0.28)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(id, x + cell / 2, y + cell / 2);
      }
    });

    if (showGrid) {
      drawPatternGrid(context, pattern.width, pattern.height, cell);
    }

    if (highlightIndex !== null && highlightIndex >= 0) {
      const x = (highlightIndex % pattern.width) * cell;
      const y = Math.floor(highlightIndex / pattern.width) * cell;
      context.strokeStyle = "#f43f9e";
      context.lineWidth = Math.max(2, cell * 0.16);
      context.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    }

    if (keyboardIndex !== null) {
      const x = (keyboardIndex % pattern.width) * cell;
      const y = Math.floor(keyboardIndex / pattern.width) * cell;
      context.strokeStyle = "#2563eb";
      context.lineWidth = Math.max(2, cell * 0.16);
      context.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }, [pattern, showCodes, showGrid, shape, highlightIndex, keyboardIndex]);

  function cellIndex(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!ref.current) return null;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * pattern.width,
    );
    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * pattern.height,
    );
    return x >= 0 && y >= 0 && x < pattern.width && y < pattern.height
      ? y * pattern.width + x
      : null;
  }

  function paint(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!editable || !onPaint) return;
    const index = cellIndex(event);

    if (index !== null && lastPainted.current !== index) {
      lastPainted.current = index;
      onPaint(index);
    }
  }

  function moveKeyboardCursor(event: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!editable || keyboardIndex === null) return;

    const moves: Record<string, number> = {
      ArrowDown: pattern.width,
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -pattern.width,
    };

    if (event.key in moves) {
      event.preventDefault();
      const next = keyboardIndex + moves[event.key];
      if (
        next >= 0
        && next < pattern.cells.length
        && (event.key !== "ArrowLeft" || keyboardIndex % pattern.width)
        && (event.key !== "ArrowRight"
          || keyboardIndex % pattern.width < pattern.width - 1)
      ) {
        setKeyboardIndex(next);
      }
    }

    if (event.key === "Enter" && onPaint) {
      event.preventDefault();
      onStrokeStart?.();
      onPaint(keyboardIndex);
      onStrokeEnd?.();
    }
  }

  function finishStroke(pointerId: number, cancel = false) {
    activePointers.current.delete(pointerId);
    if (drawingPointer.current !== pointerId || !strokeOpen.current) return;
    if (cancel) onStrokeCancel?.();
    else onStrokeEnd?.();
    drawingPointer.current = null;
    lastPainted.current = null;
    strokeOpen.current = false;
  }

  const accessibilityHint = editable ? "。方向键移动，回车修改当前格" : "";
  const ariaLabel = `${pattern.name}，${pattern.width} × ${pattern.height} MARD 拼豆图纸${accessibilityHint}`;
  const hoverColor
    = hoverIndex === null || !pattern.cells[hoverIndex]
      ? null
      : beadById(pattern.cells[hoverIndex]);

  return (
    <>
      <canvas
        ref={ref}
        aria-label={ariaLabel}
        className={`pattern-canvas ${editable ? "is-editable" : ""} ${className}`}
        onBlur={() => setKeyboardIndex(null)}
        onFocus={() => editable && setKeyboardIndex(value => value ?? 0)}
        onKeyDown={moveKeyboardCursor}
        onPointerDown={(event) => {
          if (!editable || !onPaint) return;
          activePointers.current.add(event.pointerId);
          if (event.pointerType === "touch" && activePointers.current.size > 1) {
            if (strokeOpen.current && drawingPointer.current !== null)
              finishStroke(drawingPointer.current, true);
            return;
          }
          if (event.pointerType !== "touch")
            event.currentTarget.setPointerCapture(event.pointerId);
          drawingPointer.current = event.pointerId;
          lastPainted.current = null;
          strokeOpen.current = true;
          onStrokeStart?.();
          paint(event);
        }}
        onPointerMove={(event) => {
          if (showCellTooltip && event.pointerType !== "touch")
            setHoverIndex(cellIndex(event));
          if (
            continuous
            && drawingPointer.current === event.pointerId
            && activePointers.current.size === 1
            && event.buttons === 1
          )
            paint(event);
        }}
        onPointerLeave={() => setHoverIndex(null)}
        onPointerUp={event => finishStroke(event.pointerId)}
        onPointerCancel={event => finishStroke(event.pointerId, true)}
        onLostPointerCapture={event => finishStroke(event.pointerId)}
        role="img"
        style={{ width: "100%" }}
        tabIndex={editable ? 0 : -1}
      />
      {showCellTooltip && hoverIndex !== null && (
        <span
          className="pattern-cell-tooltip"
          data-side={hoverIndex % pattern.width < pattern.width / 2 ? "right" : "left"}
          style={{
            left: `${((hoverIndex % pattern.width + 0.5) / pattern.width) * 100}%`,
            top: `${((Math.floor(hoverIndex / pattern.width) + 0.5) / pattern.height) * 100}%`,
          }}
        >
          <i style={{ background: hoverColor?.hex }} />
          <strong>{hoverColor?.id || "空白"}</strong>
          <span>
            (
            {hoverIndex % pattern.width + 1}
            ,
            {Math.floor(hoverIndex / pattern.width) + 1}
            )
          </span>
        </span>
      )}
    </>
  );
}
