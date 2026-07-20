import { ProjectDetailScreen } from "@/features/projects/ProjectDetailScreen";

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <ProjectDetailScreen projectId={projectId} />;
}
