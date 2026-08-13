"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type CopyButtonProps = {
  value: string;
  label: string;
  variant?: "ghost" | "outline";
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  }
  catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy failed");
  }
}

export function CopyButton({
  value,
  label,
  variant = "ghost",
}: CopyButtonProps) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  function resetAfterDelay() {
    window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  async function handleCopy() {
    try {
      await copyText(value);
      setState("copied");
      resetAfterDelay();
    }
    catch {
      setState("error");
      resetAfterDelay();
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={variant === "ghost" ? "min-w-[88px] text-workbench-foreground hover:bg-workbench-control hover:text-workbench-foreground" : "min-w-[88px]"}
      onClick={handleCopy}
      aria-live="polite"
    >
      {state === "copied" ? <Check /> : <Copy />}
      {state === "copied" ? "已复制" : state === "error" ? "复制失败" : label}
    </Button>
  );
}
