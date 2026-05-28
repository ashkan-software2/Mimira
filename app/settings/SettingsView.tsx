"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import styles from "./settings.module.css";
import {
  acceptTeamMemberInvite,
  addSampleDialogue,
  deleteCapacityRule,
  deleteSampleDialogue,
  deleteTeamMember,
  exportDsar,
  inviteTeamMember,
  requestEmbeddingOverride,
  resendInvite,
  rotateLineSecret,
  saveAftercare,
  saveAiBrain,
  saveBillingCard,
  saveBrandVoice,
  saveCapacityRule,
  saveClinic,
  saveLine,
  savePrivacy,
  setAutoRenew,
  setBillingPlan,
  setKillSwitch,
  setTeamMemberRole,
  testLineSignature,
} from "./actions";
import type { SettingsBlob } from "@/lib/db";
import type {
  AuditEntry,
  CapacityRule,
  SampleDialogue,
  TeamMember,
} from "@/lib/repo";

type SectionId =
  | "clinic"
  | "line"
  | "ai-brain"
  | "kill-switch"
  | "brand-voice"
  | "capacity"
  | "aftercare"
  | "privacy"
  | "team"
  | "billing";

type NavEntry = {
  id: SectionId;
  label: string;
  tag?: "ai" | "dot";
};

