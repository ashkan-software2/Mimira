import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API = "https://api.line.me";

function channelSecret(): string {
  const v = process.env.LINE_CHANNEL_SECRET;
  if (!v) throw new Error("LINE_CHANNEL_SECRET is not set");
  return v;
}

function channelAccessToken(): string {
  const v = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!v) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return v;
}

/**
 * Verify HMAC-SHA256 signature on the raw request body, base64-compared to
 * the X-Line-Signature header. LINE rejects webhooks that don't verify, so
 * this is mandatory even for the demo.
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret())
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type LineTextMessage = { type: "text"; text: string };
type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

async function lineFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${LINE_API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${channelAccessToken()}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE ${path} ${res.status}: ${body}`);
  }
  return res;
}

export async function replyText(replyToken: string, text: string): Promise<void> {
  const messages: LineTextMessage[] = [{ type: "text", text }];
  await lineFetch("/v2/bot/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function pushText(toUserId: string, text: string): Promise<void> {
  const messages: LineTextMessage[] = [{ type: "text", text }];
  await lineFetch("/v2/bot/message/push", {
    method: "POST",
    body: JSON.stringify({ to: toUserId, messages }),
  });
}

export async function pushImage(
  toUserId: string,
  originalContentUrl: string,
  previewImageUrl: string
): Promise<void> {
  const messages: LineImageMessage[] = [
    { type: "image", originalContentUrl, previewImageUrl },
  ];
  await lineFetch("/v2/bot/message/push", {
    method: "POST",
    body: JSON.stringify({ to: toUserId, messages }),
  });
}

export async function getMessageContent(messageId: string): Promise<{
  contentType: string;
  data: Buffer;
}> {
  const res = await fetch(`${LINE_API}/v2/bot/message/${messageId}/content`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${channelAccessToken()}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE content ${messageId} ${res.status}: ${body}`);
  }
  const contentType =
    res.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  return {
    contentType,
    data: Buffer.from(await res.arrayBuffer()),
  };
}

export type LineProfile = {
  displayName: string;
  userId: string;
  pictureUrl?: string;
  language?: string;
};

export async function getProfile(userId: string): Promise<LineProfile | null> {
  try {
    const res = await lineFetch(`/v2/bot/profile/${userId}`, { method: "GET" });
    return (await res.json()) as LineProfile;
  } catch {
    return null;
  }
}

export const APOLOGY_THAI =
  "ขอบคุณที่ส่งข้อมูลมานะคะ ขณะนี้ Yuna ยังไม่สามารถดูภาพ/สติกเกอร์/เสียงได้ค่ะ ทีมงานจะเข้ามาช่วยดูให้นะคะ 🙏";
