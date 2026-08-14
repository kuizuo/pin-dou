---
name: image-to-pindou
description: Convert photos or illustrations into recognizable, printable MARD fuse-bead patterns. Use for AI-assisted pixel-art redrawing, local conversion, feature-preserving pixelation, background removal, bead color matching, editable grids, and purchase lists.
---

# Image to Pindou

Run the bundled CLI from this directory. Prefer an AI-redrawn pixel source when resemblance matters; use the local path when the user requests offline or deterministic conversion.

## Workflow

1. Identify the subject, output directory, target size, background treatment, color cap, and 2–6 identity-defining details. Finish when every detail that would make the result recognizable is listed.
2. Choose a source path:
   - Best quality: redraw the image as crisp square-pixel art with the built-in image-editing tool, then run the CLI with `--ai off`; or use `--ai openai|gemini` when its API key is already configured.
   - Fully local: run the original image with `--ai off`.
3. Use `cartoon` for flat illustrations, `bead` for general buildability, `faithful` for photographic shading, or `all` only for local comparisons. Pass each critical detail with a separate `--preserve` when using CLI AI.
4. Inspect `ai-draft.png` when present, then `sampled-preview.png`, `pixel-preview.png`, and `pattern.png`. Finish only when the subject is recognizable at preview size, critical details survive, the background is correct, and no isolated wrong-color speckles remain.
5. If a check fails, change one cause and rerun: revise the redraw for missing identity, increase size for lost geometry, lower the color cap for noisy shading, or switch `bead`/`cartoon` for weak contours. Reinspect all four stages after each rerun.
6. Verify that the `.pindou.json` project, `bom.csv`, and rendered pattern agree on dimensions, colors, and bead count before reporting.

For built-in image editing, request deliberate pixel art at the target grid size, strong one-cell outlines, flat coherent color regions, a plain white outer background when removing it, and preservation of the listed details. Request no visible grid, bead circles, labels, text, gradients, blur, or added objects. The CLI enforces the exact grid locally.

## CLI

```bash
npm install
node scripts/generate.mjs photo.jpg \
  --style cartoon --size 50 --max-colors 18 --background remove \
  --preserve "asymmetrical eyes" --preserve "hat shape" \
  --out outputs/cat
```

Run `node scripts/generate.mjs --help` for limits and optional flags. Never silently make repeated paid AI calls; show the draft or report why a rerun is needed first.

Read [references/principles.md](references/principles.md) when explaining or changing the conversion method.

Treat the `.pindou.json` file as the editable source of truth and mention that it can be imported into Pin Dou for further editing. `pattern.svg` is the scalable construction drawing; `bom.csv` is the purchase list. When `--style all` is used, each style receives its own output directory.

Report the grid dimensions, color count, bead count, output path, and any background-removal refusal.
