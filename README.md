# 拼豆图纸生成器

面向新手的 MARD 拼豆图纸工具：在浏览器中完成去背景、裁剪、像素化、291 色匹配、逐格精修、作品版本和 PNG/PDF 导出。

## 本地运行

```bash
bun install
bun run dev
```

打开 `http://localhost:3000`。本地处理是默认方式，不需要密钥，也不会下载任何图片处理模型。

AI 模式可以使用 Cloudflare AI，也可以使用 Gemini 3.1 Flash Image。Gemini 需要用户在设置弹窗填写自己的 API Key，密钥会保存在当前浏览器，但不会写入作品或备份；纯色背景删除、MARD 配色和图纸生成仍在浏览器中完成。

本地联调 Cloudflare 时复制 `.env.example` 为 `.env.local`，再复制 `worker/.dev.vars.example` 为 `worker/.dev.vars`，分别运行 `bun run dev` 和 `bun run worker:dev`。

## 验证与构建

```bash
bun run test
bun run lint
bun run typecheck
bun run build
bun run worker:check
```

## 数据与许可

### MARD 291 色数据

- 来源：[`maxcleme/beadcolors`](https://github.com/maxcleme/beadcolors)
- 固定版本：`29229889daab404fb30531d4bb785fd73f7f58e3`
- 文件：`raw/mard.csv`
- 许可：MIT License，Copyright (c) 2020 maxcleme

### 浏览器纯色背景识别

- `magic-wand-tool` 1.1.7
- 许可：MIT License，Copyright (c) 2014-2020 Ryasnoy Paul
- 仅在浏览器内识别与图片四角连通的纯色背景，不下载模型。

### 画布缩放

- `react-zoom-pan-pinch` 4.0.4
- 许可：MIT License，Copyright (c) 2019 prc5

### 本地颜色匹配

- `color-diff` 1.4.0
- 许可：BSD 3-Clause License，Copyright (c) 2012-2023 Markus Ekholm
- 使用 CIEDE2000 将图片颜色匹配到最接近的 MARD 色号。
