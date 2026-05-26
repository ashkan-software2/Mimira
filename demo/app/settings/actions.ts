"use server";

import { revalidatePath } from "next/cache";
import { getDb, now } from "@/lib/db";

export async function saveBrandVoice(brandVoice: string): Promise<void> {
  getDb()
    .prepare("UPDATE settings SET brand_voice = ?, updated_at = ? WHERE id = 1")
    .run(brandVoice, now());
  revalidatePath("/settings");
}
