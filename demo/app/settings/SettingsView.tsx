"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import styles from "./settings.module.css";
import { saveBrandVoice } from "./actions";

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
  { id: "line", label: "Line OA", tag: "dot" },
  { id: "ai-brain", label: "AI brain", tag: "ai" },
  { id: "kill-switch", label: "Kill switch", tag: "ai" },
  { id: "brand-voice", label: "Brand voice" },
  { id: "capacity", label: "Capacity rules" },
  { id: "aftercare", label: "Aftercare" },
  { id: "privacy", label: "Privacy & retention" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Billing" },
];

const TOAST_MS = 2400;

const DIALOGUES: { customer: string; yuna: string }[] = [
  {
    customer: "สวัสดีค่ะ ทำเลเซอร์รักแร้ราคาเท่าไหร่คะ",
    yuna: "สวัสดีค่ะ! เลเซอร์รักแร้ที่คลินิกเรามี 2 แพ็คเกจค่ะ แบบ 6 ครั้ง ราคา 8,900 บาท เฉลี่ยครั้งละไม่ถึง 1,500 ทำต่อเนื่องผลดีกว่าค่ะ จองคิวเลยมั้ยคะ?",
  },
  {
    customer: "ทำแล้วเจ็บมั้ย กลัวเข็มมาก",
    yuna: "ไม่ต้องกลัวเลยค่ะ เลเซอร์ไม่ใช้เข็มเลย เป็นแสงสั้นๆ พักผิวสักพัก ลูกค้าบอกรู้สึกเหมือนยางรัดเบาๆ เรามีเครื่องเป่าเย็นช่วยด้วยค่ะ",
  },
  {
    customer: "หลังทำควรดูแลตัวเองยังไงคะ",
    yuna: "หลังทำ 24 ชม. หลีกเลี่ยงน้ำร้อนกับการขัดถูแรงๆ นะคะ ทาครีมกันแดดทุกครั้งที่ออกแดด เดี๋ยวจะส่งไกด์ดูแลผิวฉบับเต็มให้นะคะ",
  },
];

const CAPACITY_ROWS = [
  { name: "Underarm laser", perDay: 8, slot: "30 min" },
  { name: "Picosure facial", perDay: 4, slot: "60 min" },
  { name: "HIFU", perDay: 3, slot: "90 min" },
  { name: "Consultation", perDay: 3, slot: "20 min" },
];

const TEAM_ROWS = [
  {
    name: "Dr. Anchalee P.",
    email: "anchalee@sukhumvit-skin.com",
    role: "Owner",
    last: "2h ago",
    pending: false,
  },
  {
    name: "Pim (you)",
    email: "pim@sukhumvit-skin.com",
    role: "Staff",
    last: "now",
    pending: false,
  },
  {
    name: "Nok",
    email: "nok@sukhumvit-skin.com",
    role: "Staff",
    last: "14h ago",
    pending: false,
  },
  {
    name: "Tip",
    email: "tip@sukhumvit-skin.com",
    role: "Staff",
    last: "3 days ago",
    pending: false,
  },
  {
    name: "Phak",
    email: "phak@sukhumvit-skin.com · invite pending",
    role: "Staff",
    last: "—",
    pending: true,
  },
];

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

