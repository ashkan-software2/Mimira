import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueSignedToken, presignUrl, put } from "@vercel/blob";
import { uuid } from "./db";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type ChatMedia = {
  kind: "image" | "video";
  url: string;
  mimeType: string;
  fileName: string;
};

export function mediaExt(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? "bin";
}

export function absolutePublicUrl(relativeUrl: string): string | null {
  try {
    return new URL(relativeUrl).toString();
  } catch {
    // Relative URL; resolve it against the configured public app origin below.
  }

  const configured =
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!configured) return null;
  try {
    return new URL(relativeUrl, configured).toString();
  } catch {
    return null;
  }
}

export function protectedMediaUrl(url: string): string {
  if (url.startsWith("/api/inbox/media?")) {
    return url;
  }
  return `/api/inbox/media?src=${encodeURIComponent(url)}`;
}

export async function lineAccessibleMediaUrl(url: string): Promise<string | null> {
  if (process.env.BLOB_READ_WRITE_TOKEN && isBlobUrl(url)) {
    const validUntil = Date.now() + 10 * 60_000;
    const token = await issueSignedToken({
      pathname: pathnameFromBlobUrl(url),
      operations: ["get"],
      validUntil,
    });
    const { presignedUrl } = await presignUrl(token, {
      access: "private",
      operation: "get",
      pathname: pathnameFromBlobUrl(url),
      validUntil,
    });
    return presignedUrl;
  }

  return absolutePublicUrl(url);
}

export async function savePublicMedia(args: {
  bytes: Buffer;
  mimeType: string;
  kind: "image" | "video";
  folder: string;
}): Promise<ChatMedia> {
  const ext = mediaExt(args.mimeType);
  const fileName = `${uuid()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`uploads/${args.folder}/${fileName}`, args.bytes, {
      access: "private",
      contentType: args.mimeType,
    });
    return {
      kind: args.kind,
      url: blob.url,
      mimeType: args.mimeType,
      fileName,
    };
  }

  const dir = path.join(UPLOAD_ROOT, args.folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), args.bytes);
  return {
    kind: args.kind,
    url: `/uploads/${args.folder}/${fileName}`,
    mimeType: args.mimeType,
    fileName,
  };
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

function pathnameFromBlobUrl(url: string): string {
  return new URL(url).pathname.replace(/^\/+/, "");
}
