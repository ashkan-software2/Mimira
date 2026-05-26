"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./Inbox.module.css";
import {
  CONVERSATIONS,
  STAFF_NAME,
  type Conversation,
  type ConversationBadge,
  type ThreadItem,
} from "./_data";

type ConvState = {
  aiPaused: boolean;
  composerMode: "ai" | "staff";
  items: ThreadItem[];
};

function initialState(): Record<string, ConvState> {
  const out: Record<string, ConvState> = {};
  for (const c of CONVERSATIONS) {
    out[c.id] = {
      aiPaused: c.aiPaused,
      composerMode: c.aiPaused ? "ai" : "ai",
      items: c.items,
    };
  }
  return out;
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function InboxView() {
  const [state, setState] =
    useState<Record<string, ConvState>>(initialState);
  const [activeId, setActiveId] = useState<string>(CONVERSATIONS[0].id);
  const [query, setQuery] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  const active = useMemo(
    () => CONVERSATIONS.find((c) => c.id === activeId) ?? CONVERSATIONS[0],
    [activeId],
  );
  const activeState = state[active.id];

  const filtered = useMemo(() => {
    if (!query.trim()) return CONVERSATIONS;
    const q = query.toLowerCase();
    return CONVERSATIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q),
    );
  }, [query]);

  // Scroll thread to bottom whenever active conversation or its items change.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, activeState.items.length]);

  function takeOver() {
    setState((s) => ({
      ...s,
      [active.id]: { ...s[active.id], composerMode: "staff", aiPaused: true },
    }));
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function returnToYuna() {
    setState((s) => ({
      ...s,
      [active.id]: { ...s[active.id], composerMode: "ai", aiPaused: false },
    }));
  }

  function sendStaffReply() {
    const text = draft.trim();
    if (!text) return;
    const time = currentTime();
    const newItem: ThreadItem = {
      kind: "message",
      id: `staff-${Date.now()}`,
      sender: "staff",
      author: STAFF_NAME,
      text,
      time,
      deliveryNote: "sending…",
    };
    setState((s) => ({
      ...s,
      [active.id]: {
        ...s[active.id],
        items: [...s[active.id].items, newItem],
      },
    }));
    setDraft("");

    // Fake "delivered" tick after 600ms.
    const targetId = newItem.id;
    const convId = active.id;
    setTimeout(() => {
      setState((s) => {
        const cs = s[convId];
        if (!cs) return s;
        return {
          ...s,
          [convId]: {
            ...cs,
            items: cs.items.map((it) =>
              it.kind === "message" && it.id === targetId
                ? { ...it, deliveryNote: "✓ delivered" }
                : it,
            ),
          },
        };
      });
    }, 600);
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendStaffReply();
    }
  }

  const composerMode = activeState.composerMode;
  const headerBadge = active.badges.find(
    (b) => b.kind === "attention" || b.kind === "staff",
  );

  return (
    <div className={styles.workspace}>
      <LeftRail
        conversations={filtered}
        activeId={activeId}
        onSelect={setActiveId}
        query={query}
        onQuery={setQuery}
        totalCount={CONVERSATIONS.length}
      />

      <section className={styles.col + " " + styles.colThread} aria-label="Active conversation">
        <header className={styles.threadHeader}>
          <div className={styles.threadTitle}>
            <h1>
              {active.name}
              {headerBadge && <Badge badge={headerBadge} />}
            </h1>
            <div className={styles.threadSub}>
              <span>{active.channel}</span>
              <span className={styles.dot}></span>
              <span>{active.language}</span>
            </div>
          </div>
          <div className={styles.threadActions}>
            <button className={`${styles.btn} ${styles.btnGhost}`}>Flag</button>
            {composerMode === "ai" ? (
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={takeOver}
              >
                Take over chat
              </button>
            ) : (
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={returnToYuna}
              >
                Return to Yuna
              </button>
            )}
          </div>
        </header>

        <div className={styles.messages} ref={messagesRef}>
          {activeState.items.map((it) => (
            <ThreadItemView key={it.id} item={it} />
          ))}
        </div>

        <div className={styles.composerWrap}>
          {composerMode === "ai" ? (
            <div className={styles.composerAi}>
              <div className={styles.composerAiLabel}>
                <span className={styles.pulse} aria-hidden="true"></span>
                {activeState.aiPaused
                  ? "Yuna is paused on this thread — escalated to staff."
                  : "Yuna is replying on this thread."}
              </div>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={takeOver}
              >
                Take over chat
              </button>
            </div>
          ) : (
            <div className={styles.composerStaff}>
              <div className={styles.composerInput}>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Type your reply in Thai or English… Enter to send, Shift+Enter for new line"
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={sendStaffReply}
                  disabled={!draft.trim()}
                >
                  Send
                </button>
              </div>
              <div className={styles.composerStaffToolbar}>
                <span>Staff: ครูภา</span>
                <span>·</span>
                <button
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSmall}`}
                >
                  Insert template
                </button>
                <span>·</span>
                <button
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSmall}`}
                  onClick={returnToYuna}
                >
                  Resolve &amp; return to Yuna
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <RightRail conversation={active} />
    </div>
  );
}

