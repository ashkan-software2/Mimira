/**
 * Minimal Cohere embed-multilingual-v3 wrapper.
 * - input_type='search_query' for inbound user text (what we'll search with)
 * - input_type='search_document' for knowledge chunks at ingest time
 * Returns 1024-dim float vectors.
 */

const COHERE_API = "https://api.cohere.com/v2/embed";
const MODEL = "embed-multilingual-v3.0";

function cohereKey(): string {
  const v = process.env.COHERE_API_KEY;
  if (!v) throw new Error("COHERE_API_KEY is not set");
  return v;
}

type InputType = "search_query" | "search_document";

async function embed(texts: string[], inputType: InputType): Promise<number[][]> {
  const res = await fetch(COHERE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cohereKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      texts,
      input_type: inputType,
      embedding_types: ["float"],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cohere ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    embeddings: { float: number[][] };
  };
  return data.embeddings.float;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embed([text], "search_query");
  return v;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  return embed(texts, "search_document");
}
