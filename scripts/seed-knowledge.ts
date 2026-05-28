/**
 * Seed knowledge_chunks from pre-chunked files in chunks/.
 *
 * Filename convention: `<source_doc>__NNNN.txt`. The part before `__` becomes
 * the source_doc identifier in the DB; the rest is just an ordering suffix
 * from the upstream chunker.
 *
 * Usage:
 *   npm run seed:knowledge                          # default: chunks/ dir
 *   npm run seed:knowledge -- path/to/chunks-dir    # alternative dir
 *
 * Re-running deletes existing chunks for each source_doc before re-inserting,
 * so it is safe to run repeatedly while iterating on the upstream chunker.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "dotenv";
import { embedDocuments } from "../lib/cohere";
import { deleteKnowledgeForSource, insertKnowledgeChunk } from "../lib/repo";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const DEFAULT_DIR = join(process.cwd(), "chunks");
const EMBED_BATCH_SIZE = 96; // Cohere embed-multilingual-v3 cap.

function sourceDocFromFilename(name: string): string {
  const sep = name.indexOf("__");
  if (sep === -1) return name.replace(/\.[^.]+$/, "");
  return name.slice(0, sep);
}

async function embedInBatches(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const slice = texts.slice(i, i + EMBED_BATCH_SIZE);
    const vectors = await embedDocuments(slice);
    if (vectors.length !== slice.length) {
      throw new Error(
        `Cohere returned ${vectors.length} vectors for ${slice.length} texts`
      );
    }
    out.push(...vectors);
  }
  return out;
}

async function main() {
  const argv = process.argv.slice(2);
  const dir = resolve(argv[0] ?? DEFAULT_DIR);

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`ERROR  ${dir} is not a directory`);
    process.exit(1);
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".txt") || f.endsWith(".md"))
    .sort();

  if (files.length === 0) {
    console.log(`No .txt/.md files in ${dir}. Nothing to seed.`);
    return;
  }

  // Group by source_doc and clear each one.
  const bySource: Record<string, string[]> = {};
  for (const f of files) {
    const src = sourceDocFromFilename(f);
    (bySource[src] ??= []).push(f);
  }

  for (const src of Object.keys(bySource)) {
    const removed = await deleteKnowledgeForSource(src);
    if (removed > 0) console.log(`CLEAR  ${src} (${removed} old chunks)`);
  }

  const allTexts: string[] = [];
  const meta: Array<{ source: string; text: string }> = [];
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8").trim();
    if (!text) continue;
    allTexts.push(text);
    meta.push({ source: sourceDocFromFilename(f), text });
  }

  process.stdout.write(
    `EMBED  ${allTexts.length} chunks across ${Object.keys(bySource).length} source(s)... `
  );
  const vectors = await embedInBatches(allTexts);
  console.log("ok");

  for (let i = 0; i < meta.length; i++) {
    await insertKnowledgeChunk({
      sourceDoc: meta[i].source,
      text: meta[i].text,
      embedding: vectors[i],
    });
  }
  console.log(`Inserted ${meta.length} chunks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
