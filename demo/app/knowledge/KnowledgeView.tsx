"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import styles from "./knowledge.module.css";
import { createKnowledgeDoc } from "./actions";

export type KnowledgeDocDto = {
  id: string;
  title: string;
  category: "Treatments" | "Aftercare & safety";
  chunkCount: number;
  body: string;
  lastEditedAt: number;
};

type Props = {
  docs: KnowledgeDocDto[];
};

type ToastKind = "success" | "ai" | "danger";
type Toast = {
  id: number;
  kind: ToastKind;
  text: string;
  meta?: string;
  leaving?: boolean;
};

const TOAST_VISIBLE_MS = 2400;
const TOAST_LEAVE_MS = 280;

function CaretIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`${styles.caret} ${collapsed ? styles.caretCollapsed : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function formatRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "just now";
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function KnowledgeView({ docs: initialDocs }: Props) {
  const [docs, setDocs] = useState<KnowledgeDocDto[]>(initialDocs);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocs[0]?.id ?? null
  );

  // Local edits — keep title + body in component state per-doc, keyed by id.
  // Save is a no-op toast in the demo: the edits survive in-tab but not reload.
  const [drafts, setDrafts] = useState<
    Record<string, { title: string; body: string }>
  >(() => {
    const out: Record<string, { title: string; body: string }> = {};
    for (const d of initialDocs) out[d.id] = { title: d.title, body: d.body };
    return out;
  });
  const [saved, setSaved] = useState<Record<string, { title: string; body: string }>>(
    () => {
      const out: Record<string, { title: string; body: string }> = {};
      for (const d of initialDocs) out[d.id] = { title: d.title, body: d.body };
      return out;
    }
  );

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Treatments: true,
    "Aftercare & safety": true,
  });

  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] =
    useState<KnowledgeDocDto["category"]>("Treatments");
  const [newBody, setNewBody] = useState("");
  const [creating, startCreate] = useTransition();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(1);

  function pushToast(t: Omit<Toast, "id">) {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, ...t }]);
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((x) => (x.id === id ? { ...x, leaving: true } : x))
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, TOAST_LEAVE_MS);
    }, TOAST_VISIBLE_MS);
  }

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups: Record<string, KnowledgeDocDto[]> = {
      Treatments: [],
      "Aftercare & safety": [],
    };
    for (const d of docs) {
      const title = drafts[d.id]?.title ?? d.title;
      if (q && !title.toLowerCase().includes(q)) continue;
      (groups[d.category] ??= []).push({ ...d, title });
    }
    return groups;
  }, [docs, drafts, query]);

  const selected = selectedId
    ? docs.find((d) => d.id === selectedId) ?? null
    : null;
  const draft = selected ? drafts[selected.id] : null;
  const savedSnapshot = selected ? saved[selected.id] : null;
  const dirty =
    !!draft &&
    !!savedSnapshot &&
    (draft.title !== savedSnapshot.title || draft.body !== savedSnapshot.body);

  function toggleGroup(name: string) {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function selectDoc(id: string) {
    setSelectedId(id);
  }

  function updateDraft(patch: { title?: string; body?: string }) {
    if (!selected) return;
    setDrafts((prev) => ({
      ...prev,
      [selected.id]: { ...prev[selected.id], ...patch },
    }));
  }

  function handleSave() {
    if (!selected || !draft) return;
    const ts = Date.now();
    setSaved((prev) => ({ ...prev, [selected.id]: { ...draft } }));
    setDocs((prev) =>
      prev.map((d) =>
        d.id === selected.id
          ? { ...d, title: draft.title, lastEditedAt: ts }
          : d
      )
    );
    pushToast({ kind: "success", text: "Saved." });
    setTimeout(() => {
      pushToast({
        kind: "ai",
        text: "Yuna is using this.",
        meta: "live in 30s",
      });
    }, 1400);
  }

  function handleDeleteConfirm() {
    setDeleting(false);
    pushToast({
      kind: "danger",
      text: "Document deleted.",
      meta: "undo within 10s",
    });
  }

  function handleAddDoc() {
    setNewTitle("");
    setNewCategory("Treatments");
    setNewBody("");
    setAdding(true);
  }

  function handleCreate() {
    const title = newTitle.trim();
    if (!title) {
      titleInputRef.current?.focus();
      return;
    }
    const body = newBody.trim();
    const category = newCategory;
    startCreate(async () => {
      try {
        const { id, lastEditedAt } = await createKnowledgeDoc({
          title,
          body,
          category,
        });
        const doc: KnowledgeDocDto = {
          id,
          title,
          category,
          chunkCount: 1,
          body,
          lastEditedAt,
        };
        setDocs((prev) => [...prev, doc]);
        setDrafts((prev) => ({ ...prev, [id]: { title, body } }));
        setSaved((prev) => ({ ...prev, [id]: { title, body } }));
        setExpanded((prev) => ({ ...prev, [category]: true }));
        setSelectedId(id);
        setAdding(false);
        pushToast({ kind: "success", text: "Document created." });
        setTimeout(() => {
          pushToast({
            kind: "ai",
            text: "Yuna is using this.",
            meta: "live in 30s",
          });
        }, 1400);
      } catch (err) {
        pushToast({
          kind: "danger",
          text: "Could not create document.",
          meta: err instanceof Error ? err.message.slice(0, 60) : "unknown",
        });
      }
    });
  }

  // Esc closes whichever modal is open.
  useEffect(() => {
    if (!deleting && !adding) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (deleting) setDeleting(false);
      if (adding) setAdding(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleting, adding]);

  // Autofocus the title field when the create modal opens.
  useEffect(() => {
    if (adding) titleInputRef.current?.focus();
  }, [adding]);

  const treeGroupOrder: Array<"Treatments" | "Aftercare & safety"> = [
    "Treatments",
    "Aftercare & safety",
  ];

  return (
    <div className={styles.workspace}>
      {/* ============ LEFT RAIL ============ */}
      <aside
        className={`${styles.col} ${styles.colTree}`}
        aria-label="Knowledge tree"
      >
        <div className={styles.treeHeader}>
          <h2>Knowledge · {docs.length}</h2>
        </div>

        <div className={styles.treeSearch}>
          <label className="visually-hidden" htmlFor="tree-q">
            Search documents
          </label>
          <input
            id="tree-q"
            type="search"
            placeholder="Search documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.treeSearchInput}
          />
        </div>

        <button
          type="button"
          className={styles.addDoc}
          onClick={handleAddDoc}
        >
          <PlusIcon />
          Add document
        </button>

        <nav className={styles.tree} role="tree" aria-label="Documents by category">
          {treeGroupOrder.map((name) => {
            const list = grouped[name] ?? [];
            const isExpanded = expanded[name] ?? true;
            return (
              <div key={name} className={styles.treeGroup}>
                <button
                  type="button"
                  className={styles.treeGroupHead}
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(name)}
                >
                  <CaretIcon collapsed={!isExpanded} />
                  <span className={styles.treeGroupName}>{name}</span>
                  <span className={styles.treeGroupCount}>{list.length}</span>
                </button>
                {isExpanded && (
                  <ul className={styles.treeList} role="group">
                    {list.length === 0 && (
                      <li className={styles.treeEmpty}>No documents</li>
                    )}
                    {list.map((d) => {
                      const isActive = d.id === selectedId;
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            role="treeitem"
                            aria-current={isActive ? "true" : undefined}
                            className={`${styles.treeItem} ${
                              isActive ? styles.treeItemActive : ""
                            }`}
                            onClick={() => selectDoc(d.id)}
                          >
                            <span className={styles.treeItemName}>{d.title}</span>
                            <span className={styles.treeItemMeta}>
                              {formatRelative(d.lastEditedAt)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ============ EDITOR ============ */}
      <main
        className={`${styles.col} ${styles.colEditor}`}
        aria-label="Document editor"
      >
        {selected && draft ? (
          <>
            <header className={styles.editorHeader}>
              <div className={styles.editorTitle}>
                <div className={styles.editorCrumbs}>
                  <span>{selected.category}</span>
                  <span className={styles.editorCrumbsSep}>/</span>
                  <span className={styles.subtle}>
                    {selected.chunkCount} chunk
                    {selected.chunkCount === 1 ? "" : "s"} · last indexed{" "}
                    {formatRelative(selected.lastEditedAt)}
                  </span>
                </div>
                <input
                  className={styles.editorTitleInput}
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  spellCheck={false}
                />
              </div>
              <div className={styles.editorActions}>
                <SaveStateBadge dirty={dirty} />
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDangerGhost}`}
                  onClick={() => setDeleting(true)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={handleSave}
                  disabled={!dirty}
                >
                  Save
                </button>
              </div>
            </header>

            <div className={styles.editorBody}>
              <div className={styles.editorPaper}>
                <textarea
                  className={styles.editorTextarea}
                  spellCheck={false}
                  value={draft.body}
                  onChange={(e) => updateDraft({ body: e.target.value })}
                />
              </div>
            </div>
          </>
        ) : (
          <div className={styles.editorEmpty}>
            <p>
              Select a document on the left to view or edit it. Add a new one
              with the + button.
            </p>
          </div>
        )}
      </main>

      {/* ============ DELETE MODAL ============ */}
      {deleting && selected && draft && (
        <div
          className={styles.modalScrim}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleting(false);
          }}
        >
          <div className={styles.modal}>
            <h2 id="delete-title">Delete this document?</h2>
            <p>
              Yuna will stop using <strong>{draft.title}</strong> in customer
              replies within 30 seconds. This can&rsquo;t be undone.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setDeleting(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleDeleteConfirm}
              >
                Delete document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ADD DOC MODAL ============ */}
      {adding && (
        <div
          className={styles.modalScrim}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdding(false);
          }}
        >
          <form
            className={`${styles.modal} ${styles.modalWide}`}
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
          >
            <h2 id="add-title">Add a document</h2>
            <p>
              Yuna will start using it in customer replies within 30 seconds of
              creation.
            </p>

            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="add-doc-title">
                Title
              </label>
              <input
                ref={titleInputRef}
                id="add-doc-title"
                className={styles.formInput}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Underarm Laser Hair Removal"
                spellCheck={false}
              />
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="add-doc-category">
                Category
              </label>
              <select
                id="add-doc-category"
                className={styles.formSelect}
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as KnowledgeDocDto["category"])
                }
              >
                <option value="Treatments">Treatments</option>
                <option value="Aftercare & safety">Aftercare & safety</option>
              </select>
            </div>

            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="add-doc-body">
                Content
              </label>
              <textarea
                id="add-doc-body"
                className={styles.formTextarea}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="What should Yuna know about this topic? Plain Thai or English. Avoid prices Yuna shouldn't quote."
                spellCheck={false}
                rows={8}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setAdding(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? "Embedding…" : "Create document"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ============ TOASTS ============ */}
      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} />
        ))}
      </div>
    </div>
  );
}

function SaveStateBadge({ dirty }: { dirty: boolean }) {
  return (
    <span
      className={`${styles.saveState} ${dirty ? "" : styles.saveStateSaved}`}
    >
      <span className={styles.saveDot} aria-hidden="true" />
      <span>{dirty ? "Unsaved" : "Saved · just now"}</span>
    </span>
  );
}

function ToastView({ toast }: { toast: Toast }): ReactNode {
  const kindClass =
    toast.kind === "ai"
      ? styles.toastAi
      : toast.kind === "danger"
        ? styles.toastDanger
        : "";
  return (
    <div
      className={`${styles.toast} ${kindClass} ${toast.leaving ? styles.toastLeave : ""}`}
    >
      <span className={styles.toastDot} aria-hidden="true" />
      <span>{toast.text}</span>
      {toast.meta && <span className={styles.toastMeta}>{toast.meta}</span>}
    </div>
  );
}
