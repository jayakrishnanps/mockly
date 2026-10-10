"use server";

import { revalidatePath } from "next/cache";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUuid } from "@/lib/mock-validation";
import { validateBankAppend, validateBankMock, validateBankTitle } from "@/lib/bank-validation";
import { bankStore } from "@/server/banks";
import { BankStoreError } from "@/server/bank-store";

export type BankActionResult = { ok: true; id: string } | { ok: false; error: string; uncertain?: true };

const denied: BankActionResult = { ok: false, error: "Switch to JK to manage question banks." };

function failure(error: unknown): BankActionResult {
  if (error instanceof BankStoreError) return { ok: false, error: error.message };
  return { ok: false, uncertain: true, error: "The change could not be confirmed. Your draft has been kept; please retry." };
}

function refreshBank(id: string) {
  revalidatePath("/u/JK/bank");
  revalidatePath(`/u/JK/bank/${id}`);
  revalidatePath("/test/[id]", "page");
}

export async function createBank(input: unknown): Promise<BankActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return denied;
  const checked = validateBankTitle(input);
  if (!checked.value) return { ok: false, error: checked.error };
  let saved;
  try { saved = await bankStore.create(checked.value); }
  catch (error) { return failure(error); }
  refreshBank(saved.id);
  return { ok: true, id: saved.id };
}

export async function appendBankQuestions(input: unknown): Promise<BankActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return denied;
  const checked = validateBankAppend(input);
  if (!checked.value) return { ok: false, error: checked.error };
  let saved;
  try { saved = await bankStore.append(checked.value); }
  catch (error) { return failure(error); }
  refreshBank(saved.id);
  return { ok: true, id: saved.id };
}

export async function createBankMock(input: unknown): Promise<BankActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return denied;
  const checked = validateBankMock(input);
  if (!checked.value) return { ok: false, error: checked.error };
  let saved;
  try { saved = await bankStore.createMock(checked.value); }
  catch (error) { return failure(error); }
  revalidatePath("/u/JK");
  revalidatePath("/u/HE");
  revalidatePath(`/test/${saved.id}`);
  return { ok: true, id: saved.id };
}

export async function deleteBank(id: unknown): Promise<BankActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return denied;
  if (!isUuid(id)) return { ok: false, error: "This question bank ID is invalid." };
  try { await bankStore.remove(id.toLowerCase()); }
  catch (error) { return failure(error); }
  refreshBank(id);
  revalidatePath("/u/JK");
  revalidatePath("/u/HE");
  revalidatePath("/u/JK/history");
  revalidatePath("/u/HE/history");
  revalidatePath("/exam/[attemptId]", "page");
  revalidatePath("/result/[attemptId]", "page");
  revalidatePath("/studio");
  return { ok: true, id };
}
