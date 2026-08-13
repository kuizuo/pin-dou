<div align="center">
  <img src="./public/logo.svg" width="88" alt="拼豆图纸生成器 Logo">
  <h1>拼豆图纸生成器</h1>
  <p>把照片变成真正能照着拼的 MARD 拼豆图纸</p>
  <p>
    <a href="https://pindou.kuizuo.me"><strong>在线体验</strong></a> ·
    <a href="#快速开始">本地运行</a> ·
    <a href="#可选安装-skill">安装 Skill</a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/配色-MARD%20291%20色-f43f8e" alt="MARD 291 色配色">
    <img src="https://img.shields.io/badge/图纸-自动去碎色-f59e0b" alt="自动清理零碎颜色">
    <img src="https://img.shields.io/badge/编辑-逐格精修-3b82f6" alt="逐格精修">
    <img src="https://img.shields.io/badge/清单-用豆统计-22a06b" alt="用豆统计">
  </p>
</div>


<p align="center">
  <a href="https://pindou.kuizuo.me">
    <img src="./public/readme/home.png" alt="拼豆图纸生成器主页">
  </a>
</p>

## 亮点

| 🎨 MARD 291 色 | 🧩 真正能拼 |
| --- | --- |
| 自动匹配接近的 MARD 色号，并统计每种颜色的用量。 | 区分白色豆与空白格，控制颜色数量并清理零碎色块。 |
| **✏️ 逐格精修** | **🔒 本地优先** |
| 裁剪、像素化、逐格修改，保存多个作品版本。 | 无需注册；默认在浏览器处理，作品只保存在当前设备。 |

## 快速开始

```bash
git clone https://github.com/kuizuo/pin-dou.git
cd pin-dou
bun install
bun run dev
```

打开 `http://localhost:3000`，选择图片即可开始。

## 可选：安装 Skill

在支持 Skill 的工具中，也可以通过对话生成拼豆图纸：

```bash
npx skills add kuizuo/pin-dou --skill image-to-pindou -g -y
```

安装后，发送图片并说：

```text
使用 $image-to-pindou，把这张图片做成 50×50 的拼豆图纸，移除背景，最多使用 18 种颜色。
```

## 转换流程

```mermaid
flowchart LR
    A[原图] --> B[整理主体]
    B --> C[识别背景]
    C --> D[划分像素格]
    D --> E[保留轮廓与细节]
    E --> F[匹配 MARD 色号]
    F --> G[合并近似色并清理碎色]
    G --> H[完成图纸]
```

复杂照片会先整理成轮廓清楚、色块稳定的像素稿；简洁插画可以直接转换。背景只从画面边缘开始识别，减少误删主体内部的浅色区域。

<details>
<summary><strong>AI 与 Cloudflare 配置</strong></summary>

AI 模式支持 Cloudflare AI 和 Gemini 3.1 Flash Image。Gemini 密钥只保存在当前浏览器，不会写入作品或备份。

本地联调 Cloudflare 时，将 `.env.example` 复制为 `.env.local`，将 `worker/.dev.vars.example` 复制为 `worker/.dev.vars`，再分别运行 `bun run dev` 和 `bun run worker:dev`。

</details>

## 开发检查

```bash
bun run test
bun run lint
bun run typecheck
bun run build
bun run worker:check
```

## 数据与许可

- [`maxcleme/beadcolors`](https://github.com/maxcleme/beadcolors)：提供 MARD 291 色数据。
- [`magic-wand-tool`](https://www.npmjs.com/package/magic-wand-tool)：用于识别与图片边缘相连的纯色背景。
- [`react-zoom-pan-pinch`](https://www.npmjs.com/package/react-zoom-pan-pinch)：用于画布缩放与平移。
- [`color-diff`](https://www.npmjs.com/package/color-diff)：用于将图片颜色匹配到 MARD 色号。
- [`CIawevy/pindou-skill`](https://github.com/CIawevy/pindou-skill)：拼豆图纸 Skill 的参考项目。
