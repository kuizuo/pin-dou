/* eslint-disable @next/next/no-img-element -- generated preview uses an in-memory data URL */

import { Check, Clipboard, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function PatternPreviewDialog({
  src,
  name,
  onClose,
  onCopy,
  onDownload,
}: {
  src: string;
  name: string;
  onClose: () => void;
  onCopy: () => Promise<boolean>;
  onDownload: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    returnFocus = useRef<HTMLElement | null>(null),
    copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copying, setCopying] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      element?.close();
      requestAnimationFrame(() => returnFocus.current?.focus());
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="pattern-preview-dialog max-[641px]:h-auto! max-[641px]:max-h-[78dvh]! max-[641px]:overflow-hidden!"
      aria-labelledby="pattern-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="pattern-preview-card max-[641px]:h-auto! max-[641px]:max-h-[78dvh]!">
        <div className="pattern-preview-heading max-[641px]:flex-col! max-[641px]:items-start!">
          <div>
            <h2 id="pattern-preview-title">图纸预览</h2>
            <p>
              {name}
              {" "}
              · 方格、色号和用量齐全
            </p>
          </div>
          <div className="pattern-preview-actions max-[641px]:w-full! max-[641px]:[&>[data-slot=button]]:min-w-0! max-[641px]:[&>[data-slot=button]]:flex-1!">
            <Button
              className="pattern-preview-copy"
              variant="outline"
              aria-disabled={copying || copied}
              aria-label={copying ? "正在复制" : copied ? "复制成功" : "复制图片"}
              onClick={() => {
                if (copying || copied) return;
                setCopying(true);
                void onCopy().then((success) => {
                  setCopied(success);
                  setCopying(false);
                  if (success) {
                    if (copiedTimer.current) clearTimeout(copiedTimer.current);
                    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
                  }
                });
              }}
            >
              <span
                className="pattern-preview-copy-label"
                aria-hidden="true"
              >
                {copied
                  ? (
                      <>
                        <Check />
                        复制成功
                      </>
                    )
                  : (
                      <>
                        <Clipboard />
                        复制图片
                      </>
                    )}
              </span>
            </Button>
            <Button onClick={onDownload}>
              <Download />
              下载 PNG
            </Button>
          </div>
          <Button
            className="pattern-preview-close"
            variant="outline"
            size="icon"
            aria-label="关闭预览"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <div className="pattern-preview-scroll max-[641px]:max-h-[calc(78dvh-68px)]! max-[641px]:p-3!">
          <img
            src={src}
            alt={`${name}图纸预览`}
          />
        </div>
      </div>
    </dialog>
  );
}
