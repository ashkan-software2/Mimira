import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  bootstrapFirstOwner,
  getActiveTeamMemberByEmail,
  getTeamMemberByEmail,
  markTeamMemberActive,
  type TeamMember,
} from "@/lib/repo";

type ClerkUser = Awaited<ReturnType<typeof currentUser>>;

export type CurrentMember = {
  clerkUserId: string;
  email: string;
  member: TeamMember;
};

export function isDemoAccount(email: string): boolean {
  return email.toLowerCase().endsWith("@sukhumvit-skin.com");
}

export async function getCurrentMember(): Promise<CurrentMember | null> {
  const user = await currentUser();
  return getMemberForUser(user);
}

export async function getMemberForUser(
  user: ClerkUser
): Promise<CurrentMember | null> {
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!user || !email) {
    return null;
  }

  let member =
    (await getActiveTeamMemberByEmail(email)) ??
    (await getTeamMemberByEmail(email));

  if (!member) {
    member = await bootstrapFirstOwner({
      name: displayNameForUser(user, email),
      email: email.toLowerCase(),
    });
  }

  if (!member) {
    return null;
  }

  await markTeamMemberActive(member.id);
  return {
    clerkUserId: user.id,
    email,
    member,
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

export async function requireApiMember(): Promise<NextResponse | null> {
  const current = await getCurrentMember();
  if (current) {
    return null;
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
