"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Home, NewProject } from "@/components/workspace/home";
import { type Draft, Prepare } from "@/components/workspace/prepare";
import { Result } from "@/components/workspace/result";
import {
  type AiProvider,
  type AiRequest,
  type AiStyleCandidate,
  type AiStyleFailure,
  generatePixelStyle,
} from "@/lib/ai";
import {
  imageToPattern,
  prepareImageFile,
  removeBackground,
  renderGenerationSource,
  validateImageFile,
} from "@/lib/pattern";
import {
  addVersion,
  deleteProject,
  listProjects,
  saveProject,
} from "@/lib/projects";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TRANSFORM,
  type GenerationMode,
  type GenerationSettings,
  type SourceVariant,
} from "@/lib/types";
import {
  projectPath,
  workspaceRoute,
  type WorkspaceRoute,
} from "@/lib/workspace-route";

type Stage = "loading" | "missing" | "home" | "new" | "prepare" | "result";

type WorkspaceProps = {
  initialProjectId?: string;
  initialStage?: "home" | "new";
};

type SampleImage = { name: string; src: string };

const GENERATION_MODE_KEY = "pindou-generation-mode-v1";

function savedGenerationMode(): GenerationMode {
  if (typeof window === "undefined") return DEFAULT_SETTINGS.mode;
  try {
    return window.localStorage.getItem(GENERATION_MODE_KEY) === "ai"
      ? "ai"
      : "local";
  }
  catch {
    return DEFAULT_SETTINGS.mode;
  }
}

