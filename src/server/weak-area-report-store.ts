import { and, arrayContains, desc, eq, isNull } from "drizzle-orm";
import type { db } from "../db/index";
import { tests, weakAreaReports } from "../db/schema.ts";
import { isRecord, isUuid } from "../lib/mock-validation.ts";
import { normalizeWeakAreaSubtaskText, validateSavedWeakAreaReportInput, validateWeakAreaReportInput, type SavedWeakAreaReport, type WeakArea, type WeakAreaReportInput, type WeakAreaSubject } from "../lib/weak-area-report.ts";

export class WeakAreaReportError extends Error {
  code: "invalid" | "not-found" | "conflict";
  constructor(code: WeakAreaReportError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function readReport(row: typeof weakAreaReports.$inferSelect): SavedWeakAreaReport {
  const checked = validateSavedWeakAreaReportInput({ sourceTestId: row.sourceTestId, areas: row.areas });
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
  function definitions(areas: WeakArea[]) {
    return JSON.stringify(areas.map((area) => ({
      subject: area.subject, area: area.area, focus: area.focus, priority: area.priority,
      subtasks: area.subtasks?.map((subtask) => subtask.text),
    })));
  }
  if (saved.sourceTestId !== input.sourceTestId || definitions(saved.areas) !== definitions(input.areas)) {
    throw new WeakAreaReportError("conflict", "This save ID already belongs to a different report. Your draft has been kept.");
  }
  return { id: saved.id };
}

function readAreaTarget(input: unknown, extraKeys: readonly string[]): { reportId: string; subject: WeakAreaSubject; area: string } {
  if (!isRecord(input) || !isUuid(input.reportId) ||
      Object.keys(input).some((key) => !["reportId", "subject", "area", ...extraKeys].includes(key))) {
    throw new WeakAreaReportError("invalid", "This weak area could not be identified. Reload the page and try again.");
  }
  const checked = validateWeakAreaReportInput({
    sourceTestId: input.reportId,
    areas: [{ subject: input.subject, area: input.area, focus: "Accuracy", priority: "Low" }],
  });
  if (!checked.ok) throw new WeakAreaReportError("invalid", checked.error);
  const target = checked.value.areas[0];
  return { reportId: input.reportId.toLowerCase(), subject: target.subject, area: target.area };
}

function matchesArea(area: WeakArea, target: { subject: WeakAreaSubject; area: string }): boolean {
  return area.subject === target.subject && area.area.toLowerCase() === target.area.toLowerCase();
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

    async removeArea(input: unknown): Promise<void> {
      const target = readAreaTarget(input, []);

      await database.transaction(async (tx) => {
        const [row] = await tx.select().from(weakAreaReports)
          .where(eq(weakAreaReports.id, target.reportId)).for("update");
        if (!row) return;
        const saved = readReport(row);
        const selected = saved.areas.find((area) => matchesArea(area, target));
        if (!selected) return;
        if (selected.subtasks?.some((subtask) => !subtask.completed)) {
          throw new WeakAreaReportError("conflict", "Complete every practice step before checking off this weak area.");
        }
        const remaining = saved.areas.filter((area) => !matchesArea(area, target));
        await tx.update(weakAreaReports).set({ areas: remaining }).where(eq(weakAreaReports.id, target.reportId));
      });
    },

    async setSubtask(input: unknown): Promise<WeakArea> {
      const target = readAreaTarget(input, ["subtask", "completed"]);
      if (!isRecord(input) || typeof input.completed !== "boolean") {
        throw new WeakAreaReportError("invalid", "Choose whether this practice step is complete.");
      }
      const subtaskText = normalizeWeakAreaSubtaskText(input.subtask);
      if (!subtaskText) throw new WeakAreaReportError("invalid", "This practice step could not be identified. Reload the page and try again.");
      const completed = input.completed;

      return database.transaction(async (tx) => {
        const [row] = await tx.select().from(weakAreaReports)
          .where(eq(weakAreaReports.id, target.reportId)).for("update");
        if (!row) throw new WeakAreaReportError("not-found", "This report is no longer available. Reload the page.");
        const saved = readReport(row);
        const selected = saved.areas.find((area) => matchesArea(area, target));
        if (!selected?.subtasks) throw new WeakAreaReportError("not-found", "This weak area's practice steps are no longer available. Reload the page.");
        const selectedSubtask = selected.subtasks.find((subtask) => subtask.text.toLowerCase() === subtaskText.toLowerCase());
        if (!selectedSubtask) throw new WeakAreaReportError("not-found", "This practice step is no longer available. Reload the page.");
        if (selectedSubtask.completed === completed) return selected;
        const updated: WeakArea = {
          ...selected,
          subtasks: selected.subtasks.map((subtask) => subtask === selectedSubtask ? { ...subtask, completed } : subtask),
        };
        const areas = saved.areas.map((area) => area === selected ? updated : area);
        await tx.update(weakAreaReports).set({ areas }).where(eq(weakAreaReports.id, target.reportId));
        return updated;
      });
    },
  };
}
