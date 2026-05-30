import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  after: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("next/server", async (importActual) => {
  const actual = await importActual<typeof import("next/server")>();
  return {
    ...actual,
    after: hooks.after,
  };
});

vi.mock("@/lib/repo", () => ({
  getCustomerByLineId: vi.fn(),
  getSettings: hooks.getSettings,
  insertMessage: vi.fn(),
  updateSettings: hooks.updateSettings,
  upsertCustomer: vi.fn(),
}));

vi.mock("@/lib/outbound", () => ({
  gateOutboundMessage: vi.fn(),
  recordOutboundMessage: vi.fn(),
}));

vi.mock("@/lib/pipeline", () => ({
  runChatPipeline: vi.fn(),
}));

vi.mock("@/lib/media", () => ({
  savePublicMedia: vi.fn(),
}));

vi.mock("@/lib/settings-runtime", () => ({
  lineDestinationMatches: vi.fn(() => true),
}));

const secret = "line-secret";

function signedRequest(raw: string, signature = sign(raw)): Request {
  return new Request("https://mimira.test/api/line/webhook", {
    method: "POST",
    body: raw,
    headers: { "x-line-signature": signature },
  });
}

function sign(raw: string): string {
  return createHmac("sha256", secret).update(raw, "utf8").digest("base64");
}

describe("LINE webhook auth regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_CHANNEL_SECRET = secret;
    hooks.getSettings.mockResolvedValue({
      line: { channel_id: "line-bot", channel_secret: secret },
    });
    hooks.updateSettings.mockImplementation(async (_section, patch) => ({
      line: { channel_id: patch.channel_id },
    }));
  });

  it("rejects requests with an invalid LINE signature", async () => {
    const { POST } = await import("./route");
    const raw = JSON.stringify({ events: [] });

    const res = await POST(signedRequest(raw, "bad-signature"));

    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("bad signature");
    expect(hooks.getSettings).toHaveBeenCalledOnce();
    expect(hooks.after).not.toHaveBeenCalled();
  });

  it("accepts a valid LINE webhook without requiring Clerk membership", async () => {
    const { POST } = await import("./route");
    const raw = JSON.stringify({
      destination: "line-bot",
      events: [
        {
          type: "message",
          replyToken: "reply-token",
          source: { type: "user", userId: "U123" },
          message: { type: "text", id: "msg-1", text: "hello" },
        },
      ],
    });

    const res = await POST(signedRequest(raw));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(hooks.getSettings).toHaveBeenCalledOnce();
    expect(hooks.after).toHaveBeenCalledOnce();
  });
});
