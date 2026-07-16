import { ProjectDetailScreen } from "@/features/projects/ProjectDetailScreen";

export default function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  return <ProjectDetailScreen projectId={params.projectId} />;
}
