"use client";

import {
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AiProvider } from "@/lib/ai";
import { Turnstile } from "@/components/turnstile";
import { Button } from "@/components/ui/button";

const PROVIDER_ICON_PATHS: Record<AiProvider, string> = {
  cloudflare: "M16.509 16.845c.147-.507.091-.971-.156-1.316-.224-.316-.604-.499-1.061-.52l-8.659-.113a.156.156 0 0 1-.133-.071.195.195 0 0 1-.021-.155.228.228 0 0 1 .203-.156l8.736-.113c1.035-.049 2.16-.887 2.554-1.913l.499-1.302a.28.28 0 0 0 .014-.168 5.69 5.69 0 0 0-5.55-4.445 5.687 5.687 0 0 0-5.387 3.862 2.54 2.54 0 0 0-1.794-.5 2.575 2.575 0 0 0-2.286 2.286c-.028.31-.007.613.064.894C1.568 13.171 0 14.775 0 16.752c0 .175.014.351.035.527.014.083.085.148.17.148h15.98a.22.22 0 0 0 .204-.156l.12-.426Zm2.757-5.564c-.077 0-.162 0-.239.011a.17.17 0 0 0-.127.098l-.338 1.174c-.147.507-.092.971.155 1.317.225.316.605.498 1.062.52l1.844.113c.055 0 .105.026.133.07a.2.2 0 0 1 .021.156.23.23 0 0 1-.204.155l-1.921.113c-1.041.049-2.158.887-2.553 1.914l-.14.358c-.029.071.021.142.098.142h6.598a.18.18 0 0 0 .169-.126c.112-.408.176-.837.176-1.28 0-2.603-2.125-4.727-4.734-4.727Z",
  gemini: "M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81",
  openai: "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.182a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.096 5.98 5.98 0 0 0 .511 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073Zm-9.022 12.608a4.476 4.476 0 0 1-2.877-1.04l.142-.081 4.778-2.758a.795.795 0 0 0 .393-.682v-6.736l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.471 4.471 0 0 1-.535-3.014l.142.085 4.783 2.758a.771.771 0 0 0 .781 0l5.843-3.368v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.499 4.499 0 0 1-6.141-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.814 3.354-2.02 1.169a.076.076 0 0 1-.071 0l-4.83-2.787A4.504 4.504 0 0 1 2.34 7.872Zm16.596 3.855-5.833-3.387 2.016-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.677a.79.79 0 0 0-.407-.668Zm2.011-3.023-.142-.085-4.773-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.499 4.499 0 0 1 6.681 4.66ZM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.056V6.074a4.499 4.499 0 0 1 7.376-3.453l-.142.08-4.778 2.758a.795.795 0 0 0-.393.682Zm1.098-2.365 2.602-1.5 2.607 1.5v2.999l-2.598 1.5-2.607-1.5Z",
};

function ProviderIcon({ provider }: { provider: AiProvider }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
    >
      <path
        d={PROVIDER_ICON_PATHS[provider]}
        fill="currentColor"
      />
    </svg>
  );
}

