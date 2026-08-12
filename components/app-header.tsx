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
        className="app-logo"
        src="/logo.svg"
        alt=""
        width={36}
        height={36}
        priority
      />
      <span className="app-title">拼豆图纸生成器</span>
    </>
  );
  return (
    <header className="app-header">
      {onHome
        ? (
            <Button
              variant="ghost"
              className="brand-button"
              onClick={onHome}
              aria-label="返回拼豆图纸生成器首页"
            >
              {brand}
            </Button>
          )
        : (
            <Link
              className={cn(buttonVariants({ variant: "ghost" }), "brand-button")}
              href="/"
            >
              {brand}
            </Link>
          )}
      <div className="app-header-actions">
        <Link
          href="/help"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "quiet-link",
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
                className="project-switcher-trigger"
              >
                <span
                  className={`project-switcher-icon${currentProject ? " project-thumbnail" : ""}`}
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
                <span className="project-switcher-copy">
                  <strong>{currentProject?.name || "我的图纸"}</strong>
                  <small>
                    {projects.length}
                    {" "}
                    个图纸
                  </small>
                </span>
                <ChevronsUpDown />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="project-switcher-menu">
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
                          className="project-item-icon project-thumbnail"
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
                <span className="project-item-icon">
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
