import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const normalizedCss = css.replaceAll("\"", "").replace(/\s+/g, " ");
const result = readFileSync(
  new URL("../components/workspace/result.tsx", import.meta.url),
  "utf8",
);
const prepare = readFileSync(
  new URL("../components/workspace/prepare.tsx", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("../components/workspace.tsx", import.meta.url),
  "utf8",
);
const header = readFileSync(
  new URL("../components/app-header.tsx", import.meta.url),
  "utf8",
);
const newProjectDialog = readFileSync(
  new URL("../components/new-project-dialog.tsx", import.meta.url),
  "utf8",
);
const home = readFileSync(
  new URL("../components/workspace/home.tsx", import.meta.url),
  "utf8",
);
const skillPage = readFileSync(
  new URL("../app/skill/page.tsx", import.meta.url),
  "utf8",
);
const copyButton = readFileSync(
  new URL("../app/skill/copy-button.tsx", import.meta.url),
  "utf8",
);
const patternPreview = readFileSync(
  new URL("../components/pattern-preview-dialog.tsx", import.meta.url),
  "utf8",
);
const aiSettings = readFileSync(
  new URL("../components/ai-settings-dialog.tsx", import.meta.url),
  "utf8",
);
const turnstile = readFileSync(
  new URL("../components/turnstile.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const ai = readFileSync(new URL("../lib/ai.ts", import.meta.url), "utf8");

describe("统一图纸工作台", () => {
  it("顶部可以进入包含安装、使用和真实效果的 Skill 指南", () => {
    expect(header).toContain("href=\"/skill\"");
    expect(header.indexOf("href=\"/skill\"")).toBeLessThan(
      header.indexOf("使用帮助"),
    );
    expect(skillPage).toContain("id=\"install\"");
    expect(skillPage).toContain("id=\"demo\"");
    expect(skillPage).toContain("npx skills add kuizuo/pin-dou");
    expect(skillPage).toContain("/skill/mcd-lulu-pattern.png");
    expect(skillPage.match(/<CopyButton/g)).toHaveLength(2);
    expect(skillPage).toContain("<NewProjectTrigger");
    expect(copyButton).toContain("navigator.clipboard.writeText(value)");
    expect(copyButton).toContain("已复制");
    expect(copyButton).toContain("setState(\"idle\"), 2000");
    expect(header).toContain("listProjects()");
    expect(header).toContain("router.push(projectPath(id))");
    expect(header).toContain("else openDialog()");
    expect(newProjectDialog).toContain("input.current?.click()");
    expect(workspace).toContain("<Dialog.Popup");
    expect(workspace).toContain("<Prepare");
    expect(existsSync(new URL("../app/new/page.tsx", import.meta.url))).toBe(false);
  });

  it("作品列表支持多选后统一确认删除", () => {
    expect(home.indexOf("导入 JSON")).toBeLessThan(home.lastIndexOf("批量删除"));
    expect(home).toContain("导入文件夹");
    expect(home).toContain("webkitdirectory");
    expect(home).toContain("droppedJsonFiles(event.dataTransfer)");
    expect(home).toContain("批量删除");
    expect(home).toContain("aria-pressed={selectionMode");
    expect(home).toContain("await deleteProjects([...selectedIds])");
    expect(home).toContain("删除选中的 ${selectedIds.size} 个作品");
  });

  it("备份和恢复操作集中在备份设置弹窗", () => {
    const settings = home.indexOf("<AlertDialogTitle>备份设置</AlertDialogTitle>");
    expect(settings).toBeGreaterThan(-1);
    expect(home.indexOf("恢复备份")).toBeGreaterThan(settings);
    expect(home.indexOf("备份全部")).toBeGreaterThan(settings);
  });

  it("每个作品可用共享弹窗直接预览图纸", () => {
    expect(home).toContain("<PatternPreviewDialog");
    expect(home).toContain("<Eye />");
    expect(home).toContain("预览");
    expect(result).toContain("<PatternPreviewDialog");
  });

  it("按钮的键盘焦点清晰但不过重", () => {
    expect(normalizedCss).toContain("button:not([data-slot]):focus-visible");
  });

  it("生成前只保留裁切和生成方式，详细参数留到生成后", () => {
    expect(prepare).not.toContain("生成前确认");
    expect(prepare).not.toContain("裁切需要保留的画面");
    expect(prepare).not.toContain("生成像素稿");
    expect(prepare).toContain("生成方式");
    expect(prepare).toContain("本地处理");
    expect(prepare).toContain("AI 处理");
    expect(prepare).toContain("1:1 裁切");
    expect(prepare).toContain("<CropIcon />");
    expect(prepare).not.toContain("3:4");
    expect(prepare).not.toContain("4:3");
    expect(prepare).toContain("aspect={aspect}");
    expect(prepare).not.toContain("颜色上限");
    expect(prepare).not.toContain("图案最长边");
    expect(prepare).toContain("w-[min(740px,calc(100%-32px))]");
    expect(normalizedCss).not.toContain(".prepare-submit-bar");
    expect(prepare).toContain("mb-3 flex min-h-11");
    expect(prepare).toContain(">裁切图片</h2>");
  });

  it("格数和颜色使用常用值按钮，也可直接填写", () => {
    expect(result).toContain("label=\"豆板格数\"");
    expect(result).not.toContain("label=\"格数\"");
    expect(result).toContain("presets={[29, 52, 78, 104]}");
    expect(result).toContain("presets={[8, 12, 16, 20]}");
    expect(result).toContain("aria-label={`自定义${label}`}");
    expect(result).toContain("setCustomizing(true)");
    expect(result).toContain("自定义");
    expect(result).toContain("type=\"number\"");
    expect(result).toContain("修改格数并重排图纸？");
    expect(result).toContain("当前手工编辑不会保留");
    expect(result).toContain("applyAdjustments(next, true)");
    expect(result).not.toContain("disabled={hasManualEdits}");
    expect(result).not.toMatch(/type="range"[\s\S]{0,160}longestEdge/);
    expect(result).not.toMatch(/type="range"[\s\S]{0,160}maxColors/);
  });

  it("生成时保存完整图片调整结果，原图对比直接使用该结果", () => {
    expect(workspace).toContain("const adjustedSource = await renderGenerationSource(");
    expect(workspace).toContain("adjustedSourceBlob");
    expect(result).toContain("renderGenerationSource(");
    expect(result).toContain("projectRef.current.transform");
    expect(result).toContain("projectRef.current.generatedSource");
    expect(result).toContain("? await readBlobAsDataUrl(source)");
    expect(result).not.toContain("original: await readBlobAsDataUrl(projectRef.current.source)");
  });

  it("三个 AI 服务都在设置弹窗中，密钥不挤占主界面", () => {
    expect(aiSettings).toContain("Cloudflare AI");
    expect(aiSettings).toContain("Gemini API Key");
    expect(aiSettings).toContain("GPT Image 2");
    expect(aiSettings).toContain("OpenAI API Key");
    expect(aiSettings).toContain("保存在当前浏览器");
    expect(aiSettings).toContain("不会写入作品或备份");
    expect(aiSettings).toContain("AI 只做像素化并尽量保留原图颜色");
    expect(prepare).not.toContain("AI 只做像素化并尽量保留原图颜色");
    expect(aiSettings).toContain("hidden={provider !== \"cloudflare\"}");
    expect(aiSettings).toContain("hidden={provider !== \"openai\"}");
    expect(turnstile).toContain("\"appearance\": \"always\"");
    expect(turnstile).toContain("window.turnstile?.reset(widgetId)");
    expect(aiSettings).toContain("active={open}");
    expect(prepare).toContain("Date.now() - turnstileTime.current < 290_000");
    expect(prepare).toContain("AI 设置，当前使用");
    expect(prepare).not.toContain("gemini-key-field");
    expect(
      [prepare, result, aiSettings, ai].join("\n"),
    ).not.toContain("localStorage");
    expect(workspace).toContain("pindou-generation-mode-v1");
  });

  it("Gemini 密钥保存在当前浏览器，清空后删除", () => {
    expect(workspace).toContain("GEMINI_KEY_STORAGE_KEY");
    expect(workspace).toContain("savedGeminiKey");
    expect(workspace).toContain("window.localStorage.getItem(GEMINI_KEY_STORAGE_KEY)");
    expect(workspace).toContain("window.localStorage.setItem(GEMINI_KEY_STORAGE_KEY, value)");
    expect(workspace).toContain("window.localStorage.removeItem(GEMINI_KEY_STORAGE_KEY)");
    expect(workspace).toContain("onGeminiKeyChange={rememberGeminiKey}");
  });

  it("OpenAI 密钥保存在当前浏览器，清空后删除", () => {
    expect(workspace).toContain("OPENAI_KEY_STORAGE_KEY");
    expect(workspace).toContain("savedOpenaiKey");
    expect(workspace).toContain("window.localStorage.getItem(OPENAI_KEY_STORAGE_KEY)");
    expect(workspace).toContain("window.localStorage.setItem(OPENAI_KEY_STORAGE_KEY, value)");
    expect(workspace).toContain("window.localStorage.removeItem(OPENAI_KEY_STORAGE_KEY)");
    expect(workspace).toContain("onOpenaiKeyChange={rememberOpenaiKey}");
  });

  it("移除独立编辑页，把查看和编辑放在同一画布", () => {
    expect(
      existsSync(
        new URL("../app/patterns/[id]/edit/page.tsx", import.meta.url),
      ),
    ).toBe(false);
    expect(
      existsSync(
        new URL("../components/workspace/pixel-editor.tsx", import.meta.url),
      ),
    ).toBe(false);
    expect(result).toContain("className={`pattern-workbench");
    expect(result).toContain("<TransformWrapper");
    expect(result).toContain("<PatternCanvas");
    expect(result).toContain("onStrokeStart={beginStroke}");
    expect(result).toContain(
      "excluded: isEditing && !spacePanning ? [\"pattern-canvas\"] : []",
    );
    expect(result).toContain("pinch={{ disabled: false, allowPanning: true }}");
    expect(workspace).not.toContain("PixelEditor");
    expect(workspace).not.toContain("onEdit");
  });

  it("画布占满顶栏以外的空间并取消页面滚动", () => {
    expect(css.match(/\.pattern-workbench \{([^}]*)\}/)?.[1]).toContain(
      "height: calc(100dvh - 60px)",
    );
    expect(css.match(/\.pattern-workbench \{([^}]*)\}/)?.[1]).toContain(
      "overflow: hidden",
    );
    expect(css.match(/\.pattern-workbench \{([^}]*)\}/)?.[1]).toContain(
      "grid-template-rows: minmax(0, 1fr)",
    );
    expect(css.match(/\.workbench-canvas \{([^}]*)\}/)?.[1]).toContain(
      "radial-gradient",
    );
    expect(css.match(/\.workbench-board \{([^}]*)\}/)?.[1]).toContain(
      "box-shadow",
    );
    expect(result).toContain(
      "min-[980px]:[&.has-panel]:grid-cols-[minmax(0,1fr)_var(--workbench-panel-width)]!",
    );
  });

  it("工具和操作分布在约定的位置", () => {
    expect(result).toContain("className=\"workbench-toolbar ");
    expect(result).toContain("className=\"workbench-status ");
    expect(result).toContain("className=\"workbench-actions ");
    expect(result).toContain("className=\"workbench-lower-left ");
    expect(result).toContain("className=\"workbench-lower-right ");
    expect(result).not.toContain("锁定编辑");
    expect(result).toContain("抓手");
    expect(result).toContain("画笔");
    expect(result).toContain("整色替换");
    expect(result).not.toContain("更多工具");
    expect(result).toContain("<kbd>1</kbd>");
    expect(result).toContain("<kbd>{shortcut}</kbd>");
    expect(result).toContain("1: \"hand\"");
    expect(result).toContain("2: \"brush\"");
    expect(result).toContain("5: \"replace\"");
    expect(result).not.toContain("背景恢复");
    expect(patternPreview).toContain("图纸预览");
    expect(patternPreview).toContain("复制图片");
    expect(result).toContain("分享图纸");
    expect(result).toContain("预览并下载图纸");
    expect(patternPreview).toContain("下载 PNG");
    expect(patternPreview).toContain("aria-label=\"关闭预览\"");
    expect(normalizedCss).toContain(".pattern-preview-close { position: absolute; top: 14px; right: 16px;");
    expect(patternPreview).toContain("复制成功");
    expect(patternPreview).toContain("正在复制");
    expect(patternPreview).toContain("setTimeout(() => setCopied(false), 2000)");
    expect(patternPreview).toContain("if (copying || copied) return");
    expect(normalizedCss).toContain(".pattern-preview-copy { width: 116px;");
    expect(normalizedCss).toContain("overscroll-behavior: none");
    expect(patternPreview).toContain("{copied");
    expect(normalizedCss).not.toContain(".pattern-preview-copy-label > span");
    expect(normalizedCss).not.toContain("transition: opacity 140ms ease");
    expect(result).not.toContain("aria-label=\"预览图纸\"");
    expect(result).not.toContain("aria-label=\"复制图片\"");
    expect(result).not.toContain("标准施工图");
    expect(result).not.toContain("分页施工图");
  });

  it("图标按钮使用统一提示而不是原生标题", () => {
    expect(result).toContain("<ControlTooltip");
    expect(result).toContain("label=\"恢复 100% 缩放\"");
    expect(result).not.toMatch(
      /title="(?:锁定编辑|抓手|更多工具|预览图纸|分享图纸|下载图纸|恢复 100% 缩放)/,
    );
  });

  it("同组控件保持统一尺寸并随可用空间收紧", () => {
    expect(normalizedCss).toContain("--workbench-control-size: 36px");
    expect(normalizedCss).toContain("--panel-control-size: 40px");
    expect(normalizedCss).toContain(
      "--workbench-control-size: clamp(34px, 8.15vw, 40px); --panel-control-size: 44px",
    );
    expect(result).toContain(
      "@max-[1121px]/workbench-canvas:[&_kbd]:hidden!",
    );
    expect(result).toContain(
      "@max-[841px]/workbench-canvas:[&>button>span]:hidden!",
    );
    expect(normalizedCss).toContain(
      ".workbench-toolbar > button, .workbench-toolbar > [data-slot=dropdown-menu] > button",
    );
    expect(normalizedCss).toContain(".workbench-lower-right { right: 8px; bottom: 8px;");
    expect(result).toContain("max-[980px]:right-auto!");
    expect(result).toContain("max-[980px]:top-2!");
    expect(result).toContain("className=\"workbench-tool-properties ");
    expect(result).toContain(
      "max-[980px]:size-[var(--workbench-control-size)]!",
    );
    expect(result).toContain("wheel={{ wheelDisabled: true }}");
    expect(result).toContain(
      "trackPadPanning={{ disabled: false, velocityDisabled: true }}",
    );
  });

  it("颜色块直接显示色号并使用紧凑多列布局", () => {
    expect(result).toContain("--swatch-foreground");
    expect(result).toContain("className=\"workbench-tool-color ");
    expect(result).not.toContain(".slice(0, 6)");
    expect(result).toContain("className=\"color-series-heading\"");
    expect(normalizedCss).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))",
    );
    expect(normalizedCss).toContain(".color-series-heading::after");
    expect(normalizedCss).toContain(
      ".workbench-tool-colors { min-width: 0; flex: 1; display: flex; align-items: center; gap: 4px; overflow-x: auto;",
    );
    expect(result).toContain("min-[980px]:overflow-visible!");
    expect(normalizedCss).toContain(
      ".workbench-tool-color[aria-pressed=true] { border-color: var(--primary); box-shadow: inset 0 0 0 2px var(--primary);",
    );
  });

  it("下载旁的开关打开设置抽屉", () => {
    expect(result).toContain("const [panelOpen, setPanelOpen] = useState(true)");
    expect(result).toContain(
      "window.matchMedia(\"(min-width: 980px)\").matches",
    );
    expect(result).toContain("setPanelOpen(false)");
    expect(result).toContain("<PanelBottomOpen className=\"min-[980px]:hidden!\" />");
    expect(result).toContain("<PanelBottomClose className=\"min-[980px]:hidden!\" />");
    expect(result).toContain("{ id: \"adjust\", label: \"设置\" }");
    expect(result).toContain("{ id: \"colors\", label: \"颜色\" }");
    expect(result).toContain("{ id: \"versions\", label: \"版本\" }");
    expect(result).toContain("className={`workbench-panel ");
    expect(result).toContain("role=\"tablist\"");
    expect(result).toContain("onDoubleClick={() => addQuickColor(color.id)}");
    expect(normalizedCss).toContain(
      ".workbench-toolbar:has([aria-expanded=true]) { z-index: 8; overflow: visible;",
    );
    expect(result).toContain(
      "aria-label={panelOpen ? \"收起设置\" : \"展开设置\"}",
    );
    expect(result).not.toContain("MoreHorizontal");
    expect(result).not.toContain("应用调整");
    expect(result).not.toContain("整体调整");
    expect(result).not.toContain(">重新生成图纸</h2>");
    expect(result).not.toContain("可用色板");
    expect(result).toContain("颜色合并程度");
    expect(result).toContain("轮廓增强");
    expect(result).toContain("纯色块");
    expect(result).toContain("自然平均");
    expect(result.indexOf("轮廓增强")).toBeLessThan(
      result.indexOf("自然平均"),
    );
    expect(normalizedCss).toContain(
      ".panel-processing-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));",
    );
    expect(result).toContain("scheduleAdjustments");
  });

  it("设置页可以二次确认删除当前图纸并返回首页", () => {
    expect(result).toContain("删除后只能通过已有备份恢复");
    expect(result).toContain("确认删除");
    expect(result).toContain("await onDelete()");
    expect(workspace).toContain("await deleteProject(current.id)");
    expect(workspace).toContain("window.history.replaceState(null, \"\", \"/\")");
  });

  it("设置面板使用紧凑的背景开关和移动端 Sheet", () => {
    expect(result).toContain("<Switch");
    expect(result).toContain("checked={draftSettings.background === \"plain\"}");
    expect(result).toContain("镜像处理");
    expect(result).toContain("checked={draftSettings.mirror}");
    expect(result).toContain("aria-label=\"水平镜像图纸\"");
    expect(result).not.toContain("label: \"去除纯色背景\"");
    expect(result).toContain("applied && JSON.stringify");
    expect(result).toContain("\"warning\"");
    expect(result).toContain("data-tone={busy ? \"busy\" : noticeTone}");
    expect(result).toContain("element.scrollWidth > element.clientWidth");
    expect(result).toContain("<OverflowTooltip text={notice} />");
    expect(result).toContain("delay={0}");
    expect(result).toContain("open={open}");
    expect(result).toContain("max-[980px]:max-w-[calc(100%-16px)]!");
    expect(normalizedCss).toContain(
      ".workbench-status[data-tone=warning]",
    );
    expect(normalizedCss).toContain(
      ".workbench-status:has([data-slot=tooltip-trigger]), .workbench-status [data-slot=tooltip-trigger] { pointer-events: auto;",
    );
    expect(normalizedCss).toContain(".panel-switch-row");
    expect(result).toContain(
      "max-[641px]:h-auto! max-[641px]:max-h-[min(68dvh,580px)]!",
    );
  });

  it("AI 图纸生成后不再提供重新生成入口", () => {
    expect(result).not.toContain("重新生成");
    expect(result).not.toContain("生成新图纸");
    expect(result).not.toContain("AiSettingsDialog");
    expect(normalizedCss).not.toContain(".panel-ai-source");
    expect(normalizedCss).not.toContain(".panel-ai-picker");
  });

  it("裁切时不显示返回按钮，AI 处理时仍可返回当前图片", () => {
    expect(prepare).toContain("{!showVariants && (");
    expect(prepare).toContain("预览 AI 处理效果大图");
    expect(prepare).toContain("AI 处理效果大图预览");
    expect(prepare).toContain("{showVariants && (");
    expect(prepare).toContain("onClick={onReturnToImage}");
    expect(prepare).not.toContain("onBack");
    expect(prepare).toContain("{!showVariants && (");
    expect(prepare).not.toContain("showVariants ? \"重新生成\"");
    expect(workspace).toContain("onReturnToImage={() => {");
    expect(workspace).toContain("aiRunRef.current += 1");
    expect(prepare).not.toContain("重新截取");
    expect(prepare).toContain("AI 处理");
    expect(prepare).toContain("dialog.current?.showModal()");
  });

  it("AI 方案不去背景，避免背景识别失败阻断生成", () => {
    expect(workspace).toContain(
      "const settings = { ...draft.settings, background: \"keep\" as const };",
    );
  });

  it("AI 处理文案说明正在处理图片，成功后可重新生成", () => {
    expect(prepare).toContain("<span className=\"eyebrow\">AI 图片处理</span>");
    expect(prepare).toContain("? \"正在处理图片\"");
    expect(prepare).toContain("今日免费额度已用完");
    expect(prepare).toContain("改用 GPT Image");
    expect(prepare).not.toContain("正在为你整理图纸");
    expect(workspace).toContain("图片处理完成，请确认效果");
    const regenerate = prepare.indexOf("onClick={onRetry}");
    const choose = prepare.indexOf("onClick={() => onChoose(candidate)}");
    expect(regenerate).toBeGreaterThan(-1);
    expect(regenerate).toBeLessThan(choose);
  });

  it("AI 处理失败后可以直接修改服务设置", () => {
    expect(prepare).toContain("修改 AI 设置");
    expect(prepare).toContain("onClick={onOpenSettings}");
  });

  it("记住上一次选择的图片处理方式", () => {
    expect(workspace).toContain("savedGenerationMode");
    expect(workspace).toContain("window.localStorage.setItem");
    expect(workspace).toContain("mode: preferredMode");
    expect(prepare).toContain("onModeChange(mode)");
  });

  it("桌面使用右侧抽屉，手机使用底部 Sheet", () => {
    expect(result).toContain(
      "min-[980px]:[&.has-panel]:grid-cols-[minmax(0,1fr)_var(--workbench-panel-width)]!",
    );
    expect(css.match(/\.workbench-panel \{([^}]*)\}/)?.[1]).toContain(
      "position: fixed",
    );
    expect(css.match(/\.workbench-panel \{([^}]*)\}/)?.[1]).toContain(
      "bottom: 0",
    );
    expect(normalizedCss).toContain(".workbench-sheet-backdrop");
    expect(result).toContain("max-[641px]:h-[calc(100dvh-56px)]!");
    expect(layout).toContain("max-[641px]:[&_button]:min-h-11");
    expect(css).not.toMatch(/@media\s*\((?:max|min)-width/);
  });

  it("手机端图片工具和生成操作保持紧凑排列", () => {
    expect(prepare).toContain("max-[640px]:grid-cols-2");
    expect(prepare).toContain("max-[641px]:grid-cols-2");
    expect(prepare).toContain("grid grid-cols-2 gap-2 border-t");
    expect(prepare).toContain("max-[640px]:text-xs");
    expect(prepare).toContain("flex-none border-l border-border");
  });

  it("首页和裁切区支持拖入图片，替换前需要确认", () => {
    expect(newProjectDialog).toContain("松开即可上传");
    expect(newProjectDialog).toContain("从相册选择图片");
    expect(newProjectDialog).not.toContain("capture=");
    expect(newProjectDialog).toContain("event.dataTransfer.files[0]");
    expect(prepare).toContain("松开即可替换图片");
    expect(prepare).toContain("替换当前图片？");
    expect(prepare).toContain("确认替换");
  });

  it("编辑工具悬停格子时显示坐标、色号和颜色块", () => {
    const canvas = readFileSync("components/pattern-canvas.tsx", "utf8");
    expect(result).toContain("showCellTooltip={isEditing");
    expect(canvas).toContain("className=\"pattern-cell-tooltip\"");
    expect(canvas).toContain("hoverColor?.id || \"空白\"");
    expect(css).toContain(".pattern-cell-tooltip > i");
  });

  it("离开前保护未应用调整，并保持浅色顶栏", () => {
    expect(workspace).toContain("还有未应用的调整");
    expect(workspace).toContain("放弃并离开");
    expect(workspace).toContain("<AlertDialog");
    expect(workspace).not.toMatch(/\b(confirm|prompt)\(/);
    expect(header).toContain("sticky top-0 z-50");
    expect(header).toContain("bg-card");
    expect(header).toContain("我的图纸");
    expect(header).toContain("新建图纸");
    expect(header).toContain("pattern={currentProject.pattern}");
    expect(header).toContain("<Images />");
    expect(header).toContain("[&_canvas]:w-full!");
    expect(header).toContain("[&_canvas]:object-contain");
    expect(header).toContain("top-[calc(100%+1px)]");
  });
});
