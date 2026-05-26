import { getBrandVoice } from "@/lib/repo";
import { SettingsView } from "./SettingsView";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const brandVoice = getBrandVoice();
  return <SettingsView initialBrandVoice={brandVoice} />;
}
