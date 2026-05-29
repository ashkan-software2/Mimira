import { getSettings, listConversations } from "../lib/repo";

async function main() {
  const [convs, settings] = await Promise.all([
    listConversations(),
    getSettings(),
  ]);
  console.log("channel_id in settings:", settings.line.channel_id);
  console.log("conversations:", convs.length);
  for (const c of convs.slice(0, 10)) {
    const ts = Number(c.last_message_at);
    const when = Number.isFinite(ts) ? new Date(ts).toISOString() : String(c.last_message_at);
    console.log(
      "-",
      c.customer.display_name || c.customer.line_user_id,
      "|",
      c.last_message?.text?.slice(0, 50),
      "|",
      when
    );
  }

  const sql = await (await import("../lib/db")).getDb();
  const recent = await sql<
    { direction: string; text: string; created_at: number; sent_by: string }[]
  >`
    SELECT direction, text, created_at, sent_by FROM messages
    ORDER BY created_at DESC LIMIT 5
  `;
  console.log("\nrecent messages:");
  for (const m of recent) {
    console.log(" ", m.direction, m.sent_by, new Date(Number(m.created_at)).toISOString(), m.text.slice(0, 60));
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
