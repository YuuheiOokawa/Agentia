import { HistoryDetailScreen } from "@/features/history/HistoryDetailScreen";

export default async function HistoryDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <HistoryDetailScreen sessionId={sessionId} />;
}
