export const PIXEL_ART_PROMPT = `Edit the supplied image. Apply ONLY a neutral pixelation treatment to the existing image. This is a strict image-to-image conversion, not a redesign, recolor, or enhancement.

CONTENT LOCK: keep the exact canvas aspect ratio, composition, crop, positions, scale, spacing, subject identity, pose, silhouette, logos, and existing words. Keep every existing element. Render existing words as readable blocky pixel lettering without changing the words.

BACKGROUND LOCK: keep the original background content, shape, and color. A solid background must remain the same single solid color. Never remove, replace, decorate, extend, or add detail to the background. Do not isolate the subject or create transparency.

COLOR LOCK: preserve the original colors as closely as possible in every corresponding region, including hue, saturation, brightness, contrast, highlights, shadows, and gradients. Every output color must come from the corresponding source region. Do not color-grade, enhance, recolor, simplify, merge, reduce, substitute, or invent colors. Do not apply a retro palette. Color reduction is handled later by the app.

PIXEL STYLE: change only the spatial rendering into clearly visible chunky square pixel clusters, stair-step diagonals, hard edges, no anti-aliasing, and no smooth curves. Approximate gradients and texture with larger square samples of their original source colors rather than changing the palette.

OUTPUT LOCK: output a clean raster pixel-art image only. No visible grid lines, tile borders, checkerboard, beads, pegboard, frame, new text, new colors, new objects, or new scenery.`;
