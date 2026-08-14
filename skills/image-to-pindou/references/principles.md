# Processing principles

## Pipeline

1. Normalize orientation. When removing a background, identify a dominant corner-connected outer color at source resolution and clear only its connected region. Preserve transparent inputs and refuse ambiguous edges.
2. Resize to eight samples per target cell. Use linear-light averaging for faithful detail and color-cluster representatives for bead/cartoon detail.
3. Preserve thin dark outlines and saturated accents when they occupy a meaningful part of a tile; otherwise select the dominant real source-color cluster instead of independently mixing RGB channels.
4. Save `sampled-preview.png` before palette matching so sampling errors remain distinguishable from palette errors.
5. Convert sampled RGB colors to Lab and match every visible cell to the nearest real palette color with CIEDE2000 perceptual distance.
6. Select retained palette colors by weighted perceptual error reduction, remap excluded colors to retained bead colors, and merge only tiny local color regions. Preserve internal white areas and intentional holes.
7. Render the exact cell grid locally. AI drafts define appearance, while JavaScript defines dimensions, palette codes, bead counts, and construction files.

## Style intent

- `faithful`: preserve gradients and photographic lighting; only suppress sampling noise.
- `bead`: preserve composition and key features while strengthening boundaries and consolidating small color changes.
- `cartoon`: favor broad, flat regions and simple shading without adding or removing objects.

## AI prompt contract

Ask for a deliberate redraw rather than a pixelation filter. Preserve composition, crop, subject count, pose, silhouette, proportions, expression, facial features, markings, accessories, and user-listed identity details. Adapt block size and shading complexity to the requested grid size and color cap. Ask for strong stair-stepped contours and coherent flat regions with no visible grid, bead board, labels, text, color codes, gradients, blur, or margins.

Request a clean pixel-art draft and enforce exact grid dimensions locally. Do not depend on image models to draw an exact number of straight grid lines.

## Palette

The bundled palette contains 291 MARD colors. A custom CSV may select a subset with `code,r,g,b` or `code,hex` columns; codes and colors must match the bundled palette so projects remain editable after import.
