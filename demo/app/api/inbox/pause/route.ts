import { NextResponse } from "next/server";
import { getCustomerById, setAiPaused } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { customerId?: string; paused?: boolean };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const customerId = body.customerId?.trim();
  if (!customerId || typeof body.paused !== "boolean") {
    return new NextResponse("missing customerId or paused", { status: 400 });
  }

  const customer = await getCustomerById(customerId);
  if (!customer) {
    return new NextResponse("not found", { status: 404 });
  }

  await setAiPaused(customer.id, body.paused);
  return NextResponse.json({ ok: true, aiPaused: body.paused });
}
