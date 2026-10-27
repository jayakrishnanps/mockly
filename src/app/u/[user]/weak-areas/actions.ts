"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { WeakAreaReportError } from "@/server/weak-area-report-store";
import { weakAreaReportStore } from "@/server/weak-area-reports";

export type WeakAreaActionResult = { ok: true; id: string } | { ok: false; error: string; uncertain?: true };

function failure(error: unknown): WeakAreaActionResult {
  if (error instanceof WeakAreaReportError) return { ok: false, error: error.message };
  return { ok: false, uncertain: true, error: "The change could not be confirmed. Your report is kept; please retry." };
}

export async function saveWeakAreaReport(input: unknown): Promise<WeakAreaActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return { ok: false, error: "Switch to JK to save a report." };
  let saved;
  try { saved = await weakAreaReportStore.save(input); }
  catch (error) { return failure(error); }
  revalidatePath("/u/JK/weak-areas");
  return { ok: true, id: saved.id };
}

export async function deleteWeakAreaReport(id: unknown): Promise<WeakAreaActionResult> {
  if (await getRememberedUserFromCookies() !== "JK") return { ok: false, error: "Switch to JK to delete a report." };
  if (!isUuid(id)) return { ok: false, error: "This report ID is invalid." };
  try { await weakAreaReportStore.remove(id.toLowerCase()); }
  catch (error) { return failure(error); }
  revalidatePath("/u/JK/weak-areas");
  return { ok: true, id };
}
