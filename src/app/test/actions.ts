"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUser } from "@/lib/users";
import { mockStore } from "@/server/mocks";

function refreshMocks(id: string) {
  revalidatePath("/u/JK");
  revalidatePath("/u/HE");
  revalidatePath(`/test/${id}`);
}

export async function deleteMock(id: unknown, expectedUser: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(id)) return { ok: false, error: "This mock ID is invalid." };
  if (!isUser(expectedUser)) return { ok: false, error: "Choose a person before deleting a mock." };
  const user = await getRememberedUserFromCookies();
  if (user !== expectedUser) return { ok: false, error: "The selected person has changed. Reload this page before deleting the mock." };
  try {
    await mockStore.remove(id.toLowerCase(), user);
  } catch {
    return { ok: false, error: "The mock could not be deleted. Please try again." };
  }
  refreshMocks(id);
  revalidatePath("/u/JK/history");
  revalidatePath("/u/HE/history");
  revalidatePath("/u/JK/weak-areas");
  revalidatePath("/u/HE/weak-areas");
  revalidatePath("/result/[attemptId]", "page");
  revalidatePath("/exam/[attemptId]", "page");
  return { ok: true };
}
