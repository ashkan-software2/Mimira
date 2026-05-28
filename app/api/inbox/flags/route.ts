import { NextResponse } from "next/server";
import {
  addFlagToCustomer,
  getCustomerById,
  PRESET_FLAGS,
  removeFlagFromCustomer,
  resolveAttentionForCustomer,
} from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-clinic demo; staff actions are attributed to "Pim".
const ACTOR = "Pim";

const ALLOWED: ReadonlySet<string> = new Set(PRESET_FLAGS);

export async function POST(req: Request) {
  let body: { customerId?: string; flag?: string; on?: boolean };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const customerId = body.customerId?.trim();
  const flag = body.flag?.trim();
  if (!customerId || !flag || typeof body.on !== "boolean") {
    return new NextResponse("missing customerId, flag, or on", { status: 400 });
  }
  if (!ALLOWED.has(flag)) {
    return new NextResponse(`unknown flag '${flag}'`, { status: 400 });
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  const flags = body.on
    ? await addFlagToCustomer(customer.id, flag)
    : await removeFlagFromCustomer(customer.id, flag);

  // Marking the thread Addressed is the "I'm done with this" signal — also
  // resolve any open per-message attention flags so the inbox stops nudging.
  let resolvedMessages = 0;
  if (flag === "Addressed" && body.on) {
    resolvedMessages = await resolveAttentionForCustomer({
      customerId: customer.id,
      actor: ACTOR,
    });
  }

  return NextResponse.json({ ok: true, flags, resolvedMessages });
}
