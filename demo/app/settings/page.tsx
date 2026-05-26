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

export default function SettingsPage() {
  return (
    <SettingsView
      initialBrandVoice={getBrandVoice()}
      initialSettings={getSettings()}
      initialDialogues={listSampleDialogues()}
      initialCapacity={listCapacityRules()}
      initialTeam={listTeamMembers()}
      initialAudit={listAuditLog({ limit: 30 })}
    />
  );
}
