import type { SavedWeakAreaReport, WeakArea } from "./weak-area-report.ts";

export function weakAreaKey(reportId: string, area: WeakArea): string {
  return JSON.stringify([reportId, area.subject, area.area.toLowerCase()]);
}

export function summarizeWeakAreaReports(reports: SavedWeakAreaReport[], completedAreas: ReadonlySet<string>) {
  const orderedReports = [...reports].sort((a, b) => Date.parse(b.importedAt) - Date.parse(a.importedAt) || b.id.localeCompare(a.id));
  const latestByMock = new Map<string, SavedWeakAreaReport>();
  const reportCounts = new Map<string, number>();

  for (const report of orderedReports) {
    if (!latestByMock.has(report.sourceTestId)) latestByMock.set(report.sourceTestId, report);
    reportCounts.set(report.sourceTestId, (reportCounts.get(report.sourceTestId) ?? 0) + 1);
  }

  const activeMockCount = [...latestByMock.values()].filter((report) =>
    report.areas.some((area) => !completedAreas.has(weakAreaKey(report.id, area))),
  ).length;

  return { orderedReports, latestByMock, reportCounts, activeMockCount };
}
