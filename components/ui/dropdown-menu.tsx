"use client";

import {
  type ButtonHTMLAttributes,
  cloneElement,
  createContext,
  type HTMLAttributes,
  isValidElement,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const DropdownContext = createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function useDropdown() {
  const value = useContext(DropdownContext);
  if (!value)
    throw new Error("DropdownMenu components must be used inside DropdownMenu");
  return value;
}

function DropdownMenu({ children }: { children: ReactNode; modal?: boolean }) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <DropdownContext value={{ open, setOpen }}>
      <div
        ref={root}
        data-slot="dropdown-menu"
        className="relative"
      >
        {children}
      </div>
    </DropdownContext>
  );
}

function DropdownMenuTrigger({
  asChild,
  children,
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { open, setOpen } = useDropdown();
  const trigger = {
    ...props,
    "data-slot": "dropdown-menu-trigger",
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "onClick": (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      setOpen(!open);
    },
  };
  if (
    asChild
    && isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(children)
  )
    return cloneElement(children, {
      ...trigger,
      className: cn(children.props.className, className),
      onClick: (event) => {
        children.props.onClick?.(event);
        trigger.onClick(event);
      },
    });
  return (
    <button
      type="button"
      className={className}
      {...trigger}
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  const { open } = useDropdown();
  if (!open) return null;
  return (
    <div
      role="menu"
      data-slot="dropdown-menu-content"
      className={cn(
        "absolute top-[calc(100%+8px)] right-0 z-50 max-h-[min(70dvh,560px)] min-w-56 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDropdown();
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="dropdown-menu-item"
      className={cn(
        "flex min-h-11 w-full cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm outline-hidden select-none hover:bg-accent focus-visible:bg-accent focus-visible:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
