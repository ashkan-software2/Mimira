import { headers } from "next/headers";
import { retentionCutoffMs } from "@/lib/settings-runtime";
import {
  getBrandVoice,
  getSettings,
  listAuditLog,
  listCapacityRules,
  listSampleDialogues,
  listTeamMembers,
} from "@/lib/repo";
import { SettingsView } from "./SettingsView";

export const dynamic = "force-dynamic";

function webhookUrlFromHeaders(h: Headers): string | null {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/api/line/webhook`;
}

export default async function SettingsPage() {
  const h = await headers();
  const webhookUrl = webhookUrlFromHeaders(h);
  const settings = await getSettings();
  const [brandVoice, dialogues, capacity, team, audit] = await Promise.all([
    getBrandVoice(),
    listSampleDialogues(),
    listCapacityRules(),
    listTeamMembers(),
    listAuditLog({
      limit: 30,
      sinceMs: retentionCutoffMs(settings.privacy.audit_months),
    }),
  ]);
  return (
    <SettingsView
      initialBrandVoice={brandVoice}
      initialSettings={settings}
      initialDialogues={dialogues}
      initialCapacity={capacity}
      initialTeam={team}
      initialAudit={audit}
      webhookUrl={webhookUrl ?? settings.line.webhook_url}
    />
  );
}
