#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = ["faithful", "bead", "cartoon"];
const HELP = `Usage:
  node scripts/generate.mjs <image> [options]

Options:
  --style faithful|bead|cartoon|all  Processing style (default: bead)
  --size 16..192                      Longest edge in cells (default: 50)
  --max-colors 1..291                 Final color cap (default: 18)
  --background keep|remove            Outer background handling (default: keep)
  --cell-px 8..64                     Drawing cell size (default: 24)
  --palette <csv>                     Custom code,r,g,b or code,hex palette
  --ai off|openai|gemini              Optional visual cleanup (default: off)
  --model <name>                      Provider image model
  --preserve <detail>                 Feature to preserve; may be repeated
  --out <directory>                   Output directory (default: outputs/<name>)
  --help                              Show this help`;

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const options = {
    style: "bead", size: 50, maxColors: 18, background: "keep", cellPx: 24,
    ai: "off", preserve: [],
  };
  const values = new Map([
    ["--style", "style"], ["--size", "size"], ["--max-colors", "maxColors"],
    ["--background", "background"], ["--cell-px", "cellPx"], ["--palette", "palette"],
    ["--ai", "ai"], ["--model", "model"], ["--preserve", "preserve"], ["--out", "out"],
  ]);
  let input;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      if (input) throw new Error(`Unexpected argument: ${token}`);
      input = token;
      continue;
    }
    const key = values.get(token);
    if (!key) throw new Error(`Unknown option: ${token}`);
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${token} needs a value.`);
    if (key === "preserve") options.preserve.push(value);
    else options[key] = ["size", "maxColors", "cellPx"].includes(key) ? Number(value) : value;
  }
  if (!input) throw new Error("An input image is required.");
  if (![...STYLES, "all"].includes(options.style)) throw new Error("Invalid --style.");
  if (!Number.isInteger(options.size) || options.size < 16 || options.size > 192) throw new Error("--size must be an integer from 16 to 192.");
  if (!Number.isInteger(options.maxColors) || options.maxColors < 1 || options.maxColors > 291) throw new Error("--max-colors must be an integer from 1 to 291.");
  if (!Number.isInteger(options.cellPx) || options.cellPx < 8 || options.cellPx > 64) throw new Error("--cell-px must be an integer from 8 to 64.");
  if (!["keep", "remove"].includes(options.background)) throw new Error("Invalid --background.");
  if (!["off", "openai", "gemini"].includes(options.ai)) throw new Error("Invalid --ai.");
  options.model ||= options.ai === "openai" ? "gpt-image-2" : "gemini-3.1-flash-image";
  options.input = path.resolve(input);
  options.out = path.resolve(options.out || path.join("outputs", path.parse(input).name));
  if (options.palette) options.palette = path.resolve(options.palette);
  return options;
}

function rgbToLab([red, green, blue]) {
  const linear = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const x = (linear[0] * 0.4124 + linear[1] * 0.3576 + linear[2] * 0.1805) / 0.95047;
  const y = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  const z = (linear[0] * 0.0193 + linear[1] * 0.1192 + linear[2] * 0.9505) / 1.08883;
  const curve = value => value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116;
  const fx = curve(x), fy = curve(y), fz = curve(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function colorDistance([l1, a1, b1], [l2, a2, b2]) {
  const deg = value => value * 180 / Math.PI, rad = value => value * Math.PI / 180;
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), meanC = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1), cp2 = Math.hypot(ap2, b2);
  const hue = (a, b) => (deg(Math.atan2(b, a)) + 360) % 360;
  const hp1 = hue(ap1, b1), hp2 = hue(ap2, b2), dl = l2 - l1, dc = cp2 - cp1;
  let dh = hp2 - hp1;
  if (cp1 * cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const bigH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(rad(dh / 2));
  const meanL = (l1 + l2) / 2, meanCp = (cp1 + cp2) / 2;
  let meanH = hp1 + hp2;
  if (cp1 * cp2 && Math.abs(hp1 - hp2) <= 180) meanH /= 2;
  else if (cp1 * cp2 && meanH < 360) meanH = (meanH + 360) / 2;
  else if (cp1 * cp2) meanH = (meanH - 360) / 2;
  const t = 1 - 0.17 * Math.cos(rad(meanH - 30)) + 0.24 * Math.cos(rad(2 * meanH))
    + 0.32 * Math.cos(rad(3 * meanH + 6)) - 0.2 * Math.cos(rad(4 * meanH - 63));
  const sl = 1 + 0.015 * (meanL - 50) ** 2 / Math.sqrt(20 + (meanL - 50) ** 2);
  const sc = 1 + 0.045 * meanCp, sh = 1 + 0.015 * meanCp * t;
  const rt = -2 * Math.sqrt(meanCp ** 7 / (meanCp ** 7 + 25 ** 7))
    * Math.sin(rad(60 * Math.exp(-(((meanH - 275) / 25) ** 2))));
  const light = dl / sl, chroma = dc / sc, hueTerm = bigH / sh;
  return Math.sqrt(light ** 2 + chroma ** 2 + hueTerm ** 2 + rt * chroma * hueTerm);
}

function parseCsv(text) {
  const [header, ...lines] = text.trim().split(/\r?\n/).filter(Boolean);
  const columns = header.split(",").map(value => value.trim().toLowerCase());
  const at = name => columns.indexOf(name);
  const codeAt = Math.max(at("code"), at("id"));
  if (codeAt < 0) throw new Error("Palette needs a code or id column.");
  return lines.map((line) => {
    const row = line.split(",").map(value => value.trim());
    let rgb;
    if (at("hex") >= 0) {
      const hex = row[at("hex")].replace("#", "");
      rgb = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
    }
    else rgb = [row[at("r")], row[at("g")], row[at("b")]].map(Number);
    if (!row[codeAt] || rgb.some(value => !Number.isInteger(value) || value < 0 || value > 255)) throw new Error(`Invalid palette row: ${line}`);
    return { code: row[codeAt], rgb, lab: rgbToLab(rgb), hex: `#${rgb.map(value => value.toString(16).padStart(2, "0")).join("")}` };
  });
}

