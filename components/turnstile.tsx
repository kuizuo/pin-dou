"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

export function Turnstile({
  onToken,
  refreshKey = 0,
  active = true,
}: {
  onToken: (token: string) => void;
  refreshKey?: number;
  active?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null),
    callback = useRef(onToken),
    [ready, setReady] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);
  useEffect(() => {
    if (
      !active
      || !ready
      || !sitekey
      || !container.current
      || !window.turnstile
    ) return;
    callback.current("");
    const widgetId = window.turnstile.render(container.current, {
      "sitekey": sitekey,
      "action": "pixelize",
      "theme": "auto",
      "appearance": "always",
      "callback": (token: string) => callback.current(token),
      "error-callback": () => callback.current(""),
      "expired-callback": () => {
        callback.current("");
        window.turnstile?.reset(widgetId);
      },
    });
    return () => window.turnstile?.remove(widgetId);
  }, [active, ready, refreshKey, sitekey]);
  if (!sitekey)
    return (
      <p className="m-0 text-[0.68rem] text-destructive">
        Cloudflare AI 尚未配置。
      </p>
    );
  return (
    <div className="max-w-[300px] overflow-hidden">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
      />
      <div ref={container} />
    </div>
  );
}