const NAV: NavEntry[] = [
  { id: "clinic", label: "Clinic profile" },
  { id: "line", label: "Line OA" },
  { id: "ai-brain", label: "AI brain", tag: "ai" },
  { id: "kill-switch", label: "Kill switch", tag: "ai" },
  { id: "brand-voice", label: "Brand voice" },
  { id: "capacity", label: "Capacity rules" },
  { id: "aftercare", label: "Aftercare" },
  { id: "privacy", label: "Privacy & retention" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
];

const TOAST_MS = 2600;

const SECTION_LABEL: Record<string, string> = {
  clinic: "Clinic profile",
  line: "Line OA",
  "ai-brain": "AI brain",
  "kill-switch": "Kill switch",
  "brand-voice": "Brand voice",
  capacity: "Capacity rules",
  aftercare: "Aftercare",
  privacy: "Privacy & retention",
  team: "Team",
  billing: "Billing",
};

const MODEL_BY_PROVIDER: Record<
  "OpenAI" | "Anthropic" | "Google",
  { id: string; label: string }[]
> = {
  OpenAI: [
    { id: "gpt-4o-mini", label: "gpt-4o-mini" },
    { id: "gpt-4o", label: "gpt-4o" },
    { id: "gpt-4.1", label: "gpt-4.1" },
  ],
  Anthropic: [
    { id: "claude-sonnet-4-6", label: "claude-sonnet-4-6 (recommended)" },
    { id: "claude-haiku-4-5", label: "claude-haiku-4-5" },
    { id: "claude-opus-4-7", label: "claude-opus-4-7" },
  ],
  Google: [
    { id: "gemini-1.5-flash", label: "gemini-1.5-flash" },
    { id: "gemini-1.5-pro", label: "gemini-1.5-pro" },
    { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
  ],
};

const TIMEZONES = [
  { id: "Asia/Bangkok", label: "Asia/Bangkok (UTC+7)" },
  { id: "Asia/Singapore", label: "Asia/Singapore (UTC+8)" },
  { id: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
];

type PlanId = "starter" | "growth" | "scale";

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  quota: number;
  features: string[];
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: "฿2,490",
    quota: 10000,
    features: [
      "10,000 outbound msgs / mo",
      "1 Line OA",
      "1 admin seat included",
      "Email support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "฿5,990",
    quota: 30000,
    features: [
      "30,000 outbound msgs / mo",
      "Up to 3 Line OAs",
      "5 seats included",
      "Aftercare scheduler",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    price: "฿14,900",
    quota: 100000,
    features: [
      "100,000 outbound msgs / mo",
      "Unlimited OAs",
      "Unlimited seats",
      "Priority + Slack support",
    ],
  },
];

const PLAN_NAME: Record<PlanId, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};
const PLAN_PRICE_THB: Record<PlanId, number> = {
  starter: 2490,
  growth: 5990,
  scale: 14900,
};

// ---------- Time helpers ----------

const MIN = 60_000;
const HR = 60 * MIN;
const DAY = 24 * HR;

function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const delta = Date.now() - ts;
  if (delta < 30_000) return "just now";
  if (delta < HR) return `${Math.floor(delta / MIN)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HR)}h ago`;
  const days = Math.floor(delta / DAY);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function timeUntil(ts: number): string {
  const delta = ts - Date.now();
  if (delta <= 0) return "now";
  const days = Math.floor(delta / DAY);
  if (days >= 1) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `in ${Math.max(1, Math.floor(delta / HR))}h`;
}

// All date formatters render in Asia/Bangkok and build strings by hand so
// Node's ICU and the browser's ICU can't disagree. toLocaleString output
// differs between runtimes ("26 May, 18:24" vs "27 May at 01:24") which
// triggers a hydration mismatch — React then regenerates the tree and
// silently strips event handlers, so Save buttons appear dead.
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function bangkokParts(ts: number) {
  // Asia/Bangkok is a fixed UTC+7 (no DST), so a literal offset is exact.
  const d = new Date(ts + 7 * HR);
  return {
    day: d.getUTCDate(),
    month: MONTHS_SHORT[d.getUTCMonth()],
    year: d.getUTCFullYear(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtDate(ts: number): string {
  const p = bangkokParts(ts);
  return `${p.day} ${p.month} ${p.year}`;
}

function fmtDateTime(ts: number): string {
  const p = bangkokParts(ts);
  return `${pad2(p.day)} ${p.month}, ${pad2(p.hour)}:${pad2(p.minute)}`;
}

function fmtClock(ts: number): string {
  const p = bangkokParts(ts);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

// ---------- Inline icons ----------

function Chevron() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 2 8 6 4 10" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className={styles.lockIco}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="5" width="8" height="6" rx="1" />
      <path d="M4 5V3a2 2 0 0 1 4 0v2" />
    </svg>
  );
}

// ---------- Card primitive ----------

type CardProps = {
  id: SectionId;
  title: ReactNode;
  summary: ReactNode;
  saved: ReactNode;
  open: boolean;
  onToggle: () => void;
  registerRef: (id: SectionId, el: HTMLElement | null) => void;
  children: ReactNode;
};

function Card({
  id,
  title,
  summary,
  saved,
  open,
  onToggle,
  registerRef,
  children,
}: CardProps) {
  return (
    <article
      id={id}
      ref={(el) => registerRef(id, el)}
      className={`${styles.card} ${open ? styles.cardOpen : ""}`}
    >
      <button type="button" className={styles.cardHead} onClick={onToggle}>
        <span className={styles.chev}>
          <Chevron />
        </span>
        <h2>{title}</h2>
        <span className={styles.summary}>{summary}</span>
        <span className={styles.saved}>{saved}</span>
      </button>
      <div className={styles.cardBody}>{children}</div>
    </article>
  );
}

// ---------- Modal primitive ----------

type ModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

function Modal({ title, subtitle, onClose, wide, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={styles.modalScrim}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <h3>{title}</h3>
            {subtitle && <div className={styles.hint}>{subtitle}</div>}
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFoot}>{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Props ----------

type Props = {
  initialBrandVoice: string;
  initialSettings: SettingsBlob;
  initialDialogues: SampleDialogue[];
  initialCapacity: CapacityRule[];
  initialTeam: TeamMember[];
  initialAudit: AuditEntry[];
};

type ModalState =
  | { kind: "none" }
  | { kind: "audit"; section?: string }
  | { kind: "invite" }
  | { kind: "member"; member: TeamMember }
  | { kind: "capacity"; rule: CapacityRule | null }
  | { kind: "addDialogue" }
  | { kind: "override" }
  | { kind: "comparePlans" }
  | { kind: "payment" }
  | { kind: "dsar"; payload: { filename: string; json: string; customers: number } };

export function SettingsView(props: Props) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    clinic: false,
    line: true,
    "ai-brain": true,
    "kill-switch": true,
    "brand-voice": true,
    capacity: false,
    aftercare: false,
    privacy: false,
    team: false,
    billing: false,
  });

  const [active, setActive] = useState<SectionId>("ai-brain");

  // ---------- Per-section state ----------

  const [settings, setSettings] = useState<SettingsBlob>(props.initialSettings);

  // Clinic
  const [clinic, setClinic] = useState(settings.clinic);
  const clinicDirty =
    clinic.name !== settings.clinic.name ||
    clinic.timezone !== settings.clinic.timezone ||
    clinic.address !== settings.clinic.address ||
    clinic.hours !== settings.clinic.hours ||
    clinic.languages !== settings.clinic.languages;

  // Line
  const [line, setLine] = useState({
    channel_id: settings.line.channel_id,
    oa_name: settings.line.oa_name,
  });
  const lineDirty =
    line.channel_id !== settings.line.channel_id ||
    line.oa_name !== settings.line.oa_name;

  // AI brain
  const [ai, setAi] = useState({
    provider: settings.ai.provider,
    model: settings.ai.model,
    temperature: settings.ai.temperature,
  });
  const aiDirty =
    ai.provider !== settings.ai.provider ||
    ai.model !== settings.ai.model ||
    ai.temperature !== settings.ai.temperature;

  // Kill switch
  const [aiActive, setAiActive] = useState(!settings.kill_switch.paused);

  // Brand voice
  const [brandVoice, setBrandVoice] = useState(props.initialBrandVoice);
  const [savedBrandVoice, setSavedBrandVoice] = useState(props.initialBrandVoice);
  const brandDirty = brandVoice !== savedBrandVoice;
  const [dialogues, setDialogues] = useState<SampleDialogue[]>(props.initialDialogues);

  // Capacity
  const [capacity, setCapacity] = useState<CapacityRule[]>(props.initialCapacity);

  // Aftercare
  const [aftercare, setAftercare] = useState(settings.aftercare);
  const aftercareDirty =
    aftercare.d1 !== settings.aftercare.d1 ||
    aftercare.d7 !== settings.aftercare.d7 ||
    aftercare.d30 !== settings.aftercare.d30 ||
    aftercare.send_time !== settings.aftercare.send_time ||
    aftercare.languages !== settings.aftercare.languages;

  // Privacy
  const [privacy, setPrivacy] = useState({
    conversation_months: settings.privacy.conversation_months,
    audit_months: settings.privacy.audit_months,
  });
  const privacyDirty =
    privacy.conversation_months !== settings.privacy.conversation_months ||
    privacy.audit_months !== settings.privacy.audit_months;

  // Team
  const [team, setTeam] = useState<TeamMember[]>(props.initialTeam);

  // Audit log
  const [audit, setAudit] = useState<AuditEntry[]>(props.initialAudit);

  // Modal state
  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  // Toast
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(text: string) {
    setToast(text);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_MS);
  }

  function toggle(id: SectionId) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // ---------- Save helper that funnels through useTransition ----------

  const [isPending, startTransition] = useTransition();

  function noteAudit(section: string, summary: string) {
    setAudit((prev) =>
      [
        {
          id: `local-${Math.random().toString(36).slice(2, 9)}`,
          section,
          actor: "Pim",
          summary,
          created_at: Date.now(),
        },
        ...prev,
      ].slice(0, 30)
    );
  }

  async function doSave(label: string, fn: () => Promise<void>) {
    try {
      await fn();
      showToast(`Saved · ${label}`);
    } catch (err) {
      console.error(err);
      showToast(`Save failed · ${label}`);
    }
  }

  // ---------- Section save handlers ----------

  function saveClinicSection() {
    startTransition(async () => {
      await doSave("Clinic profile", async () => {
        const next = await saveClinic(clinic);
        setSettings(next);
        noteAudit("clinic", `Clinic profile updated · ${clinic.name}`);
      });
    });
  }
  function cancelClinic() {
    setClinic(settings.clinic);
  }

  function saveLineSection() {
    startTransition(async () => {
      await doSave("Line OA", async () => {
        const next = await saveLine(line);
        setSettings(next);
        noteAudit("line", `Line OA updated · ${line.oa_name}`);
      });
    });
  }
  function cancelLine() {
    setLine({
      channel_id: settings.line.channel_id,
      oa_name: settings.line.oa_name,
    });
  }
  function rotateSecret() {
    startTransition(async () => {
      try {
        const { last4, rotated_at } = await rotateLineSecret();
        setSettings((s) => ({
          ...s,
          line: { ...s.line, secret_last4: last4, secret_rotated_at: rotated_at },
        }));
        noteAudit("line", `Channel secret rotated · ends ${last4}`);
        showToast(`Secret rotated · ends ${last4}`);
      } catch {
        showToast("Rotate failed");
      }
    });
  }
  function pingLine() {
    startTransition(async () => {
      try {
        const { pinged_at } = await testLineSignature();
        setSettings((s) => ({
          ...s,
          line: { ...s.line, last_ping_at: pinged_at },
        }));
        noteAudit("line", "Test signature verified");
        showToast(`Signature verified · ${fmtClock(pinged_at)} ICT`);
      } catch {
        showToast("Test failed");
      }
    });
  }

  function saveAiSection() {
    startTransition(async () => {
      await doSave("AI brain", async () => {
        const next = await saveAiBrain(ai);
        setSettings(next);
        noteAudit(
          "ai-brain",
          `AI brain updated · ${ai.provider} ${ai.model} @ ${ai.temperature.toFixed(2)}`
        );
      });
    });
  }
  function cancelAi() {
    setAi({
      provider: settings.ai.provider,
      model: settings.ai.model,
      temperature: settings.ai.temperature,
    });
  }

  function toggleKillSwitch() {
    const nextPaused = aiActive; // flipping
    startTransition(async () => {
      try {
        const next = await setKillSwitch(nextPaused);
        setSettings(next);
        setAiActive(!nextPaused);
        noteAudit(
          "kill-switch",
          nextPaused
            ? "Mimira paused for the clinic"
            : "Mimira re-activated for the clinic"
        );
        showToast(nextPaused ? "Mimira paused for this clinic" : "Mimira activated");
      } catch {
        showToast("Toggle failed");
      }
    });
  }

  function saveBrandVoiceSection() {
    startTransition(async () => {
      await doSave("Brand voice", async () => {
        await saveBrandVoice(brandVoice);
        setSavedBrandVoice(brandVoice);
        setSettings((s) => ({
          ...s,
          brand_voice: { saved_at: Date.now(), saved_by: "Pim" },
        }));
        noteAudit(
          "brand-voice",
          `Brand voice updated (${brandVoice.length} chars)`
        );
      });
    });
  }

  function cancelBrandVoice() {
    setBrandVoice(savedBrandVoice);
  }

  function removeDialogue(id: string) {
    startTransition(async () => {
      try {
        await deleteSampleDialogue(id);
        setDialogues((prev) => prev.filter((d) => d.id !== id));
        noteAudit("brand-voice", "Sample dialogue removed");
        showToast("Sample removed");
      } catch {
        showToast("Remove failed");
      }
    });
  }

  function saveAftercareSection() {
    startTransition(async () => {
      await doSave("Aftercare schedule", async () => {
        const next = await saveAftercare(aftercare);
        setSettings(next);
        noteAudit(
          "aftercare",
          `Aftercare updated · D1=${aftercare.d1 ? "on" : "off"} D7=${
            aftercare.d7 ? "on" : "off"
          } D30=${aftercare.d30 ? "on" : "off"} @ ${aftercare.send_time}`
        );
      });
    });
  }
  function cancelAftercare() {
    setAftercare(settings.aftercare);
  }

  function savePrivacySection() {
    startTransition(async () => {
      await doSave("Privacy & retention", async () => {
        const next = await savePrivacy(privacy);
        setSettings(next);
        noteAudit(
          "privacy",
          `Retention updated · conv ${privacy.conversation_months}mo · audit ${privacy.audit_months}mo`
        );
      });
    });
  }
  function cancelPrivacy() {
    setPrivacy({
      conversation_months: settings.privacy.conversation_months,
      audit_months: settings.privacy.audit_months,
    });
  }

  function deleteCapacityRow(rule: CapacityRule) {
    if (
      !window.confirm(`Remove "${rule.treatment}" from capacity rules?`)
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteCapacityRule(rule.id, rule.treatment);
        setCapacity((prev) => prev.filter((r) => r.id !== rule.id));
        noteAudit("capacity", `Capacity rule removed · ${rule.treatment}`);
        showToast(`Removed · ${rule.treatment}`);
      } catch {
        showToast("Remove failed");
      }
    });
  }

  function deleteTeamRow(member: TeamMember) {
    if (member.role === "Owner") {
      showToast("Can't remove the Owner");
      return;
    }
    if (!window.confirm(`Remove ${member.name}?`)) return;
    startTransition(async () => {
      try {
        await deleteTeamMember(member.id, member.email);
        setTeam((prev) => prev.filter((m) => m.id !== member.id));
        noteAudit("team", `Member removed · ${member.email}`);
        showToast(`Removed · ${member.name}`);
      } catch {
        showToast("Remove failed");
      }
    });
  }

  function resendTeamInvite(member: TeamMember) {
    startTransition(async () => {
      try {
        await resendInvite(member.id, member.email);
        noteAudit("team", `Invite resent · ${member.email}`);
        showToast(`Invite resent to ${member.email}`);
      } catch {
        showToast("Resend failed");
      }
    });
  }

  function changeRole(member: TeamMember, role: "Owner" | "Staff") {
    startTransition(async () => {
      try {
        await setTeamMemberRole(member.id, role);
        setTeam((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, role } : m))
        );
        noteAudit("team", `Role changed · ${member.email} → ${role}`);
        showToast(`Role set to ${role}`);
      } catch {
        showToast("Update failed");
      }
    });
  }

  function acceptInvite(member: TeamMember) {
    startTransition(async () => {
      try {
        await acceptTeamMemberInvite(member.id, member.email);
        setTeam((prev) =>
          prev.map((m) =>
            m.id === member.id
              ? { ...m, pending: false, last_active_at: Date.now() }
              : m
          )
        );
        noteAudit("team", `Invite accepted · ${member.email}`);
        showToast(`${member.name} marked active`);
      } catch {
        showToast("Update failed");
      }
    });
  }

  function changeBillingPlan(plan: PlanId) {
    if (plan === settings.billing.plan) {
      setModal({ kind: "none" });
      return;
    }
    startTransition(async () => {
      try {
        const next = await setBillingPlan(plan);
        setSettings(next);
        noteAudit("billing", `Plan switched to ${plan}`);
        showToast(`Switched to ${PLAN_NAME[plan]}`);
        setModal({ kind: "none" });
      } catch {
        showToast("Update failed");
      }
    });
  }

  function toggleAutoRenew() {
    const next = !settings.billing.auto_renew;
    startTransition(async () => {
      try {
        const updated = await setAutoRenew(next);
        setSettings(updated);
        noteAudit("billing", next ? "Auto-renew on" : "Auto-renew off");
        showToast(next ? "Auto-renew on" : "Auto-renew off");
      } catch {
        showToast("Toggle failed");
      }
    });
  }

  function downloadInvoices() {
    const plan = settings.billing.plan;
    const price = PLAN_PRICE_THB[plan];
    const rows = ["Invoice #,Date,Plan,Amount THB,Status"];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(2);
      const inv = `YN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      rows.push(
        `${inv},${d.toISOString().slice(0, 10)},${PLAN_NAME[plan]},${price},paid`
      );
    }
    triggerDownload(
      `mimira-invoices-${new Date().toISOString().slice(0, 7)}.csv`,
      rows.join("\n"),
      "text/csv"
    );
    noteAudit("billing", "Invoices CSV downloaded");
    showToast("Invoices downloaded");
  }

  // ---------- DSAR ----------

  function startDsarExport() {
    startTransition(async () => {
      try {
        const payload = await exportDsar();
        noteAudit("privacy", `DSAR export prepared · ${payload.customers} customers`);
        setModal({ kind: "dsar", payload });
      } catch {
        showToast("Export failed");
      }
    });
  }

  // ---------- Refs for nav scroll-spy ----------

  const cardRefs = useRef<Map<SectionId, HTMLElement>>(new Map());
  const registerRef = (id: SectionId, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  function findScrollContainer(start: HTMLElement | null): HTMLElement | null {
    let p = start;
    while (p) {
      const overflowY = getComputedStyle(p).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") return p;
      p = p.parentElement;
    }
    return null;
  }

  function navTo(id: SectionId) {
    setActive(id);
    setOpen((prev) => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(id);
      if (!el) return;
      const container = findScrollContainer(el.parentElement);
      if (container) {
        const top =
          el.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop -
          12;
        container.scrollTo({ top, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  useEffect(() => {
    const first = cardRefs.current.values().next().value as
      | HTMLElement
      | undefined;
    const container = findScrollContainer(first?.parentElement ?? null);
    const target: HTMLElement | Window = container ?? window;

    const compute = () => {
      const refTop = container ? container.getBoundingClientRect().top : 0;
      const viewportBottom = container
        ? container.getBoundingClientRect().bottom
        : window.innerHeight;
      let bestId: SectionId | null = null;
      let bestDistance = Infinity;
      for (const [id, el] of cardRefs.current) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - refTop - 80);
        if (
          rect.top < viewportBottom &&
          rect.bottom > refTop &&
          distance < bestDistance
        ) {
          bestDistance = distance;
          bestId = id;
        }
      }
      if (bestId) setActive(bestId);
    };

    target.addEventListener("scroll", compute, { passive: true });
    compute();
    return () => target.removeEventListener("scroll", compute);
  }, []);

  // ---------- Computed summaries ----------

  const voiceSummary = useMemo(() => {
    const first = savedBrandVoice.replace(/\s+/g, " ").trim().slice(0, 60);
    const count = dialogues.length;
    const suffix = `${count} sample dialogue${count === 1 ? "" : "s"}`;
    return first
      ? `${first}${savedBrandVoice.length > 60 ? "…" : ""} · ${suffix}`
      : suffix;
  }, [savedBrandVoice, dialogues.length]);

  const capacitySummary = useMemo(() => {
    const total = capacity.reduce((acc, r) => acc + r.per_day, 0);
    return `${capacity.length} treatment${capacity.length === 1 ? "" : "s"} · ${total} bookings/day max`;
  }, [capacity]);

  const teamSummary = useMemo(() => {
    const owners = team.filter((m) => m.role === "Owner").length;
    const staff = team.filter((m) => m.role === "Staff").length;
    const pending = team.filter((m) => m.pending).length;
    return `${team.length} member${team.length === 1 ? "" : "s"} · ${owners} owner${
      owners === 1 ? "" : "s"
    } · ${staff} staff${pending ? ` · ${pending} pending` : ""}`;
  }, [team]);

  const billingMeterPct = Math.min(
    100,
    Math.round((settings.billing.msg_count / settings.billing.msg_quota) * 100)
  );

  // Has the Line OA had a recent ping?
  const linePinged = settings.line.last_ping_at > 0;
  const lineSummary = `${settings.line.oa_name} · channel ${settings.line.channel_id.slice(0, 4)}…${settings.line.channel_id.slice(-4)} · last ping ${
    linePinged ? fmtClock(settings.line.last_ping_at) : "never"
  } ✓`;

  return (
    <div className={styles.workspace}>
      <aside className={styles.colNav} aria-label="Settings sections">
        <div className={styles.navHeader}>
          <h2>Settings · {NAV.length}</h2>
        </div>
        <ul className={styles.navList}>
          {NAV.map((item) => {
            const isActive = item.id === active;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.navItem} ${
                    isActive ? styles.navItemActive : ""
                  }`}
                  onClick={() => navTo(item.id)}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span>{item.label}</span>
                  {item.tag === "ai" && (
                    <span className={`${styles.navTag} ${styles.navTagAi}`}>
                      Mimira
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={styles.colContent} aria-label="Settings">
        <div className={styles.content}>
          <header className={styles.pageHeader}>
            <h1>Settings</h1>
            <div className={styles.sub}>
              Each section saves on its own. Changes take effect on the next
              inbound message.
            </div>
          </header>

          {/* CLINIC */}
          <Card
            id="clinic"
            title="Clinic profile"
            summary={`${settings.clinic.name} · ${settings.clinic.timezone.split("/")[1]} · ${settings.clinic.hours}`}
            saved={`Saved ${timeAgo(settings.clinic.saved_at)}`}
            open={open.clinic}
            onToggle={() => toggle("clinic")}
            registerRef={registerRef}
          >
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-name">
                  Clinic name
                </label>
                <input
                  className={styles.input}
                  id="clinic-name"
                  value={clinic.name}
                  onChange={(e) =>
                    setClinic({ ...clinic, name: e.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-tz">
                  Timezone
                </label>
                <select
                  className={styles.select}
                  id="clinic-tz"
                  value={clinic.timezone}
                  onChange={(e) =>
                    setClinic({ ...clinic, timezone: e.target.value })
                  }
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="clinic-addr">
                Address
              </label>
              <input
                className={styles.input}
                id="clinic-addr"
                value={clinic.address}
                onChange={(e) =>
                  setClinic({ ...clinic, address: e.target.value })
                }
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-hours">
                  Hours
                </label>
                <input
                  className={styles.input}
                  id="clinic-hours"
                  value={clinic.hours}
                  onChange={(e) =>
                    setClinic({ ...clinic, hours: e.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-langs">
                  Languages spoken
                </label>
                <input
                  className={styles.input}
                  id="clinic-langs"
                  value={clinic.languages}
                  onChange={(e) =>
                    setClinic({ ...clinic, languages: e.target.value })
                  }
                />
              </div>
            </div>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {clinicDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.clinic.saved_at)} by ${settings.clinic.saved_by}`}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelClinic}
                disabled={!clinicDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveClinicSection}
                disabled={!clinicDirty || isPending}
              >
                {isPending && clinicDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* LINE OA */}
          <Card
            id="line"
            title="Line OA"
            summary={lineSummary}
            saved={`Saved ${timeAgo(settings.line.saved_at)}`}
            open={open.line}
            onToggle={() => toggle("line")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              The clinic&rsquo;s Line Official Account credentials. Channel
              secret is encrypted at rest — only the last 4 characters are shown.
              In the demo build, these live in <code>.env.local</code>.
            </p>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="line-id">
                  Channel ID
                </label>
                <input
                  className={`${styles.input} ${styles.inputMono}`}
                  id="line-id"
                  value={line.channel_id}
                  onChange={(e) =>
                    setLine({ ...line, channel_id: e.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="line-oa">
                  OA display name
                </label>
                <input
                  className={styles.input}
                  id="line-oa"
                  value={line.oa_name}
                  onChange={(e) =>
                    setLine({ ...line, oa_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="line-secret">
                Channel secret <span className={styles.req}>· encrypted</span>
              </label>
              <div className={styles.secretRow}>
                <input
                  className={`${styles.input} ${styles.inputMono}`}
                  id="line-secret"
                  value={`••••••••••••••${settings.line.secret_last4}`}
                  readOnly
                />
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={rotateSecret}
                  disabled={isPending}
                >
                  Rotate
                </button>
              </div>
              <span className={styles.hint}>
                Stored in Supabase Vault. Last rotated{" "}
                {timeAgo(settings.line.secret_rotated_at)}.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="line-webhook">
                Webhook URL <span className={styles.req}>· read-only</span>
              </label>
              <input
                className={`${styles.input} ${styles.inputMono}`}
                id="line-webhook"
                value={settings.line.webhook_url}
                readOnly
              />
              <span className={styles.hint}>
                Paste this into the Line Developers Console → Messaging API →
                Webhook URL.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Verify connection</label>
              <div className={styles.testRow}>
                <div className={styles.status}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  <span>
                    {linePinged ? "Last ping received" : "No ping received"}
                  </span>
                </div>
                <span className={styles.when}>
                  {linePinged
                    ? `${fmtDateTime(settings.line.last_ping_at)} ICT`
                    : "—"}
                </span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={pingLine}
                  disabled={isPending}
                >
                  Test signature
                </button>
              </div>
              <span className={styles.hint}>
                Sends a signed test event from Mimira. Your webhook should respond
                within 1s.
              </span>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {lineDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.line.saved_at)} by ${settings.line.saved_by}`}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelLine}
                disabled={!lineDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveLineSection}
                disabled={!lineDirty || isPending}
              >
                {isPending && lineDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* AI BRAIN */}
          <Card
            id="ai-brain"
            title={
              <>
                AI brain{" "}
                <span className={`${styles.badge} ${styles.badgeYuna}`}>
                  Mimira
                </span>
              </>
            }
            summary={`${settings.ai.provider} · ${settings.ai.model} · Cohere v3 · temp ${settings.ai.temperature.toFixed(2)}`}
            saved={`Saved ${timeAgo(settings.ai.saved_at)}`}
            open={open["ai-brain"]}
            onToggle={() => toggle("ai-brain")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Which model writes Mimira&rsquo;s replies. Changes apply to new
              conversations — active threads finish on the current provider.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Provider</label>
              <div
                className={styles.segment}
                role="radiogroup"
                aria-label="LLM provider"
              >
                {(["OpenAI", "Anthropic", "Google"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-pressed={ai.provider === p}
                    aria-checked={ai.provider === p}
                    onClick={() =>
                      setAi({
                        provider: p,
                        model: MODEL_BY_PROVIDER[p][0].id,
                        temperature: ai.temperature,
                      })
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
              <span className={styles.hint}>
                Recommended for Thai: Anthropic. You can change anytime.
              </span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ai-model">
                  Model
                </label>
                <select
                  className={styles.select}
                  id="ai-model"
                  value={ai.model}
                  onChange={(e) => setAi({ ...ai, model: e.target.value })}
                >
                  {MODEL_BY_PROVIDER[ai.provider].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ai-temp">
                  Temperature
                </label>
                <div className={styles.sliderRow}>
                  <input
                    id="ai-temp"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={ai.temperature}
                    onChange={(e) =>
                      setAi({ ...ai, temperature: parseFloat(e.target.value) })
                    }
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>
                    {ai.temperature.toFixed(2)}
                  </span>
                </div>
                <div className={styles.sliderScale}>
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Embedding model</label>
              <div className={styles.lockedRow}>
                <div className={styles.lock}>
                  <LockIcon />
                  <span>Cohere embed-multilingual-v3</span>
                </div>
                <div className={styles.meta}>
                  <span>1024 dim</span>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    className={styles.btnLink}
                    onClick={() => setModal({ kind: "override" })}
                  >
                    Request override
                  </button>
                </div>
              </div>
              <span className={styles.hint}>
                Locked in v0. Changing the embedding model would require
                re-indexing your entire Knowledge base.
              </span>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {aiDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.ai.saved_at)} by ${settings.ai.saved_by}`}{" "}
                ·{" "}
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => setModal({ kind: "audit", section: "ai-brain" })}
                >
                  View audit log
                </button>
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelAi}
                disabled={!aiDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveAiSection}
                disabled={!aiDirty || isPending}
              >
                {isPending && aiDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* KILL SWITCH */}
          <Card
            id="kill-switch"
            title={
              <>
                Kill switch{" "}
                <span className={`${styles.badge} ${styles.badgeYuna}`}>
                  Mimira
                </span>
              </>
            }
            summary={
              aiActive
                ? `Mimira AI is active · no state change in ${timeAgo(settings.kill_switch.changed_at)}`
                : "Mimira AI is paused · routing to staff"
            }
            saved="Owner-only"
            open={open["kill-switch"]}
            onToggle={() => toggle("kill-switch")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              One toggle to pause Mimira for this clinic. Inbound messages route
              straight to the staff inbox until you turn her back on. Use this
              for off-hours, trainings, or if a customer flags Mimira&rsquo;s
              reply as wrong.
            </p>

            <div className={styles.killSwitch}>
              <div className={styles.labelBlock}>
                <span className={styles.label}>
                  Mimira AI is{" "}
                  <span
                    className={
                      aiActive ? styles.stateActive : styles.statePaused
                    }
                  >
                    {aiActive ? "active" : "paused"}
                  </span>
                </span>
                <span className={styles.hint}>
                  {aiActive
                    ? "All inbound messages currently flow through Mimira with staff escalation as needed."
                    : "All inbound messages are routing directly to the staff inbox."}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiActive}
                aria-label="Pause Mimira for this clinic"
                className={`${styles.switch} ${
                  aiActive ? "" : styles.switchOff
                } ${!aiActive ? styles.switchPaused : ""}`}
                onClick={toggleKillSwitch}
                disabled={isPending}
              />
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                Last change {timeAgo(settings.kill_switch.changed_at)} ·{" "}
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() =>
                    setModal({ kind: "audit", section: "kill-switch" })
                  }
                >
                  View audit log
                </button>
              </span>
            </div>
          </Card>

          {/* BRAND VOICE */}
          <Card
            id="brand-voice"
            title="Brand voice"
            summary={voiceSummary}
            saved={brandDirty ? "Unsaved changes" : "Saved"}
            open={open["brand-voice"]}
            onToggle={() => toggle("brand-voice")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Tell Mimira how she should sound. This free-form prompt feeds the
              system prompt on every reply. Sample dialogues show, don&rsquo;t
              tell — they have the largest effect on tone.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="voice-prompt">
                Voice prompt
              </label>
              <textarea
                id="voice-prompt"
                className={`${styles.textarea} ${styles.textareaLg}`}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                spellCheck={false}
              />
              <span className={styles.hint}>
                Plain Thai or English. Avoid mentioning specific prices — those
                come from Knowledge.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Sample dialogues{" "}
                <span className={styles.req}>
                  · {dialogues.length} of 5
                </span>
              </label>
              <div className={styles.dialogueList}>
                {dialogues.map((d) => (
                  <div key={d.id} className={styles.dialogue}>
                    <div className={styles.turn}>
                      <span className={styles.who}>Customer</span>
                      <div className={styles.turnText}>{d.customer_text}</div>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label="Remove"
                        onClick={() => removeDialogue(d.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles.turn}>
                      <span className={`${styles.who} ${styles.whoYuna}`}>
                        Mimira
                      </span>
                      <div className={styles.turnText}>
                        <span className={`${styles.badge} ${styles.badgeYuna}`}>
                          Mimira
                        </span>
                        {d.assistant_text}
                      </div>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label="Remove"
                        onClick={() => removeDialogue(d.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost} ${styles.addSample}`}
                onClick={() => setModal({ kind: "addDialogue" })}
                disabled={dialogues.length >= 5}
              >
                + Add sample dialogue
              </button>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {brandDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.brand_voice.saved_at)} by ${settings.brand_voice.saved_by}`}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelBrandVoice}
                disabled={!brandDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveBrandVoiceSection}
                disabled={!brandDirty || isPending}
              >
                {isPending && brandDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* CAPACITY */}
          <Card
            id="capacity"
            title="Capacity rules"
            summary={capacitySummary}
            saved={`Saved ${timeAgo(settings.clinic.saved_at)}`}
            open={open.capacity}
            onToggle={() => toggle("capacity")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Informational only in v0. Mimira mentions these when customers ask
              about availability, but doesn&rsquo;t auto-block bookings.
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Treatment</th>
                  <th className={styles.tableNum}>Bookings / day</th>
                  <th className={styles.tableNum}>Slot length</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {capacity.map((row) => (
                  <tr key={row.id}>
                    <td>{row.treatment}</td>
                    <td className={styles.tableNum}>{row.per_day}</td>
                    <td className={styles.tableNum}>{row.slot_minutes} min</td>
                    <td>
                      <span className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          onClick={() => setModal({ kind: "capacity", rule: row })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          onClick={() => deleteCapacityRow(row)}
                        >
                          Remove
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
                {capacity.length === 0 && (
                  <tr>
                    <td colSpan={4} className={styles.auditEmpty}>
                      No treatments yet — add one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                Capacity rules persist immediately
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setModal({ kind: "capacity", rule: null })}
              >
                + Add treatment
              </button>
            </div>
          </Card>

          {/* AFTERCARE */}
          <Card
            id="aftercare"
            title="Aftercare schedule"
            summary={`${aftercare.d1 ? "D1" : ""}${aftercare.d1 && aftercare.d7 ? " · " : ""}${aftercare.d7 ? "D7" : ""}${aftercare.d30 ? (aftercare.d1 || aftercare.d7 ? " · D30" : "D30") : ""} · ${aftercare.send_time} ICT · ${aftercare.languages === "th+en" ? "Thai + English" : aftercare.languages === "th" ? "Thai only" : "English only"}`}
            saved={`Saved ${timeAgo(settings.aftercare.saved_at)}`}
            open={open.aftercare}
            onToggle={() => toggle("aftercare")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Day-1 and Day-7 followup messages send automatically after a
              treatment. Each reply passes a safety classifier before sending.
            </p>

            {(
              [
                {
                  key: "d1" as const,
                  title: "Day 1 followup",
                  when: "Sends 10:00 ICT, one day after the appointment date.",
                },
                {
                  key: "d7" as const,
                  title: "Day 7 followup",
                  when: "Sends 10:00 ICT, seven days after the appointment date.",
                },
                {
                  key: "d30" as const,
                  title: "Day 30 followup",
                  when: "Off by default. Useful for laser series only.",
                },
              ]
            ).map((row) => {
              const checked = aftercare[row.key];
              return (
                <div key={row.key} className={styles.toggleRow}>
                  <div>
                    <div className={styles.label}>{row.title}</div>
                    <div className={styles.whenText}>{row.when}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-label={`Toggle ${row.title}`}
                    className={`${styles.switch} ${
                      checked ? "" : styles.switchOff
                    }`}
                    onClick={() =>
                      setAftercare((prev) => ({ ...prev, [row.key]: !prev[row.key] }))
                    }
                  />
                </div>
              );
            })}

            <div className={styles.timeGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ac-time">
                  Send time (clinic timezone)
                </label>
                <input
                  className={styles.input}
                  id="ac-time"
                  type="time"
                  value={aftercare.send_time}
                  onChange={(e) =>
                    setAftercare({ ...aftercare, send_time: e.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ac-langs">
                  Template languages
                </label>
                <select
                  className={styles.select}
                  id="ac-langs"
                  value={aftercare.languages}
                  onChange={(e) =>
                    setAftercare({
                      ...aftercare,
                      languages: e.target.value as "th+en" | "th" | "en",
                    })
                  }
                >
                  <option value="th+en">Thai + English</option>
                  <option value="th">Thai only</option>
                  <option value="en">English only</option>
                </select>
              </div>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {aftercareDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.aftercare.saved_at)} by ${settings.aftercare.saved_by}`}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelAftercare}
                disabled={!aftercareDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={saveAftercareSection}
                disabled={!aftercareDirty || isPending}
              >
                {isPending && aftercareDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* PRIVACY */}
          <Card
            id="privacy"
            title="Privacy & retention"
            summary={`${privacy.conversation_months}-month retention · 3 sub-processors · DSAR enabled`}
            saved={`Saved ${timeAgo(settings.privacy.saved_at)}`}
            open={open.privacy}
            onToggle={() => toggle("privacy")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              How long conversation data is stored, and who processes it. These
              values appear in your PDPA disclosure to customers.
            </p>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ret-conv">
                  Conversation retention
                </label>
                <select
                  className={styles.select}
                  id="ret-conv"
                  value={String(privacy.conversation_months)}
                  onChange={(e) =>
                    setPrivacy({
                      ...privacy,
                      conversation_months: Number(e.target.value),
                    })
                  }
                >
                  <option value="24">24 months (default)</option>
                  <option value="12">12 months</option>
                  <option value="6">6 months</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ret-audit">
                  Audit log retention
                </label>
                <select
                  className={styles.select}
                  id="ret-audit"
                  value={String(privacy.audit_months)}
                  onChange={(e) =>
                    setPrivacy({
                      ...privacy,
                      audit_months: Number(e.target.value),
                    })
                  }
                >
                  <option value="36">36 months (PDPA recommended)</option>
                  <option value="24">24 months</option>
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Sub-processors</label>
              <div className={styles.disclosure}>
                <div className={styles.disclosureLabel}>
                  Auto-generated from your current AI brain selection
                </div>
                <div>
                  {settings.ai.provider} <code>{settings.ai.model}</code>{" "}
                  generates replies. Cohere{" "}
                  <code>embed-multilingual-v3</code> embeds Knowledge for
                  retrieval. Supabase (Singapore) stores all data at rest.
                  Customer messages cross the SG–US border for the model call
                  only; no personally identifiable data is retained by
                  sub-processors.
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Data subject access requests (DSAR)
              </label>
              <div className={styles.testRow}>
                <div className={styles.status}>
                  <span
                    className={`${styles.statusDot} ${styles.statusDotInfo}`}
                    aria-hidden="true"
                  />
                  <span>DSAR endpoint live</span>
                </div>
                <span className={styles.when}>0 pending</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={startDsarExport}
                  disabled={isPending}
                >
                  Export customer data
                </button>
              </div>
              <span className={styles.hint}>
                Staff can export or delete a customer&rsquo;s entire history
                within 30 days, as required by PDPA.
              </span>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {privacyDirty
                  ? "Unsaved changes"
                  : `Last saved ${timeAgo(settings.privacy.saved_at)} by ${settings.privacy.saved_by}`}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={cancelPrivacy}
                disabled={!privacyDirty || isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={savePrivacySection}
                disabled={!privacyDirty || isPending}
              >
                {isPending && privacyDirty ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* TEAM */}
          <Card
            id="team"
            title="Team"
            summary={teamSummary}
            saved={`Saved ${timeAgo(settings.clinic.saved_at)}`}
            open={open.team}
            onToggle={() => toggle("team")}
            registerRef={registerRef}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className={styles.tableNum}>Last active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {team.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.name}
                      <div className={styles.hint}>
                        {row.email}
                        {row.pending ? " · invite pending" : ""}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`${styles.pill} ${
                          row.role === "Owner" ? styles.pillOwner : ""
                        }`}
                      >
                        {row.role}
                      </span>
                    </td>
                    <td className={styles.tableNum}>
                      {row.pending ? "—" : timeAgo(row.last_active_at)}
                    </td>
                    <td>
                      <span className={styles.rowActions}>
                        {row.pending && (
                          <button
                            type="button"
                            className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                            onClick={() => resendTeamInvite(row)}
                          >
                            Resend
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          onClick={() => setModal({ kind: "member", member: row })}
                        >
                          Manage
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                Team changes persist immediately ·{" "}
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => setModal({ kind: "audit", section: "team" })}
                >
                  View audit log
                </button>
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => setModal({ kind: "invite" })}
              >
                + Invite member
              </button>
            </div>
          </Card>

          {/* BILLING */}
          <Card
            id="billing"
            title="Billing"
            summary={`${PLAN_NAME[settings.billing.plan]} · ${settings.billing.msg_count.toLocaleString()} / ${settings.billing.msg_quota.toLocaleString()} msgs · renews ${timeUntil(settings.billing.renews_at)}`}
            saved={settings.billing.auto_renew ? "Auto-renew on" : "Auto-renew off"}
            open={open.billing}
            onToggle={() => toggle("billing")}
            registerRef={registerRef}
          >
            <div className={styles.billingGrid}>
              <div>
                <div className={styles.hint} style={{ marginBottom: 4 }}>
                  Current plan
                </div>
                <div className={styles.price}>
                  <span className={styles.priceAmount}>
                    ฿{PLAN_PRICE_THB[settings.billing.plan].toLocaleString()}
                  </span>
                  <span className={styles.pricePer}>/ month</span>
                </div>
                <div className={styles.hint} style={{ marginTop: 6 }}>
                  {PLAN_NAME[settings.billing.plan]} · up to{" "}
                  {settings.billing.msg_quota.toLocaleString()} outbound messages
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    onClick={() => setModal({ kind: "comparePlans" })}
                  >
                    Compare plans
                  </button>
                </div>
              </div>
              <div>
                <div className={styles.hint} style={{ marginBottom: 4 }}>
                  Message volume · this period
                </div>
                <div className={styles.meter}>
                  <div
                    className={styles.meterFill}
                    style={{ width: `${billingMeterPct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={styles.hint}
                  style={{ marginTop: 6, fontVariantNumeric: "tabular-nums" }}
                >
                  {settings.billing.msg_count.toLocaleString()} /{" "}
                  {settings.billing.msg_quota.toLocaleString()} outbound · resets{" "}
                  {timeUntil(settings.billing.renews_at)}
                </div>
              </div>
            </div>

            <div className={styles.field} style={{ marginTop: 20 }}>
              <label className={styles.label}>Payment method</label>
              <div className={styles.testRow}>
                <div className={styles.status}>
                  <span
                    className={`${styles.statusDot} ${styles.statusDotMuted}`}
                    aria-hidden="true"
                  />
                  <span>
                    {settings.billing.card_brand} ending in{" "}
                    {settings.billing.card_last4}
                  </span>
                </div>
                <span className={styles.when}>
                  Expires {settings.billing.card_exp}
                </span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => setModal({ kind: "payment" })}
                >
                  Update
                </button>
              </div>
            </div>

            <div className={styles.toggleRow}>
              <div>
                <div className={styles.label}>Auto-renew</div>
                <div className={styles.whenText}>
                  {settings.billing.auto_renew
                    ? `Next charge ${fmtDate(settings.billing.renews_at)}`
                    : "Plan will lapse at the end of the period"}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.billing.auto_renew}
                aria-label="Toggle auto-renew"
                className={`${styles.switch} ${
                  settings.billing.auto_renew ? "" : styles.switchOff
                }`}
                onClick={toggleAutoRenew}
                disabled={isPending}
              />
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                Next invoice: ฿
                {PLAN_PRICE_THB[settings.billing.plan].toLocaleString()} on{" "}
                {fmtDate(settings.billing.renews_at)}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={downloadInvoices}
              >
                Download invoices
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setModal({ kind: "comparePlans" })}
              >
                Manage plan
              </button>
            </div>
          </Card>
        </div>
      </section>

      {/* ---------- Toast ---------- */}
      <div
        className={
          toastVisible
            ? `${styles.toast} ${styles.toastVisible}`
            : styles.toast
        }
        role="status"
        aria-live="polite"
      >
        <span className={styles.toastCheck} aria-hidden="true">
          ✓
        </span>
        <span>{toast}</span>
      </div>

      {/* ---------- Modals ---------- */}

      {modal.kind === "audit" && (
        <AuditModal
          entries={
            modal.section
              ? audit.filter((a) => a.section === modal.section)
              : audit
          }
          section={modal.section}
          onClose={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "invite" && (
        <InviteModal
          onClose={() => setModal({ kind: "none" })}
          onInvited={(member) => {
            setTeam((prev) => [...prev, member]);
            noteAudit("team", `Invite sent · ${member.email} (${member.role})`);
            showToast(`Invite sent to ${member.email}`);
            setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "member" && (
        <ManageMemberModal
          member={modal.member}
          onClose={() => setModal({ kind: "none" })}
          onRoleChange={(role) => {
            changeRole(modal.member, role);
            setModal({ kind: "none" });
          }}
          onRemove={() => {
            setModal({ kind: "none" });
            deleteTeamRow(modal.member);
          }}
          onAcceptInvite={() => {
            acceptInvite(modal.member);
            setModal({ kind: "none" });
          }}
        />
      )}

      {modal.kind === "capacity" && (
        <CapacityModal
          rule={modal.rule}
          onClose={() => setModal({ kind: "none" })}
          onSave={async (input) => {
            try {
              await saveCapacityRule(input);
              if (input.id) {
                setCapacity((prev) =>
                  prev.map((r) =>
                    r.id === input.id
                      ? {
                          ...r,
                          treatment: input.treatment,
                          per_day: input.per_day,
                          slot_minutes: input.slot_minutes,
                        }
                      : r
                  )
                );
                noteAudit("capacity", `Capacity rule updated · ${input.treatment}`);
                showToast(`Updated · ${input.treatment}`);
              } else {
                // Re-query nothing — push a temporary row; will be refreshed next page load.
                const fakeId = `local-${Math.random().toString(36).slice(2, 9)}`;
                setCapacity((prev) => [
                  ...prev,
                  {
                    id: fakeId,
                    treatment: input.treatment,
                    per_day: input.per_day,
                    slot_minutes: input.slot_minutes,
                    position: prev.length,
                  },
                ]);
                noteAudit("capacity", `Capacity rule added · ${input.treatment}`);
                showToast(`Added · ${input.treatment}`);
              }
              setModal({ kind: "none" });
            } catch {
              showToast("Save failed");
            }
          }}
        />
      )}

      {modal.kind === "addDialogue" && (
        <DialogueModal
          onClose={() => setModal({ kind: "none" })}
          onSave={async (input) => {
            try {
              const dialogue = await addSampleDialogue(input);
              setDialogues((prev) => [...prev, dialogue]);
              noteAudit("brand-voice", "Sample dialogue added");
              showToast("Sample added");
              setModal({ kind: "none" });
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      )}

      {modal.kind === "override" && (
        <OverrideModal
          onClose={() => setModal({ kind: "none" })}
          onSubmit={async (reason) => {
            try {
              await requestEmbeddingOverride(reason);
              noteAudit("ai-brain", "Embedding override requested");
              showToast("Override request sent");
              setModal({ kind: "none" });
            } catch {
              showToast("Send failed");
            }
          }}
        />
      )}

      {modal.kind === "comparePlans" && (
        <ComparePlansModal
          current={settings.billing.plan}
          onClose={() => setModal({ kind: "none" })}
          onSelect={changeBillingPlan}
        />
      )}

      {modal.kind === "payment" && (
        <PaymentModal
          current={{
            card_brand: settings.billing.card_brand,
            card_last4: settings.billing.card_last4,
            card_exp: settings.billing.card_exp,
          }}
          onClose={() => setModal({ kind: "none" })}
          onSave={async (input) => {
            try {
              const next = await saveBillingCard(input);
              setSettings(next);
              noteAudit(
                "billing",
                `Payment method updated · ${input.card_brand} ····${input.card_last4}`
              );
              showToast("Payment method updated");
              setModal({ kind: "none" });
            } catch (err) {
              showToast(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      )}

      {modal.kind === "dsar" && (
        <DsarModal
          payload={modal.payload}
          onClose={() => setModal({ kind: "none" })}
          onDownload={() => {
            triggerDownload(
              modal.payload.filename,
              modal.payload.json,
              "application/json"
            );
            showToast("DSAR export downloaded");
            setModal({ kind: "none" });
          }}
        />
      )}
    </div>
  );
}

// ---------- Modal contents ----------

function AuditModal({
  entries,
  section,
  onClose,
}: {
  entries: AuditEntry[];
  section?: string;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Audit log"
      subtitle={
        section
          ? `Recent changes · ${SECTION_LABEL[section] ?? section}`
          : "Recent changes across all settings"
      }
      onClose={onClose}
      wide
      footer={
        <>
          <span className={styles.saveMeta}>
            {entries.length} entr{entries.length === 1 ? "y" : "ies"}
          </span>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Close
          </button>
        </>
      }
    >
      <div className={styles.auditList}>
        {entries.length === 0 && (
          <div className={styles.auditEmpty}>
            No audit entries yet — make a change and it&rsquo;ll show up here.
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={styles.auditEntry}>
            <span className={styles.auditSection}>
              {SECTION_LABEL[e.section] ?? e.section}
            </span>
            <span className={styles.auditSummary}>
              {e.summary} <span className={styles.hint}>· by {e.actor}</span>
            </span>
            <span className={styles.when}>{timeAgo(e.created_at)}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (m: TeamMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Owner" | "Staff">("Staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const member = await inviteTeamMember({ name, email, role });
      onInvited(member);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Invite team member"
      subtitle="They'll receive an email link to set their password."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="invite-form"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
          >
            {busy ? "Sending…" : "Send invite"}
          </button>
        </>
      }
    >
      <form id="invite-form" onSubmit={onSubmit} className={styles.modalBody} style={{ padding: 0, display: "contents" }}>
        {error && <div className={styles.modalError}>{error}</div>}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-name">
            Name
          </label>
          <input
            id="invite-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="invite-email">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Role</label>
          <div className={styles.segment} role="radiogroup" aria-label="Role">
            {(["Staff", "Owner"] as const).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={role === r}
                aria-pressed={role === r}
                onClick={() => setRole(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <span className={styles.hint}>
            Owners can manage billing and remove other members.
          </span>
        </div>
      </form>
    </Modal>
  );
}

function ManageMemberModal({
  member,
  onClose,
  onRoleChange,
  onRemove,
  onAcceptInvite,
}: {
  member: TeamMember;
  onClose: () => void;
  onRoleChange: (role: "Owner" | "Staff") => void;
  onRemove: () => void;
  onAcceptInvite: () => void;
}) {
  const [role, setRole] = useState<"Owner" | "Staff">(member.role);
  const dirty = role !== member.role;

  return (
    <Modal
      title={`Manage · ${member.name}`}
      subtitle={member.email}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onRemove}
            disabled={member.role === "Owner"}
          >
            Remove
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => onRoleChange(role)}
            disabled={!dirty}
          >
            Save role
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.label}>Role</label>
        <div className={styles.segment} role="radiogroup" aria-label="Role">
          {(["Staff", "Owner"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={role === r}
              aria-pressed={role === r}
              onClick={() => setRole(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {member.role === "Owner" && (
          <span className={styles.hint}>
            Owners can&rsquo;t be removed. Demote first if you need to remove
            this member.
          </span>
        )}
      </div>
      {member.pending ? (
        <div className={styles.field}>
          <label className={styles.label}>Invite status</label>
          <div className={styles.testRow}>
            <div className={styles.status}>
              <span
                className={`${styles.statusDot} ${styles.statusDotMuted}`}
                aria-hidden="true"
              />
              <span>Invite pending</span>
            </div>
            <span className={styles.when}>not yet accepted</span>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              onClick={onAcceptInvite}
            >
              Mark accepted
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.field}>
          <label className={styles.label}>Last active</label>
          <div className={styles.hint}>{timeAgo(member.last_active_at)}</div>
        </div>
      )}
    </Modal>
  );
}

function CapacityModal({
  rule,
  onClose,
  onSave,
}: {
  rule: CapacityRule | null;
  onClose: () => void;
  onSave: (input: {
    id: string | null;
    treatment: string;
    per_day: number;
    slot_minutes: number;
  }) => Promise<void>;
}) {
  const [treatment, setTreatment] = useState(rule?.treatment ?? "");
  const [perDay, setPerDay] = useState(rule?.per_day ?? 4);
  const [slot, setSlot] = useState(rule?.slot_minutes ?? 30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!treatment.trim()) {
      setError("Treatment name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        id: rule?.id ?? null,
        treatment: treatment.trim(),
        per_day: perDay,
        slot_minutes: slot,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={rule ? `Edit · ${rule.treatment}` : "Add treatment"}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="capacity-form"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="capacity-form" onSubmit={onSubmit} style={{ display: "contents" }}>
        {error && <div className={styles.modalError}>{error}</div>}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cap-name">
            Treatment
          </label>
          <input
            id="cap-name"
            className={styles.input}
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cap-day">
              Bookings / day
            </label>
            <input
              id="cap-day"
              className={styles.input}
              type="number"
              min={1}
              max={50}
              value={perDay}
              onChange={(e) => setPerDay(Number(e.target.value))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="cap-slot">
              Slot length (min)
            </label>
            <input
              id="cap-slot"
              className={styles.input}
              type="number"
              min={5}
              max={240}
              step={5}
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function DialogueModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: { customer_text: string; assistant_text: string }) => Promise<void>;
}) {
  const [customer, setCustomer] = useState("");
  const [assistant, setAssistant] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({ customer_text: customer, assistant_text: assistant });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Add sample dialogue"
      subtitle="Real example of how Mimira should respond. Tone teaches more than rules."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="dialogue-form"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !customer.trim() || !assistant.trim()}
          >
            {busy ? "Saving…" : "Add"}
          </button>
        </>
      }
    >
      <form id="dialogue-form" onSubmit={onSubmit} style={{ display: "contents" }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="dlg-cust">
            Customer message
          </label>
          <textarea
            id="dlg-cust"
            className={styles.textarea}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            required
            autoFocus
            placeholder="สวัสดีค่ะ ทำเลเซอร์รักแร้ราคาเท่าไหร่คะ"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="dlg-assistant">
            Mimira&rsquo;s reply
          </label>
          <textarea
            id="dlg-assistant"
            className={styles.textarea}
            value={assistant}
            onChange={(e) => setAssistant(e.target.value)}
            required
            placeholder="สวัสดีค่ะ! เลเซอร์รักแร้ที่คลินิกเรามี 2 แพ็คเกจค่ะ…"
          />
        </div>
      </form>
    </Modal>
  );
}

function OverrideModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Request embedding override"
      subtitle="Tell us why you need a different embedding model. We'll reach out within 1 business day."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="override-form"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy || !reason.trim()}
          >
            {busy ? "Sending…" : "Send request"}
          </button>
        </>
      }
    >
      <form id="override-form" onSubmit={submit} style={{ display: "contents" }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="override-reason">
            Reason
          </label>
          <textarea
            id="override-reason"
            className={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            autoFocus
            placeholder="We need OpenAI text-embedding-3-large because…"
          />
        </div>
      </form>
    </Modal>
  );
}

function ComparePlansModal({
  current,
  onClose,
  onSelect,
}: {
  current: PlanId;
  onClose: () => void;
  onSelect: (plan: PlanId) => void;
}) {
  return (
    <Modal
      title="Compare plans"
      subtitle="Switching takes effect immediately. We'll prorate the difference on the next invoice."
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={onClose}
        >
          Close
        </button>
      }
    >
      <div className={styles.planGrid}>
        {PLANS.map((p) => {
          const active = p.id === current;
          return (
            <div
              key={p.id}
              className={`${styles.planCard} ${active ? styles.planCardActive : ""}`}
            >
              <div className={styles.planName}>{p.name}</div>
              <div className={styles.planPrice}>
                <span className={styles.planPriceAmount}>{p.price}</span>
                <span className={styles.pricePer}>/ mo</span>
              </div>
              <ul className={styles.planList}>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`${styles.btn} ${active ? styles.btnSecondary : styles.btnPrimary}`}
                onClick={() => onSelect(p.id)}
                disabled={active}
              >
                {active ? "Current plan" : `Switch to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PaymentModal({
  current,
  onClose,
  onSave,
}: {
  current: { card_brand: string; card_last4: string; card_exp: string };
  onClose: () => void;
  onSave: (input: {
    card_brand: string;
    card_last4: string;
    card_exp: string;
  }) => Promise<void>;
}) {
  const [brand, setBrand] = useState(current.card_brand);
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState(current.card_exp);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({
        card_brand: brand || "Card",
        card_last4: number.replace(/\D/g, "").slice(-4),
        card_exp: exp,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Update payment method"
      subtitle="Card details are stored by Stripe — we only keep the last 4 + expiry."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="payment-form"
            className={`${styles.btn} ${styles.btnPrimary}`}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save card"}
          </button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} style={{ display: "contents" }}>
        {error && <div className={styles.modalError}>{error}</div>}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pay-brand">
              Brand
            </label>
            <select
              id="pay-brand"
              className={styles.select}
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              <option>Visa</option>
              <option>Mastercard</option>
              <option>Amex</option>
              <option>JCB</option>
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pay-exp">
              Expiry (MM/YY)
            </label>
            <input
              id="pay-exp"
              className={`${styles.input} ${styles.inputMono}`}
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              placeholder="09/29"
              required
            />
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="pay-num">
            Card number
          </label>
          <input
            id="pay-num"
            className={`${styles.input} ${styles.inputMono}`}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            required
            autoFocus
          />
          <span className={styles.hint}>
            For the demo we only persist the last 4 digits.
          </span>
        </div>
      </form>
    </Modal>
  );
}

function DsarModal({
  payload,
  onClose,
  onDownload,
}: {
  payload: { filename: string; json: string; customers: number };
  onClose: () => void;
  onDownload: () => void;
}) {
  const preview = useMemo(() => {
    if (payload.json.length <= 1200) return payload.json;
    return payload.json.slice(0, 1200) + "\n… (truncated for preview)";
  }, [payload.json]);

  return (
    <Modal
      title="DSAR export ready"
      subtitle={`${payload.customers} customer record${
        payload.customers === 1 ? "" : "s"
      } · ${payload.filename}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={onDownload}
          >
            Download JSON
          </button>
        </>
      }
    >
      <div className={styles.field}>
        <label className={styles.label}>Preview</label>
        <pre
          className={`${styles.input} ${styles.inputMono}`}
          style={{
            maxHeight: "40vh",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {preview}
        </pre>
        <span className={styles.hint}>
          PDPA: deliver this within 30 days of the customer&rsquo;s request.
        </span>
      </div>
    </Modal>
  );
}

// ---------- Helpers ----------

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
