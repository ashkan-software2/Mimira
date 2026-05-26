"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb, now, type SettingsBlob } from "@/lib/db";
import {
  appendAudit,
  exportAllCustomers,
  insertSampleDialogue,
  insertTeamMember,
  listSampleDialogues,
  removeCapacityRule,
  removeSampleDialogue,
  removeTeamMember,
  updateSettings,
  updateTeamMember,
  upsertCapacityRule,
  type CustomerExport,
  type SampleDialogue,
  type TeamMember,
} from "@/lib/repo";

const ACTOR = "Pim";

function bump() {
  revalidatePath("/settings");
}

// ---------- Brand voice ----------

export async function saveBrandVoice(brandVoice: string): Promise<void> {
  getDb()
    .prepare(
      "UPDATE settings SET brand_voice = ?, updated_at = ? WHERE id = 1"
    )
    .run(brandVoice, now());
  updateSettings("brand_voice", { saved_at: now(), saved_by: ACTOR });
  appendAudit({
    section: "brand-voice",
    actor: ACTOR,
    summary: `Brand voice updated (${brandVoice.length} chars)`,
  });
  bump();
}

export async function addSampleDialogue(args: {
  customer_text: string;
  yuna_text: string;
}): Promise<SampleDialogue> {
  const trimmedCustomer = args.customer_text.trim();
  const trimmedYuna = args.yuna_text.trim();
  if (!trimmedCustomer || !trimmedYuna) {
    throw new Error("Both customer and Yuna lines are required");
  }
  const dialogue = insertSampleDialogue({
    customer_text: trimmedCustomer,
    yuna_text: trimmedYuna,
  });
  appendAudit({
    section: "brand-voice",
    actor: ACTOR,
    summary: "Sample dialogue added",
  });
  bump();
  return dialogue;
}

