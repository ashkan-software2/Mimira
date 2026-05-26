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
import type { ConversationListItem, ThreadMessage, ThreadResponse } from "./types";

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
    if (!text || !active || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: active.id, text }),
      });
      if (!res.ok) {
        const body = await res.text();
        setSendError(body || `HTTP ${res.status}`);
        return;
      }
      setDraft("");
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
                </div>
              </div>
              <div className={styles.threadActions}>
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
                    Return to Yuna
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
                    Yuna is replying on this thread.
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
                      disabled={!draft.trim() || sending}
                    >
                      {sending ? "Sending…" : "Send"}
                    </button>
                  </div>
                  <div className={styles.composerStaffToolbar}>
                    <span>Yuna is paused for this thread.</span>
                    <span>·</span>
                    <button
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnGhostSmall}`}
                      onClick={() => setPaused(false)}
                    >
                      Resolve &amp; return to Yuna
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
              <dt>Yuna</dt>
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
  const side = message.sentBy === "staff" ? "right" : "left";
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
        ? "Yuna"
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
          <span className={`${styles.badge} ${styles.badgeYuna}`}>Yuna</span>
        )}
      </div>
      <div className={`${styles.bubble} ${bubbleClass}`}>{message.text}</div>
      <div className={styles.msgMetaBottom}>
        <time>{timeOnly(message.createdAt)}</time>
      </div>
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
