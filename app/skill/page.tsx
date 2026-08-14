import type { Metadata } from "next";
import Image from "next/image";
import { AppHeader } from "@/components/app-header";
import { NewProjectTrigger } from "@/components/new-project-dialog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = {
  title: "Skill 使用指南",
  description:
    "安装 image-to-pindou Skill，通过对话把图片转换成可制作的 MARD 拼豆图纸。",
};

const installCommand
  = "npx skills add kuizuo/pin-dou --skill image-to-pindou -g -y";
const examplePrompt
  = "使用 $image-to-pindou，把这张图片做成 50×50 的拼豆图纸，移除背景，最多使用 18 种颜色。";

export default function SkillPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-[min(920px,calc(100%-32px))] py-10 sm:py-14">
        <header className="max-w-2xl pb-10 sm:pb-12">
          <Badge
            variant="outline"
            className="mb-4 h-7 bg-card px-3 font-bold"
          >
            Skill 使用指南
          </Badge>
          <h1 className="m-0 text-3xl font-black tracking-tight sm:text-4xl">
            image-to-pindou
          </h1>
          <p className="mb-0 mt-4 text-base leading-7 text-muted-foreground">
            安装后，发送一张图片和一句要求，即可生成拼豆预览、完整图纸、购豆清单和可继续精修的作品文件。
          </p>
        </header>

        <section
          id="install"
          className="grid scroll-mt-24 gap-5 border-t border-border py-10 sm:grid-cols-[180px_1fr] sm:gap-8 sm:py-12"
          aria-labelledby="install-title"
        >
          <div>
            <span className="eyebrow">01</span>
            <h2
              id="install-title"
              className="mb-0 mt-1 text-2xl font-black"
            >
              安装
            </h2>
          </div>
          <div className="min-w-0">
            <p className="mb-4 mt-0 text-sm leading-6 text-muted-foreground">
              在终端运行下面的命令。这是可选功能，不影响网页生成器的使用。
            </p>
            <div className="overflow-hidden rounded-xl border border-workbench-border bg-workbench text-workbench-foreground">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-workbench-border px-4">
                <span className="text-xs font-bold text-workbench-muted">
                  安装命令
                </span>
                <CopyButton
                  value={installCommand}
                  label="复制命令"
                />
              </div>
              <pre className="m-0 overflow-x-auto p-4 text-sm leading-7">
                <code>{installCommand}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="grid gap-5 border-t border-border py-10 sm:grid-cols-[180px_1fr] sm:gap-8 sm:py-12">
          <div>
            <span className="eyebrow">02</span>
            <h2 className="mb-0 mt-1 text-2xl font-black">使用</h2>
          </div>
          <div className="min-w-0">
            <ol className="mb-6 mt-0 grid gap-3 pl-5 text-sm leading-6 text-muted-foreground">
              <li>在对话中发送需要转换的图片。粘贴下面的示例，并按需修改格数、背景和颜色数量。</li>
              <li>检查预览和图纸；需要精修时，将生成的 .pindou.json 导入“我的作品”。</li>
            </ol>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4">
                <span className="text-xs font-bold text-muted-foreground">
                  调用示例
                </span>
                <CopyButton
                  value={examplePrompt}
                  label="复制示例"
                  variant="outline"
                />
              </div>
              <pre className="m-0 whitespace-pre-wrap p-4 text-sm leading-7 text-foreground">
                <code>{examplePrompt}</code>
              </pre>
            </div>
          </div>
        </section>

        <section
          id="demo"
          className="scroll-mt-24 border-t border-border py-10 sm:py-12"
          aria-labelledby="demo-title"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">03</span>
              <h2
                id="demo-title"
                className="mb-0 mt-1 text-2xl font-black"
              >
                效果演示
              </h2>
            </div>
            <span className="text-sm text-muted-foreground">
              50 × 50 · 18 色 · 1470 颗
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card p-3">
              <Image
                src="/samples/mcd-lulu.png"
                alt="转换前的水豚噜噜原图"
                width={1024}
                height={1024}
                className="aspect-square h-auto w-full rounded-lg object-cover"
                sizes="(min-width: 920px) 426px, (min-width: 640px) calc(50vw - 40px), calc(100vw - 56px)"
              />
              <figcaption className="px-1 pb-1 pt-3 text-sm font-bold">
                原始图片
              </figcaption>
            </figure>
            <figure className="m-0 overflow-hidden rounded-xl border border-border bg-card p-3">
              <Image
                src="/skill/mcd-lulu-preview.png"
                alt="水豚噜噜转换后的 50 乘 50 拼豆预览"
                width={1200}
                height={1200}
                className="aspect-square h-auto w-full rounded-lg bg-workbench object-contain [image-rendering:pixelated]"
                sizes="(min-width: 920px) 426px, (min-width: 640px) calc(50vw - 40px), calc(100vw - 56px)"
              />
              <figcaption className="px-1 pb-1 pt-3 text-sm font-bold">
                拼豆预览
              </figcaption>
            </figure>
          </div>

          <figure className="m-0 mt-4 overflow-hidden rounded-xl border border-border bg-card p-3">
            <Image
              src="/skill/mcd-lulu-pattern.png"
              alt="带网格、MARD 色号和用豆数量的水豚噜噜完整拼豆图纸"
              width={1492}
              height={1232}
              className="h-auto w-full rounded-lg border border-border bg-white"
              sizes="(min-width: 920px) 894px, calc(100vw - 56px)"
            />
            <figcaption className="px-1 pb-1 pt-3 text-sm font-bold">
              完整图纸
            </figcaption>
          </figure>
        </section>

        <section className="grid gap-5 border-t border-border py-10 sm:grid-cols-[180px_1fr] sm:gap-8 sm:py-12">
          <div>
            <span className="eyebrow">04</span>
            <h2 className="mb-0 mt-1 text-2xl font-black">继续精修</h2>
          </div>
          <div>
            <p className="mb-5 mt-0 text-sm leading-6 text-muted-foreground">
              如果对 Skill 生成的效果不满意，可以替换图片，在网页中调整格数、配色和每个格子。
            </p>
            <NewProjectTrigger
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "font-bold",
              )}
            >
              上传图片并精修
            </NewProjectTrigger>
          </div>
        </section>
      </main>
    </div>
  );
}
