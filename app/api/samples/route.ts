import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

export async function GET() {
  const names = (await readdir(join(process.cwd(), "public", "samples")))
    .filter(name => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort(
      (left, right) =>
        Number(right === "sample-cat.svg")
        - Number(left === "sample-cat.svg")
        || left.localeCompare(right, "zh-CN"),
    );

  return Response.json({
    samples: names.map(name => ({
      name,
      src: `/samples/${encodeURIComponent(name)}`,
    })),
  });
}
