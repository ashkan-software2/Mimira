/**
 * Seed knowledge_chunks from one or more knowledge files.
 *
 * Usage:
 *   npm run seed:knowledge                          # default: data/sample_clinic_knowledge
 *   npm run seed:knowledge -- path/to/file.md ...   # one or more explicit files
 *
 * Splitting: paragraphs separated by blank lines, merged greedily into
 * ~500-character chunks. This is a deliberately dumb chunker for the demo —
 * another agent is working on a smarter outline-aware chunker that will plug
 * into the same insertKnowledgeChunk interface.
 *
 * Re-running deletes existing chunks for each source_doc and re-inserts —
 * safe to run repeatedly while iterating on knowledge files.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { config } from "dotenv";
import { embedDocuments } from "../lib/cohere";
import { deleteKnowledgeForSource, insertKnowledgeChunk } from "../lib/repo";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const TARGET_CHUNK_CHARS = 500;
const DEFAULT_PATH = join(process.cwd(), "data", "sample_clinic_knowledge");

function chunkText(raw: string): string[] {
  const paragraphs = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf.length === 0) {
      buf = p;
      continue;
    }
    if (buf.length + p.length + 2 <= TARGET_CHUNK_CHARS) {
      buf = `${buf}\n\n${p}`;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf.length > 0) chunks.push(buf);
  return chunks;
}

async function seedFile(filePath: string) {
  const sourceDoc = basename(filePath);
  const raw = readFileSync(filePath, "utf8");
  const chunks = chunkText(raw);
  if (chunks.length === 0) {
    console.log(`SKIP   ${sourceDoc} (empty)`);
    return;
  }

  const removed = deleteKnowledgeForSource(sourceDoc);
  if (removed > 0) console.log(`CLEAR  ${sourceDoc} (${removed} old chunks)`);

  process.stdout.write(`EMBED  ${sourceDoc} (${chunks.length} chunks)... `);
  const vectors = await embedDocuments(chunks);
  if (vectors.length !== chunks.length) {
    throw new Error(
      `Cohere returned ${vectors.length} vectors for ${chunks.length} chunks`
    );
  }
  for (let i = 0; i < chunks.length; i++) {
    insertKnowledgeChunk({
      sourceDoc,
      text: chunks[i],
      embedding: vectors[i],
    });
  }
  console.log("ok");
}

async function main() {
  const argv = process.argv.slice(2);
  const targets = (argv.length > 0 ? argv : [DEFAULT_PATH]).map((p) =>
    resolve(p)
  );

  for (const t of targets) {
    if (!existsSync(t)) {
      console.error(`ERROR  ${t} does not exist`);
      process.exit(1);
    }
    if (!statSync(t).isFile()) {
      console.error(`ERROR  ${t} is not a regular file`);
      process.exit(1);
    }
  }

  for (const t of targets) {
    await seedFile(t);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
