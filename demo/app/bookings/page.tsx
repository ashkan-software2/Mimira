"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./bookings.module.css";
import {
  CONFIRMED,
  DECLINED,
  PENDING,
  type ConfirmedBooking,
  type PendingBooking,
} from "./data";

const RESOLVE_MS = 240;
const TOAST_MS = 2200;
const NEW_ROW_MS = 700;

function PhoneIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function NoPhoneIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function shortName(customer: string): string {
  return customer.split("·")[0].trim();
}

function needsLabel(needs: PendingBooking["needs"]): string | null {
  if (needs === "time") return "Needs time";
  if (needs === "phone") return "Needs phone";
  return null;
}

export default function BookingsPage() {
  const [pending, setPending] = useState<PendingBooking[]>(PENDING);
  const [confirmed, setConfirmed] = useState<ConfirmedBooking[]>(CONFIRMED);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const [confirmedOpen, setConfirmedOpen] = useState(true);
  const [declinedOpen, setDeclinedOpen] = useState(false);

  const [toast, setToast] = useState<string>("");
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

  function confirmBooking(card: PendingBooking) {
    setResolving((prev) => {
      const next = new Set(prev);
      next.add(card.id);
      return next;
    });

    const newId = `c-${card.id}-${Date.now()}`;

    setTimeout(() => {
      setPending((prev) => prev.filter((p) => p.id !== card.id));
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(card.id);
        return next;
      });
      setConfirmed((prev) => [
        {
          id: newId,
          customer: card.customer,
          treatment: card.treatment,
          whenLabel: card.whenLabel,
          statusLabel: "Yuna confirmed · sent by Pim · now",
        },
        ...prev,
      ]);
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.add(newId);
        return next;
      });
      setTimeout(() => {
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(newId);
          return next;
        });
      }, NEW_ROW_MS);
      showToast(`Yuna messaged ${shortName(card.customer)} on Line — confirmation sent`);
    }, RESOLVE_MS);
  }

  function reschedule(card: PendingBooking) {
    showToast(`Yuna messaged ${shortName(card.customer)} on Line — reschedule options sent`);
  }

  function ask(card: PendingBooking) {
    const need = card.needs === "time" ? "time" : card.needs === "phone" ? "phone" : "details";
    showToast(`Yuna messaged ${shortName(card.customer)} on Line — asking for ${need}`);
  }

  function setManually(card: PendingBooking) {
    showToast(`Opened manual entry for ${shortName(card.customer)}`);
  }

  function openInInbox(name: string) {
    showToast(`Would open ${shortName(name)}'s chat in the Inbox`);
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Bookings</h1>
          </div>
          <div className={styles.toolbar}>
            <button className={styles.filter} type="button">
              All treatments
            </button>
            <div className={styles.search}>
              <label className="visually-hidden" htmlFor="b-search">
                Search bookings
              </label>
              <input
                id="b-search"
                type="search"
                placeholder="Search name or phone…"
                className={styles.searchInput}
              />
            </div>
          </div>
        </div>

        {/* ===== PENDING ===== */}
        <section className={styles.section}>
          <header className={styles.sectionHeader}>
            <h2 className={styles.sectionH2}>
              Pending <span className={styles.sectionCount}>· {pending.length}</span>
            </h2>
            <span className={styles.sectionMeta}>
              Confirm with the customer over Line, then mark here
            </span>
          </header>

          <div className={styles.sectionBody}>
            {pending.map((card) => {
              const isResolving = resolving.has(card.id);
              const isNeeds = card.needs !== "none";
              const cardClass = [
                styles.card,
                isNeeds ? styles.cardNeeds : "",
                isResolving ? styles.cardResolving : "",
              ]
                .filter(Boolean)
                .join(" ");
              const needs = needsLabel(card.needs);

              return (
                <article key={card.id} className={cardClass}>
                  <div className={styles.cardBody}>
                    <div className={styles.cardLine1}>
                      <div className={styles.customer}>{card.customer}</div>
                      <div
                        className={
                          card.whenIsMissing
                            ? `${styles.when} ${styles.whenMissing}`
                            : styles.when
                        }
                      >
                        {card.whenLabel}
                        {!card.whenIsMissing && <> <span className={styles.tz}>ICT</span></>}
                      </div>
                    </div>

                    <div className={styles.cardLine2}>
                      <span className={styles.treatment}>{card.treatment}</span>
                      <span className={styles.sep}>·</span>
                      <span
                        className={
                          card.phoneIsMissing
                            ? `${styles.phone} ${styles.phoneMissing}`
                            : styles.phone
                        }
                      >
                        {card.phoneIsMissing ? <NoPhoneIcon /> : <PhoneIcon />}
                        {card.phoneLabel}
                      </span>
                    </div>

                    <div className={styles.quote}>
                      {card.quote}
                      <span className={styles.quoteStamp}>{card.quoteStamp}</span>
                    </div>

                    {needs && (
                      <div className={styles.cardMeta}>
                        <span className={`${styles.badge} ${styles.badgeWarning}`}>
                          {needs}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.cardActions}>
                    {card.needs === "none" && (
                      <>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => confirmBooking(card)}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={() => reschedule(card)}
                        >
                          Reschedule
                        </button>
                      </>
                    )}
                    {card.needs === "time" && (
                      <>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => ask(card)}
                        >
                          Ask customer
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={() => setManually(card)}
                        >
                          Set manually
                        </button>
                      </>
                    )}
                    {card.needs === "phone" && (
                      <>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          onClick={() => ask(card)}
                        >
                          Ask customer
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          onClick={() => confirmBooking(card)}
                        >
                          Confirm anyway
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                      onClick={() => openInInbox(card.customer)}
                    >
                      View chat ›
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ===== CONFIRMED ===== */}
        <section className={styles.section}>
          <header
            className={`${styles.sectionHeader} ${styles.sectionHeaderToggle}`}
            onClick={() => setConfirmedOpen((v) => !v)}
            role="button"
            tabIndex={0}
            aria-expanded={confirmedOpen}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setConfirmedOpen((v) => !v);
              }
            }}
          >
            <h2 className={styles.sectionH2}>
              Confirmed{" "}
              <span className={styles.sectionCount}>
                · {confirmed.length} in the last 30 days
              </span>
            </h2>
            <span className={styles.sectionMeta}>
              <span
                className={
                  confirmedOpen
                    ? styles.chevron
                    : `${styles.chevron} ${styles.chevronCollapsed}`
                }
                aria-hidden="true"
              />
            </span>
          </header>

          {confirmedOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.compactList}>
                {confirmed.map((row) => (
                  <div
                    key={row.id}
                    className={
                      freshIds.has(row.id)
                        ? `${styles.compactRow} ${styles.rowNew}`
                        : styles.compactRow
                    }
                  >
                    <span className={styles.rowName}>{row.customer}</span>
                    <span className={styles.rowTreatment}>{row.treatment}</span>
                    <span className={styles.rowWhen}>{row.whenLabel}</span>
                    <span className={styles.rowStatus}>
                      <span className={styles.rowCheck}>✓</span> {row.statusLabel}
                    </span>
                    <button
                      type="button"
                      className={styles.rowOpen}
                      aria-label="Open in inbox"
                      onClick={() => openInInbox(row.customer)}
                    >
                      ›
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ===== DECLINED / NO-SHOW ===== */}
        <section className={styles.section}>
          <header
            className={`${styles.sectionHeader} ${styles.sectionHeaderToggle}`}
            onClick={() => setDeclinedOpen((v) => !v)}
            role="button"
            tabIndex={0}
            aria-expanded={declinedOpen}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setDeclinedOpen((v) => !v);
              }
            }}
          >
            <h2 className={styles.sectionH2}>
              Declined / no-show{" "}
              <span className={styles.sectionCount}>
                · {DECLINED.length} in the last 30 days
              </span>
            </h2>
            <span className={styles.sectionMeta}>
              <span
                className={
                  declinedOpen
                    ? styles.chevron
                    : `${styles.chevron} ${styles.chevronCollapsed}`
                }
                aria-hidden="true"
              />
            </span>
          </header>

          {declinedOpen && (
            <div className={styles.sectionBody}>
              <div className={styles.compactList}>
                {DECLINED.map((row) => (
                  <div key={row.id} className={styles.compactRow}>
                    <span className={styles.rowName}>{row.customer}</span>
                    <span className={styles.rowTreatment}>{row.treatment}</span>
                    <span className={styles.rowWhen}>{row.whenLabel}</span>
                    <span className={`${styles.rowStatus} ${styles.rowStatusNoShow}`}>
                      <span className={styles.rowCheck}>×</span> {row.statusLabel}
                    </span>
                    <button
                      type="button"
                      className={styles.rowOpen}
                      aria-label="Open in inbox"
                      onClick={() => openInInbox(row.customer)}
                    >
                      ›
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div
        className={toastVisible ? `${styles.toast} ${styles.toastVisible}` : styles.toast}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
