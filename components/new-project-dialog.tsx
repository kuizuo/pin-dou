"use client";

import { ImagePlus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NewProjectRequest
  = { id: number; file: File };

type NewProjectContextValue = {
  clearRequest: (id: number) => void;
  openDialog: () => void;
  request: NewProjectRequest | null;
};

const NewProjectContext = createContext<NewProjectContextValue | null>(null);

export function useNewProjectDialog() {
  const context = useContext(NewProjectContext);
  if (!context)
    throw new Error("useNewProjectDialog must be used inside NewProjectProvider");
  return context;
}

export function UploadCard({
  className,
  onFile,
  onSample,
}: {
  className?: string;
  onFile: (file?: File) => void;
  onSample: () => void;
}) {
  const input = useRef<HTMLInputElement>(null),
    [dragging, setDragging] = useState(false);
  return (
    <div
      className={cn(
        "flex min-h-[360px] flex-col gap-2.5 rounded-[22px] bg-workbench p-[18px] text-workbench-foreground shadow-[0_26px_45px_rgb(24_34_53/0.2)] [transform:rotate(1.5deg)] [&>[data-slot=button]]:border-[#d9ccd0] [&>[data-slot=button]]:bg-white [&>[data-slot=button]]:text-[#182235] max-[641px]:min-h-80! max-[641px]:[transform:none]!",
        className,
      )}
    >
      <input
        className="hidden"
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        className="flex min-h-[245px]! flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[#64738a] bg-workbench-raised text-inherit hover:border-primary data-[dragging=true]:border-primary data-[dragging=true]:bg-[#2b3950] data-[dragging=true]:shadow-[inset_0_0_0_3px_rgb(238_51_145/18%)]"
        type="button"
        data-dragging={dragging}
        onClick={() => input.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={event => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="grid size-[62px] place-items-center rounded-[18px] bg-primary text-white">
          <ImagePlus size={30} />
        </span>
        <strong className="text-[1.1rem]">
          {dragging ? "松开即可上传" : "从相册选择图片"}
        </strong>
        <small className="text-center text-workbench-muted">
          JPG、PNG、WebP、HEIC · 不超过 10MB
        </small>
      </button>
      <Button
        variant="outline"
        onClick={onSample}
      >
        <ImagePlus size={17} />
        先看示例
      </Button>
    </div>
  );
}

export function NewProjectTrigger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { openDialog } = useNewProjectDialog();
  return (
    <button
      type="button"
      className={className}
      onClick={openDialog}
    >
      {children}
    </button>
  );
}

export function NewProjectProvider({ children }: { children: ReactNode }) {
  const input = useRef<HTMLInputElement>(null),
    requestId = useRef(0);
  const pathname = usePathname(),
    router = useRouter(),
    [request, setRequest] = useState<NewProjectRequest | null>(null);

  const openDialog = useCallback(() => input.current?.click(), []);
  const clearRequest = useCallback((id: number) => {
    setRequest(current => current?.id === id ? null : current);
  }, []);
  const choose = useCallback((file: File) => {
    setRequest({ file, id: ++requestId.current });
    if (pathname !== "/" && !pathname.startsWith("/patterns/"))
      router.push("/");
  }, [pathname, router]);

  const value = useMemo(() => ({ clearRequest, openDialog, request }), [
    clearRequest,
    openDialog,
    request,
  ]);

  return (
    <NewProjectContext value={value}>
      {children}
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) choose(file);
          event.target.value = "";
        }}
      />
    </NewProjectContext>
  );
}
