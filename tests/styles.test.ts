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
const aiSettings = readFileSync(
  new URL("../components/ai-settings-dialog.tsx", import.meta.url),
  "utf8",
);
const turnstile = readFileSync(
  new URL("../components/turnstile.tsx", import.meta.url),
  "utf8",
);
const ai = readFileSync(new URL("../lib/ai.ts", import.meta.url), "utf8");

describe("统一图纸工作台", () => {
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
    expect(prepare).not.toContain("颜色上限");
    expect(prepare).not.toContain("图案最长边");
    expect(normalizedCss).toContain(".prepare-page");
    expect(normalizedCss).not.toContain(".prepare-submit-bar");
    expect(normalizedCss).toContain(
      ".prepare-header { min-height: 58px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;",
    );
  });

  it("Cloudflare 与 Gemini 都在 AI 设置弹窗中，密钥不挤占主界面", () => {
    expect(aiSettings).toContain("Cloudflare AI");
    expect(aiSettings).toContain("Gemini API Key");
    expect(aiSettings).toContain("不会保存到作品或浏览器");
    expect(turnstile).toContain("\"appearance\": \"interaction-only\"");
    expect(prepare).toContain("AI 设置，当前使用");
    expect(prepare).not.toContain("gemini-key-field");
    expect(
      [prepare, result, aiSettings, ai].join("\n"),
    ).not.toContain("localStorage");
    expect(workspace).toContain("pindou-generation-mode-v1");
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
    expect(normalizedCss).toContain(".pattern-workbench.has-panel");
  });

  it("工具和操作分布在约定的位置", () => {
    expect(result).toContain("className=\"workbench-toolbar\"");
    expect(result).toContain("className=\"workbench-status\"");
    expect(result).toContain("className=\"workbench-actions\"");
    expect(result).toContain("className=\"workbench-lower-left\"");
    expect(result).toContain("className=\"workbench-lower-right\"");
    expect(result).toContain("锁定");
    expect(result).toContain("抓手");
    expect(result).toContain("画笔");
    expect(result).toContain("整色替换");
    expect(result).not.toContain("更多工具");
    expect(result).toContain("<kbd>1</kbd>");
    expect(result).toContain("<kbd>{shortcut}</kbd>");
    expect(result).not.toContain("背景恢复");
    expect(result).toContain("图纸预览");
    expect(result).toContain("复制图片");
    expect(result).toContain("分享图纸");
    expect(result).toContain("预览并下载图纸");
    expect(result).toContain("下载 PNG");
    expect(result).toContain("aria-label=\"关闭预览\"");
    expect(normalizedCss).toContain(".pattern-preview-close { position: absolute; top: 10px; right: 10px;");
    expect(result).toContain("复制成功");
    expect(result).toContain("正在复制");
    expect(result).toContain("setTimeout(() => setCopied(false), 2000)");
    expect(result).toContain("if (copying || copied) return");
    expect(normalizedCss).toContain(".pattern-preview-copy { width: 116px;");
    expect(result).toContain("{copied");
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
    expect(normalizedCss).toContain("@container workbench-canvas (max-width: 1120px)");
    expect(normalizedCss).toContain("@container workbench-canvas (max-width: 840px)");
    expect(normalizedCss).toContain(
      ".workbench-toolbar > button, .workbench-toolbar > [data-slot=dropdown-menu] > button",
    );
    expect(normalizedCss).toContain(".workbench-lower-right { right: 8px; bottom: 8px;");
    expect(normalizedCss).toContain("@media (max-width: 979px)");
    expect(normalizedCss).toContain(
      ".workbench-toolbar { right: auto; width: max-content;",
    );
    expect(normalizedCss).toContain(".workbench-actions { top: 8px; }");
    expect(result).toContain("className=\"workbench-tool-properties\"");
    expect(normalizedCss).toContain(
      ".workbench-tool-color, .workbench-tool-properties .workbench-color-trigger",
    );
    expect(result).toContain("wheel={{ wheelDisabled: true }}");
    expect(result).toContain(
      "trackPadPanning={{ disabled: false, velocityDisabled: true }}",
    );
  });

  it("颜色块直接显示色号并使用紧凑多列布局", () => {
    expect(result).toContain("--swatch-foreground");
    expect(result).toContain("className=\"workbench-tool-color\"");
    expect(result).toContain("className=\"color-series-heading\"");
    expect(normalizedCss).toContain("grid-template-columns: repeat(6, 1fr)");
    expect(normalizedCss).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(44px, 1fr))",
    );
    expect(normalizedCss).toContain(".color-series-heading::after");
  });

  it("下载旁的开关打开设置抽屉", () => {
    expect(result).toContain("{ id: \"adjust\", label: \"设置\" }");
    expect(result).toContain("{ id: \"colors\", label: \"颜色\" }");
    expect(result).toContain("{ id: \"versions\", label: \"版本\" }");
    expect(result).toContain("className=\"workbench-panel\"");
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
    expect(normalizedCss).toContain(".panel-switch-row");
    expect(normalizedCss).toContain(
      ".workbench-panel { height: auto; max-height: min(62dvh, 520px); }",
    );
  });

  it("AI 图纸生成后不再提供重新生成入口", () => {
    expect(result).not.toContain("重新生成");
    expect(result).not.toContain("生成新图纸");
    expect(result).not.toContain("AiSettingsDialog");
    expect(normalizedCss).not.toContain(".panel-ai-source");
    expect(normalizedCss).not.toContain(".panel-ai-picker");
  });

  it("AI 处理时隐藏裁切区，结果支持大图预览并返回原图裁切", () => {
    expect(prepare).toContain("{!showVariants && (");
    expect(prepare).toContain("预览 AI 智能图纸大图");
    expect(prepare).toContain("AI 智能图纸大图预览");
    expect(prepare).toContain("showVariants ? \"重新生成\" : \"生成图纸\"");
    expect(prepare).toContain("? onRegenerate()");
    expect(workspace).toContain("onRegenerate={() => {");
    expect(workspace).not.toContain("onRegenerate={newProject}");
    expect(prepare).not.toContain("重新截取");
    expect(prepare).toContain("AI 处理");
    expect(prepare).toContain("dialog.current?.showModal()");
  });

  it("记住上一次选择的图片处理方式", () => {
    expect(workspace).toContain("savedGenerationMode");
    expect(workspace).toContain("window.localStorage.setItem");
    expect(workspace).toContain("mode: preferredMode");
    expect(prepare).toContain("onModeChange(mode)");
  });

  it("桌面使用右侧抽屉，手机使用底部 Sheet", () => {
    expect(normalizedCss).toContain(
      ".pattern-workbench.has-panel { grid-template-columns: minmax(0, 1fr) var(--workbench-panel-width); }",
    );
    expect(css.match(/\.workbench-panel \{([^}]*)\}/)?.[1]).toContain(
      "position: fixed",
    );
    expect(css.match(/\.workbench-panel \{([^}]*)\}/)?.[1]).toContain(
      "bottom: 0",
    );
    expect(normalizedCss).toContain(".workbench-sheet-backdrop");
    expect(css.slice(css.indexOf("@media (max-width: 640px)"))).toContain(
      "height: calc(100dvh - 56px)",
    );
    expect(normalizedCss).toContain(
      "button, select, input:not([type=file]) { min-width: 44px; min-height: 44px; }",
    );
  });

  it("手机端图片工具等宽排列，AI 设置与生成方式保持同一行", () => {
    expect(normalizedCss).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(normalizedCss).toContain(
      ".generation-mode:has(.ai-mode-summary) .segmented { grid-column: 1;",
    );
    expect(normalizedCss).toContain(
      ".ai-mode-summary > [data-slot=button] { width: 44px; height: 44px;",
    );
  });

  it("离开前保护未应用调整，并保持浅色顶栏", () => {
    expect(workspace).toContain("还有未应用的调整");
    expect(workspace).toContain("放弃并离开");
    expect(workspace).toContain("<AlertDialog");
    expect(workspace).not.toMatch(/\b(confirm|prompt)\(/);
    expect(css.match(/\.app-header \{([^}]*)\}/)?.[1]).toContain(
      "background: var(--card)",
    );
    expect(header).toContain("我的图纸");
    expect(header).toContain("新建图纸");
    expect(header).toContain("pattern={currentProject.pattern}");
    expect(header).toContain("<Images />");
    expect(header).toContain("className=\"project-item-icon project-thumbnail\"");
    expect(normalizedCss).toContain(
      ".project-thumbnail canvas { width: 100% !important; height: 100%; object-fit: contain; }",
    );
    expect(normalizedCss).toContain(".project-switcher-menu { top: calc(100% + 1px);");
  });
});
