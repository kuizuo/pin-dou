import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC } from "next/font/google";
import { NewProjectProvider } from "@/components/new-project-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import "react-image-crop/dist/ReactCrop.css";
import "./globals.css";

const bodyFont = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "拼豆图纸生成器", template: "%s | 拼豆图纸生成器" },
  description:
    "上传图片，在本机生成带 MARD 真实色号、用豆统计和 A4 施工 PDF 的拼豆图纸。",
  applicationName: "拼豆图纸生成器",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf7",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      data-scroll-behavior="smooth"
    >
      <body
        className={`${bodyFont.variable} max-[641px]:[&_button]:min-h-11 max-[641px]:[&_button]:min-w-11 max-[641px]:[&_select]:min-h-11 max-[641px]:[&_select]:min-w-11 max-[641px]:[&_input]:min-h-11 max-[641px]:[&_input]:min-w-11 max-[641px]:[&_input[type=range]]:h-11`}
      >
        <NewProjectProvider>
          <TooltipProvider delay={350}>{children}</TooltipProvider>
        </NewProjectProvider>
      </body>
    </html>
  );
}
