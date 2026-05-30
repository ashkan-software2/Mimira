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

function platformWebhookUrl(h: Headers): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return new URL("/api/line/webhook", appUrl).toString();
  return webhookUrlFromHeaders(h) ?? "https://app.mimira.ai/api/line/webhook";
}

export default async function SettingsPage() {
  const h = await headers();
  const webhookUrl = platformWebhookUrl(h);
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
  const lineWebhookUrl = settings.line.webhook_url || webhookUrl;
  return (
    <SettingsView
      initialBrandVoice={brandVoice}
      initialSettings={settings}
      initialDialogues={dialogues}
      initialCapacity={capacity}
      initialTeam={team}
      initialAudit={audit}
      webhookUrl={lineWebhookUrl ?? ""}
    />
  );
}
