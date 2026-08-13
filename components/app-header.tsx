"use client";

import { Check, ChevronsUpDown, CircleHelp, Images, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { PatternCanvas } from "@/components/pattern-canvas";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  onHome?: () => void;
  projects?: Array<Pick<Project, "id" | "name" | "pattern">>;
  currentProjectId?: string;
  onSelectProject?: (id: string) => void;
  onNewProject?: () => void;
};

export function AppHeader({
  onHome,
  projects = [],
  currentProjectId,
  onSelectProject,
  onNewProject,
}: AppHeaderProps) {
  const currentProject = projects.find(
    project => project.id === currentProjectId,
  );
  const brand = (
    <>
      <Image
        className="size-9 rounded-[9px]"
        src="/logo.svg"
        alt=""
        width={36}
        height={36}
        priority
      />
      <span className="font-[850] tracking-[-0.02em] max-[640px]:text-[0.9rem] max-[360px]:hidden">
        拼豆图纸生成器
      </span>
    </>
  );
  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b border-border bg-card px-6 text-foreground max-[640px]:h-14 max-[640px]:px-3">
      {onHome
        ? (
            <Button
              variant="ghost"
              className="flex items-center gap-[9px] border-0 bg-transparent p-0 text-inherit hover:bg-transparent max-[640px]:min-h-11"
              onClick={onHome}
              aria-label="返回拼豆图纸生成器首页"
            >
              {brand}
            </Button>
          )
        : (
            <Link
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "flex items-center gap-[9px] border-0 bg-transparent p-0 text-inherit hover:bg-transparent max-[640px]:min-h-11",
              )}
              href="/"
            >
              {brand}
            </Link>
          )}
      <div className="flex items-center gap-4 max-[640px]:gap-2">
        <Link
          href="/help"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground max-[640px]:hidden",
          )}
        >
          <CircleHelp size={15} />
          使用帮助
        </Link>
        {onNewProject && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-12 w-[230px] cursor-pointer items-center gap-[9px] rounded-[11px] border border-border bg-muted py-[5px] pr-2 pl-[5px] text-foreground aria-expanded:border-primary aria-expanded:bg-accent max-[640px]:relative max-[640px]:min-h-10! max-[640px]:w-[156px] max-[640px]:gap-[7px] max-[640px]:py-[3px] max-[640px]:pr-1.5 max-[640px]:pl-[3px] [&>svg]:w-4 [&>svg]:text-muted-foreground"
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-[9px] border border-border bg-card text-foreground [&_svg]:w-[17px] max-[640px]:size-7",
                    currentProject
                    && "overflow-hidden bg-[#26344a] p-0.5 [&_canvas]:h-full [&_canvas]:w-full! [&_canvas]:object-contain",
                  )}
                  aria-hidden="true"
                >
                  {currentProject
                    ? (
                        <PatternCanvas
                          pattern={currentProject.pattern}
                          showGrid={false}
                        />
                      )
                    : (
                        <Images />
                      )}
                </span>
                <span className="grid min-w-0 flex-1 gap-px text-left">
                  <strong className="truncate text-[0.76rem] max-[640px]:max-w-[84px]">
                    {currentProject?.name || "我的图纸"}
                  </strong>
                  <small className="truncate text-[0.62rem] text-muted-foreground">
                    {projects.length}
                    {" "}
                    个图纸
                  </small>
                </span>
                <ChevronsUpDown />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="top-[calc(100%+1px)] w-[min(288px,calc(100vw-24px))]">
              <DropdownMenuLabel>我的图纸</DropdownMenuLabel>
              {projects.length
                ? (
                    projects.map(project => (
                      <DropdownMenuItem
                        key={project.id}
                        className={
                          project.id === currentProjectId ? "bg-accent" : ""
                        }
                        onClick={() => onSelectProject?.(project.id)}
                      >
                        <span
                          className="grid size-7 place-items-center overflow-hidden rounded-[9px] border border-border bg-[#26344a] p-0.5 text-muted-foreground [&_canvas]:h-full [&_canvas]:w-full! [&_canvas]:object-contain [&_svg]:w-[17px]"
                          aria-hidden="true"
                        >
                          <PatternCanvas
                            pattern={project.pattern}
                            showGrid={false}
                          />
                        </span>
                        <span className="truncate">{project.name}</span>
                        {project.id === currentProjectId && (
                          <Check className="ml-auto" />
                        )}
                      </DropdownMenuItem>
                    ))
                  )
                : (
                    <DropdownMenuItem disabled>还没有图纸</DropdownMenuItem>
                  )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onNewProject}>
                <span className="grid size-7 place-items-center rounded-[9px] border border-border bg-card text-muted-foreground [&_svg]:w-[17px]">
                  <Plus />
                </span>
                新建图纸
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
