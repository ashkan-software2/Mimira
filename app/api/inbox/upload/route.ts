import { NextResponse } from "next/server";
import { requireApiMember } from "@/lib/auth";
import { lineAccessibleMediaUrl, savePublicMedia } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const forbidden = await requireApiMember();
  if (forbidden) return forbidden;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse("expected multipart form data", { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return new NextResponse("missing file", { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return new NextResponse("only image uploads are supported", { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return new NextResponse("image is too large", { status: 413 });
  }

  const media = await savePublicMedia({
    bytes: Buffer.from(await file.arrayBuffer()),
    mimeType: file.type,
    kind: "image",
    folder: "chat",
  });
  const publicUrl = await lineAccessibleMediaUrl(media.url);

  return NextResponse.json({
    media,
    publicUrl,
    requiresPublicUrl: publicUrl === null,
  });
}
