"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withAuthedAction } from "@/lib/auth";
import { embedDocuments } from "@/lib/cohere";
import { insertKnowledgeChunk } from "@/lib/repo";

export type CreateKnowledgeDocInput = {
  title: string;
  body: string;
  category: "Treatments" | "Aftercare & safety";
};

export type CreateKnowledgeDocResult = {
  id: string;
  lastEditedAt: number;
};

/**
 * Persist a new knowledge doc so RAG can retrieve it.
 *
 * We store the doc as a single chunk where `text` starts with the title
 * line — same shape the upstream chunker produces, so the same first-line
 * grouping in `listKnowledgeDocs()` keeps working.
 *
 * `source_doc` is unique per insert (`doc:<uuid>`) so future delete/update
 * actions can target this doc without colliding with seeded chunks (which
 * all share `source_doc = "sample_clinic_knowledge"`).
 */
export const createKnowledgeDoc = withAuthedAction(async function createKnowledgeDoc(
  _current,
  input: CreateKnowledgeDocInput
): Promise<CreateKnowledgeDocResult> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required");

  const body = input.body.trim();
  const text = body ? `${title}\n${body}` : title;

  const [embedding] = await embedDocuments([text]);
  if (!embedding) throw new Error("Embedding failed");

  const sourceDoc = `doc:${randomUUID()}`;
  const id = await insertKnowledgeChunk({ sourceDoc, text, embedding });
  revalidatePath("/knowledge");
  return { id, lastEditedAt: Date.now() };
});
