export type WorkspaceRoute = {
  stage: "home" | "new" | "result";
  projectId?: string;
};

export function projectPath(projectId: string) {
  return `/patterns/${encodeURIComponent(projectId)}`;
}

export function workspaceRoute(pathname: string): WorkspaceRoute {
  if (pathname === "/new") return { stage: "new" };
  const match = pathname.match(/^\/patterns\/([^/]+)\/?$/);
  if (match)
    return { stage: "result", projectId: decodeURIComponent(match[1]) };
  return { stage: "home" };
}
