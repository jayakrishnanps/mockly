import { and, arrayContains, desc, eq, isNull } from "drizzle-orm";
import type { db } from "../db/index";
import { heWeakReports, tests } from "../db/schema.ts";
import { isRecord, isUuid } from "../lib/mock-validation.ts";
import { validateHEWeakReportInput, type HEWeakReportInput, type SavedHEWeakReport } from "../lib/he-weak-report.ts";

export class HEWeakReportError extends Error {
  code: "invalid" | "not-found" | "conflict";
  constructor(code: HEWeakReportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function readReport(row: typeof heWeakReports.$inferSelect): SavedHEWeakReport {
  const checked = validateHEWeakReportInput({
    sourceTestId: row.sourceTestId, title: row.title,
    explanation: row.explanation, practice: row.practice,
  });
  const timestamp = Date.parse(row.importedAt);
  if (!checked.ok || !isUuid(row.id) || typeof row.sourceTitle !== "string" ||
      !row.sourceTitle.trim() || row.sourceTitle.length > 200 || !Number.isFinite(timestamp)) {
    throw new HEWeakReportError("invalid", "This saved HE note could not be read.");
  }
  return {
    ...checked.value, id: row.id.toLowerCase(), sourceTitle: row.sourceTitle,
    importedAt: new Date(timestamp).toISOString(),
  };
}

function matchSaved(row: typeof heWeakReports.$inferSelect, input: HEWeakReportInput) {
  const saved = readReport(row);
  if (saved.sourceTestId !== input.sourceTestId || saved.title !== input.title ||
      saved.explanation !== input.explanation || saved.practice !== input.practice) {
    throw new HEWeakReportError("conflict", "This save ID already belongs to a different HE note. Your draft has been kept.");
  }
  return { id: saved.id };
}

export function createHEWeakReportStore(database: typeof db) {
  return {
    async list(): Promise<SavedHEWeakReport[]> {
      const rows = await database.select().from(heWeakReports)
        .orderBy(desc(heWeakReports.importedAt), desc(heWeakReports.id));
      return rows.map(readReport);
    },

    async save(input: unknown): Promise<{ id: string }> {
      if (!isRecord(input) || !isUuid(input.id) ||
          Object.keys(input).some((key) => !["id", "sourceTestId", "title", "explanation", "practice"].includes(key))) {
        throw new HEWeakReportError("invalid", "This HE note save is invalid. Your draft has been kept.");
      }
      const checked = validateHEWeakReportInput({
        sourceTestId: input.sourceTestId, title: input.title,
        explanation: input.explanation, practice: input.practice,
      });
      if (!checked.ok) throw new HEWeakReportError("invalid", checked.error);
      const id = input.id.toLowerCase();

      return database.transaction(async (tx) => {
        const [previous] = await tx.select().from(heWeakReports).where(eq(heWeakReports.id, id));
        if (previous) return matchSaved(previous, checked.value);

        const [source] = await tx.select({ id: tests.id, title: tests.title }).from(tests)
          .where(and(eq(tests.id, checked.value.sourceTestId), arrayContains(tests.forUsers, ["HE"]), isNull(tests.deletedAt)))
          .for("share");
        if (!source) throw new HEWeakReportError("not-found", "This mock is no longer available for HE. Your draft has been kept.");

        await tx.insert(heWeakReports).values({
          ...checked.value, id, sourceTitle: source.title,
        }).onConflictDoNothing({ target: heWeakReports.id });
        const [saved] = await tx.select().from(heWeakReports).where(eq(heWeakReports.id, id));
        if (!saved) throw new HEWeakReportError("not-found", "This HE note could not be saved. Your draft has been kept.");
        return matchSaved(saved, checked.value);
      });
    },

    async remove(id: string): Promise<void> {
      if (!isUuid(id)) throw new HEWeakReportError("invalid", "This HE note ID is invalid.");
      await database.delete(heWeakReports).where(eq(heWeakReports.id, id.toLowerCase()));
    },

    async clearAll(): Promise<void> {
      await database.delete(heWeakReports);
    },
  };
}
