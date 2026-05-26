import { NextResponse } from "next/server";
import { getCustomerById, resolveAttentionForCustomer } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The demo app is single-clinic and unauthenticated; staff actions are
// attributed to "Pim", the placeholder logged-in user.
const ACTOR = "Pim";

export async function POST(req: Request) {
  let body: { customerId?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const customerId = body.customerId?.trim();
  if (!customerId) {
    return new NextResponse("missing customerId", { status: 400 });
  }

  const customer = getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  const resolved = resolveAttentionForCustomer({
    customerId: customer.id,
    actor: ACTOR,
  });
  return NextResponse.json({ ok: true, resolved });
}
