import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireApiMember: vi.fn(async () =>
    NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  ),
}));

const routes = [
  {
    label: "GET /api/inbox/list",
    importRoute: () => import("./list/route"),
    call: (route: typeof import("./list/route")) => route.GET(),
  },
  {
    label: "GET /api/inbox/thread",
    importRoute: () => import("./thread/route"),
    call: (route: typeof import("./thread/route")) =>
      route.GET(new Request("https://mimira.test/api/inbox/thread")),
  },
  {
    label: "GET /api/inbox/media",
    importRoute: () => import("./media/route"),
    call: (route: typeof import("./media/route")) =>
      route.GET(new Request("https://mimira.test/api/inbox/media")),
  },
  {
    label: "POST /api/inbox/reply",
    importRoute: () => import("./reply/route"),
    call: (route: typeof import("./reply/route")) =>
      route.POST(
        new Request("https://mimira.test/api/inbox/reply", {
          method: "POST",
          body: JSON.stringify({}),
        })
      ),
  },
  {
    label: "POST /api/inbox/pause",
    importRoute: () => import("./pause/route"),
    call: (route: typeof import("./pause/route")) =>
      route.POST(
        new Request("https://mimira.test/api/inbox/pause", {
          method: "POST",
          body: JSON.stringify({}),
        })
      ),
  },
  {
    label: "POST /api/inbox/flags",
    importRoute: () => import("./flags/route"),
    call: (route: typeof import("./flags/route")) =>
      route.POST(
        new Request("https://mimira.test/api/inbox/flags", {
          method: "POST",
          body: JSON.stringify({}),
        })
      ),
  },
  {
    label: "POST /api/inbox/upload",
    importRoute: () => import("./upload/route"),
    call: (route: typeof import("./upload/route")) =>
      route.POST(
        new Request("https://mimira.test/api/inbox/upload", {
          method: "POST",
          body: new FormData(),
        })
      ),
  },
] as const;

describe("/api/inbox auth gate", () => {
  it.each(routes)("$label returns 403 before route validation", async (entry) => {
    const route = await entry.importRoute();
    const res = await entry.call(route as never);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Forbidden",
    });
  });
});
