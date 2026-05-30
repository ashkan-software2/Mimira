"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { withAuthedAction } from "@/lib/auth";
import { getDb, now, type SettingsBlob } from "@/lib/db";
import { retentionCutoffMs } from "@/lib/settings-runtime";
import {
  appendAudit,
  exportAllCustomers,
  getTeamMemberByEmail,
  getSettings,
  insertSampleDialogue,
  insertTeamMember,
  listTeamMembers,
  listSampleDialogues,
  removeCapacityRule,
  removeSampleDialogue,
  removeTeamMember,
  saveSettings,
  updateSettings,
  updateTeamMember,
  upsertCapacityRule,
  type CustomerExport,
  type SampleDialogue,
  type TeamMember,
} from "@/lib/repo";

function bump() {
  revalidatePath("/settings");
}

const requireOwnerActor = withAuthedAction(
  async (current) => current.member.name,
  { role: "Owner" }
);

function invitationRedirectUrl(): string | undefined {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!base) return undefined;
  return new URL("/sign-up", base).toString();
}

async function sendClerkInvitation(email: string): Promise<void> {
  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    ignoreExisting: true,
    notify: true,
    redirectUrl: invitationRedirectUrl(),
  });
}

// ---------- Brand voice ----------

export async function saveBrandVoice(brandVoice: string): Promise<void> {
  const actor = await requireOwnerActor();
  const sql = await getDb();
  await sql`
    UPDATE settings
    SET brand_voice = ${brandVoice}, updated_at = ${now()}
    WHERE id = 1
  `;
  await updateSettings("brand_voice", { saved_at: now(), saved_by: actor });
  await appendAudit({
    section: "brand-voice",
    actor,
    summary: `Brand voice updated (${brandVoice.length} chars)`,
  });
  bump();
}

export async function addSampleDialogue(args: {
  customer_text: string;
  assistant_text: string;
}): Promise<SampleDialogue> {
  const actor = await requireOwnerActor();
  const trimmedCustomer = args.customer_text.trim();
  const trimmedAssistant = args.assistant_text.trim();
  if (!trimmedCustomer || !trimmedAssistant) {
    throw new Error("Both customer and assistant lines are required");
  }
  const dialogue = await insertSampleDialogue({
    customer_text: trimmedCustomer,
    assistant_text: trimmedAssistant,
  });
  await appendAudit({
    section: "brand-voice",
    actor,
    summary: "Sample dialogue added",
  });
  bump();
  return dialogue;
}

export async function deleteSampleDialogue(id: string): Promise<void> {
  const actor = await requireOwnerActor();
  await removeSampleDialogue(id);
  await appendAudit({
    section: "brand-voice",
    actor,
    summary: "Sample dialogue removed",
  });
  bump();
}

export async function getSampleDialogues(): Promise<SampleDialogue[]> {
  return listSampleDialogues();
}

// ---------- Clinic ----------