async function loadPalette(file) {
  const builtIn = parseCsv(await readFile(path.join(ROOT, "palettes/mard-291.csv"), "utf8"));
  const palette = file ? parseCsv(await readFile(file, "utf8")) : builtIn;
  if (!palette.length) throw new Error("Palette is empty.");
  if (file) {
    const supported = new Map(builtIn.map(color => [color.code, color.rgb.join(",")]));
    if (palette.some(color => supported.get(color.code) !== color.rgb.join(","))) throw new Error("Custom palettes must be a subset of the bundled MARD palette.");
  }
  return palette;
}

function weightedMedian(samples, channel, totalWeight) {
  const sorted = samples.toSorted((a, b) => a.rgb[channel] - b.rgb[channel]);
  let weight = 0;
  for (const sample of sorted) {
    weight += sample.weight;
    if (weight >= totalWeight / 2) return sample.rgb[channel];
  }
  return sorted.at(-1).rgb[channel];
}

function luminance(rgb) { return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114; }

function saturation(rgb) {
  const high = Math.max(...rgb), low = Math.min(...rgb);
  return high ? (high - low) / high : 0;
}

function dominantCluster(samples) {
  const clusters = new Map();
  for (const sample of samples) {
    const key = sample.rgb.map(value => value >> 4).join(",");
    const cluster = clusters.get(key) || { samples: [], weight: 0 };
    cluster.samples.push(sample); cluster.weight += sample.weight; clusters.set(key, cluster);
  }
  const cluster = [...clusters.values()].toSorted((a, b) => b.weight - a.weight)[0];
  return [0, 1, 2].map(channel => weightedMedian(cluster.samples, channel, cluster.weight));
}

function representative(samples, style) {
  const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const mode = dominantCluster(samples), modeLight = luminance(mode), modeSaturation = saturation(mode);
  const dark = samples.filter(sample => luminance(sample.rgb) <= Math.min(72, modeLight - 28));
  const darkWeight = dark.reduce((sum, sample) => sum + sample.weight, 0);
  const darkThreshold = style === "cartoon" ? 0.11 : 0.18;
  if (modeLight > 75 && darkWeight / total >= darkThreshold) return dominantCluster(dark);
  const accent = samples.filter(sample => saturation(sample.rgb) >= Math.max(0.34, modeSaturation + 0.16));
  const accentWeight = accent.reduce((sum, sample) => sum + sample.weight, 0);
  if (accentWeight / total >= (style === "cartoon" ? 0.16 : 0.24)) return dominantCluster(accent);
  return mode;
}

