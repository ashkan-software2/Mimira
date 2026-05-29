import type { SettingsBlob } from "./db";
import type { CapacityRule, SampleDialogue } from "./repo";

const MS_PER_MONTH = 30 * 24 * 60 * 60 * 1000;

export function retentionCutoffMs(months: number): number {
  return Date.now() - months * MS_PER_MONTH;
}

export function isOutboundQuotaExceeded(settings: SettingsBlob): boolean {
  return settings.billing.msg_count >= settings.billing.msg_quota;
}

export function quotaExceededReply(settings: SettingsBlob): string {
  const langs = settings.aftercare.languages;
  if (langs === "en") {
    return "Thank you for your message. This clinic has reached its monthly outbound message limit. A team member will follow up as soon as possible.";
  }
  if (langs === "th") {
    return "ขอบคุณที่ทักมาค่ะ ขณะนี้คลินิกใช้โควต้าข้อความออกครบแล้ว ทีมงานจะติดต่อกลับโดยเร็วที่สุดค่ะ";
  }
  return "ขอบคุณที่ทักมาค่ะ / Thank you — this clinic has reached its monthly outbound message limit. A team member will follow up shortly.";
}

/** Clinic profile block injected into the AI system prompt (Settings → Clinic). */
export function formatClinicBlock(settings: SettingsBlob): string {
  const c = settings.clinic;
  return `# Clinic profile (from Settings)
Name: ${c.name}
Timezone: ${c.timezone}
Address: ${c.address}
Hours: ${c.hours}
Languages served: ${c.languages}`;
}

/** Aftercare scheduler config (Settings → Aftercare). */
export function formatAftercareBlock(settings: SettingsBlob): string {
  const a = settings.aftercare;
  const days = [
    a.d1 ? "D+1" : null,
    a.d7 ? "D+7" : null,
    a.d30 ? "D+30" : null,
  ].filter(Boolean);
  const schedule =
    days.length > 0
      ? days.join(", ")
      : "none enabled (staff sends aftercare manually)";
  const langs =
    a.languages === "th+en"
      ? "Thai and English"
      : a.languages === "th"
        ? "Thai only"
        : "English only";
  return `# Aftercare follow-ups (from Settings)
Automated touchpoints: ${schedule}
Default send time: ${a.send_time} (${settings.clinic.timezone})
Message languages: ${langs}
When customers ask about post-treatment check-ins, describe only what is enabled above.`;
}

/** Language preference for automated / default replies (Settings → Aftercare languages). */
export function formatLanguageBlock(settings: SettingsBlob): string {
  const langs = settings.aftercare.languages;
  if (langs === "th") {
    return "# Language preference (from Settings)\nDefault to Thai for automated clinic replies unless the customer writes in another language.";
  }
  if (langs === "en") {
    return "# Language preference (from Settings)\nDefault to English for automated clinic replies unless the customer writes in another language.";
  }
  return "# Language preference (from Settings)\nClinic supports Thai and English for automated touchpoints; follow the customer's language in conversation.";
}

/** Capacity rules for booking guidance (Settings → Capacity). */
export function formatCapacityBlock(rules: CapacityRule[]): string {
  if (rules.length === 0) {
    return "# Capacity rules (from Settings)\nNo per-treatment daily limits configured.";
  }
  const lines = rules.map(
    (r) =>
      `- ${r.treatment}: max ${r.per_day}/day · ${r.slot_minutes} min slots`
  );
  return `# Capacity rules (from Settings)
When discussing availability or capturing bookings, respect these limits. If a day is full for a treatment, say so and offer another day — do not promise a slot that exceeds capacity.
${lines.join("\n")}`;
}

/** Few-shot examples from Settings → Brand voice sample dialogues. */
export function formatSampleDialoguesBlock(
  dialogues: SampleDialogue[]
): string {
  if (dialogues.length === 0) return "";
  const examples = dialogues
    .map(
      (d, i) =>
        `Example ${i + 1}\nCustomer: ${d.customer_text}\nAssistant: ${d.assistant_text}`
    )
    .join("\n\n");
  return `# Sample dialogues (from Settings — match this tone)
${examples}`;
}

export function matchCapacityRule(
  rules: CapacityRule[],
  treatment: string
): CapacityRule | undefined {
  const t = treatment.trim().toLowerCase();
  if (!t) return undefined;
  return (
    rules.find((r) => r.treatment.trim().toLowerCase() === t) ??
    rules.find(
      (r) =>
        r.treatment.trim().toLowerCase().includes(t) ||
        t.includes(r.treatment.trim().toLowerCase())
    )
  );
}

export function lineDestinationMatches(
  destination: string | undefined,
  channelId: string
): boolean {
  if (!destination?.trim() || !channelId?.trim()) return true;
  return destination.trim() === channelId.trim();
}
