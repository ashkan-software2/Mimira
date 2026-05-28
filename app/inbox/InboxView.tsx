"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./Inbox.module.css";
import {
  PRESET_FLAGS,
  type ConversationListItem,
  type PresetFlag,
  type ThreadMessage,
  type ThreadResponse,
} from "./types";

const FLAG_BADGE_CLASS: Record<PresetFlag, string> = {
  "Needs review": styles.badgeAttention,
  "Doctor advice": styles.badgeDoctor,
  Appointment: styles.badgeAppointment,
  Addressed: styles.badgeAddressed,
};

const LIST_POLL_MS = 5000;
const THREAD_POLL_MS = 4000;

function ageLabel(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

function timeOnly(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const datePart = sameDay
    ? "Today"
    : d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  return `${datePart} · ${timeOnly(ts)} ICT`;
}

function displayName(c: ConversationListItem): string {
  return c.displayName?.trim() || `LINE ${c.lineUserId.slice(0, 6)}…`;
}

export function InboxView({
  initialConversations,
}: {
  initialConversations: ConversationListItem[];
}) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    initialConversations
  );
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [query, setQuery] = useState("");
  const [thread, setThread] = useState<ThreadResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        displayName(c).toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q) ||
        c.lineUserId.toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/inbox/list", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: ConversationListItem[] };
      setConversations(data.conversations);
      setActiveId((cur) => {
        if (cur && data.conversations.some((c) => c.id === cur)) return cur;
        return data.conversations[0]?.id ?? null;
      });
    } catch {
      // network blip; next tick will retry
    }
  }, []);

  const refreshThread = useCallback(async (customerId: string) => {
    try {
      const res = await fetch(
        `/api/inbox/thread?customerId=${encodeURIComponent(customerId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = (await res.json()) as ThreadResponse;
      setThread((prev) => {
        if (prev && prev.customer.id !== customerId) return prev;
        return data;
      });
    } catch {
      // ignore
    }
  }, []);

  // Poll conversation list.
  useEffect(() => {
    const id = setInterval(refreshList, LIST_POLL_MS);
    return () => clearInterval(id);
  }, [refreshList]);

  // When active conversation changes, fetch its thread + start polling.
  useEffect(() => {
    if (!activeId) {
      setThread(null);
      return;
    }
    setThread(null);
    refreshThread(activeId);
    const id = setInterval(() => refreshThread(activeId), THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [activeId, refreshThread]);

  // Scroll thread to bottom whenever items change.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length, activeId]);

  const aiPaused = thread?.customer.aiPaused ?? active?.aiPaused ?? false;
  const composerMode: "ai" | "staff" = aiPaused ? "staff" : "ai";

  const activeFlags = useMemo<string[]>(
    () => thread?.customer.flags ?? active?.flags ?? [],
    [thread, active]
  );

  useEffect(() => {
    if (!attachedImage) {
      setAttachedPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachedImage);
    setAttachedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [attachedImage]);

  async function toggleFlag(flag: PresetFlag, on: boolean) {
    if (!active) return;
    const target = active.id;
    const now = Date.now();

    // Optimistic update for the open thread's flag set and (when Addressed
    // is checked) the per-message attention badges. The server is the
    // source of truth — refreshThread/refreshList reconcile after.
    setThread((t) => {
      if (!t || t.customer.id !== target) return t;
      const nextFlags = on
        ? Array.from(new Set([...t.customer.flags, flag]))
        : t.customer.flags.filter((f) => f !== flag);
      const messages =
        flag === "Addressed" && on
          ? t.messages.map((m) =>
              m.needsAttention
                ? { ...m, needsAttention: false, attentionResolvedAt: now }
                : m
            )
          : t.messages;
      return {
        ...t,
        customer: { ...t.customer, flags: nextFlags },
        messages,
      };
    });
    setConversations((cs) =>
      cs.map((c) => {
        if (c.id !== target) return c;
        const nextFlags = on
          ? Array.from(new Set([...c.flags, flag]))
          : c.flags.filter((f) => f !== flag);
        return {
          ...c,
          flags: nextFlags,
          needsAttention:
            flag === "Addressed" && on ? false : c.needsAttention,
        };
      })
    );

    try {
      await fetch("/api/inbox/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: target, flag, on }),
      });
    } finally {
      refreshThread(target);
      refreshList();
    }
  }

  async function setPaused(paused: boolean) {
    if (!active) return;
    const target = active.id;
    // optimistic
    setConversations((cs) =>
      cs.map((c) => (c.id === target ? { ...c, aiPaused: paused } : c))
    );
    setThread((t) =>
      t && t.customer.id === target
        ? { ...t, customer: { ...t.customer, aiPaused: paused } }
        : t
    );
    try {
      await fetch("/api/inbox/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: target, paused }),
      });
    } finally {
      refreshThread(target);
      refreshList();
    }
    if (paused) setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function sendStaffReply() {
    const text = draft.trim();
    if ((!text && !attachedImage) || !active || sending) return;
    setSending(true);
    setSendError(null);
    try {
      let mediaPayload: {
        media: NonNullable<ThreadMessage["media"]>;
        publicUrl: string | null;
      } | null = null;
      if (attachedImage) {
        const form = new FormData();
        form.set("file", attachedImage);
        const upload = await fetch("/api/inbox/upload", {
          method: "POST",
          body: form,
        });
        if (!upload.ok) {
          const body = await upload.text();
          setSendError(body || `Upload HTTP ${upload.status}`);
          return;
        }
        const body = (await upload.json()) as {
          media: NonNullable<ThreadMessage["media"]>;
          publicUrl: string | null;
        };
        mediaPayload = body;
      }

      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: active.id,
          text,
          media: mediaPayload?.media,
          mediaPublicUrl: mediaPayload?.publicUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        setSendError(body || `HTTP ${res.status}`);
        return;
      }
      setDraft("");
      setAttachedImage(null);
      refreshThread(active.id);
      refreshList();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendStaffReply();
    }
  }

  return (
    <div className={styles.workspace}>
      <LeftRail
        conversations={filtered}
        activeId={activeId}
        onSelect={setActiveId}
        query={query}
        onQuery={setQuery}
        totalCount={conversations.length}
      />

      <section
        className={styles.col + " " + styles.colThread}
        aria-label="Active conversation"
      >
        {active ? (
          <>
            <header className={styles.threadHeader}>
              <div className={styles.threadTitle}>
                <h1>
                  {displayName(active)}
                  {active.aiPaused && (
                    <span className={`${styles.badge} ${styles.badgeStaff}`}>
                      Paused
                    </span>
                  )}
                </h1>
                <div className={styles.threadSub}>
                  <span>LINE</span>
                  <span className={styles.dot}></span>
                  <span className="mono">{active.lineUserId.slice(0, 8)}…</span>
                  {activeFlags.length > 0 && (
                    <>
                      <span className={styles.dot}></span>
                      <span className={styles.threadFlags}>
                        {activeFlags.map((f) => (
                          <FlagPill key={f} flag={f} />
                        ))}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.threadActions}>
                <ActionsMenu flags={activeFlags} onToggle={toggleFlag} />
                {composerMode === "ai" ? (
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setPaused(true)}
                  >
                    Take over chat
                  </button>
                ) : (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => setPaused(false)}
                  >
                    Return to Mimira
                  </button>
                )}
              </div>
            </header>

            <div className={styles.messages} ref={messagesRef}>
              {thread === null ? (
                <div className={styles.systemNote}>Loading…</div>
              ) : thread.messages.length === 0 ? (
                <div className={styles.systemNote}>
                  No messages yet for this customer.
                </div>
              ) : (
                <MessagesList messages={thread.messages} />
              )}
            </div>

            <div className={styles.composerWrap}>
              {composerMode === "ai" ? (
                <div className={styles.composerAi}>
                  <div className={styles.composerAiLabel}>
                    <span className={styles.pulse} aria-hidden="true"></span>
                    Mimira is replying on this thread.
                  </div>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setPaused(true)}
                  >
                    Take over chat
                  </button>
                </div>
              ) : (
                <div className={styles.composerStaff}>
                  <div className={styles.composerInput}>
                    <label className={`${styles.btn} ${styles.btnSecondary}`}>
                      Image
                      <input
                        className={styles.fileInput}
                        type="file"
                        accept="image/*"
                        disabled={sending}
                        onChange={(e) => {
                          setAttachedImage(e.target.files?.[0] ?? null);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={onComposerKeyDown}
                      placeholder="Type your reply in Thai or English… Enter to send, Shift+Enter for new line"
                      disabled={sending}
                    />
                    <button
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={sendStaffReply}
                      disabled={(!draft.trim() && !attachedImage) || sending}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                  {attachedPreviewUrl && attachedImage && (
                    <div className={styles.attachmentPreview}>
                      <img src={attachedPreviewUrl} alt="" />
                      <div>
                        <span>{attachedImage.name}</span>
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSmall}`}
                          type="button"
                          onClick={() => setAttachedImage(null)}
                          disabled={sending}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={styles.composerStaffToolbar}>
                    <span>Mimira is paused for this thread.</span>
                    <span>·</span>
                    <button
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSmall}`}
                      onClick={() => setPaused(false)}
                    >
                      Resolve &amp; return to Mimira
                    </button>
                    {sendError && (
                      <>
                        <span>·</span>
                        <span style={{ color: "var(--danger, #c33)" }}>
                          {sendError}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <EmptyState />
        )}
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
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  query: string;
  onQuery: (q: string) => void;
  totalCount: number;
}) {
  return (
    <aside className={styles.col + " " + styles.colList} aria-label="Conversations">
      <div className={styles.listHeader}>
        <h2>Conversations · {totalCount}</h2>
        <button className={styles.filterButton}>All</button>
      </div>
      <div className={styles.search}>
        <label className="visually-hidden" htmlFor="esc-search">
          Search conversations
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
        {conversations.length === 0 ? (
          <div className={styles.systemNote} style={{ padding: "1rem" }}>
            No conversations yet. Message the connected LINE Official Account
            to start a thread.
          </div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              role="listitem"
              className={styles.escalation}
              aria-current={c.id === activeId ? "true" : undefined}
              onClick={() => onSelect(c.id)}
            >
              <div className={styles.escName}>{displayName(c)}</div>
              <div className={styles.escAge}>{ageLabel(c.lastMessageAt)}</div>
              <div className={styles.escPreview}>
                {c.preview || "(no messages)"}
              </div>
              <div className={styles.escMeta}>
                {c.flags.map((f) => (
                  <FlagPill key={f} flag={f} />
                ))}
                {c.aiPaused && (
                  <span className={`${styles.badge} ${styles.badgeStaff}`}>
                    Paused
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function RightRail({
  conversation,
}: {
  conversation: ConversationListItem | null;
}) {
  return (
    <aside
      className={styles.col + " " + styles.colContext}
      aria-label="Customer context"
    >
      <div className={styles.context}>
        <section>
          <h3>Customer</h3>
          {conversation ? (
            <dl>
              <dt>Display name</dt>
              <dd>{displayName(conversation)}</dd>
              <dt>LINE user ID</dt>
              <dd>
                <span className="mono">{conversation.lineUserId}</span>
              </dd>
              <dt>Mimira</dt>
              <dd>{conversation.aiPaused ? "paused" : "active"}</dd>
            </dl>
          ) : (
            <div className={styles.bookingEmpty}>Select a conversation.</div>
          )}
        </section>
      </div>
    </aside>
  );
}

function MessagesList({ messages }: { messages: ThreadMessage[] }) {
  const items: React.ReactNode[] = [];
  let lastDay = "";
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== lastDay) {
      items.push(
        <div key={`day-${m.id}`} className={styles.dayDivider}>
          <span>{dayLabel(m.createdAt)}</span>
        </div>
      );
      lastDay = dayKey;
    }
    items.push(<MessageBubble key={m.id} message={m} />);
  }
  return <>{items}</>;
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  // Customer on the left; both Mimira and staff (the clinic's "side") on the right.
  const side = message.sentBy === "customer" ? "left" : "right";
  const bubbleClass =
    message.sentBy === "customer"
      ? styles.bubbleCustomer
      : message.sentBy === "ai"
        ? styles.bubbleYuna
        : styles.bubbleStaff;

  const author =
    message.sentBy === "customer"
      ? "Customer"
      : message.sentBy === "ai"
        ? "Mimira"
        : "You";

  return (
    <div
      className={`${styles.msgRow} ${
        side === "right" ? styles.msgRowRight : styles.msgRowLeft
      }`}
    >
      <div className={styles.msgMetaTop}>
        <span className={styles.msgAuthor}>{author}</span>
        {message.sentBy === "ai" && (
          <span className={`${styles.badge} ${styles.badgeYuna}`}>Mimira</span>
        )}
        {message.needsAttention ? (
          <span className={`${styles.badge} ${styles.badgeAttention}`}>
            Needs attention
          </span>
        ) : message.attentionResolvedAt !== null ? (
          <span
            className={`${styles.badge} ${styles.badgeAddressed}`}
            title={`Marked addressed at ${timeOnly(
              message.attentionResolvedAt
            )}`}
          >
            Addressed
          </span>
        ) : null}
      </div>
      <div
        className={`${styles.bubble} ${bubbleClass} ${
          message.media ? styles.bubbleWithMedia : ""
        }`}
      >
        {message.media && <MessageMedia media={message.media} />}
        {(!message.media || !isMediaPlaceholder(message.text)) && (
          <div>{message.text}</div>
        )}
      </div>
      <div className={styles.msgMetaBottom}>
        <time>{timeOnly(message.createdAt)}</time>
      </div>
    </div>
  );
}

function isMediaPlaceholder(text: string): boolean {
  return text === "[image]" || text === "[video]";
}

function MessageMedia({ media }: { media: NonNullable<ThreadMessage["media"]> }) {
  if (media.kind === "image") {
    return (
      <a href={media.url} target="_blank" rel="noreferrer">
        <img className={styles.messageMedia} src={media.url} alt="Chat upload" />
      </a>
    );
  }
  return (
    <video
      className={styles.messageMedia}
      src={media.url}
      controls
      preload="metadata"
    />
  );
}

function FlagPill({ flag }: { flag: string }) {
  // PresetFlag → known palette; anything else falls back to neutral.
  const variant =
    flag in FLAG_BADGE_CLASS
      ? FLAG_BADGE_CLASS[flag as PresetFlag]
      : "";
  return (
    <span className={`${styles.badge} ${variant}`}>{flag}</span>
  );
}

function ActionsMenu({
  flags,
  onToggle,
}: {
  flags: string[];
  onToggle: (flag: PresetFlag, on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className={styles.actionsWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.btn} ${styles.btnSecondary}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Actions <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className={styles.actionsPopover} role="menu">
          <div className={styles.actionsHeader}>Flag this thread</div>
          {PRESET_FLAGS.map((f) => {
            const on = flags.includes(f);
            return (
              <label key={f} className={styles.actionItem}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(f, !on)}
                />
                <span className={`${styles.actionDot} ${FLAG_BADGE_CLASS[f]}`} />
                <span>{f}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "var(--fg-muted)",
        fontSize: 14,
      }}
    >
      No conversation selected. Send a message to your LINE OA to see it appear here.
    </div>
  );
}
