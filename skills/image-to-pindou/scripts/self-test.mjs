import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { colorDistance, run } from "./generate.mjs";

assert.ok(Math.abs(colorDistance([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 0.001);

const directory = await mkdtemp(path.join(os.tmpdir(), "pindou-skill-"));
try {
  const input = path.join(directory, "sample.svg"), output = path.join(directory, "result");
  await writeFile(input, `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="white"/><circle cx="80" cy="60" r="42" fill="#df8a42"/><circle cx="65" cy="50" r="5"/><circle cx="95" cy="50" r="5"/><path d="M65 75 Q80 85 95 75" fill="none" stroke="#552a18" stroke-width="5"/></svg>`);
  const [result] = await run([input, "--size", "16", "--max-colors", "6", "--background", "remove", "--preserve", "eyes", "--out", output]);
  assert.equal(result.width, 16); assert.ok(result.colors <= 6); assert.ok(result.beads > 0 && result.beads < 16 * 12);
  for (const file of ["sampled-preview.png", "pixel-preview.png", "pattern.png", "pattern.svg", "grid.json", "bom.csv", "config.json"]) await readFile(path.join(output, file));
  const grid = JSON.parse(await readFile(path.join(output, "grid.json"))), config = JSON.parse(await readFile(path.join(output, "config.json")));
  const bomTotal = (await readFile(path.join(output, "bom.csv"), "utf8")).trim().split("\n").slice(1).reduce((sum, line) => sum + Number(line.split(",")[2]), 0);
  assert.deepEqual(config.preserve, ["eyes"]); assert.equal(grid.width, config.width); assert.equal(grid.height, config.height); assert.equal(bomTotal, config.beads);
  const ambiguous = path.join(directory, "ambiguous.svg");
  await writeFile(ambiguous, `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="50" height="100" fill="white"/><rect x="50" width="50" height="100" fill="#aaa"/></svg>`);
  await assert.rejects(run([ambiguous, "--size", "12", "--background", "remove", "--out", path.join(directory, "ambiguous")]), /outer background is ambiguous/);
  const checker = path.join(directory, "checker.svg"), checkerOutput = path.join(directory, "checker");
  await writeFile(checker, `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#fff"/><rect width="8" height="8" fill="#eee"/><rect x="8" y="8" width="8" height="8" fill="#eee"/></pattern></defs><rect width="120" height="120" fill="url(#p)"/><path d="M20 100 L60 20 L100 100 Z" fill="#222"/></svg>`);
  const [checkerResult] = await run([checker, "--style", "cartoon", "--size", "12", "--background", "remove", "--out", checkerOutput]);
  assert.ok(checkerResult.beads > 20 && checkerResult.beads < 100);
  const transparent = path.join(directory, "transparent.svg");
  await writeFile(transparent, `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>`);
  const [empty] = await run([transparent, "--size", "8", "--out", path.join(directory, "transparent")]);
  assert.equal(empty.beads, 0);
  console.log("self-test: ok");
}
finally {
  await rm(directory, { recursive: true, force: true });
}
