"use client";

import {
  Check,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AiProvider } from "@/lib/ai";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";

export function AiSettingsDialog({
  open,
  onClose,
  provider,
  onProviderChange,
  geminiKey,
  onGeminiKeyChange,
  turnstileToken,
  onTurnstileToken,
  turnstileRefresh,
}: {
  open: boolean;
  onClose: () => void;
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  geminiKey: string;
  onGeminiKeyChange: (value: string) => void;
  turnstileToken: string;
  onTurnstileToken: (value: string) => void;
  turnstileRefresh: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [keyVisible, setKeyVisible] = useState(false);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const ready
    = provider === "gemini" ? Boolean(geminiKey.trim()) : Boolean(turnstileToken);
  return (
    <dialog
      ref={dialog}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(520px,calc(100%-32px))] max-w-none overflow-visible rounded-[20px] border-0 bg-transparent p-0 backdrop:bg-[rgb(19_22_30/0.58)] backdrop:backdrop-blur-[3px]"
      aria-labelledby="ai-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="grid max-h-[calc(100dvh-32px)] gap-[18px] overflow-y-auto rounded-[20px] border border-border bg-card p-[22px] shadow-[0_28px_80px_rgb(28_20_27/0.28)] max-[640px]:px-3.5 max-[640px]:py-[18px]">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">AI 图片处理</span>
            <h2
              className="mt-[3px] mb-[5px] text-[1.35rem]"
              id="ai-settings-title"
            >
              选择处理服务
            </h2>
            <p className="m-0 text-[0.72rem] text-muted-foreground">
              Cloudflare 可直接使用；Gemini 使用你自己的密钥。
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="关闭 AI 设置"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>
        <div
          className="grid grid-cols-2 gap-2.5 max-[640px]:grid-cols-1"
          role="group"
          aria-label="AI 处理服务"
        >
          <button
            className="grid min-h-[82px]! grid-cols-[24px_minmax(0,1fr)_18px] items-center gap-[9px] rounded-[13px] border border-border bg-muted p-[13px] text-left text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&>svg]:w-5 [&>svg]:text-primary [&>svg:last-child]:w-4 [&_small]:mt-[3px] [&_small]:block [&_small]:text-[0.63rem] [&_small]:leading-[1.35] [&_small]:text-muted-foreground [&_strong]:block"
            type="button"
            aria-pressed={provider === "cloudflare"}
            onClick={() => onProviderChange("cloudflare")}
          >
            <Cloud />
            <span>
              <strong>Cloudflare AI</strong>
              <small>应用提供，无需填写密钥</small>
            </span>
            {provider === "cloudflare" && <Check />}
          </button>
          <button
            className="grid min-h-[82px]! grid-cols-[24px_minmax(0,1fr)_18px] items-center gap-[9px] rounded-[13px] border border-border bg-muted p-[13px] text-left text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&>svg]:w-5 [&>svg]:text-primary [&>svg:last-child]:w-4 [&_small]:mt-[3px] [&_small]:block [&_small]:text-[0.63rem] [&_small]:leading-[1.35] [&_small]:text-muted-foreground [&_strong]:block"
            type="button"
            aria-pressed={provider === "gemini"}
            onClick={() => onProviderChange("gemini")}
          >
            <Sparkles />
            <span>
              <strong>Gemini</strong>
              <small>使用你的 Gemini API Key</small>
            </span>
            {provider === "gemini" && <Check />}
          </button>
        </div>
        {provider === "cloudflare"
          ? (
              <div className="ai-provider-credentials">
                <strong>完成安全验证</strong>
                <small>验证只用于保护公共图片处理服务，不会创建账号。</small>
                <Turnstile
                  refreshKey={turnstileRefresh}
                  onToken={onTurnstileToken}
                />
              </div>
            )
          : (
              <div className="ai-provider-credentials">
                <label
                  className="flex items-center justify-between gap-2.5 text-[0.7rem] font-extrabold"
                  htmlFor="gemini-key"
                >
                  <span className="inline-flex items-center gap-[5px] [&_svg]:size-3.5">
                    <KeyRound />
                    Gemini API Key
                  </span>
                  <a
                    className="inline-flex items-center gap-[5px] whitespace-nowrap text-primary no-underline [&_svg]:size-3.5"
                    href="https://aistudio.google.com/app/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    获取密钥
                    <ExternalLink />
                  </a>
                </label>
                <div className="relative">
                  <input
                    className="h-[42px] w-full rounded-[9px] border border-border bg-card py-0 pr-[42px] pl-[11px] text-[0.74rem] text-foreground outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary),transparent_82%)]"
                    id="gemini-key"
                    type={keyVisible ? "text" : "password"}
                    value={geminiKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="粘贴你的 Gemini API Key"
                    onChange={event => onGeminiKeyChange(event.target.value)}
                  />
                  <Button
                    className="absolute top-1 right-1 min-h-[34px] min-w-[34px]"
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={keyVisible ? "隐藏密钥" : "显示密钥"}
                    onClick={() => setKeyVisible(value => !value)}
                  >
                    {keyVisible ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
                <small>密钥只在当前页面使用，不会保存到作品或浏览器。</small>
              </div>
            )}
        <footer className="flex justify-end">
          <Button
            className="min-w-[108px]!"
            type="button"
            disabled={!ready}
            onClick={onClose}
          >
            {ready ? "完成" : provider === "gemini" ? "请填写密钥" : "等待验证"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
