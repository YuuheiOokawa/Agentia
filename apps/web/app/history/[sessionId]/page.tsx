import { HistoryDetailScreen } from "@/features/history/HistoryDetailScreen";

export default function HistoryDetailPage({ params }: { params: { sessionId: string } }) {
  return <HistoryDetailScreen sessionId={params.sessionId} />;
}
