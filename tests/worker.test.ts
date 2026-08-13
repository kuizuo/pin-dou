import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("按 Turnstile 接口要求提交验证信息", () => {
  const worker = readFileSync(
    new URL("../worker/src/index.ts", import.meta.url),
    "utf8",
  );
  expect(worker).toContain("const form = new URLSearchParams()");
});
