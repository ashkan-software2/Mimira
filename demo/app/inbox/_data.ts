/**
 * Mock conversation data for the demo inbox.
 *
 * Mirrors the content drawn in /mockups/inbox.html so the real app reads as the
 * same product. In the production build this will come from Supabase via a
 * server component; for the demo, it is in-memory and edited via React state.
 */

export type MessageSender = "customer" | "yuna" | "staff";

export type ThreadItem =
  | {
      kind: "message";
      id: string;
      sender: MessageSender;
      author: string;
      text: string;
      time: string;
      sources?: { count: number; label: string };
      deliveryNote?: string;
    }
  | { kind: "day-divider"; id: string; label: string }
  | { kind: "system-note"; id: string; text: string }
  | {
      kind: "escalation-banner";
      id: string;
      title: string;
      reason: string;
    };

export type ConversationBadge =
  | { kind: "attention"; label: string }
  | { kind: "staff"; label: string }
  | { kind: "plain"; label: string };

export type Conversation = {
  id: string;
  name: string;
  ageLabel: string;
  preview: string;
  badges: ConversationBadge[];
  lineId: string;
  phone: string;
  language: string;
  channel: string;
  recentBookings: { treatment: string; when: string }[];
  aiPaused: boolean;
  items: ThreadItem[];
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: "noot",
    name: "คุณนุช · Noot J.",
    ageLabel: "now",
    preview: "ทำไมยังแดงอยู่เลยคะ ทำไปสองวันแล้ว ปวดมากด้วย",
    badges: [
      { kind: "attention", label: "Needs attention" },
      { kind: "plain", label: "post-procedure" },
    ],
    lineId: "U7a3…4f2c",
    phone: "081-234-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: true,
    recentBookings: [
      { treatment: "Underarm laser", when: "24 May" },
      { treatment: "Brow shape", when: "12 Apr" },
      { treatment: "Underarm laser", when: "02 Mar" },
      { treatment: "Consultation", when: "14 Feb" },
    ],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 14:08 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "คุณนุช",
        text: "สวัสดีค่ะ พึ่งทำเลเซอร์มาเมื่อวานนี้ แต่ตอนนี้ผิวยังแดงและปวดมากเลย เป็นปกติไหมคะ",
        time: "14:08",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "ขอบคุณที่ติดต่อมานะคะ คุณนุช เข้าใจค่ะว่าตอนนี้กังวล หลังเลเซอร์ผิวจะแดงและรู้สึกอุ่นได้ประมาณ 24–48 ชั่วโมง แต่ \"ปวดมาก\" ไม่ใช่อาการปกติค่ะ เดี๋ยวเจ้าหน้าที่ของเราจะเข้ามาช่วยดูเคสนี้ทันทีนะคะ",
        time: "14:08",
        sources: { count: 2, label: "aftercare-laser.md" },
      },
      {
        kind: "escalation-banner",
        id: "b1",
        title: "Yuna handed this to staff.",
        reason:
          "Customer said “ปวด” (pain) within 72 hours of a procedure. Yuna sent a safety reply and stopped, waiting for you.",
      },
      {
        kind: "message",
        id: "m3",
        sender: "customer",
        author: "คุณนุช",
        text: "ตรงรักแร้ขวานี่บวมแดงเลยค่ะ กดแล้วเจ็บ กลัวจะติดเชื้อ ต้องไปคลินิกเลยมั้ย หรือทายาอะไรก่อนได้",
        time: "14:11",
      },
      {
        kind: "message",
        id: "m4",
        sender: "customer",
        author: "คุณนุช",
        text: "มีรูปด้วยนะคะ",
        time: "14:11",
      },
      { kind: "system-note", id: "s1", text: "คุณนุชส่งรูปภาพ · staff-only preview" },
      {
        kind: "message",
        id: "m5",
        sender: "staff",
        author: "ครูภา (you)",
        text: "สวัสดีค่ะคุณนุช ครูภาเองนะคะ ขอดูรูปที่ส่งมาก่อนสักครู่ค่ะ ระหว่างนี้อย่าเพิ่งทายาอะไร และประคบเย็นเบาๆ ได้ค่ะ",
        time: "14:13",
        deliveryNote: "✓ delivered",
      },
    ],
  },
  {
    id: "mali",
    name: "Khun Mali · มะลิ",
    ageLabel: "2 min",
    preview: "Picosure ราคาเท่าไหร่คะ มีโปรเดือนนี้มั้ย",
    badges: [{ kind: "attention", label: "Needs attention" }],
    lineId: "U5b2…9a1d",
    phone: "082-555-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: false,
    recentBookings: [{ treatment: "Consultation", when: "10 May" }],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 14:06 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Mali",
        text: "สวัสดีค่ะ สนใจ Picosure ราคาเท่าไหร่คะ มีโปรเดือนนี้มั้ย",
        time: "14:06",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "สวัสดีค่ะคุณมะลิ Picosure ของเราเริ่มต้น 4,500 บาท/ครั้งค่ะ เดือนนี้มีคอร์ส 5 ครั้งราคาพิเศษ 19,500 บาทนะคะ สนใจให้จองเวลาคุยกับหมอก่อนได้เลยค่ะ",
        time: "14:06",
        sources: { count: 1, label: "pricing-picosure.md" },
      },
      {
        kind: "message",
        id: "m3",
        sender: "customer",
        author: "Mali",
        text: "อยากถามว่าคอร์ส 5 ครั้ง ต้องทำห่างกันกี่สัปดาห์ และจ่ายครั้งเดียวเลยมั้ย",
        time: "14:08",
      },
    ],
  },
  {
    id: "kaew",
    name: "คุณแก้ว · Kaew P.",
    ageLabel: "5 min",
    preview: "ขอคุยกับพี่หมอหน่อยค่ะ เรื่องผลข้างเคียง",
    badges: [{ kind: "staff", label: "Staff requested" }],
    lineId: "U9c4…7e2b",
    phone: "086-118-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: true,
    recentBookings: [
      { treatment: "HIFU full face", when: "20 May" },
      { treatment: "Consultation", when: "08 May" },
    ],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 14:03 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Kaew",
        text: "หลัง HIFU เมื่อวาน รู้สึกชาที่กรามขวา ปกติมั้ยคะ",
        time: "14:03",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "อาการชาเล็กน้อยหลัง HIFU อาจพบได้และจะค่อยๆ ดีขึ้นใน 1–2 สัปดาห์ค่ะ แต่ถ้ารู้สึกผิดปกติ ขอให้พี่หมอช่วยดูให้นะคะ จะส่งต่อทีมงานทันทีค่ะ",
        time: "14:03",
        sources: { count: 1, label: "aftercare-hifu.md" },
      },
      {
        kind: "message",
        id: "m3",
        sender: "customer",
        author: "Kaew",
        text: "ขอคุยกับพี่หมอหน่อยค่ะ เรื่องผลข้างเคียง",
        time: "14:04",
      },
      {
        kind: "escalation-banner",
        id: "b1",
        title: "Customer asked for staff.",
        reason: "Yuna stopped. Reply manually or pull a doctor in.",
      },
    ],
  },
  {
    id: "thida",
    name: "Thida W. · ธิดา",
    ageLabel: "8 min",
    preview: "เลื่อนนัดพรุ่งนี้ได้มั้ย ติดงานด่วน",
    badges: [
      { kind: "attention", label: "Needs attention" },
      { kind: "plain", label: "booking" },
    ],
    lineId: "U2d5…1b8a",
    phone: "089-771-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: false,
    recentBookings: [{ treatment: "Underarm laser", when: "27 May (booked)" }],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 14:00 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Thida",
        text: "พรุ่งนี้นัดเลเซอร์ 11 โมง ขอเลื่อนได้มั้ยคะ ติดงานด่วนค่ะ",
        time: "14:00",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "ได้เลยค่ะคุณธิดา รบกวนแจ้งวันและเวลาที่สะดวก ทีมงานจะตรวจสอบและยืนยันให้นะคะ",
        time: "14:00",
      },
    ],
  },
  {
    id: "puk",
    name: "คุณปุ๊ก · Puk S.",
    ageLabel: "12 min",
    preview: "ทำ HIFU แล้วหน้าบวมปกติมั้ยคะ",
    badges: [
      { kind: "attention", label: "Needs attention" },
      { kind: "plain", label: "post-procedure" },
    ],
    lineId: "U6e7…3c4f",
    phone: "081-901-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: false,
    recentBookings: [{ treatment: "HIFU full face", when: "25 May" }],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 13:56 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Puk",
        text: "ทำ HIFU มาเมื่อวาน วันนี้หน้าบวมนิดหน่อย ปกติมั้ยคะ",
        time: "13:56",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "บวมเล็กน้อยหลัง HIFU 24–48 ชั่วโมงแรกเป็นเรื่องปกติค่ะ ดื่มน้ำเยอะๆ และพักให้พอ จะช่วยให้ยุบเร็วขึ้นนะคะ ถ้าบวมมากผิดปกติ ปวด หรือมีไข้ แจ้งกลับมาทันทีนะคะ",
        time: "13:57",
        sources: { count: 1, label: "aftercare-hifu.md" },
      },
    ],
  },
  {
    id: "aey",
    name: "Aey · เอ๋",
    ageLabel: "18 min",
    preview: "ที่จองไว้เสาร์ ขอเปลี่ยนเป็นบ่ายสามได้มั้ย",
    badges: [{ kind: "staff", label: "Staff requested" }],
    lineId: "U4f8…6d1e",
    phone: "088-220-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: true,
    recentBookings: [{ treatment: "Brow shape", when: "30 May (booked)" }],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 13:50 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Aey",
        text: "ที่จองไว้เสาร์ ขอเปลี่ยนเป็นบ่ายสามได้มั้ยคะ",
        time: "13:50",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "รับทราบค่ะ ขอตรวจสอบคิวบ่ายสามวันเสาร์ก่อนนะคะ เดี๋ยวทีมงานจะยืนยันให้อีกครั้ง",
        time: "13:50",
      },
    ],
  },
  {
    id: "fon",
    name: "คุณฝน · Fon",
    ageLabel: "26 min",
    preview: "มีคูปองส่วนลดมั้ยคะ เพื่อนแนะนำมา",
    badges: [{ kind: "attention", label: "Needs attention" }],
    lineId: "U1a9…2f5c",
    phone: "082-334-xxxx",
    language: "Thai (TH)",
    channel: "LINE @sukhumvit-skin",
    aiPaused: false,
    recentBookings: [],
    items: [
      { kind: "day-divider", id: "d1", label: "Today · 13:42 ICT" },
      {
        kind: "message",
        id: "m1",
        sender: "customer",
        author: "Fon",
        text: "สวัสดีค่ะ เพื่อนแนะนำมา มีคูปองส่วนลดมั้ยคะ",
        time: "13:42",
      },
      {
        kind: "message",
        id: "m2",
        sender: "yuna",
        author: "Yuna",
        text: "ยินดีต้อนรับค่ะ ลูกค้าใหม่จากการแนะนำ รับส่วนลด 500 บาทสำหรับการรักษาครั้งแรกค่ะ สนใจทรีตเมนต์ไหน เดี๋ยวแนะนำให้นะคะ",
        time: "13:42",
        sources: { count: 1, label: "promotions-may.md" },
      },
    ],
  },
];

export const STAFF_NAME = "ครูภา (you)";
