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

export default async function SettingsPage() {
  const [brandVoice, settings, dialogues, capacity, team, audit] =
    await Promise.all([
      getBrandVoice(),
      getSettings(),
      listSampleDialogues(),
      listCapacityRules(),
      listTeamMembers(),
      listAuditLog({ limit: 30 }),
    ]);
  return (
    <SettingsView
      initialBrandVoice={brandVoice}
      initialSettings={settings}
      initialDialogues={dialogues}
      initialCapacity={capacity}
      initialTeam={team}
      initialAudit={audit}
    />
  );
}
