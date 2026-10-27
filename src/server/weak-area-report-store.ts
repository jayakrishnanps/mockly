import { and, arrayContains, desc, eq, isNull } from "drizzle-orm";
import type { db } from "../db/index";
import { tests, weakAreaReports } from "../db/schema.ts";
import { isRecord, isUuid } from "../lib/mock-validation.ts";
import { validateWeakAreaReportInput, type SavedWeakAreaReport, type WeakAreaReportInput } from "../lib/weak-area-report.ts";

export class WeakAreaReportError extends Error {
  code: "invalid" | "not-found" | "conflict";
  constructor(code: WeakAreaReportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function readReport(row: typeof weakAreaReports.$inferSelect): SavedWeakAreaReport {
  const checked = validateWeakAreaReportInput({ sourceTestId: row.sourceTestId, areas: row.areas });
  const timestamp = Date.parse(row.importedAt);
  if (!checked.ok || !isUuid(row.id) || typeof row.sourceTitle !== "string" ||
      !row.sourceTitle.trim() || row.sourceTitle.length > 200 || !Number.isFinite(timestamp)) {
    throw new WeakAreaReportError("invalid", "This saved report could not be read.");
  }
  return {
    id: row.id.toLowerCase(), sourceTestId: checked.value.sourceTestId,
    sourceTitle: row.sourceTitle, areas: checked.value.areas,
    importedAt: new Date(timestamp).toISOString(),
  };
}

function matchSaved(row: typeof weakAreaReports.$inferSelect, input: WeakAreaReportInput) {
  const saved = readReport(row);
  if (saved.sourceTestId !== input.sourceTestId || JSON.stringify(saved.areas) !== JSON.stringify(input.areas)) {
    throw new WeakAreaReportError("conflict", "This save ID already belongs to a different report. Your draft has been kept.");
  }
  return { id: saved.id };
}

export function createWeakAreaReportStore(database: typeof db) {
  return {
    async list(): Promise<SavedWeakAreaReport[]> {
      const rows = await database.select().from(weakAreaReports)
        .orderBy(desc(weakAreaReports.importedAt), desc(weakAreaReports.id));
      return rows.map(readReport);
    },

    async save(input: unknown): Promise<{ id: string }> {
      if (!isRecord(input) || !isUuid(input.id)) {
        throw new WeakAreaReportError("invalid", "This report save is invalid. Your draft has been kept.");
      }
      const checked = validateWeakAreaReportInput({ sourceTestId: input.sourceTestId, areas: input.areas });
      if (!checked.ok) throw new WeakAreaReportError("invalid", checked.error);
      const id = input.id.toLowerCase();

      return database.transaction(async (tx) => {
        const [previous] = await tx.select().from(weakAreaReports).where(eq(weakAreaReports.id, id));
        if (previous) return matchSaved(previous, checked.value);

        const [source] = await tx.select({ id: tests.id, title: tests.title }).from(tests)
          .where(and(eq(tests.id, checked.value.sourceTestId), arrayContains(tests.forUsers, ["JK"]), isNull(tests.deletedAt)))
          .for("share");
        if (!source) throw new WeakAreaReportError("not-found", "This mock is no longer available for JK. Your report has been kept.");

        await tx.insert(weakAreaReports).values({
          id, sourceTestId: source.id, sourceTitle: source.title, areas: checked.value.areas,
        }).onConflictDoNothing({ target: weakAreaReports.id });
        const [saved] = await tx.select().from(weakAreaReports).where(eq(weakAreaReports.id, id));
        if (!saved) throw new WeakAreaReportError("not-found", "This report could not be saved. Your draft has been kept.");
        return matchSaved(saved, checked.value);
      });
    },

    async remove(id: string): Promise<void> {
      if (!isUuid(id)) throw new WeakAreaReportError("invalid", "This report ID is invalid.");
      await database.delete(weakAreaReports).where(eq(weakAreaReports.id, id.toLowerCase()));
    },
  };
}
