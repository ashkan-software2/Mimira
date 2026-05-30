/*
 * Mock data for the Bookings page. In the real demo (DESIGN-DEMO.md, Day 5)
 * these come from the `bookings` table. Numbers and copy mirror
 * /mockups/bookings.html so the visual regression is exact.
 *
 * ISO datetimes are pinned to May 2025 so day-of-week labels match (Sat 31 May
 * was a Saturday in 2025). Times are local clinic time (Bangkok / ICT).
 */

export type PendingNeeds = "none" | "time" | "phone";

export type PendingBooking = {
  id: string;
  customer: string;
  whenLabel: string;
  whenIsMissing: boolean;
  startISO: string | null;
  durationMin: number;
  treatment: string;
  phoneLabel: string;
  phoneIsMissing: boolean;
  quote: string;
  quoteStamp: string;
  needs: PendingNeeds;
};

export type ConfirmedBooking = {
  id: string;
  customer: string;
  treatment: string;
  whenLabel: string;
  startISO: string;
  durationMin: number;
  statusLabel: string;
  isNoShow?: boolean;
};

/** The demo's "today" — pinned so dates and weekdays make sense. */
export const TODAY_ISO = "2025-05-30T09:00:00";

export const PENDING: PendingBooking[] = [
  {
    id: "b1",
    customer: "คุณนุช · Noot J.",
    whenLabel: "Sat 31 May · 14:00",
    whenIsMissing: false,
    startISO: "2025-05-31T14:00:00",
    durationMin: 45,
    treatment: "Underarm laser",
    phoneLabel: "081-234-xxxx",
    phoneIsMissing: false,
    quote: "ขอจองวันเสาร์บ่ายสองค่ะ ทำใต้วงแขนนะ ขอบคุณค่ะ",
    quoteStamp: "from chat · 14:13",
    needs: "none",
  },
  {
    id: "b2",
    customer: "Khun Mali · มะลิ",
    whenLabel: '"next week, afternoon"',
    whenIsMissing: true,
    startISO: null,
    durationMin: 90,
    treatment: "HIFU full face",
    phoneLabel: "089-771-xxxx",
    phoneIsMissing: false,
    quote: "สนใจ HIFU ค่ะ พอจะว่างอาทิตย์หน้าบ่ายๆ ก็ได้นะคะ ไม่เร่งร้อน",
    quoteStamp: "from chat · 12:02",
    needs: "time",
  },
  {
    id: "b3",
    customer: "Aey · เอ๋",
    whenLabel: "Sat 31 May · 15:00",
    whenIsMissing: false,
    startISO: "2025-05-31T15:00:00",
    durationMin: 60,
    treatment: "Picosure (pigmentation)",
    phoneLabel: "No phone on file",
    phoneIsMissing: true,
    quote: "ที่จองไว้เสาร์ ขอเปลี่ยนเป็นบ่ายสามได้มั้ยคะ เพื่อนจะมาด้วยคน",
    quoteStamp: "from chat · 11:47",
    needs: "phone",
  },
];

export const CONFIRMED: ConfirmedBooking[] = [
  {
    id: "c1",
    customer: "Aey · เอ๋",
    treatment: "Picosure (pigmentation)",
    whenLabel: "Sat 24 May · 15:00",
    startISO: "2025-05-24T15:00:00",
    durationMin: 60,
    statusLabel: "Mimira confirmed · sent by staff · 22 May",
  },
  {
    id: "c2",
    customer: "Thida W. · ธิดา",
    treatment: "Brow shape + tint",
    whenLabel: "Fri 23 May · 11:00",
    startISO: "2025-05-23T11:00:00",
    durationMin: 45,
    statusLabel: "Mimira confirmed · sent by staff · 21 May",
  },
  {
    id: "c3",
    customer: "คุณปุ๊ก · Puk S.",
    treatment: "HIFU full face",
    whenLabel: "Thu 22 May · 16:30",
    startISO: "2025-05-22T16:30:00",
    durationMin: 90,
    statusLabel: "Mimira confirmed · sent by Mod · 20 May",
  },
  {
    id: "c4",
    customer: "คุณฝน · Fon",
    treatment: "Consultation",
    whenLabel: "Wed 21 May · 10:00",
    startISO: "2025-05-21T10:00:00",
    durationMin: 30,
    statusLabel: "Mimira confirmed · sent by staff · 19 May",
  },
  {
    id: "c5",
    customer: "Nat · ณัฏฐ์",
    treatment: "Underarm laser",
    whenLabel: "Tue 20 May · 14:00",
    startISO: "2025-05-20T14:00:00",
    durationMin: 45,
    statusLabel: "Mimira confirmed · sent by Mod · 18 May",
  },
  {
    id: "c6",
    customer: "คุณแก้ว · Kaew P.",
    treatment: "HIFU jawline",
    whenLabel: "Mon 19 May · 11:30",
    startISO: "2025-05-19T11:30:00",
    durationMin: 60,
    statusLabel: "Mimira confirmed · sent by staff · 17 May",
  },
  {
    id: "c7",
    customer: "Bee · บี",
    treatment: "Picosure (freckles)",
    whenLabel: "Sat 17 May · 13:00",
    startISO: "2025-05-17T13:00:00",
    durationMin: 60,
    statusLabel: "Mimira confirmed · sent by staff · 15 May",
  },
  {
    id: "c8",
    customer: "คุณนุช · Noot J.",
    treatment: "Underarm laser",
    whenLabel: "Sat 24 May · 14:00",
    startISO: "2025-05-24T14:00:00",
    durationMin: 45,
    statusLabel: "Mimira confirmed · sent by Mod · 22 May",
  },
];

export const DECLINED: ConfirmedBooking[] = [
  {
    id: "d1",
    customer: "Pla · ปลา",
    treatment: "HIFU jawline",
    whenLabel: "Sun 18 May · 13:00",
    startISO: "2025-05-18T13:00:00",
    durationMin: 60,
    statusLabel: "No-show · logged by staff",
    isNoShow: true,
  },
];
