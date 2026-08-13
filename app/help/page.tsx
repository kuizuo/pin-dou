import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Download,
  ImagePlus,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "使用帮助" };

const steps = [
  [
    ImagePlus,
    "上传图片",
    "拍照或选择 JPG、PNG、WebP、HEIC 图片，单张不超过 10MB。",
  ],
  [
    SlidersHorizontal,
    "调整图纸",
    "首次生成后可调整格数、颜色数量、颜色合并和处理模式，修改后会自动更新。",
  ],
  [
    Palette,
    "检查精修",
    "比较原图与图纸；需要时用画笔、填充、橡皮、整色替换和背景恢复逐格修改。",
  ],
  [
    Download,
    "下载开拼",
    "排除色号后会自动换成相近颜色，也可立即撤销，再下载施工 PNG 或 A4 PDF。",
  ],
] as const;

const questions = [
  [
    "没有 AI 密钥也能用吗？",
    "可以。AI 处理默认可使用 Cloudflare；也可以在设置中选择 Gemini 并填写自己的 API Key。",
  ],
  [
    "图片和密钥会保存吗？",
    "裁切后的图片只用于当次 AI 请求。Gemini 密钥保存在当前浏览器，方便下次直接使用，但不会写入作品或备份。",
  ],
  ["支持哪些拼豆品牌？", "目前只支持 MARD，使用固定来源的完整 291 色。"],
  [
    "作品保存在哪里？",
    "原图、设置、当前图纸和版本都保存在当前浏览器。建议定期使用“备份全部”，换设备后可以恢复。",
  ],
  [
    "格数和颜色该怎么选？",
    "默认 70 格、MARD 291 色库、最多 20 色，适合多数图片。首次生成后可在设置面板统一修改。",
  ],
] as const;