export function Workspace({
  initialProjectId,
  initialStage = "home",
}: WorkspaceProps) {
  const [stage, setStage] = useState<Stage>(
    initialProjectId ? "loading" : initialStage,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [current, setCurrent] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preferredMode, setPreferredMode] = useState(savedGenerationMode);
  const [aiProvider, setAiProvider] = useState<AiProvider>("cloudflare");
  const [geminiKey, setGeminiKey] = useState("");
  const [aiCandidates, setAiCandidates] = useState<AiStyleCandidate[]>([]);
  const [aiFailures, setAiFailures] = useState<AiStyleFailure[]>([]);
  const [samples, setSamples] = useState<SampleImage[]>([]);
  const [workbenchPending, setWorkbenchPending] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<
    (() => void) | null
  >(null);
  const workbenchPendingRef = useRef(false);
  const currentProjectIdRef = useRef(initialProjectId || null);

  async function refresh() {
    setProjects(await listProjects());
  }

  function setPath(path: string) {
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }

  useEffect(() => {
    let active = true;

    async function openRoute(
      route: WorkspaceRoute = initialProjectId
        ? { projectId: initialProjectId, stage: "result" }
        : { stage: initialStage },
    ) {
      const items = await listProjects();
      if (!active) return;

      setProjects(items);
      if (route.stage === "result") {
        const project = items.find(item => item.id === route.projectId);
        setCurrent(project || null);
        setDraft(null);
        setStage(project ? route.stage : "missing");
      }
      else {
        setCurrent(null);
        setDraft(null);
        setStage(route.stage);
      }
    }

    void openRoute();
    const pop = () => {
      const path = window.location.pathname;
      const projectId = currentProjectIdRef.current;
      if (workbenchPendingRef.current && projectId) {
        window.history.pushState(null, "", projectPath(projectId));
        setPendingNavigation(() => () => {
          window.history.replaceState(null, "", path);
          void openRoute(workspaceRoute(path));
        });
        return;
      }
      void openRoute(workspaceRoute(path));
    };
    window.addEventListener("popstate", pop);

    return () => {
      active = false;
      window.removeEventListener("popstate", pop);
    };
  }, [initialProjectId, initialStage]);

  useEffect(() => {
    currentProjectIdRef.current = current?.id || null;
  }, [current]);

  function setPendingState(pending: boolean) {
    workbenchPendingRef.current = pending;
    setWorkbenchPending(pending);
  }

  function rememberGenerationMode(mode: GenerationMode) {
    setPreferredMode(mode);
    try {
      window.localStorage.setItem(GENERATION_MODE_KEY, mode);
    }
    catch { /* private browsing or storage restrictions keep the current session working */ }
  }

  async function chooseFile(file?: File) {
    if (!file) return;

    try {
      validateImageFile(file);
      const dataUrl = await prepareImageFile(file);
      setCurrent(null);
      setDraft({
        dataUrl,
        file,
        settings: { ...DEFAULT_SETTINGS, mode: preferredMode },
        transform: { ...DEFAULT_TRANSFORM },
      });
      setMessage("");
      setAiCandidates([]);
      setAiFailures([]);
      setStage("prepare");
      setPath("/new");
      window.scrollTo(0, 0);
    }
    catch (error) {
      alert(error instanceof Error ? error.message : "图片无法打开。");
    }
  }

  async function chooseSample(next = false) {
    try {
      const items = samples.length
        ? samples
        : await fetch("/api/samples").then(async (response) => {
            if (!response.ok) throw new Error();
            return ((await response.json()) as { samples: SampleImage[] })
              .samples;
          });
      if (!items.length) throw new Error();
      if (!samples.length) setSamples(items);
      const currentIndex = items.findIndex(
        item => item.src === draft?.dataUrl,
      );
      const sample
        = items[
          next && currentIndex >= 0 ? (currentIndex + 1) % items.length : 0
        ];
      const response = await fetch(sample.src);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      setDraft({
        dataUrl: sample.src,
        file: new File([blob], sample.name, { type: blob.type }),
        settings: draft?.settings || { ...DEFAULT_SETTINGS, mode: preferredMode },
        transform: { ...DEFAULT_TRANSFORM },
      });
      setMessage("");
      setAiCandidates([]);
      setAiFailures([]);
      setStage("prepare");
      setPath("/new");
      window.scrollTo(0, 0);
    }
    catch {
      alert("示例图片无法打开，请稍后再试。");
    }
  }

  async function finishGeneration(
    sourceDataUrl: string,
    settings: GenerationSettings,
    sourceVariant: SourceVariant,
    generatedSource?: Blob,
    processedDataUrl?: string,
  ) {
    if (!draft) return;
    setBusy(true);
    try {
      setMessage(
        settings.background === "keep"
          ? "正在匹配 MARD 291 色…"
          : "正在本机去背景…",
      );
      const processed
        = processedDataUrl
          || (await removeBackground(
            sourceDataUrl,
            settings.background,
            setMessage,
          ));
      setMessage("正在整理颜色和图案轮廓…");
      const pattern = await imageToPattern(
        processed,
        draft.file.name,
        settings,
        generatedSource ? DEFAULT_TRANSFORM : draft.transform,
        settings.background === "keep" ? undefined : sourceDataUrl,
      );
      const now = new Date().toISOString();
      const removed = settings.background !== "keep";
      const project = addVersion(
        {
          backgroundRemoved: removed,
          createdAt: now,
          generatedSource,
          id: crypto.randomUUID(),
          name: pattern.name,
          pattern,
          processedSource: removed
            ? await fetch(processed).then(response => response.blob())
            : undefined,
          settings,
          source: draft.file,
          sourceName: draft.file.name,
          sourceType: draft.file.type,
          sourceVariant,
          transform: draft.transform,
          updatedAt: now,
          versions: [],
        },
        pattern,
        "auto",
        "首次生成",
      );

      await saveProject(project);
      setCurrent(project);
      await refresh();
      setStage("result");
      setPath(projectPath(project.id));
      setMessage("");
      setAiCandidates([]);
      setAiFailures([]);
      window.scrollTo(0, 0);
    }
    catch (error) {
      setMessage(
        error instanceof Error ? error.message : "图纸生成失败，请重试。",
      );
    }
    finally {
      setBusy(false);
    }
  }

  async function generateAiVariant(request: AiRequest) {
    if (!draft) return;
    setBusy(true);
    setMessage("AI 正在整理画面和配色…");
    setAiCandidates([]);
    setAiFailures([]);
    try {
      const selected = await renderGenerationSource(
        draft.dataUrl,
        draft.transform,
      );
      const candidate = await generatePixelStyle(selected, request, setMessage);
      setAiCandidates([candidate]);
      setMessage("图纸已经准备好，请确认后继续");
    }
    catch (error) {
      setAiFailures([
        {
          variant: "pixel",
          message: error instanceof Error ? error.message : "生成失败",
        },
      ]);
      setMessage(
        error instanceof Error ? error.message : "AI 处理失败，请重试。",
      );
    }
    finally {
      setBusy(false);
    }
  }

  async function generate(request?: AiRequest) {
    if (!draft) return;
    if (draft.settings.mode === "ai" && request)
      return generateAiVariant(request);
    await finishGeneration(
      draft.dataUrl,
      { ...draft.settings, background: "keep" },
      "original",
    );
  }

  async function chooseAiCandidate(candidate: AiStyleCandidate) {
    if (!draft) return;
    const generatedSource = await fetch(candidate.originalImage).then(
      response => response.blob(),
    );
    const settings = {
      ...draft.settings,
      background: "plain" as const,
      processingMode: "edge" as const,
    };
    setDraft({ ...draft, settings });
    await finishGeneration(
      candidate.originalImage,
      settings,
      "ai-pixel",
      generatedSource,
      candidate.image,
    );
  }

  async function updateCurrent(project: Project) {
    setCurrent(project);
    setProjects(items =>
      items.map(item => (item.id === project.id ? project : item)),
    );
  }

  const home = () => {
    setStage("home");
    setCurrent(null);
    setDraft(null);
    setMessage("");
    setAiCandidates([]);
    setAiFailures([]);
    setPath("/");
    window.scrollTo(0, 0);
    void refresh();
  };

  const newProject = () => {
    setStage("new");
    setCurrent(null);
    setDraft(null);
    setMessage("");
    setAiCandidates([]);
    setAiFailures([]);
    setPath("/new");
    window.scrollTo(0, 0);
  };

  async function deleteCurrent() {
    if (!current) return;
    await deleteProject(current.id);
    setProjects(items => items.filter(item => item.id !== current.id));
    window.history.replaceState(null, "", "/");
    home();
  }

  const openProject = (project: Project) => {
    setCurrent(project);
    setDraft(null);
    setStage("result");
    setMessage("");
    setAiCandidates([]);
    setAiFailures([]);
    setPath(projectPath(project.id));
    window.scrollTo(0, 0);
  };

  function guardNavigation(action: () => void) {
    if (!workbenchPending) return action();
    setPendingNavigation(() => action);
  }

  const header = (
    <AppHeader
      currentProjectId={current?.id}
      onHome={() => guardNavigation(home)}
      onNewProject={() => guardNavigation(newProject)}
      onSelectProject={(id) => {
        const project = projects.find(item => item.id === id);
        if (project) guardNavigation(() => openProject(project));
      }}
      projects={projects}
    />
  );

  return (
    <div className="app-shell">
      {header}
      {stage === "loading" && (
        <main className="workspace route-state">
          <LoaderCircle className="spin" />
          <p>正在打开图纸…</p>
        </main>
      )}
      {stage === "missing" && (
        <main className="workspace route-state">
          <h1>找不到这张图纸</h1>
          <p>它可能已被删除，或只保存在另一台设备上。</p>
          <Button onClick={home}>返回我的作品</Button>
        </main>
      )}
      {stage === "home" && (
        <Home
          onFile={file => void chooseFile(file)}
          onOpen={openProject}
          onRefresh={refresh}
          onSample={() => void chooseSample()}
          projects={projects}
        />
      )}
      {stage === "new" && (
        <NewProject
          onFile={file => void chooseFile(file)}
          onSample={() => void chooseSample()}
        />
      )}
      {stage === "prepare" && draft && (
        <Prepare
          aiProvider={aiProvider}
          candidates={aiCandidates}
          busy={busy}
          draft={draft}
          failures={aiFailures}
          geminiKey={geminiKey}
          message={message}
          onAiProviderChange={setAiProvider}
          onBack={home}
          onChooseCandidate={candidate => void chooseAiCandidate(candidate)}
          onGeminiKeyChange={setGeminiKey}
          onGenerate={request => void generate(request)}
          onModeChange={rememberGenerationMode}
          onRegenerate={() => {
            setAiCandidates([]);
            setAiFailures([]);
            setMessage("");
            window.scrollTo(0, 0);
          }}
          onRetry={request => void generateAiVariant(request)}
          onSwitchSample={
            samples.some(sample => sample.src === draft.dataUrl)
              ? () => void chooseSample(true)
              : undefined
          }
          samplePosition={
            samples.findIndex(sample => sample.src === draft.dataUrl) + 1
          }
          sampleTotal={samples.length}
          setDraft={(next) => {
            setDraft(next);
            setAiCandidates([]);
            setAiFailures([]);
            setMessage("");
          }}
        />
      )}
      {stage === "result" && current && (
        <Result
          key={current.id}
          onChange={project => void updateCurrent(project)}
          onDelete={deleteCurrent}
          onPendingChange={setPendingState}
          project={current}
        />
      )}
      <AlertDialog
        open={pendingNavigation !== null}
        onOpenChange={open => !open && setPendingNavigation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>还有未应用的调整</AlertDialogTitle>
            <AlertDialogDescription>
              尺寸、颜色或背景设置还没有应用。继续离开会放弃这些数值，当前图纸不会改变。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续调整</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingNavigation;
                setPendingNavigation(null);
                setPendingState(false);
                action?.();
              }}
            >
              放弃并离开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
