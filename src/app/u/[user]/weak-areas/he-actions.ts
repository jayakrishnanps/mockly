"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { HEWeakReportError } from "@/server/he-weak-report-store";
import { heWeakReportStore } from "@/server/he-weak-reports";

type HEChangeResult = { ok: true } | { ok: false; error: string };
type HESaveResult = { ok: true; id: string } | { ok: false; error: string };

function failure(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof HEWeakReportError ? error.message : "The change could not be confirmed. Please retry." };
}

export async function saveHEWeakReport(input: unknown): Promise<HESaveResult> {
  if (await getRememberedUserFromCookies() !== "JK") return { ok: false, error: "Switch to JK to save HE's notes." };
  let saved;
  try { saved = await heWeakReportStore.save(input); }
  catch (error) { return failure(error); }
  revalidatePath("/u/HE/weak-areas");
  return { ok: true, id: saved.id };
}

export async function deleteHEWeakReport(id: unknown): Promise<HEChangeResult> {
  if (await getRememberedUserFromCookies() !== "HE") return { ok: false, error: "Switch to HE to delete these notes." };
  if (!isUuid(id)) return { ok: false, error: "These notes have an invalid ID." };
  try { await heWeakReportStore.remove(id.toLowerCase()); }
  catch (error) { return failure(error); }
  revalidatePath("/u/HE/weak-areas");
  return { ok: true };
}

export async function clearHEWeakReports(): Promise<HEChangeResult> {
  if (await getRememberedUserFromCookies() !== "HE") return { ok: false, error: "Switch to HE to clear these notes." };
  try { await heWeakReportStore.clearAll(); }
  catch (error) { return failure(error); }
  revalidatePath("/u/HE/weak-areas");
  return { ok: true };
}
