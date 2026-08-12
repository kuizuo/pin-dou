# 拼豆图纸生成器

面向新手的 MARD 拼豆图纸工具：在浏览器中完成去背景、裁剪、像素化、291 色匹配、逐格精修、作品版本和 PNG/PDF 导出。

## 本地运行

```bash
bun install
bun run dev
```

打开 `http://localhost:3000`。本地处理是默认方式，不需要密钥，也不会下载任何图片处理模型。

AI 模式可以使用 Cloudflare AI，也可以使用 Gemini 3.1 Flash Image。Gemini 需要用户在设置弹窗填写自己的 API Key，密钥只用于当次请求，不会写入作品或浏览器；纯色背景删除、MARD 配色和图纸生成仍在浏览器中完成。

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

MARD 291 色来自 [Bead Colors](https://beadcolors.eremes.xyz) 。完整来源与第三方许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