function sampleTiles(data, width, height, scale, style) {
  const average = [], shaped = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const samples = [];
    let red = 0, green = 0, blue = 0, alpha = 0, weight = 0;
    for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
      const offset = ((y * scale + sy) * width * scale + x * scale + sx) * 4;
      const pixelAlpha = data[offset + 3], pixelWeight = pixelAlpha / 255;
      if (pixelAlpha < 12) continue;
      const rgb = [data[offset], data[offset + 1], data[offset + 2]];
      samples.push({ rgb, weight: pixelWeight });
      for (let channel = 0; channel < 3; channel += 1) {
        const value = rgb[channel] / 255;
        const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        if (channel === 0) red += linear * pixelWeight;
        else if (channel === 1) green += linear * pixelWeight;
        else blue += linear * pixelWeight;
      }
      alpha += pixelAlpha; weight += pixelWeight;
    }
    if (!samples.length) {
      average.push(null); shaped.push(null); continue;
    }
    const fromLinear = value => Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
    const a = Math.round(alpha / scale ** 2);
    average.push({ rgb: [fromLinear(red / weight), fromLinear(green / weight), fromLinear(blue / weight)], alpha: a });
    shaped.push({ rgb: representative(samples, style), alpha: a });
  }
  if (style === "faithful") return average;
  if (style === "cartoon") return shaped;
  const labs = average.map(cell => cell && rgbToLab(cell.rgb));
  return average.map((cell, index) => {
    if (!cell) return null;
    const x = index % width, y = Math.floor(index / width);
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height)
      .map(([nx, ny]) => labs[ny * width + nx]).filter(Boolean);
    return neighbors.some(lab => colorDistance(labs[index], lab) >= 10) ? shaped[index] : cell;
  });
}

function removeBackgroundPixels(data, width, height) {
  const edge = [];
  for (let x = 0; x < width; x += 1) edge.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) edge.push(y * width, y * width + width - 1);
  if (edge.filter(index => data[index * 4 + 3] < 24).length / edge.length >= 0.05) return 0;
  const buckets = new Map();
  const add = (index, corner = -1, isEdge = false) => {
    const offset = index * 4, alpha = data[offset + 3];
    if (alpha < 24) return;
    const rgb = [data[offset], data[offset + 1], data[offset + 2]], key = rgb.map(value => value >> 5).join(",");
    const bucket = buckets.get(key) || { count: 0, edgeCount: 0, sum: [0, 0, 0], corners: new Set() };
    bucket.count += 1; for (let channel = 0; channel < 3; channel += 1) bucket.sum[channel] += rgb[channel];
    if (isEdge) bucket.edgeCount += 1;
    if (corner >= 0) bucket.corners.add(corner);
    buckets.set(key, bucket);
  };
  for (let x = 0; x < width; x += 1) { add(x, -1, true); add((height - 1) * width + x, -1, true); }
  for (let y = 1; y < height - 1; y += 1) { add(y * width, -1, true); add(y * width + width - 1, -1, true); }
  const patch = Math.max(2, Math.min(32, Math.round(Math.min(width, height) * 0.035)));
  for (let y = 0; y < patch; y += 1) for (let x = 0; x < patch; x += 1) {
    add(y * width + x, 0); add(y * width + width - 1 - x, 1);
    add((height - 1 - y) * width + x, 2); add((height - 1 - y) * width + width - 1 - x, 3);
  }
  const edgeCount = edge.length;
  const candidates = [...buckets.values()].filter(bucket => bucket.corners.size >= 3 || bucket.edgeCount / edgeCount >= 0.55);
  if (!candidates.length) throw new Error("Background removal stopped: the outer background is ambiguous. Keep it or use a cleaner source image.");
  const background = candidates.toSorted((a, b) => b.corners.size - a.corners.size || b.count - a.count)[0];
  const rgb = background.sum.map(value => value / background.count);
  const neutralLight = Math.max(...rgb) - Math.min(...rgb) < 12 && luminance(rgb) > 225;
  const tolerance2 = (neutralLight ? 96 : 44) ** 2;
  const similar = (index) => {
    const offset = index * 4;
    if (data[offset + 3] < 24) return true;
    return (data[offset] - rgb[0]) ** 2 + (data[offset + 1] - rgb[1]) ** 2 + (data[offset + 2] - rgb[2]) ** 2 <= tolerance2;
  };
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height); let head = 0, tail = 0;
  const enqueue = (index) => { if (!seen[index] && similar(index)) { seen[index] = 1; queue[tail++] = index; } };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width), offset = index * 4;
    data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 0;
    if (x) enqueue(index - 1); if (x + 1 < width) enqueue(index + 1);
    if (y) enqueue(index - width); if (y + 1 < height) enqueue(index + width);
  }
  if (tail < width * height * 0.01) throw new Error("Background removal stopped: no connected outer background was found.");
  return tail;
}

