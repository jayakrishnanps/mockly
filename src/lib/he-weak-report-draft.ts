import { isRecord, isUuid } from "./mock-validation.ts";
import { MAX_HE_WEAK_REPORT_LENGTH } from "./he-weak-report.ts";

export type HEWeakReportDraft = { version: 1; source: string; id: string | null };
export const HE_WEAK_REPORT_DRAFT_KEY = "mockly:he-weak-report-draft:v1:JK";
const WARNING = "Browser storage is unavailable. Keep a copy of your HE report before closing this page.";
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => DraftStorage;

export function emptyHEWeakReportDraft(): HEWeakReportDraft {
  return { version: 1, source: "", id: null };
}

function isDraft(value: unknown): value is HEWeakReportDraft {
  return isRecord(value) && value.version === 1 && typeof value.source === "string" &&
    value.source.length <= MAX_HE_WEAK_REPORT_LENGTH &&
    (value.id === null || (value.source.trim().length > 0 && isUuid(value.id)));
}

export function loadHEWeakReportDraft(getStorage: StorageProvider = () => window.localStorage): { draft: HEWeakReportDraft; warning: string | null } {
  try {
    const raw = getStorage().getItem(HE_WEAK_REPORT_DRAFT_KEY);
    if (raw === null) return { draft: emptyHEWeakReportDraft(), warning: null };
    const value: unknown = JSON.parse(raw);
    if (isDraft(value)) return { draft: value, warning: null };
    return { draft: emptyHEWeakReportDraft(), warning: "Your saved HE draft could not be read. It has not been overwritten." };
  } catch (error) {
    return { draft: emptyHEWeakReportDraft(), warning: error instanceof SyntaxError ? "Your saved HE draft could not be read. It has not been overwritten." : WARNING };
  }
}

export function saveHEWeakReportDraft(draft: HEWeakReportDraft, getStorage: StorageProvider = () => window.localStorage): string | null {
  if (!isDraft(draft)) return "This HE draft could not be saved.";
  try {
    getStorage().setItem(HE_WEAK_REPORT_DRAFT_KEY, JSON.stringify(draft));
    return null;
  } catch {
    return WARNING;
  }
}
