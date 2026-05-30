import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  bootstrapFirstOwner,
  ensureDemoTeamMember,
  getActiveTeamMemberByEmail,
  getTeamMemberByClerkUserId,
  getTeamMemberByEmail,
  linkClerkUserId,
  markTeamMemberActive,
  type TeamMember,
} from "@/lib/repo";

type ClerkUser = Awaited<ReturnType<typeof currentUser>>;

export type CurrentMember = {
  clerkUserId: string;
  email: string;
  member: TeamMember;
};

type AuthedActionOptions = {
  role?: "Owner";
};

const DEMO_EMAILS = new Set(["demo@mimira.tech"]);
const DEMO_EMAIL_SUFFIXES = ["@sukhumvit-skin.com"];

export function isDemoAccount(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    DEMO_EMAILS.has(normalized) ||
    DEMO_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

function configuredAdminEmail(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

function canBootstrapOwner(email: string): boolean {
  const adminEmail = configuredAdminEmail();
  return !adminEmail || email.toLowerCase() === adminEmail;
}

export async function getCurrentMember(): Promise<CurrentMember | null> {
  const user = await currentUser();
  return getMemberForUser(user);
}

export async function getMemberForUser(
  user: ClerkUser
): Promise<CurrentMember | null> {
  const primary = user?.primaryEmailAddress;
  const email = primary?.emailAddress;
  if (!user || !email) {
    return null;
  }

  // AG5: only ever link a *verified* primary email. An unverified address can be
  // attacker-controlled, and linking it would hand them an existing team member's
  // account (and role). Clerk normally enforces verification before sign-in, but
  // we re-check here so the lazy-link can never be the weak link.
  if (primary.verification?.status !== "verified") {
    return null;
  }

  // 1. Already bound to this Clerk account — authoritative fast path, immune to
  //    an email being reassigned to a different person later.
  let member = await getTeamMemberByClerkUserId(user.id);

  // 2. Not yet bound: match the invited row by case-insensitive email and claim
  //    it for this Clerk account. linkClerkUserId is guarded + idempotent, so two
  //    concurrent sign-ins can't re-point the row, and the unique index backstops.
  if (!member) {
    member =
      (await getActiveTeamMemberByEmail(email)) ??
      (await getTeamMemberByEmail(email));
    if (member) {
      await linkClerkUserId(member.id, user.id);
    }
  }

  // 3. No row at all: bootstrap the very first owner, then bind it.
  if (!member) {
    if (isDemoAccount(email)) {
      member = await ensureDemoTeamMember({
        name: displayNameForUser(user, email),
        email: email.toLowerCase(),
      });
      if (member) {
        await linkClerkUserId(member.id, user.id);
      }
    } else if (!canBootstrapOwner(email)) {
      return null;
    } else {
      member = await bootstrapFirstOwner({
        name: displayNameForUser(user, email),
        email: email.toLowerCase(),
      });
      if (member) {
        await linkClerkUserId(member.id, user.id);
      }
    }
  }

  if (!member) {
    return null;
  }

  await markTeamMemberActive(member.id);
  return {
    clerkUserId: user.id,
    email,
    // Reflect the freshly-claimed link so callers (e.g. AG13 actor) see a real
    // clerk_user_id even on the first sign-in that performed the bind.
    member: { ...member, clerk_user_id: user.id },
  };
}

export async function requireMember(): Promise<CurrentMember> {
  const current = await getCurrentMember();
  if (!current) {
    throw new Error("Signed-in user is not an active Mimira team member");
  }
  return current;
}

export async function requireOwner(): Promise<CurrentMember> {
  const current = await requireMember();
  if (current.member.role !== "Owner") {
    throw new Error("Signed-in user is not a Mimira Owner");
  }
  return current;
}

export function withAuthedAction<Args extends unknown[], Result>(
  handler: (current: CurrentMember, ...args: Args) => Promise<Result>,
  options: AuthedActionOptions = {}
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    const current =
      options.role === "Owner" ? await requireOwner() : await requireMember();
    return handler(current, ...args);
  };
}

export async function requireApiMember(): Promise<CurrentMember | NextResponse> {
  const current = await getCurrentMember();
  if (current) {
    return current;
  }
  return NextResponse.json(
    { ok: false, error: "Forbidden" },
    { status: 403 }
  );
}

function displayNameForUser(user: NonNullable<ClerkUser>, email: string): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || email.split("@")[0] || "Owner";
}
