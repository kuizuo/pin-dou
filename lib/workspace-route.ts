export type WorkspaceRoute = {
  stage: "home" | "result";
  projectId?: string;
};

export function projectPath(projectId: string) {
  return `/patterns/${encodeURIComponent(projectId)}`;
}

export function workspaceRoute(pathname: string): WorkspaceRoute {
  const match = pathname.match(/^\/patterns\/([^/]+)\/?$/);
  if (match)
    return { stage: "result", projectId: decodeURIComponent(match[1]) };
  return { stage: "home" };
}
