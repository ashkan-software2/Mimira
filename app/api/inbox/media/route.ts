import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireApiMember } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export async function GET(req: Request) {
  const auth = await requireApiMember();
  if (auth instanceof NextResponse) return auth;

  const src = new URL(req.url).searchParams.get("src");
  if (!src) {
    return new NextResponse("missing src", { status: 400 });
  }

  if (src.startsWith("/uploads/")) {
    return serveLocalUpload(src);
  }

  if (isBlobUrl(src)) {
    return serveBlob(src);
  }

  return new NextResponse("unsupported media source", { status: 400 });
}

async function serveLocalUpload(src: string): Promise<Response> {
  const relative = src.replace(/^\/uploads\/+/, "");
  const filePath = path.join(PUBLIC_UPLOAD_ROOT, relative);
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(PUBLIC_UPLOAD_ROOT + path.sep)) {
    return new NextResponse("invalid media path", { status: 400 });
  }

  try {
    const bytes = await readFile(normalized);
    return new Response(bytes, {
      headers: mediaHeaders(contentTypeForPath(normalized)),
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}

async function serveBlob(src: string): Promise<Response> {
  const privateBlob = await getPrivateBlob(src);
  if (privateBlob?.stream) {
    return new Response(privateBlob.stream as BodyInit, {
      headers: mediaHeaders(
        privateBlob.blob.contentType ?? contentTypeForPath(src)
      ),
    });
  }

  const publicRes = await fetch(src);
  if (!publicRes.ok || !publicRes.body) {
    return new NextResponse("not found", { status: 404 });
  }
  return new Response(publicRes.body, {
    headers: mediaHeaders(
      publicRes.headers.get("content-type") ?? contentTypeForPath(src)
    ),
  });
}

async function getPrivateBlob(src: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    return await get(src, { access: "private" });
  } catch {
    return null;
  }
}

function mediaHeaders(contentType: string): HeadersInit {
  return {
    "Cache-Control": "private, max-age=300",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
}

function contentTypeForPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
