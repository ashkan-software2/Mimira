import { listKnowledgeDocs } from "@/lib/repo";
import { KnowledgeView, type KnowledgeDocDto } from "./KnowledgeView";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const docs: KnowledgeDocDto[] = (await listKnowledgeDocs()).map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    chunkCount: d.chunkCount,
    body: d.body,
    lastEditedAt: d.lastEditedAt,
  }));
  return <KnowledgeView docs={docs} />;
}