export async function deleteSampleDialogue(id: string): Promise<void> {
  removeSampleDialogue(id);
  appendAudit({
    section: "brand-voice",
    actor: ACTOR,
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
  hours: string;
  languages: string;
}): Promise<SettingsBlob> {
  const next = updateSettings("clinic", {
    ...input,
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "clinic",
    actor: ACTOR,
    summary: `Clinic profile updated · ${input.name}`,
  });
  bump();
  return next;
}

// ---------- Line OA ----------

export async function saveLine(input: {
  channel_id: string;
  oa_name: string;
}): Promise<SettingsBlob> {
  const next = updateSettings("line", {
    channel_id: input.channel_id,
    oa_name: input.oa_name,
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "line",
    actor: ACTOR,
    summary: `Line OA updated · ${input.oa_name}`,
  });
  bump();
  return next;
}

export async function rotateLineSecret(): Promise<{ last4: string; rotated_at: number }> {
  const last4 = randomBytes(2).toString("hex");
  const ts = now();
  updateSettings("line", { secret_last4: last4, secret_rotated_at: ts });
  appendAudit({
    section: "line",
    actor: ACTOR,
    summary: `Channel secret rotated · ends ${last4}`,
  });
  bump();
  return { last4, rotated_at: ts };
}

export async function testLineSignature(): Promise<{ ok: true; pinged_at: number }> {
  const ts = now();
  updateSettings("line", { last_ping_at: ts });
  appendAudit({
    section: "line",
    actor: ACTOR,
    summary: "Test signature verified",
  });
  bump();
  return { ok: true, pinged_at: ts };
}

// ---------- AI brain ----------

export async function saveAiBrain(input: {
  provider: "OpenAI" | "Anthropic" | "Google";
  model: string;
  temperature: number;
}): Promise<SettingsBlob> {
  const next = updateSettings("ai", {
    provider: input.provider,
    model: input.model,
    temperature: Math.max(0, Math.min(1, input.temperature)),
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "ai-brain",
    actor: ACTOR,
    summary: `AI brain updated · ${input.provider} ${input.model} @ ${input.temperature.toFixed(2)}`,
  });
  bump();
  return next;
}

export async function requestEmbeddingOverride(reason: string): Promise<void> {
  appendAudit({
    section: "ai-brain",
    actor: ACTOR,
    summary: `Embedding override requested · ${reason.slice(0, 80) || "no reason"}`,
  });
  bump();
}

// ---------- Kill switch ----------

export async function setKillSwitch(paused: boolean): Promise<SettingsBlob> {
  const ts = now();
  const next = updateSettings("kill_switch", { paused, changed_at: ts });
  appendAudit({
    section: "kill-switch",
    actor: ACTOR,
    summary: paused
      ? "Yuna paused for the clinic"
      : "Yuna re-activated for the clinic",
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
  const next = updateSettings("aftercare", {
    ...input,
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "aftercare",
    actor: ACTOR,
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
  const next = updateSettings("privacy", {
    conversation_months: input.conversation_months,
    audit_months: input.audit_months,
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "privacy",
    actor: ACTOR,
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
  const data: CustomerExport[] = exportAllCustomers();
  const payload = {
    exported_at: new Date().toISOString(),
    clinic: "Sukhumvit Skin & Laser",
    customer_count: data.length,
    customers: data,
  };
  appendAudit({
    section: "privacy",
    actor: ACTOR,
    summary: `DSAR export generated · ${data.length} customers`,
  });
  bump();
  return {
    filename: `yuna-dsar-${new Date().toISOString().slice(0, 10)}.json`,
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
  const rule = upsertCapacityRule(input);
  appendAudit({
    section: "capacity",
    actor: ACTOR,
    summary: input.id
      ? `Capacity rule updated · ${rule.treatment}`
      : `Capacity rule added · ${rule.treatment}`,
  });
  bump();
}

export async function deleteCapacityRule(id: string, name: string): Promise<void> {
  removeCapacityRule(id);
  appendAudit({
    section: "capacity",
    actor: ACTOR,
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
  const trimmedName = input.name.trim();
  const trimmedEmail = input.email.trim().toLowerCase();
  if (!trimmedName || !trimmedEmail) {
    throw new Error("Name and email are required");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error("Email looks invalid");
  }
  const member = insertTeamMember({
    name: trimmedName,
    email: trimmedEmail,
    role: input.role,
    pending: true,
  });
  appendAudit({
    section: "team",
    actor: ACTOR,
    summary: `Invite sent · ${trimmedEmail} (${input.role})`,
  });
  bump();
  return member;
}

export async function resendInvite(id: string, email: string): Promise<void> {
  appendAudit({
    section: "team",
    actor: ACTOR,
    summary: `Invite resent · ${email}`,
  });
  bump();
}

export async function setTeamMemberRole(
  id: string,
  role: "Owner" | "Staff"
): Promise<void> {
  updateTeamMember(id, { role });
  appendAudit({
    section: "team",
    actor: ACTOR,
    summary: `Role changed to ${role}`,
  });
  bump();
}

export async function acceptTeamMemberInvite(id: string, email: string): Promise<void> {
  updateTeamMember(id, { pending: false });
  appendAudit({
    section: "team",
    actor: ACTOR,
    summary: `Invite accepted · ${email}`,
  });
  bump();
}

export async function deleteTeamMember(id: string, email: string): Promise<void> {
  removeTeamMember(id);
  appendAudit({
    section: "team",
    actor: ACTOR,
    summary: `Member removed · ${email}`,
  });
  bump();
}

// ---------- Billing ----------

export async function setBillingPlan(
  plan: "starter" | "growth" | "scale"
): Promise<SettingsBlob> {
  const quotaByPlan: Record<typeof plan, number> = {
    starter: 10_000,
    growth: 30_000,
    scale: 100_000,
  };
  const next = updateSettings("billing", {
    plan,
    msg_quota: quotaByPlan[plan],
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "billing",
    actor: ACTOR,
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
  const last4 = input.card_last4.replace(/\D/g, "").slice(-4);
  if (last4.length !== 4) throw new Error("Card number must end in 4 digits");
  if (!/^\d{2}\/\d{2}$/.test(input.card_exp)) {
    throw new Error("Expiry must be MM/YY");
  }
  const next = updateSettings("billing", {
    card_brand: input.card_brand || "Card",
    card_last4: last4,
    card_exp: input.card_exp,
    saved_at: now(),
    saved_by: ACTOR,
  });
  appendAudit({
    section: "billing",
    actor: ACTOR,
    summary: `Payment method updated · ${input.card_brand} ····${last4}`,
  });
  bump();
  return next;
}

export async function setAutoRenew(autoRenew: boolean): Promise<SettingsBlob> {
  const next = updateSettings("billing", { auto_renew: autoRenew });
  appendAudit({
    section: "billing",
    actor: ACTOR,
    summary: autoRenew ? "Auto-renew turned on" : "Auto-renew turned off",
  });
  bump();
  return next;
}
