"use server";

import { revalidatePath } from "next/cache";
import { isUuid, validateSaveInput, type MetadataErrors } from "@/lib/mock-validation";
import { mockStore } from "@/server/mocks";
import { MockStoreError } from "@/server/mock-store";

export type SaveResult =
  | { ok: true; id: string; forUsers: string[] }
  | { ok: false; error: string; fields?: MetadataErrors; existingId?: string };

function refreshMocks(id: string) {
  revalidatePath("/u/JK");
  revalidatePath("/u/HE");
  revalidatePath(`/test/${id}`);
  revalidatePath("/studio");
}

export async function saveMock(input: unknown): Promise<SaveResult> {
  const validation = validateSaveInput(input);
  if (validation.value === null) return { ok: false, error: validation.error, fields: validation.fields };
  let saved;
  try {
    saved = await mockStore.save(validation.value);
  } catch (error) {
    if (error instanceof MockStoreError) return {
      ok: false, error: error.message,
      existingId: error.code === "conflict" ? validation.value.testId : undefined,
    };
    return { ok: false, error: "The mock could not be saved. Your entire draft has been kept. Please retry." };
  }
  refreshMocks(saved.id);
  return { ok: true, id: saved.id, forUsers: saved.forUsers };
}

export async function deleteMock(id: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUuid(id)) return { ok: false, error: "This mock ID is invalid." };
  try {
    await mockStore.remove(id);
  } catch {
    return { ok: false, error: "The mock could not be deleted. Please try again." };
  }
  refreshMocks(id);
  return { ok: true };
}