export function AiSettingsDialog({
  open,
  onClose,
  provider,
  onProviderChange,
  geminiKey,
  onGeminiKeyChange,
  openaiKey,
  onOpenaiKeyChange,
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
  openaiKey: string;
  onOpenaiKeyChange: (value: string) => void;
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
  const ready = provider === "cloudflare"
    ? Boolean(turnstileToken)
    : Boolean((provider === "gemini" ? geminiKey : openaiKey).trim());
  return (
    <dialog
      ref={dialog}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(640px,calc(100%-32px))] max-w-none overflow-visible rounded-[20px] border-0 bg-transparent p-0 backdrop:bg-[rgb(19_22_30/0.58)] backdrop:backdrop-blur-[3px]"
      aria-labelledby="ai-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="grid max-h-[calc(100dvh-32px)] gap-4 overflow-y-auto rounded-[20px] border border-border bg-card p-[22px] shadow-[0_28px_80px_rgb(28_20_27/0.28)] max-[640px]:gap-3 max-[640px]:px-3.5 max-[640px]:py-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <span className="eyebrow">AI 图片处理</span>
            <h2
              className="mt-[3px] mb-[5px] text-[1.35rem]"
              id="ai-settings-title"
            >
              选择处理服务
            </h2>
            <p className="m-0 text-[0.72rem] whitespace-nowrap text-muted-foreground">
              Cloudflare 免费；其他服务使用个人密钥。
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
        <p className="m-0 rounded-[11px] bg-muted px-3.5 py-3 text-[0.7rem] leading-[1.5] text-muted-foreground">
          AI 只做像素化并尽量保留原图颜色，图片仅用于本次生成。
        </p>
        <div
          className="grid grid-cols-3 gap-2 max-[640px]:grid-cols-1 max-[640px]:gap-1.5"
          role="group"
          aria-label="AI 处理服务"
        >
          <button
            className="grid min-h-16 grid-cols-[22px_minmax(0,1fr)_16px] items-center gap-2 rounded-[12px] border border-border bg-muted p-3 text-left text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&>svg]:size-5 [&>svg]:text-primary [&>svg:last-child]:size-4 [&_small]:mt-0.5 [&_small]:block [&_small]:text-[0.62rem] [&_small]:leading-tight [&_small]:whitespace-nowrap [&_small]:text-muted-foreground [&_strong]:block [&_strong]:text-sm [&_strong]:whitespace-nowrap"
            type="button"
            aria-pressed={provider === "cloudflare"}
            onClick={() => onProviderChange("cloudflare")}
          >
            <ProviderIcon provider="cloudflare" />
            <span>
              <strong>Cloudflare AI</strong>
              <small>无需密钥</small>
            </span>
            {provider === "cloudflare" && <Check />}
          </button>
          <button
            className="grid min-h-16 grid-cols-[22px_minmax(0,1fr)_16px] items-center gap-2 rounded-[12px] border border-border bg-muted p-3 text-left text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&>svg]:size-5 [&>svg]:text-primary [&>svg:last-child]:size-4 [&_small]:mt-0.5 [&_small]:block [&_small]:text-[0.62rem] [&_small]:leading-tight [&_small]:whitespace-nowrap [&_small]:text-muted-foreground [&_strong]:block [&_strong]:text-sm [&_strong]:whitespace-nowrap"
            type="button"
            aria-pressed={provider === "gemini"}
            onClick={() => onProviderChange("gemini")}
          >
            <ProviderIcon provider="gemini" />
            <span>
              <strong>Gemini</strong>
              <small>使用 Gemini Key</small>
            </span>
            {provider === "gemini" && <Check />}
          </button>
          <button
            className="grid min-h-16 grid-cols-[22px_minmax(0,1fr)_16px] items-center gap-2 rounded-[12px] border border-border bg-muted p-3 text-left text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary),transparent_35%)] [&>svg]:size-5 [&>svg]:text-primary [&>svg:last-child]:size-4 [&_small]:mt-0.5 [&_small]:block [&_small]:text-[0.62rem] [&_small]:leading-tight [&_small]:whitespace-nowrap [&_small]:text-muted-foreground [&_strong]:block [&_strong]:text-sm [&_strong]:whitespace-nowrap"
            type="button"
            aria-pressed={provider === "openai"}
            onClick={() => onProviderChange("openai")}
          >
            <ProviderIcon provider="openai" />
            <span>
              <strong>GPT Image 2</strong>
              <small>使用 OpenAI Key</small>
            </span>
            {provider === "openai" && <Check />}
          </button>
        </div>
        <div
          className="ai-provider-credentials"
          hidden={provider !== "cloudflare"}
        >
          <strong>完成安全验证</strong>
          <small>验证只用于保护公共图片处理服务，不会创建账号。</small>
          <Turnstile
            active={open}
            refreshKey={turnstileRefresh}
            onToken={onTurnstileToken}
          />
        </div>
        <div
          className="ai-provider-credentials"
          hidden={provider !== "gemini"}
        >
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
          <small>
            密钥保存在当前浏览器，下次可直接使用；不会写入作品或备份。
          </small>
        </div>
        <div
          className="ai-provider-credentials"
          hidden={provider !== "openai"}
        >
          <label
            className="flex items-center justify-between gap-2.5 text-[0.7rem] font-extrabold"
            htmlFor="openai-key"
          >
            <span className="inline-flex items-center gap-[5px] [&_svg]:size-3.5">
              <KeyRound />
              OpenAI API Key
            </span>
            <a
              className="inline-flex items-center gap-[5px] whitespace-nowrap text-primary no-underline [&_svg]:size-3.5"
              href="https://platform.openai.com/api-keys"
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
              id="openai-key"
              type={keyVisible ? "text" : "password"}
              value={openaiKey}
              autoComplete="off"
              spellCheck={false}
              placeholder="粘贴你的 OpenAI API Key"
              onChange={event => onOpenaiKeyChange(event.target.value)}
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
          <small>
            密钥保存在当前浏览器，下次可直接使用；不会写入作品或备份。
          </small>
        </div>
        <footer className="flex justify-end">
          <Button
            className="min-w-[108px]!"
            type="button"
            disabled={!ready}
            onClick={onClose}
          >
            {ready ? "完成" : provider === "cloudflare" ? "等待验证" : "请填写密钥"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