function removeBackgroundCells(cells, width, height) {
  const corners = [cells[0], cells[width - 1], cells[(height - 1) * width], cells.at(-1)].filter(Boolean);
  if (!corners.length) return cells;
  const background = [0, 1, 2].map(channel => corners.map(cell => cell.rgb[channel]).toSorted((a, b) => a - b)[Math.floor(corners.length / 2)]);
  const backgroundLab = rgbToLab(background), tolerance = luminance(background) > 225 && saturation(background) < 0.08 ? 12 : 7;
  const similar = cell => !cell || colorDistance(rgbToLab(cell.rgb), backgroundLab) <= tolerance;
  if (corners.filter(similar).length < Math.min(3, corners.length)) return cells;
  const result = [...cells], seen = new Uint8Array(cells.length), queue = new Int32Array(cells.length); let head = 0, tail = 0;
  const enqueue = (index) => { if (!seen[index] && similar(cells[index])) { seen[index] = 1; queue[tail++] = index; } };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width); result[index] = null;
    if (x) enqueue(index - 1); if (x + 1 < width) enqueue(index + 1);
    if (y) enqueue(index - width); if (y + 1 < height) enqueue(index + width);
  }
  return result;
}

function nearest(rgb, palette) {
  const lab = rgbToLab(rgb);
  let best = palette[0], distance = colorDistance(lab, best.lab);
  for (let index = 1; index < palette.length; index += 1) {
    const next = colorDistance(lab, palette[index].lab);
    if (next < distance) { best = palette[index]; distance = next; }
  }
  return best;
}

function quantize(cells, palette, maxColors) {
  const cache = new Map();
  const matched = cells.map((cell) => {
    if (!cell || cell.alpha < 36) return null;
    const key = cell.rgb.join(",");
    if (!cache.has(key)) cache.set(key, nearest(cell.rgb, palette));
    return cache.get(key);
  });
  const counts = new Map();
  for (const color of matched) if (color) counts.set(color.code, (counts.get(color.code) || 0) + 1);
  const used = [...counts].map(([code, count]) => ({ color: palette.find(item => item.code === code), count }));
  const minimumUsefulCount = Math.max(2, Math.ceil(matched.filter(Boolean).length * 0.0015));
  const candidates = used.filter(item => item.count >= minimumUsefulCount);
  const kept = [];
  if (used.length) kept.push(used.toSorted((a, b) => b.count - a.count)[0].color);
  while (kept.length < Math.min(maxColors, candidates.length)) {
    let best, bestGain = -1;
    for (const candidate of candidates) {
      if (kept.some(color => color.code === candidate.color.code)) continue;
      let gain = 0;
      for (const item of used) {
        const before = Math.min(...kept.map(color => colorDistance(item.color.lab, color.lab)));
        const after = Math.min(before, colorDistance(item.color.lab, candidate.color.lab));
        gain += item.count * (before ** 2 - after ** 2);
      }
      if (gain > bestGain) { best = candidate.color; bestGain = gain; }
    }
    kept.push(best);
  }
  if (!kept.length) return Array(cells.length).fill(null);
  const remap = new Map(palette.map(color => [color.code, kept.some(item => item.code === color.code) ? color : nearest(color.rgb, kept)]));
  return matched.map(color => color && remap.get(color.code));
}

