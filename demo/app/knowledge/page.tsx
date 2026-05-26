import { listKnowledgeDocs } from "@/lib/repo";
import { KnowledgeView, type KnowledgeDocDto } from "./KnowledgeView";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  const docs: KnowledgeDocDto[] = listKnowledgeDocs().map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    chunkCount: d.chunkCount,
    body: d.body,
    lastEditedAt: d.lastEditedAt,
  }));
  return <KnowledgeView docs={docs} />;
}
