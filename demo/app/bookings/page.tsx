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

type EventStatus = "pending" | "confirmed" | "noshow";

type CalEvent = {
  id: string;
  start: Date;
  durationMin: number;
  customer: string;
  treatment: string;
  status: EventStatus;
};

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

export default function BookingsPage() {
  const today = useMemo(() => new Date(TODAY_ISO), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

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
    return list.sort((a, b) => a.start.getTime() - b.start.getTime());
  }, []);

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
          />
        )}
      </div>

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
  onAskUnscheduled,
}: {
  monthAnchor: Date;
  monthDays: Date[];
  today: Date;
  eventsByDay: Map<string, CalEvent[]>;
  unscheduled: PendingBooking[];
  onOpenDay: (d: Date) => void;
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
              <button
                key={dayKey(d)}
                type="button"
                className={cls}
                onClick={() => onOpenDay(d)}
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
                    <div
                      key={e.id}
                      className={[
                        styles.eventChip,
                        e.status === "pending" ? styles.eventChipPending : "",
                        e.status === "noshow" ? styles.eventChipNoShow : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span className={styles.eventChipTime}>{fmtHour(e.start)}</span>
                      <span className={styles.eventChipName}>
                        {shortName(e.customer)}
                      </span>
                    </div>
                  ))}
                  {extra > 0 && (
                    <div className={styles.eventMore}>+{extra} more</div>
                  )}
                </div>
              </button>
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
}: {
  day: Date;
  events: CalEvent[];
  today: Date;
  onBack: () => void;
}) {
  const hours: number[] = [];
  for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) hours.push(h);

  const dayLabel = `${DAY_NAMES[day.getDay()]}, ${day.getDate()} ${
    MONTH_NAMES[day.getMonth()]
  } ${day.getFullYear()}`;

  const showNowLine = isSameDay(day, today);
  const nowTop = positionPx(today);

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

          {events.map((e) => {
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
              e.status === "noshow" ? styles.eventNoShow : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={e.id} className={cls} style={{ top: `${top}px`, height }}>
                <span className={styles.eventTime}>
                  {fmtHour(e.start)} – {fmtHour(endTime)}
                  {e.status === "pending" && " · pending"}
                  {e.status === "noshow" && " · no-show"}
                </span>
                <span className={styles.eventCustomer}>{e.customer}</span>
                <span className={styles.eventTreatment}>{e.treatment}</span>
              </div>
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
