import { listKnowledgeChunks, type KnowledgeChunk } from "./repo";
import { embedQuery } from "./cohere";

export type RetrievedChunk = {
  source_doc: string;
  text: string;
  score: number;
};

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Retrieve top-K most similar knowledge chunks for the query.
 * Demo-scale: scan all chunks in memory. With < ~5k chunks this is sub-ms.
 * Production note: replace with pgvector + ivfflat at the migration to Supabase.
 */
export async function retrieve(
  query: string,
  k = 5
): Promise<RetrievedChunk[]> {
  const chunks: KnowledgeChunk[] = listKnowledgeChunks();
  if (chunks.length === 0) return [];

  const q = await embedQuery(query);
  const scored = chunks.map((c) => ({
    source_doc: c.source_doc,
    text: c.text,
    score: cosine(q, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
