"use server";

import { revalidatePath } from "next/cache";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUser } from "@/lib/users";
import { attemptStore } from "@/server/attempts";

export async function clearHistory(user: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUser(user) || await getRememberedUserFromCookies() !== user) {
    return { ok: false, error: "Your selected user has changed. Choose your identity again before clearing history." };
  }

  try {
    await attemptStore.clearUserHistory(user);
  } catch {
    return { ok: false, error: "History could not be cleared. Please try again." };
  }

  revalidatePath(`/u/${user}/history`);
  revalidatePath(`/u/${user}`);
  revalidatePath("/test/[id]", "page");
  revalidatePath("/result/[attemptId]", "page");
  return { ok: true };
}