function LeftRail({
  conversations,
  activeId,
  onSelect,
  query,
  onQuery,
  totalCount,
}: {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  totalCount: number;
}) {
  return (
    <aside className={styles.col + " " + styles.colList} aria-label="Escalations">
      <div className={styles.listHeader}>
        <h2>Escalations · {totalCount}</h2>
        <button className={styles.filterButton}>All</button>
      </div>
      <div className={styles.search}>
        <label className="visually-hidden" htmlFor="esc-search">
          Search escalations
        </label>
        <input
          id="esc-search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search name or message…"
        />
      </div>

      <div className={styles.escalations} role="list">
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            role="listitem"
            className={styles.escalation}
            aria-current={c.id === activeId ? "true" : undefined}
            onClick={() => onSelect(c.id)}
          >
            <div className={styles.escName}>{c.name}</div>
            <div className={styles.escAge}>{c.ageLabel}</div>
            <div className={styles.escPreview}>{c.preview}</div>
            <div className={styles.escMeta}>
              {c.badges.map((b, i) => (
                <Badge key={i} badge={b} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function RightRail({ conversation }: { conversation: Conversation }) {
  return (
    <aside
      className={styles.col + " " + styles.colContext}
      aria-label="Customer context"
    >
      <div className={styles.context}>
        <section>
          <h3>Customer</h3>
          <dl>
            <dt>Display name</dt>
            <dd>{conversation.name}</dd>
            <dt>LINE ID</dt>
            <dd>
              <span className="mono">{conversation.lineId}</span>
            </dd>
            <dt>Phone</dt>
            <dd>{conversation.phone}</dd>
            <dt>Language</dt>
            <dd>{conversation.language}</dd>
          </dl>
        </section>

        <section>
          <h3>Recent bookings · {conversation.recentBookings.length}</h3>
          {conversation.recentBookings.length === 0 ? (
            <div className={styles.bookingEmpty}>No bookings yet.</div>
          ) : (
            conversation.recentBookings.map((b, i) => (
              <div key={i} className={styles.bookingRow}>
                <span>{b.treatment}</span>
                <span className={styles.when}>{b.when}</span>
              </div>
            ))
          )}
        </section>
      </div>
    </aside>
  );
}

function Badge({ badge }: { badge: ConversationBadge }) {
  const cls =
    badge.kind === "attention"
      ? `${styles.badge} ${styles.badgeAttention}`
      : badge.kind === "staff"
        ? `${styles.badge} ${styles.badgeStaff}`
        : styles.badge;
  return <span className={cls}>{badge.label}</span>;
}

function ThreadItemView({ item }: { item: ThreadItem }) {
  if (item.kind === "day-divider") {
    return (
      <div className={styles.dayDivider}>
        <span>{item.label}</span>
      </div>
    );
  }
  if (item.kind === "system-note") {
    return <div className={styles.systemNote}>{item.text}</div>;
  }
  if (item.kind === "escalation-banner") {
    return (
      <div className={styles.escalationBanner} role="alert">
        <span className={styles.escalationBannerIcon} aria-hidden="true"></span>
        <div className={styles.escalationBannerText}>
          <strong>{item.title}</strong>{" "}
          <span className="reason">{item.reason}</span>
        </div>
      </div>
    );
  }

  const side = item.sender === "staff" ? "right" : "left";
  const bubbleClass =
    item.sender === "customer"
      ? styles.bubbleCustomer
      : item.sender === "yuna"
        ? styles.bubbleYuna
        : styles.bubbleStaff;

  return (
    <div
      className={`${styles.msgRow} ${
        side === "right" ? styles.msgRowRight : styles.msgRowLeft
      }`}
    >
      <div className={styles.msgMetaTop}>
        <span className={styles.msgAuthor}>{item.author}</span>
        {item.sender === "yuna" && (
          <span className={`${styles.badge} ${styles.badgeYuna}`}>Yuna</span>
        )}
      </div>
      <div className={`${styles.bubble} ${bubbleClass}`}>{item.text}</div>
      <div className={styles.msgMetaBottom}>
        <time>{item.time}</time>
        {item.sources && (
          <span className={styles.sources}>
            ▾ {item.sources.count} sources · {item.sources.label}
          </span>
        )}
        {item.deliveryNote && <span>{item.deliveryNote}</span>}
      </div>
    </div>
  );
}