function cleanTinyRegions(cells, width, limit) {
  if (!limit) return cells;
  const result = [...cells], seen = new Set();
  for (let start = 0; start < cells.length; start += 1) {
    if (!cells[start] || seen.has(start)) continue;
    const code = cells[start].code, region = [], queue = [start], neighbors = new Map();
    while (queue.length) {
      const index = queue.pop();
      if (seen.has(index) || cells[index]?.code !== code) continue;
      seen.add(index); region.push(index);
      const x = index % width, y = Math.floor(index / width);
      const adjacent = [];
      if (x > 0) adjacent.push(index - 1);
      if (x < width - 1) adjacent.push(index + 1);
      if (y > 0) adjacent.push(index - width);
      if (y < Math.floor(cells.length / width) - 1) adjacent.push(index + width);
      for (const next of adjacent) {
        if (cells[next]?.code === code) queue.push(next);
        else if (cells[next]) neighbors.set(cells[next].code, (neighbors.get(cells[next].code) || 0) + 1);
      }
    }
    if (region.length <= limit && neighbors.size) {
      const replacementCode = [...neighbors].toSorted((a, b) => b[1] - a[1])[0][0];
      const replacement = cells.find(color => color?.code === replacementCode);
      if (colorDistance(cells[start].lab, replacement.lab) <= 22) for (const index of region) result[index] = replacement;
    }
  }
  return result;
}

function prompt(style, options) {
  const intent = {
    faithful: "Keep the subject recognizable and preserve its essential lighting, materials, and facial details while simplifying them into deliberate pixel clusters.",
    bead: "Use strong one-cell outlines, coherent shapes, simplified shadows, and clearly separated color regions.",
    cartoon: "Use crisp classic pixel-art contours, flat color regions, high edge contrast, and minimal controlled shading.",
  }[style];
  const background = options.background === "remove" ? "Replace only the outer background with one perfectly flat pure white field." : "Preserve the background layout.";
  const features = options.preserve.length ? ` Keep these details clearly recognizable: ${options.preserve.join("; ")}.` : "";
  return `Redraw the supplied image as deliberate square-pixel art for a fuse-bead pattern, targeting about ${options.size} logical color blocks on the longest edge. Preserve the exact composition, subject count, pose, silhouette, proportions, facial features, expression, markings, accessories, and crop.${features} ${intent} ${background} Use no more than about ${options.maxColors} visually distinct colors and merge near-duplicates. Every logical pixel must be one solid color with hard stair-stepped edges. Add or remove nothing. Return only the pixel art: no gradients, antialiasing, blur, texture, visible grid lines, bead circles, pegboard, labels, text, color codes, margins, or watermark.`;
}

