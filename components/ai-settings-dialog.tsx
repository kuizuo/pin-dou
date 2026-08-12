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
      className="ai-settings-dialog"
      aria-labelledby="ai-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="ai-settings-card">
        <header>
          <div>
            <span className="eyebrow">AI 图片处理</span>
            <h2 id="ai-settings-title">选择处理服务</h2>
            <p>Cloudflare 可直接使用；Gemini 使用你自己的密钥。</p>
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
          className="ai-provider-options"
          role="group"
          aria-label="AI 处理服务"
        >
          <button
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
              <div className="ai-provider-credentials gemini-key-field">
                <label htmlFor="gemini-key">
                  <span>
                    <KeyRound />
                    Gemini API Key
                  </span>
                  <a
                    href="https://aistudio.google.com/app/api-keys"
                    target="_blank"
                    rel="noreferrer"
                  >
                    获取密钥
                    <ExternalLink />
                  </a>
                </label>
                <div>
                  <input
                    id="gemini-key"
                    type={keyVisible ? "text" : "password"}
                    value={geminiKey}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="粘贴你的 Gemini API Key"
                    onChange={event => onGeminiKeyChange(event.target.value)}
                  />
                  <Button
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
        <footer>
          <Button
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
