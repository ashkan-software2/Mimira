import { toSql as pgvectorToSql } from "pgvector";
import { embedQuery } from "./cohere";
import { getDb } from "./db";

export type RetrievedChunk = {
  source_doc: string;
  text: string;
  score: number;
};

/**
 * Retrieve top-K most similar knowledge chunks for the query.
 *
 * Uses pgvector cosine distance (`<=>` operator). The query embedding is
 * computed via Cohere embed-multilingual-v3 (1024-dim) and serialized into
 * pgvector's text form before being passed to Postgres.
 *
 * Returns rows ordered by descending similarity (score in [-1, 1]; for normalized
 * Cohere vectors this is effectively [0, 1] with 1.0 = perfect match).
 */
export async function retrieve(
  query: string,
  k = 5
): Promise<RetrievedChunk[]> {
  const q = await embedQuery(query);
  const vec = pgvectorToSql(q);
  const sql = await getDb();
  const rows = await sql<RetrievedChunk[]>`
    SELECT source_doc,
           text,
           1 - (embedding <=> ${vec}::vector) AS score
    FROM knowledge_chunks
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${k}
  `;
  return [...rows];
}
