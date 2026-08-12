import { Workspace } from "@/components/workspace";

export default async function PatternPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Workspace initialProjectId={id} />;
}
