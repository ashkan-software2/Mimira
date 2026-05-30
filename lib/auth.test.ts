import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repo = vi.hoisted(() => ({
  bootstrapFirstOwner: vi.fn(),
  ensureDemoTeamMember: vi.fn(),
  getActiveTeamMemberByEmail: vi.fn(),
  getTeamMemberByClerkUserId: vi.fn(),
  getTeamMemberByEmail: vi.fn(),
  linkClerkUserId: vi.fn(),
  markTeamMemberActive: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

vi.mock("@/lib/repo", () => repo);

describe("auth demo account access", () => {
  it("recognizes demo@mimira.tech as a demo account", async () => {
    const { isDemoAccount } = await import("./auth");

    expect(isDemoAccount("demo@mimira.tech")).toBe(true);
    expect(isDemoAccount("DEMO@MIMIRA.TECH")).toBe(true);
    expect(isDemoAccount("pim@sukhumvit-skin.com")).toBe(true);
    expect(isDemoAccount("owner@example.com")).toBe(false);
  });

  it("creates and links a verified demo Clerk user without bootstrapping the real owner", async () => {
    const member = {
      id: "member-demo",
      name: "Demo",
      email: "demo@mimira.tech",
      role: "Owner" as const,
      pending: false,
      last_active_at: null,
      created_at: 1,
      clerk_user_id: null,
    };
    repo.getTeamMemberByClerkUserId.mockResolvedValue(null);
    repo.getActiveTeamMemberByEmail.mockResolvedValue(null);
    repo.getTeamMemberByEmail.mockResolvedValue(null);
    repo.ensureDemoTeamMember.mockResolvedValue(member);

    const { getMemberForUser } = await import("./auth");

    const current = await getMemberForUser({
      id: "clerk-demo",
      firstName: "Demo",
      lastName: null,
      primaryEmailAddress: {
        emailAddress: "demo@mimira.tech",
        verification: { status: "verified" },
      },
    } as never);

    expect(repo.ensureDemoTeamMember).toHaveBeenCalledWith({
      name: "Demo",
      email: "demo@mimira.tech",
    });
    expect(repo.bootstrapFirstOwner).not.toHaveBeenCalled();
    expect(repo.linkClerkUserId).toHaveBeenCalledWith(
      "member-demo",
      "clerk-demo"
    );
    expect(repo.markTeamMemberActive).toHaveBeenCalledWith("member-demo");
    expect(current?.member.clerk_user_id).toBe("clerk-demo");
  });
});
