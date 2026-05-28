import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
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
      access: "public",
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