type CardProps = {
  id: SectionId;
  title: ReactNode;
  summary: string;
  saved: string;
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

type Props = {
  initialBrandVoice: string;
};

export function SettingsView({ initialBrandVoice }: Props) {
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

  // Brand voice — the one section that actually persists.
  const [brandVoice, setBrandVoice] = useState(initialBrandVoice);
  const [savedBrandVoice, setSavedBrandVoice] = useState(initialBrandVoice);
  const brandDirty = brandVoice !== savedBrandVoice;
  const [isSaving, startSaveTransition] = useTransition();

  // AI brain — decorative state.
  const [provider, setProvider] = useState<"OpenAI" | "Anthropic" | "Google">(
    "Anthropic"
  );
  const [temp, setTemp] = useState(0.4);

  // Kill switch — decorative state.
  const [aiActive, setAiActive] = useState(true);

  // Aftercare — decorative toggles.
  const [aftercare, setAftercare] = useState({ d1: true, d7: true, d30: false });

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

  function notImplemented(label: string) {
    showToast(`${label} · not wired in the demo`);
  }

  // Refs to cards for nav scroll-spy and scroll-to.
  const cardRefs = useRef<Map<SectionId, HTMLElement>>(new Map());
  const registerRef = (id: SectionId, el: HTMLElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  };

  // Find the scroll container (Shell wraps us in <main overflow:auto>).
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
    // Wait one frame so a just-opened card has its full height before we scroll.
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

  // Scroll-spy — observe which card sits closest to the top of the viewport.
  // Listener attaches to the scroll container, not window, because scroll
  // events don't bubble and the Shell scrolls <main>, not the document.
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
        if (rect.top < viewportBottom && rect.bottom > refTop && distance < bestDistance) {
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

  function handleSaveBrandVoice() {
    const next = brandVoice;
    startSaveTransition(async () => {
      await saveBrandVoice(next);
      setSavedBrandVoice(next);
      showToast("Saved · brand voice");
    });
  }

  const voiceSummary = useMemo(() => {
    const first = savedBrandVoice
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return first
      ? `${first}${savedBrandVoice.length > 60 ? "…" : ""} · ${DIALOGUES.length} sample dialogues`
      : `${DIALOGUES.length} sample dialogues`;
  }, [savedBrandVoice]);

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
                      Yuna
                    </span>
                  )}
                  {item.tag === "dot" && (
                    <span
                      className={styles.navTagDot}
                      aria-label="action needed"
                      title="Test signature pending"
                    />
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
            summary="Sukhumvit Skin & Laser · Bangkok · 10:00–20:00 · TH, EN"
            saved="Saved 3 days ago"
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
                  defaultValue="Sukhumvit Skin & Laser"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-tz">
                  Timezone
                </label>
                <select className={styles.select} id="clinic-tz" defaultValue="Asia/Bangkok">
                  <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
                  <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
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
                defaultValue="492/2 Sukhumvit Rd, Khlong Toei, Bangkok 10110"
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
                  defaultValue="Mon–Sat · 10:00–20:00"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="clinic-langs">
                  Languages spoken
                </label>
                <input
                  className={styles.input}
                  id="clinic-langs"
                  defaultValue="Thai, English"
                />
              </div>
            </div>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>Last saved 3 days ago by Pim</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Cancel")}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Clinic profile")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* LINE OA */}
          <Card
            id="line"
            title="Line OA"
            summary="@sukhumvit-skin · channel Cf12…8a · last test 14:02 ✓"
            saved="Saved 2 weeks ago"
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
                  defaultValue="Cf12a93e8b8a"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="line-oa">
                  OA display name
                </label>
                <input
                  className={styles.input}
                  id="line-oa"
                  defaultValue="@sukhumvit-skin"
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
                  defaultValue="••••••••••••••3f9c"
                  readOnly
                />
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => notImplemented("Rotate secret")}
                >
                  Rotate
                </button>
              </div>
              <span className={styles.hint}>
                Stored in Supabase Vault. Last rotated 14 days ago.
              </span>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="line-webhook">
                Webhook URL <span className={styles.req}>· read-only</span>
              </label>
              <input
                className={`${styles.input} ${styles.inputMono}`}
                id="line-webhook"
                defaultValue="https://api.yuna.app/v1/line/webhook/cf12a93e8b8a"
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
                  <span>Last ping received</span>
                </div>
                <span className={styles.when}>Today · 14:02 ICT</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => notImplemented("Test signature")}
                >
                  Test signature
                </button>
              </div>
              <span className={styles.hint}>
                Sends a signed test event from Yuna. Your webhook should respond
                within 1s.
              </span>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>Last saved 2 weeks ago by Owner</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Cancel")}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Line OA")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* AI BRAIN */}
          <Card
            id="ai-brain"
            title={
              <>
                AI brain <span className={`${styles.badge} ${styles.badgeYuna}`}>Yuna</span>
              </>
            }
            summary={`Anthropic · claude-sonnet-4-6 · Cohere v3 · temp ${temp.toFixed(2)}`}
            saved="Saved 4h ago"
            open={open["ai-brain"]}
            onToggle={() => toggle("ai-brain")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Which model writes Yuna&rsquo;s replies. Changes apply to new
              conversations — active threads finish on the current provider. In
              the demo build, the model is hardcoded to Claude.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Provider</label>
              <div className={styles.segment} role="radiogroup" aria-label="LLM provider">
                {(["OpenAI", "Anthropic", "Google"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-pressed={provider === p}
                    aria-checked={provider === p}
                    onClick={() => setProvider(p)}
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
                <select className={styles.select} id="ai-model" defaultValue="claude-sonnet-4-6">
                  <option value="claude-sonnet-4-6">claude-sonnet-4-6 (recommended)</option>
                  <option value="claude-haiku-4-5">claude-haiku-4-5</option>
                  <option value="claude-opus-4-7">claude-opus-4-7</option>
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
                    value={temp}
                    onChange={(e) => setTemp(parseFloat(e.target.value))}
                    className={styles.slider}
                  />
                  <span className={styles.sliderValue}>{temp.toFixed(2)}</span>
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
                    onClick={() => notImplemented("Override request")}
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
                Last saved 4h ago by Owner ·{" "}
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => notImplemented("Audit log")}
                >
                  View audit log
                </button>
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Cancel")}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("AI brain")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* KILL SWITCH */}
          <Card
            id="kill-switch"
            title={
              <>
                Kill switch <span className={`${styles.badge} ${styles.badgeYuna}`}>Yuna</span>
              </>
            }
            summary={
              aiActive
                ? "Yuna AI is active · no state change in 2 weeks"
                : "Yuna AI is paused · routing to staff"
            }
            saved="Owner-only"
            open={open["kill-switch"]}
            onToggle={() => toggle("kill-switch")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              One toggle to pause Yuna for this clinic. Inbound messages route
              straight to the staff inbox until you turn her back on. Use this
              for off-hours, trainings, or if a customer flags Yuna&rsquo;s
              reply as wrong.
            </p>

            <div className={styles.killSwitch}>
              <div className={styles.labelBlock}>
                <span className={styles.label}>
                  Yuna AI is{" "}
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
                    ? "All inbound messages currently flow through Yuna with staff escalation as needed."
                    : "All inbound messages are routing directly to the staff inbox."}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiActive}
                aria-label="Pause Yuna for this clinic"
                className={`${styles.switch} ${
                  aiActive ? "" : styles.switchOff
                } ${!aiActive ? styles.switchPaused : ""}`}
                onClick={() => {
                  setAiActive((v) => !v);
                  showToast(
                    aiActive ? "Yuna paused for this clinic" : "Yuna activated"
                  );
                }}
              />
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                No state change in the last 2 weeks ·{" "}
                <button
                  type="button"
                  className={styles.btnLink}
                  onClick={() => notImplemented("Audit log")}
                >
                  View audit log
                </button>
              </span>
            </div>
          </Card>

          {/* BRAND VOICE — the persisted one */}
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
              Tell Yuna how she should sound. This free-form prompt feeds the
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
                <span className={styles.req}>· {DIALOGUES.length} of 5</span>
              </label>
              <div className={styles.dialogueList}>
                {DIALOGUES.map((d, i) => (
                  <div key={i} className={styles.dialogue}>
                    <div className={styles.turn}>
                      <span className={styles.who}>Customer</span>
                      <div className={styles.turnText}>{d.customer}</div>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label="Remove"
                        onClick={() => notImplemented("Remove sample")}
                      >
                        ×
                      </button>
                    </div>
                    <div className={styles.turn}>
                      <span className={`${styles.who} ${styles.whoYuna}`}>Yuna</span>
                      <div className={styles.turnText}>
                        <span className={`${styles.badge} ${styles.badgeYuna}`}>
                          Yuna
                        </span>
                        {d.yuna}
                      </div>
                      <button
                        type="button"
                        className={styles.remove}
                        aria-label="Remove"
                        onClick={() => notImplemented("Remove sample")}
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
                onClick={() => notImplemented("Add sample dialogue")}
              >
                + Add sample dialogue
              </button>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                {brandDirty
                  ? "Unsaved changes"
                  : "Last saved just now · the brand voice is the only setting that persists in the demo"}
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setBrandVoice(savedBrandVoice)}
                disabled={!brandDirty || isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSaveBrandVoice}
                disabled={!brandDirty || isSaving}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </Card>

          {/* CAPACITY */}
          <Card
            id="capacity"
            title="Capacity rules"
            summary="4 treatments · 18 bookings/day max"
            saved="Saved 5 days ago"
            open={open.capacity}
            onToggle={() => toggle("capacity")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Informational only in v0. Yuna mentions these when customers ask
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
                {CAPACITY_ROWS.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className={styles.tableNum}>{row.perDay}</td>
                    <td className={styles.tableNum}>{row.slot}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                        onClick={() => notImplemented(`Edit ${row.name}`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>Last saved 5 days ago by Pim</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Add treatment")}
              >
                + Add treatment
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Capacity rules")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* AFTERCARE */}
          <Card
            id="aftercare"
            title="Aftercare schedule"
            summary="D1 · 10:00 ICT · D7 · 10:00 ICT · Thai + English"
            saved="Saved 6 days ago"
            open={open.aftercare}
            onToggle={() => toggle("aftercare")}
            registerRef={registerRef}
          >
            <p className={styles.help}>
              Day-1 and Day-7 followup messages send automatically after a
              treatment. Each reply passes a safety classifier before sending.
              <br />
              <em>Not wired in the demo build.</em>
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
                    className={`${styles.switch} ${checked ? "" : styles.switchOff}`}
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
                  defaultValue="10:00"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ac-langs">
                  Template languages
                </label>
                <select className={styles.select} id="ac-langs" defaultValue="th+en">
                  <option value="th+en">Thai + English</option>
                  <option value="th">Thai only</option>
                  <option value="en">English only</option>
                </select>
              </div>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>Last saved 6 days ago by Owner</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Edit templates")}
              >
                Edit templates
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Aftercare")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* PRIVACY */}
          <Card
            id="privacy"
            title="Privacy & retention"
            summary="24-month retention · 3 sub-processors · DSAR enabled"
            saved="Saved 30 days ago"
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
                <select className={styles.select} id="ret-conv" defaultValue="24">
                  <option value="24">24 months (default)</option>
                  <option value="12">12 months</option>
                  <option value="6">6 months</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="ret-audit">
                  Audit log retention
                </label>
                <select className={styles.select} id="ret-audit" defaultValue="36">
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
                  Anthropic <code>claude-sonnet-4-6</code> generates replies.
                  Cohere <code>embed-multilingual-v3</code> embeds Knowledge for
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
                  onClick={() => notImplemented("Export customer data")}
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
              <span className={styles.saveMeta}>Last saved 30 days ago by Owner</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Cancel")}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Privacy & retention")}
              >
                Save changes
              </button>
            </div>
          </Card>

          {/* TEAM */}
          <Card
            id="team"
            title="Team"
            summary="5 members · 1 owner · 4 staff"
            saved="Saved 2 days ago"
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
                {TEAM_ROWS.map((row) => (
                  <tr key={row.email}>
                    <td>
                      {row.name}
                      <div className={styles.hint}>{row.email}</div>
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
                    <td className={styles.tableNum}>{row.last}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                        onClick={() =>
                          notImplemented(
                            row.pending ? "Resend invite" : `Manage ${row.name}`
                          )
                        }
                      >
                        {row.pending ? "Resend invite" : "Manage"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>Last saved 2 days ago by Owner</span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => notImplemented("Invite member")}
              >
                + Invite member
              </button>
            </div>
          </Card>

          {/* BILLING */}
          <Card
            id="billing"
            title="Billing"
            summary="Starter · 4,247 / 10,000 msgs · renews in 8 days"
            saved="Auto-renew on"
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
                  <span className={styles.priceAmount}>฿2,490</span>
                  <span className={styles.pricePer}>/ month</span>
                </div>
                <div className={styles.hint} style={{ marginTop: 6 }}>
                  Starter · up to 10,000 outbound messages
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                    onClick={() => notImplemented("Compare plans")}
                  >
                    Compare plans
                  </button>
                </div>
              </div>
              <div>
                <div className={styles.hint} style={{ marginBottom: 4 }}>
                  Message volume · May
                </div>
                <div className={styles.meter}>
                  <div
                    className={styles.meterFill}
                    style={{ width: "42%" }}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className={styles.hint}
                  style={{ marginTop: 6, fontVariantNumeric: "tabular-nums" }}
                >
                  4,247 / 10,000 outbound · resets in 8 days
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
                  <span>Visa ending in 4242</span>
                </div>
                <span className={styles.when}>Expires 09/29</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                  onClick={() => notImplemented("Update payment")}
                >
                  Update
                </button>
              </div>
            </div>

            <div className={styles.cardActions}>
              <span className={styles.saveMeta}>
                Next invoice: ฿2,490 on 2 Jun 2026
              </span>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => notImplemented("Download invoices")}
              >
                Download invoices
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => notImplemented("Manage plan")}
              >
                Manage plan
              </button>
            </div>
          </Card>
        </div>
      </section>

      <div
        className={
          toastVisible ? `${styles.toast} ${styles.toastVisible}` : styles.toast
        }
        role="status"
        aria-live="polite"
      >
        <span className={styles.toastCheck} aria-hidden="true">
          ✓
        </span>
        <span>{toast}</span>
      </div>
    </div>
  );
}
