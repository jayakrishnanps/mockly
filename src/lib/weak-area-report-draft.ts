export type WeakAreaReportDraft = { version: 1; source: string; id: string | null };

export const WEAK_AREA_REPORT_DRAFT_KEY = "mockly:weak-area-report-draft:v1:JK";
const WARNING = "Browser storage is unavailable. Keep a copy of your report before closing this page.";
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => DraftStorage;

export function emptyWeakAreaReportDraft(): WeakAreaReportDraft {
  return { version: 1, source: "", id: null };
}

function isDraft(value: unknown): value is WeakAreaReportDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 && typeof candidate.source === "string" && candidate.source.length <= 20000 &&
    (candidate.id === null || (candidate.source.trim().length > 0 && typeof candidate.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.id)));
}

export function loadWeakAreaReportDraft(getStorage: StorageProvider = () => window.localStorage): {
  draft: WeakAreaReportDraft; warning: string | null;
} {
  try {
    const raw = getStorage().getItem(WEAK_AREA_REPORT_DRAFT_KEY);
    if (raw === null) return { draft: emptyWeakAreaReportDraft(), warning: null };
    const value: unknown = JSON.parse(raw);
    if (isDraft(value)) return { draft: value, warning: null };
    return { draft: emptyWeakAreaReportDraft(), warning: "Your saved draft could not be read. It has not been overwritten." };
  } catch (error) {
    return {
      draft: emptyWeakAreaReportDraft(),
      warning: error instanceof SyntaxError ? "Your saved draft could not be read. It has not been overwritten." : WARNING,
    };
  }
}

export function saveWeakAreaReportDraft(draft: WeakAreaReportDraft, getStorage: StorageProvider = () => window.localStorage): string | null {
  if (!isDraft(draft)) return "This draft could not be saved.";
  try {
    getStorage().setItem(WEAK_AREA_REPORT_DRAFT_KEY, JSON.stringify(draft));
    return null;
  } catch {
    return WARNING;
  }
}