export async function saveClinic(input: {
  name: string;
  timezone: string;
  address: string;
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const current = await getSettings();
  const next: SettingsBlob = {
    ...current,
    clinic: {
      name: input.name,
      timezone: input.timezone,
      address: input.address,
      saved_at: now(),
      saved_by: actor,
    },
  };
  await saveSettings(next);
  await appendAudit({
    section: "clinic",
    actor,
    summary: `Clinic profile updated · ${input.name}`,
  });
  bump();
  return next;
}

// ---------- Line OA ----------

export async function saveLine(input: {
  channel_name: string;
  channel_secret: string;
  channel_access_token: string;
  webhook_url?: string;
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const channelSecret = input.channel_secret.trim();
  const channelAccessToken = input.channel_access_token.trim();
  const next = await updateSettings("line", {
    oa_name: input.channel_name.trim(),
    channel_secret: channelSecret,
    channel_access_token: channelAccessToken,
    secret_last4: channelSecret.slice(-4),
    secret_rotated_at: now(),
    ...(input.webhook_url ? { webhook_url: input.webhook_url } : {}),
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "line",
    actor,
    summary: `Line OA credentials updated · ${input.channel_name.trim()}`,
  });
  bump();
  return next;
}

// ---------- AI brain ----------

export async function saveAiBrain(input: {
  provider: "OpenAI" | "Anthropic" | "Google";
  model: string;
  temperature: number;
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const next = await updateSettings("ai", {
    provider: input.provider,
    model: input.model,
    temperature: Math.max(0, Math.min(1, input.temperature)),
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "ai-brain",
    actor,
    summary: `AI brain updated · ${input.provider} ${input.model} @ ${input.temperature.toFixed(2)}`,
  });
  bump();
  return next;
}

export async function requestEmbeddingOverride(reason: string): Promise<void> {
  const actor = await requireOwnerActor();
  await appendAudit({
    section: "ai-brain",
    actor,
    summary: `Embedding override requested · ${reason.slice(0, 80) || "no reason"}`,
  });
  bump();
}

// ---------- Kill switch ----------

export async function setKillSwitch(paused: boolean): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const ts = now();
  const next = await updateSettings("kill_switch", { paused, changed_at: ts });
  await appendAudit({
    section: "kill-switch",
    actor,
    summary: paused
      ? "Mimira paused for the clinic"
      : "Mimira re-activated for the clinic",
  });
  bump();
  return next;
}

// ---------- Aftercare ----------

export async function saveAftercare(input: {
  d1: boolean;
  d7: boolean;
  d30: boolean;
  send_time: string;
  languages: "th+en" | "th" | "en";
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const next = await updateSettings("aftercare", {
    ...input,
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "aftercare",
    actor,
    summary: `Aftercare schedule updated · D1=${input.d1 ? "on" : "off"} D7=${
      input.d7 ? "on" : "off"
    } D30=${input.d30 ? "on" : "off"} @ ${input.send_time}`,
  });
  bump();
  return next;
}

// ---------- Privacy & retention ----------

export async function savePrivacy(input: {
  conversation_months: number;
  audit_months: number;
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const next = await updateSettings("privacy", {
    conversation_months: input.conversation_months,
    audit_months: input.audit_months,
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "privacy",
    actor,
    summary: `Retention updated · conversation ${input.conversation_months}mo · audit ${input.audit_months}mo`,
  });
  bump();
  return next;
}

export async function exportDsar(): Promise<{
  filename: string;
  json: string;
  customers: number;
}> {
  const actor = await requireOwnerActor();
  const settings = await getSettings();
  const data: CustomerExport[] = await exportAllCustomers({
    conversationSinceMs: retentionCutoffMs(
      settings.privacy.conversation_months
    ),
  });
  const payload = {
    exported_at: new Date().toISOString(),
    clinic: settings.clinic.name,
    conversation_retention_months: settings.privacy.conversation_months,
    audit_retention_months: settings.privacy.audit_months,
    customer_count: data.length,
    customers: data,
  };
  await appendAudit({
    section: "privacy",
    actor,
    summary: `DSAR export generated · ${data.length} customers`,
  });
  bump();
  return {
    filename: `mimira-dsar-${new Date().toISOString().slice(0, 10)}.json`,
    json: JSON.stringify(payload, null, 2),
    customers: data.length,
  };
}

// ---------- Capacity ----------

export async function saveCapacityRule(input: {
  id?: string | null;
  treatment: string;
  per_day: number;
  slot_minutes: number;
}): Promise<void> {
  const actor = await requireOwnerActor();
  const rule = await upsertCapacityRule(input);
  await appendAudit({
    section: "capacity",
    actor,
    summary: input.id
      ? `Capacity rule updated · ${rule.treatment}`
      : `Capacity rule added · ${rule.treatment}`,
  });
  bump();
}

export async function deleteCapacityRule(id: string, name: string): Promise<void> {
  const actor = await requireOwnerActor();
  await removeCapacityRule(id);
  await appendAudit({
    section: "capacity",
    actor,
    summary: `Capacity rule removed · ${name}`,
  });
  bump();
}

// ---------- Team ----------

export async function inviteTeamMember(input: {
  name: string;
  email: string;
  role: "Owner" | "Staff";
}): Promise<TeamMember> {
  const actor = await requireOwnerActor();
  const trimmedName = input.name.trim();
  const trimmedEmail = input.email.trim().toLowerCase();
  if (!trimmedName || !trimmedEmail) {
    throw new Error("Name and email are required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("Email looks invalid");
  }
  const existing = await getTeamMemberByEmail(trimmedEmail);
  if (existing) {
    throw new Error("That email is already on the team");
  }
  await sendClerkInvitation(trimmedEmail);
  const member = await insertTeamMember({
    name: trimmedName,
    email: trimmedEmail,
    role: input.role,
    pending: true,
  });
  await appendAudit({
    section: "team",
    actor,
    summary: `Invite sent · ${trimmedEmail} (${input.role})`,
  });
  bump();
  return member;
}

export async function resendInvite(id: string, email: string): Promise<void> {
  const actor = await requireOwnerActor();
  await sendClerkInvitation(email);
  await appendAudit({
    section: "team",
    actor,
    summary: `Invite resent · ${email}`,
  });
  bump();
}

export async function setTeamMemberRole(
  id: string,
  role: "Owner" | "Staff"
): Promise<void> {
  const actor = await requireOwnerActor();
  if (role === "Staff") {
    const members = await listTeamMembers();
    const target = members.find((m) => m.id === id);
    const ownerCount = members.filter((m) => m.role === "Owner").length;
    if (target?.role === "Owner" && ownerCount <= 1) {
      throw new Error("At least one Owner is required");
    }
  }
  await updateTeamMember(id, { role });
  await appendAudit({
    section: "team",
    actor,
    summary: `Role changed to ${role}`,
  });
  bump();
}

export async function acceptTeamMemberInvite(id: string, email: string): Promise<void> {
  const actor = await requireOwnerActor();
  await updateTeamMember(id, { pending: false });
  await appendAudit({
    section: "team",
    actor,
    summary: `Invite accepted · ${email}`,
  });
  bump();
}

export async function deleteTeamMember(id: string, email: string): Promise<void> {
  const actor = await requireOwnerActor();
  const members = await listTeamMembers();
  const target = members.find((m) => m.id === id);
  const ownerCount = members.filter((m) => m.role === "Owner").length;
  if (target?.role === "Owner" && ownerCount <= 1) {
    throw new Error("At least one Owner is required");
  }
  await removeTeamMember(id);
  await appendAudit({
    section: "team",
    actor,
    summary: `Member removed · ${email}`,
  });
  bump();
}

// ---------- Billing ----------

export async function setBillingPlan(
  plan: "starter" | "growth" | "scale"
): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const quotaByPlan: Record<typeof plan, number> = {
    starter: 10_000,
    growth: 30_000,
    scale: 100_000,
  };
  const next = await updateSettings("billing", {
    plan,
    msg_quota: quotaByPlan[plan],
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "billing",
    actor,
    summary: `Plan switched to ${plan}`,
  });
  bump();
  return next;
}

export async function saveBillingCard(input: {
  card_brand: string;
  card_last4: string;
  card_exp: string;
}): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const last4 = input.card_last4.replace(/\D/g, "").slice(-4);
  if (last4.length !== 4) throw new Error("Card number must end in 4 digits");
  if (!/^\d{2}\/\d{2}$/.test(input.card_exp)) {
    throw new Error("Expiry must be MM/YY");
  }
  const next = await updateSettings("billing", {
    card_brand: input.card_brand || "Card",
    card_last4: last4,
    card_exp: input.card_exp,
    saved_at: now(),
    saved_by: actor,
  });
  await appendAudit({
    section: "billing",
    actor,
    summary: `Payment method updated · ${input.card_brand} ····${last4}`,
  });
  bump();
  return next;
}

export async function setAutoRenew(autoRenew: boolean): Promise<SettingsBlob> {
  const actor = await requireOwnerActor();
  const next = await updateSettings("billing", { auto_renew: autoRenew });
  await appendAudit({
    section: "billing",
    actor,
    summary: autoRenew ? "Auto-renew turned on" : "Auto-renew turned off",
  });
  bump();
  return next;
}
