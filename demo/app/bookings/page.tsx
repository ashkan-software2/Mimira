"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./bookings.module.css";
import {
  CONFIRMED,
  DECLINED,
  PENDING,
  TODAY_ISO,
  type ConfirmedBooking,
  type PendingBooking,
} from "./data";

const TOAST_MS = 2200;

type EventStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "noshow";

type CalEvent = {
  id: string;
  start: Date;
  durationMin: number;
  customer: string;
  treatment: string;
  status: EventStatus;
};

const STATUS_TAG: Record<EventStatus, string> = {
  pending: "pending",
  confirmed: "confirmed",
  declined: "declined",
  cancelled: "cancelled",
  noshow: "no-show",
};

const STATUS_PILL_LABEL: Record<EventStatus, string> = {
  pending: "Pending confirmation",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  noshow: "No-show",
};

function isEndedStatus(s: EventStatus): boolean {
  return s === "declined" || s === "cancelled" || s === "noshow";
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 20;
const TIMELINE_HOUR_HEIGHT = 56;

// Day-view layout: gutter at the track edges + gap between side-by-side
// columns when bookings overlap.
const TRACK_PAD = 8;
const COL_GAP = 4;

function shortName(customer: string): string {
  return customer.split("·")[0].trim();
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtHour(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtHourSlot(hour: number): string {
  return `${pad2(hour)}:00`;
}

/** Mon-first grid covering the whole displayed month, padded to full weeks. */
function buildMonthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  // JS getDay: 0=Sun..6=Sat. Convert to Mon=0..Sun=6.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  // Trim trailing all-out-of-month week if unused.
  if (days[35].getMonth() !== first.getMonth()) {
    return days.slice(0, 35);
  }
  return days;
}

function toEvent(
  source: PendingBooking | ConfirmedBooking,
  status: EventStatus,
): CalEvent | null {
  if (!source.startISO) return null;
  return {
    id: source.id,
    start: new Date(source.startISO),
    durationMin: source.durationMin,
    customer: source.customer,
    treatment: source.treatment,
    status,
  };
}

type Placement = { event: CalEvent; column: number; columns: number };

/** Lay out same-day events into the minimum number of side-by-side columns
 *  so that overlapping bookings don't stack on top of each other. */
function layoutDayEvents(events: CalEvent[]): Placement[] {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const placements: Placement[] = [];

  type Active = { event: CalEvent; column: number; end: number };
  let cluster: Active[] = [];
  let clusterEnd = 0;

  function flush() {
    if (cluster.length === 0) return;
    const columns = Math.max(...cluster.map((a) => a.column)) + 1;
    for (const a of cluster) {
      placements.push({ event: a.event, column: a.column, columns });
    }
    cluster = [];
    clusterEnd = 0;
  }

  for (const event of sorted) {
    const startMs = event.start.getTime();
    const endMs = startMs + event.durationMin * 60_000;
    if (cluster.length > 0 && startMs >= clusterEnd) flush();

    const used = new Set<number>();
    for (const a of cluster) if (a.end > startMs) used.add(a.column);
    let col = 0;
    while (used.has(col)) col++;

    cluster.push({ event, column: col, end: endMs });
    if (endMs > clusterEnd) clusterEnd = endMs;
  }
  flush();
  return placements;
}

export default function BookingsPage() {
  const today = useMemo(() => new Date(TODAY_ISO), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<
    Map<string, EventStatus>
  >(new Map());

  const [toast, setToast] = useState<string>("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedEventId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedEventId]);

  function showToast(text: string) {
    setToast(text);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_MS);
  }

  const events = useMemo<CalEvent[]>(() => {
    const list: CalEvent[] = [];
    for (const p of PENDING) {
      const e = toEvent(p, "pending");
      if (e) list.push(e);
    }
    for (const c of CONFIRMED) {
      const e = toEvent(c, "confirmed");
      if (e) list.push(e);
    }
    for (const d of DECLINED) {
      const e = toEvent(d, "noshow");
      if (e) list.push(e);
    }
    return list
      .map((e) => {
        const override = statusOverrides.get(e.id);
        return override ? { ...e, status: override } : e;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [statusOverrides]);

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [selectedEventId, events],
  );

  function updateStatus(id: string, status: EventStatus) {
    setStatusOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, status);
      return next;
    });
  }

  const eventsByDay = useMemo<Map<string, CalEvent[]>>(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      const key = dayKey(e.start);
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const unscheduled = useMemo(
    () => PENDING.filter((p) => p.whenIsMissing),
    [],
  );

  const monthDays = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const monthLabel = `${MONTH_NAMES[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`;

  function goPrev() {
    setMonthAnchor((d) => addMonths(d, -1));
  }
  function goNext() {
    setMonthAnchor((d) => addMonths(d, 1));
  }
  function goToday() {
    setMonthAnchor(startOfMonth(today));
    setSelectedDay(null);
  }

  function openDay(d: Date) {
    setSelectedDay(d);
  }
  function backToMonth() {
    setSelectedDay(null);
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitleRow}>
            <h1 className={styles.pageTitle}>Bookings</h1>
            <span className={styles.monthLabel}>{monthLabel}</span>
          </div>
          <div className={styles.toolbar}>
            <span className={styles.legend} aria-hidden="true">
              <span className={styles.legendItem}>
                <span className={styles.legendDot} /> confirmed
              </span>
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.legendDotPending}`} />{" "}
                pending
              </span>
            </span>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goPrev}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button type="button" className={styles.todayBtn} onClick={goToday}>
              Today
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goNext}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        {selectedDay === null ? (
          <MonthView
            monthAnchor={monthAnchor}
            monthDays={monthDays}
            today={today}
            eventsByDay={eventsByDay}
            unscheduled={unscheduled}
            onOpenDay={openDay}
            onSelectEvent={(e) => setSelectedEventId(e.id)}
            onAskUnscheduled={(name) =>
              showToast(`Yuna messaged ${shortName(name)} on Line — asking for time`)
            }
          />
        ) : (
          <DayView
            day={selectedDay}
            events={eventsByDay.get(dayKey(selectedDay)) ?? []}
            today={today}
            onBack={backToMonth}
            onSelectEvent={(e) => setSelectedEventId(e.id)}
          />
        )}
      </div>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEventId(null)}
          onAction={(label, name, newStatus) => {
            if (newStatus && selectedEvent) {
              updateStatus(selectedEvent.id, newStatus);
            }
            setSelectedEventId(null);
            showToast(`${label} · ${shortName(name)}`);
          }}
        />
      )}

      <div
        className={
          toastVisible ? `${styles.toast} ${styles.toastVisible}` : styles.toast
        }
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}

/* ---------- Month grid ---------- */

const MAX_CHIPS_PER_DAY = 3;

function MonthView({
  monthAnchor,
  monthDays,
  today,
  eventsByDay,
  unscheduled,
  onOpenDay,
  onSelectEvent,
  onAskUnscheduled,
}: {
  monthAnchor: Date;
  monthDays: Date[];
  today: Date;
  eventsByDay: Map<string, CalEvent[]>;
  unscheduled: PendingBooking[];
  onOpenDay: (d: Date) => void;
  onSelectEvent: (e: CalEvent) => void;
  onAskUnscheduled: (customer: string) => void;
}) {
  const currentMonth = monthAnchor.getMonth();

  return (
    <>
      {unscheduled.length > 0 && (
        <section className={styles.unscheduled}>
          <h2 className={styles.unscheduledTitle}>
            Unscheduled · {unscheduled.length} pending
          </h2>
          <div className={styles.unscheduledList}>
            {unscheduled.map((p) => (
              <div key={p.id} className={styles.unscheduledRow}>
                <span className={styles.unscheduledName}>{p.customer}</span>
                <span className={styles.unscheduledTreatment}>{p.treatment}</span>
                <span className={styles.unscheduledHint}>{p.whenLabel}</span>
                <button
                  type="button"
                  className={styles.todayBtn}
                  onClick={() => onAskUnscheduled(p.customer)}
                >
                  Ask for time
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className={styles.calendar}>
        <div className={styles.weekHeader} role="row">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className={styles.weekday} role="columnheader">
              {w}
            </div>
          ))}
        </div>
        <div className={styles.monthGrid} role="grid">
          {monthDays.map((d) => {
            const inMonth = d.getMonth() === currentMonth;
            const isToday = isSameDay(d, today);
            const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
            const shown = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
            const extra = dayEvents.length - shown.length;
            const hasPending = dayEvents.some((e) => e.status === "pending");

            const cls = [
              styles.dayCell,
              inMonth ? "" : styles.dayOut,
              isToday ? styles.dayToday : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={dayKey(d)}
                role="button"
                tabIndex={0}
                className={cls}
                onClick={() => onOpenDay(d)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onOpenDay(d);
                  }
                }}
                aria-label={`${d.getDate()} ${MONTH_NAMES[d.getMonth()]}, ${
                  dayEvents.length
                } booking${dayEvents.length === 1 ? "" : "s"}`}
              >
                <div className={styles.dayNumRow}>
                  <span className={styles.dayNum}>{d.getDate()}</span>
                  {hasPending && !isToday && (
                    <span className={styles.dayNeedsDot} aria-hidden="true" />
                  )}
                </div>
                <div className={styles.eventList}>
                  {shown.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={[
                        styles.eventChip,
                        e.status === "pending" ? styles.eventChipPending : "",
                        isEndedStatus(e.status) ? styles.eventChipNoShow : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelectEvent(e);
                      }}
                      aria-label={`Booking · ${shortName(e.customer)} · ${fmtHour(
                        e.start,
                      )} · ${e.treatment}`}
                    >
                      <span className={styles.eventChipTime}>{fmtHour(e.start)}</span>
                      <span className={styles.eventChipName}>
                        {shortName(e.customer)}
                      </span>
                    </button>
                  ))}
                  {extra > 0 && (
                    <div className={styles.eventMore}>+{extra} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- Day timeline ---------- */

function DayView({
  day,
  events,
  today,
  onBack,
  onSelectEvent,
}: {
  day: Date;
  events: CalEvent[];
  today: Date;
  onBack: () => void;
  onSelectEvent: (e: CalEvent) => void;
}) {
  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) hours.push(h);

  const dayLabel = `${DAY_NAMES[day.getDay()]}, ${day.getDate()} ${
    MONTH_NAMES[day.getMonth()]
  } ${day.getFullYear()}`;

  const showNowLine = isSameDay(day, today);
  const nowTop = positionPx(today);

  const placements = useMemo(() => layoutDayEvents(events), [events]);

  return (
    <div className={styles.dayView}>
      <div className={styles.dayHeader}>
        <div className={styles.dayHeaderLeft}>
          <button type="button" className={styles.dayBack} onClick={onBack}>
            ‹ Back to month
          </button>
          <h2 className={styles.dayTitle}>{dayLabel}</h2>
          <span className={styles.dayCount}>
            {events.length} booking{events.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineHours}>
          <div className={styles.timelineTrack}>
            {hours.map((h) => (
              <div
                key={h}
                className={styles.timelineHourLabel}
                style={{ top: `${(h - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT}px` }}
              >
                {fmtHourSlot(h)}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.timelineTrack}>
          {hours.map((h) => (
            <div key={`hl-${h}`}>
              <div
                className={styles.timelineHourLine}
                style={{ top: `${(h - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT}px` }}
              />
              {h < TIMELINE_END_HOUR && (
                <div
                  className={styles.timelineHalfLine}
                  style={{
                    top: `${
                      (h - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT +
                      TIMELINE_HOUR_HEIGHT / 2
                    }px`,
                  }}
                />
              )}
            </div>
          ))}

          {showNowLine && nowTop !== null && (
            <div
              className={styles.timelineNow}
              style={{ top: `${nowTop}px` }}
              aria-label="Current time"
            />
          )}

          {placements.map(({ event: e, column, columns }) => {
            const top = positionPx(e.start);
            if (top === null) return null;
            const height = Math.max(
              28,
              (e.durationMin / 60) * TIMELINE_HOUR_HEIGHT,
            );
            const endTime = new Date(e.start.getTime() + e.durationMin * 60_000);
            const cls = [
              styles.event,
              e.status === "pending" ? styles.eventPending : "",
              isEndedStatus(e.status) ? styles.eventNoShow : "",
              e.status === "confirmed" ? styles.eventConfirmed : "",
              columns > 1 ? styles.eventCompact : "",
              columns >= 3 ? styles.eventCompactTight : "",
            ]
              .filter(Boolean)
              .join(" ");
            const widthStyle = `calc((100% - ${
              2 * TRACK_PAD + (columns - 1) * COL_GAP
            }px) / ${columns})`;
            const leftStyle = `calc(${TRACK_PAD}px + (((100% - ${
              2 * TRACK_PAD + (columns - 1) * COL_GAP
            }px) / ${columns}) + ${COL_GAP}px) * ${column})`;
            return (
              <button
                key={e.id}
                type="button"
                className={cls}
                style={{
                  top: `${top}px`,
                  height,
                  width: widthStyle,
                  left: leftStyle,
                }}
                onClick={() => onSelectEvent(e)}
                aria-label={`Open booking · ${e.customer} · ${e.treatment} · ${fmtHour(
                  e.start,
                )}`}
              >
                <span className={styles.eventTime}>
                  {fmtHour(e.start)} – {fmtHour(endTime)}
                </span>
                <span className={styles.eventSep} aria-hidden="true">·</span>
                <span className={styles.eventCustomer}>{e.customer}</span>
                <span className={styles.eventSep} aria-hidden="true">·</span>
                <span className={styles.eventTreatment}>{e.treatment}</span>
                <span className={styles.eventSep} aria-hidden="true">·</span>
                <span className={styles.eventStatusTag}>{STATUS_TAG[e.status]}</span>
              </button>
            );
          })}

          {events.length === 0 && (
            <div className={styles.emptyDay}>No bookings on this day.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function positionPx(d: Date): number | null {
  const hour = d.getHours() + d.getMinutes() / 60;
  if (hour < TIMELINE_START_HOUR || hour > TIMELINE_END_HOUR) return null;
  return (hour - TIMELINE_START_HOUR) * TIMELINE_HOUR_HEIGHT;
}

/* ---------- Event details modal ---------- */

function EventDetailsModal({
  event,
  onClose,
  onAction,
}: {
  event: CalEvent;
  onClose: () => void;
  onAction: (label: string, customer: string, newStatus?: EventStatus) => void;
}) {
  const endTime = new Date(event.start.getTime() + event.durationMin * 60_000);
  const dateLabel = `${DAY_NAMES[event.start.getDay()]}, ${event.start.getDate()} ${
    MONTH_NAMES[event.start.getMonth()]
  } ${event.start.getFullYear()}`;
  const timeLabel = `${fmtHour(event.start)} – ${fmtHour(endTime)}`;
  const durationLabel =
    event.durationMin >= 60
      ? `${Math.floor(event.durationMin / 60)}h${
          event.durationMin % 60 ? ` ${event.durationMin % 60}m` : ""
        }`
      : `${event.durationMin}m`;

  return (
    <div
      className={styles.modalScrim}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={`Booking details · ${event.customer}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span
            className={[
              styles.statusPill,
              event.status === "pending" ? styles.statusPillPending : "",
              isEndedStatus(event.status) ? styles.statusPillNoShow : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {STATUS_PILL_LABEL[event.status]}
          </span>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <h2 className={styles.modalCustomer}>{event.customer}</h2>
        <p className={styles.modalTreatment}>{event.treatment}</p>

        <dl className={styles.modalMeta}>
          <div className={styles.modalMetaRow}>
            <dt>When</dt>
            <dd>
              {dateLabel}
              <br />
              <span className={styles.modalMetaMuted}>
                {timeLabel} · {durationLabel}
              </span>
            </dd>
          </div>
        </dl>

        <div className={styles.modalActions}>
          {event.status === "pending" && (
            <>
              <button
                type="button"
                className={styles.modalBtn}
                onClick={() =>
                  onAction("Declined booking", event.customer, "declined")
                }
              >
                Decline
              </button>
              <button
                type="button"
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                onClick={() =>
                  onAction("Confirmed booking", event.customer, "confirmed")
                }
              >
                Confirm
              </button>
            </>
          )}
          {event.status === "confirmed" && (
            <>
              <button
                type="button"
                className={styles.modalBtn}
                onClick={() =>
                  onAction("Cancelled booking", event.customer, "cancelled")
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                onClick={() =>
                  onAction("Reschedule sent on Line", event.customer)
                }
              >
                Reschedule
              </button>
            </>
          )}
          {isEndedStatus(event.status) && (
            <>
              <button
                type="button"
                className={styles.modalBtn}
                onClick={() =>
                  onAction("Booking restored to pending", event.customer, "pending")
                }
              >
                Restore
              </button>
              <button
                type="button"
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                onClick={() =>
                  onAction("Follow-up sent on Line", event.customer)
                }
              >
                Follow up
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