async function geminiDraft(input, output, instruction, options) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is required for --ai gemini.");
  const extension = path.extname(input).toLowerCase();
  const mimeType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  const body = { contents: [{ parts: [{ text: instruction }, { inlineData: { mimeType, data: (await readFile(input)).toString("base64") } }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(options.model)}:generateContent`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const json = await response.json();
  const imagePart = json.candidates?.flatMap(candidate => candidate.content?.parts || []).find(part => part.inlineData?.data || part.inline_data?.data);
  const image = imagePart?.inlineData || imagePart?.inline_data;
  if (!image) throw new Error("Gemini returned no image.");
  await writeFile(output, Buffer.from(image.data, "base64"));
  return output;
}

async function openaiDraft(input, output, instruction, options) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is required for --ai openai.");
  const extension = path.extname(input).toLowerCase();
  const mimeType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.set("model", options.model);
  form.set("prompt", instruction);
  form.set("quality", "medium");
  form.set("output_format", "png");
  form.append("image[]", new Blob([await readFile(input)], { type: mimeType }), path.basename(input));
  const response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const json = await response.json();
  const image = json.data?.[0]?.b64_json;
  if (!image) throw new Error("OpenAI returned no image.");
  await writeFile(output, Buffer.from(image, "base64"));
  return output;
}

function stats(cells) {
  const counts = new Map();
  for (const color of cells) if (color) counts.set(color.code, (counts.get(color.code) || 0) + 1);
  return [...counts].map(([code, count]) => ({ color: cells.find(item => item?.code === code), count })).toSorted((a, b) => b.count - a.count);
}

function escapeXml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }

export function packCells(cells) {
  const palette = [...new Set(cells.filter(Boolean).map(color => color.code))], indexes = new Map(palette.map((code, index) => [code, index + 1])), size = palette.length < 255 ? 1 : 2, bytes = Buffer.alloc(cells.length * size);
  cells.forEach((color, index) => {
    const value = color ? indexes.get(color.code) : 0;
    if (size === 1) bytes[index] = value;
    else { bytes[index * 2] = value & 255; bytes[index * 2 + 1] = value >> 8; }
  });
  return { p: palette, d: bytes.toString("base64"), s: size };
}

async function projectBackup(source, style, options, width, height, cells) {
  const createdAt = new Date().toISOString(), sourceName = path.parse(options.input).name || "原图", outputName = path.basename(options.out) || sourceName, name = options.style === "all" ? `${outputName}-${style}` : outputName, patternId = randomUUID(), sourcePng = await sharp(source).rotate().png().toBuffer();
  return {
    fileName: `${name}.pindou.json`,
    value: {
      schemaVersion: 4,
      exportedAt: createdAt,
      sources: [`data:image/png;base64,${sourcePng.toString("base64")}`],
      projects: [{
        id: randomUUID(), name, createdAt, updatedAt: createdAt, sourceName: `${sourceName}.png`, source: 0,
        transform: { rotation: 0, flipX: false, flipY: false, zoom: 1, offsetX: 0, offsetY: 0 },
        settings: {
          longestEdge: Math.max(width, height), maxColors: options.maxColors, paletteSize: 291, excludedColorIds: [],
          processingMode: style === "faithful" ? "average" : style === "cartoon" ? "dominant" : "edge",
          colorMerge: style === "faithful" ? 0 : 5, background: options.background === "remove" ? "plain" : "keep", mirror: false, mode: "local",
        },
        pattern: {
          id: patternId, name, createdAt,
          snapshot: { w: width, h: height, c: packCells(cells), o: { x: 0, y: 0, width, height } },
        },
      }],
    },
  };
}

function renderSvg(cells, width, height, cellPx, usage) {
  const band = 32, bomWidth = 260, canvasWidth = band + width * cellPx + bomWidth, canvasHeight = Math.max(band + height * cellPx, 70 + usage.length * 28);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" font-family="Arial,sans-serif"><rect width="100%" height="100%" fill="white"/>`, "<g id=\"cells\">\n"];
  cells.forEach((color, index) => { if (color) parts.push(`<rect x="${band + index % width * cellPx}" y="${band + Math.floor(index / width) * cellPx}" width="${cellPx}" height="${cellPx}" fill="${color.hex}" data-code="${escapeXml(color.code)}"/>`); });
  parts.push("</g><g id=\"codes\" text-anchor=\"middle\" font-size=\"" + Math.max(7, Math.round(cellPx * 0.34)) + "\">");
  cells.forEach((color, index) => { if (color) { const dark = color.rgb[0] * 0.299 + color.rgb[1] * 0.587 + color.rgb[2] * 0.114 < 130; parts.push(`<text x="${band + (index % width + 0.5) * cellPx}" y="${band + (Math.floor(index / width) + 0.64) * cellPx}" fill="${dark ? "white" : "black"}">${escapeXml(color.code)}</text>`); } });
  parts.push(`</g><g id="grid" stroke="#bbb" stroke-width="1" shape-rendering="crispEdges">`);
  for (let x = 0; x <= width; x += 1) parts.push(`<line x1="${band + x * cellPx}" y1="${band}" x2="${band + x * cellPx}" y2="${band + height * cellPx}"/>`);
  for (let y = 0; y <= height; y += 1) parts.push(`<line x1="${band}" y1="${band + y * cellPx}" x2="${band + width * cellPx}" y2="${band + y * cellPx}"/>`);
  parts.push("</g><g id=\"labels\" fill=\"#555\" font-size=\"11\" text-anchor=\"middle\">");
  for (let x = 0; x < width; x += 1) parts.push(`<text x="${band + (x + 0.5) * cellPx}" y="22">${x + 1}</text>`);
  for (let y = 0; y < height; y += 1) parts.push(`<text x="16" y="${band + (y + 0.65) * cellPx}">${y + 1}</text>`);
  const bx = band + width * cellPx + 20;
  parts.push(`</g><g id="bom"><text x="${bx}" y="35" font-size="20" font-weight="bold">Colors · ${usage.reduce((sum, item) => sum + item.count, 0)} beads</text>`);
  usage.forEach((item, index) => { const y = 68 + index * 28; parts.push(`<rect x="${bx}" y="${y - 17}" width="18" height="18" fill="${item.color.hex}" stroke="#888"/><text x="${bx + 28}" y="${y - 2}" font-size="15">${escapeXml(item.color.code)} × ${item.count}</text>`); });
  parts.push("</g></svg>");
  return parts.join("");
}

async function writeOutputs(directory, source, style, options, width, height, cells) {
  await mkdir(directory, { recursive: true });
  await Promise.all(["config.json", "grid.json"].map(file => rm(path.join(directory, file), { force: true })));
  const usage = stats(cells), raw = Buffer.alloc(width * height * 4);
  cells.forEach((color, index) => color ? raw.set([...color.rgb, 255], index * 4) : raw.set([0, 0, 0, 0], index * 4));
  await sharp(raw, { raw: { width, height, channels: 4 } }).resize(width * options.cellPx, height * options.cellPx, { kernel: "nearest" }).png().toFile(path.join(directory, "pixel-preview.png"));
  const svg = renderSvg(cells, width, height, options.cellPx, usage);
  await writeFile(path.join(directory, "pattern.svg"), svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(directory, "pattern.png"));
  await writeFile(path.join(directory, "bom.csv"), `code,hex,count\n${usage.map(item => `${item.color.code},${item.color.hex},${item.count}`).join("\n")}\n`);
  const backup = await projectBackup(source, style, options, width, height, cells), projectFile = path.join(directory, backup.fileName);
  await writeFile(projectFile, JSON.stringify(backup.value));
  return { directory, projectFile, width, height, colors: usage.length, beads: usage.reduce((sum, item) => sum + item.count, 0) };
}

async function writeSampledPreview(directory, cells, width, height, cellPx) {
  const raw = Buffer.alloc(width * height * 4);
  cells.forEach((cell, index) => cell && cell.alpha >= 36 ? raw.set([...cell.rgb, 255], index * 4) : raw.set([0, 0, 0, 0], index * 4));
  await sharp(raw, { raw: { width, height, channels: 4 } }).resize(width * cellPx, height * cellPx, { kernel: "nearest" }).png().toFile(path.join(directory, "sampled-preview.png"));
}

async function generateOne(input, directory, style, options, palette) {
  await mkdir(directory, { recursive: true });
  let source = input;
  if (options.ai !== "off") {
    const instruction = prompt(style, options);
    await writeFile(path.join(directory, "ai-prompt.txt"), `${instruction}\n`);
    if (options.ai === "gemini") source = await geminiDraft(input, path.join(directory, "ai-draft.png"), instruction, options);
    if (options.ai === "openai") source = await openaiDraft(input, path.join(directory, "ai-draft.png"), instruction, options);
  }
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) throw new Error("The input image has no readable dimensions.");
  const rotated = [5, 6, 7, 8].includes(metadata.orientation);
  const sourceWidth = rotated ? metadata.height : metadata.width, sourceHeight = rotated ? metadata.width : metadata.height;
  const width = sourceWidth >= sourceHeight ? options.size : Math.max(1, Math.round(options.size * sourceWidth / sourceHeight));
  const height = sourceHeight >= sourceWidth ? options.size : Math.max(1, Math.round(options.size * sourceHeight / sourceWidth));
  const scale = 8;
  const original = await sharp(source).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  options.backgroundRemovedPixels = options.background === "remove" ? removeBackgroundPixels(original.data, original.info.width, original.info.height) : 0;
  const kernel = style === "faithful" ? sharp.kernel.lanczos3 : sharp.kernel.mitchell;
  const { data } = await sharp(original.data, { raw: original.info }).resize(width * scale, height * scale, { fit: "fill", kernel }).raw().toBuffer({ resolveWithObject: true });
  let sampled = sampleTiles(data, width, height, scale, style);
  if (options.background === "remove") sampled = removeBackgroundCells(sampled, width, height);
  await writeSampledPreview(directory, sampled, width, height, options.cellPx);
  let cells = quantize(sampled, palette, Math.min(options.maxColors, palette.length));
  cells = cleanTinyRegions(cells, width, style === "cartoon" ? 3 : style === "bead" ? 2 : 0);
  return writeOutputs(directory, source, style, options, width, height, cells);
}

export async function run(argv) {
  const options = parseArgs(argv);
  if (options.help) { console.log(HELP); return []; }
  const palette = await loadPalette(options.palette), styles = options.style === "all" ? STYLES : [options.style], results = [];
  for (const style of styles) {
    const directory = styles.length > 1 ? path.join(options.out, style) : options.out;
    const result = await generateOne(options.input, directory, style, options, palette);
    results.push(result);
    console.log(`${style}: ${result.width}×${result.height}, ${result.colors} colors, ${result.beads} beads -> ${result.directory}`);
  }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run(process.argv.slice(2)).catch((error) => { console.error(`Error: ${error.message}`); process.exitCode = 1; });
