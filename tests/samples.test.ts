import { describe, expect, it } from "vitest";
import { GET } from "../app/api/samples/route";

describe("示例图片", () => {
  it("自动列出示例文件夹里的图片，并优先打开原有示例", async () => {
    const response = await GET();
    const { samples } = (await response.json()) as {
      samples: Array<{ name: string; src: string }>;
    };

    expect(samples[0]).toEqual({
      name: "sample-cat.svg",
      src: "/samples/sample-cat.svg",
    });
    expect(samples).toContainEqual({
      name: "docusaurus.png",
      src: "/samples/docusaurus.png",
    });
  });
});
