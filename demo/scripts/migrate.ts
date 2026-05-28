/**
 * Apply db/schema.sql to the configured Postgres database.
 *
 * Connects via DIRECT_URL (Supabase session-mode pooler / direct connection)
 * rather than DATABASE_URL (transaction pooler) so DDL — extension creation,
 * HNSW index build, constraints — runs in a normal session. Idempotent: every
 * statement in schema.sql uses `IF NOT EXISTS` so this is safe to re-run.
 *
 * Usage:
 *   npm run db:migrate
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "ERROR  DIRECT_URL (or DATABASE_URL) must be set. Use the Supabase 'direct connection' or session pooler URL for migrations."
    );
    process.exit(1);
  }

  const schemaPath = join(process.cwd(), "db", "schema.sql");
  const schema = readFileSync(schemaPath, "utf8");

  const sql = postgres(url, {
    // DDL is fine with prepared statements on a direct/session connection,
    // but we still don't gain anything from them here. Keep it simple.
    max: 1,
    onnotice: () => {},
  });

  process.stdout.write("MIGRATE  applying db/schema.sql ... ");
  try {
    // `sql.unsafe` runs raw SQL — required because schema.sql is a multi-stmt
    // file, not a single tagged-template expression. The contents are static
    // and version-controlled, so unsafe execution is appropriate here.
    await sql.unsafe(schema);
    console.log("ok");
  } catch (err) {
    console.log("FAIL");
    console.error(err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