export default function HelpPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-[min(920px,calc(100%-32px))] py-12 sm:py-16">
        <header className="mb-10 max-w-2xl">
          <Badge
            variant="outline"
            className="mb-4 h-7 px-3 font-bold"
          >
            <CircleHelp size={15} />
            使用帮助
          </Badge>
          <h1 className="m-0 text-3xl font-black tracking-tight sm:text-4xl">
            从一张图片，到可以开拼的图纸。
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            本地处理默认使用原图，不上传图片；AI
            处理会先优化主体、轮廓和配色。两种方式都会精简配色并匹配 MARD 291
            色。
          </p>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "mt-6 font-bold",
            )}
          >
            打开图片生成器
            <ArrowRight size={17} />
          </Link>
        </header>

        <section
          className="mb-12"
          aria-labelledby="preview-title"
        >
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <span className="eyebrow">效果预览</span>
              <h2
                id="preview-title"
                className="mb-0 mt-1 text-xl font-black"
              >
                图片会变成什么样？
              </h2>
            </div>
            <span className="hidden text-sm text-muted-foreground sm:block">
              下面是这个示例的真实生成结果
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_18px_50px_rgb(80_44_59/0.08)] sm:p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-55"
              style={{
                backgroundImage:
                  "radial-gradient(circle, color-mix(in srgb, var(--primary), transparent 78%) 1px, transparent 1.5px)",
                backgroundSize: "18px 18px",
                maskImage:
                  "linear-gradient(to right, transparent, black 35%, black 65%, transparent)",
              }}
              aria-hidden="true"
            />
            <div className="relative grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
              <article className="flex min-h-64 flex-col rounded-xl border border-border bg-background/90 p-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="bg-card font-bold"
                  >
                    示例原图
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground">
                    插画
                  </span>
                </div>
                <div className="grid flex-1 place-items-center py-5">
                  <Image
                    src="/samples/sample-cat.svg"
                    alt="粉色背景的猫咪原图示例"
                    width={208}
                    height={208}
                    className="size-44 rounded-2xl shadow-[0_12px_28px_rgb(80_44_59/0.16)] sm:size-52"
                  />
                </div>
              </article>

              <div className="grid place-items-center py-1 text-primary sm:px-1">
                <span className="grid size-10 place-items-center rounded-full border border-border bg-card shadow-sm">
                  <ArrowRight
                    size={18}
                    className="rotate-90 sm:rotate-0"
                    aria-hidden="true"
                  />
                </span>
                <span className="sr-only">转换为</span>
              </div>

              <article className="flex min-h-64 flex-col rounded-xl border border-primary/25 bg-[linear-gradient(145deg,#fffafd_0%,#fff_68%)] p-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className="bg-card font-bold"
                  >
                    实际图纸
                  </Badge>
                  <span className="text-xs font-bold text-muted-foreground">
                    本地处理
                  </span>
                </div>
                <div className="grid flex-1 place-items-center py-5">
                  <Image
                    src="/help/sample-cat-pattern.png"
                    alt="猫咪示例经过本地处理后生成的 65 乘 65 格拼豆图纸"
                    width={208}
                    height={208}
                    className="size-44 rounded-sm border border-workbench-border bg-white shadow-[0_12px_28px_rgb(80_44_59/0.12)] sm:size-52"
                  />
                </div>
                <div className="flex items-center justify-center gap-3 border-t border-border pt-3 text-xs font-bold text-muted-foreground">
                  <span>65 × 65 格</span>
                  <span className="size-1 rounded-full bg-border" />
                  <span>真实 MARD 色</span>
                  <span className="size-1 rounded-full bg-border" />
                  <span>可继续精修</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section aria-labelledby="quick-start">
          <h2
            id="quick-start"
            className="mb-4 text-xl font-black"
          >
            四步完成一张图纸
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map(([Icon, title, body], index) => (
              <article
                key={title}
                className="rounded-xl border border-border bg-card p-5 text-card-foreground"
              >
                <div className="mb-4 flex items-center justify-between">
                  <Icon className="text-primary" />
                  <span className="text-xs font-bold text-muted-foreground">
                    0
                    {index + 1}
                  </span>
                </div>
                <h3 className="m-0 text-base font-black">{title}</h3>
                <p className="mb-0 mt-2 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl bg-secondary p-6 text-secondary-foreground">
            <ShieldCheck className="mb-4 text-success" />
            <h2 className="m-0 text-xl font-black">本地优先</h2>
            <p className="mb-0 mt-3 text-sm leading-6 text-workbench-muted">
              不开启 AI
              时，上传、生成、编辑和导出都在浏览器内完成。图纸会保存在当前设备。
            </p>
          </article>
          <article className="rounded-xl bg-secondary p-6 text-secondary-foreground">
            <Palette className="mb-4 text-primary" />
            <h2 className="m-0 text-xl font-black">MARD 291 色</h2>
            <ul className="mt-3 grid gap-2 p-0 text-sm text-workbench-muted">
              <li className="flex items-center gap-2">
                <Check
                  size={14}
                  className="text-success"
                />
                只输出有效 MARD 色号
              </li>
              <li className="flex items-center gap-2">
                <Check
                  size={14}
                  className="text-success"
                />
                白色豆与空白格分开统计
              </li>
              <li className="flex items-center gap-2">
                <Check
                  size={14}
                  className="text-success"
                />
                自动合并低用量零碎色
              </li>
            </ul>
          </article>
        </section>

        <section
          className="mt-12"
          aria-labelledby="faq"
        >
          <h2
            id="faq"
            className="mb-4 text-xl font-black"
          >
            常见问题
          </h2>
          <Accordion className="overflow-hidden rounded-xl border border-border bg-card">
            {questions.map(([question, answer], index) => (
              <AccordionItem
                key={question}
                value={`faq-${index}`}
              >
                <AccordionTrigger className="min-h-16 items-center px-5 py-4 text-base font-bold hover:no-underline">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-sm leading-6 text-muted-foreground">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
    </div>
  );
}
