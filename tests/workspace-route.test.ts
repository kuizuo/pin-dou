import { describe, expect, it } from "vitest";
import { projectPath, workspaceRoute } from "../lib/workspace-route";

describe("图纸页面地址", () => {
  it("只保留作品列表和统一图纸工作台", () => {
    expect(workspaceRoute("/")).toEqual({ stage: "home" });
    expect(workspaceRoute("/patterns/a%20b")).toEqual({
      stage: "result",
      projectId: "a b",
    });
    expect(workspaceRoute("/patterns/a%20b/edit")).toEqual({ stage: "home" });
    expect(workspaceRoute("/new")).toEqual({ stage: "home" });
    expect(projectPath("a b")).toBe("/patterns/a%20b");
  });
});
