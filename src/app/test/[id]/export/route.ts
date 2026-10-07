import { notFound } from "next/navigation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUuid } from "@/lib/mock-validation";
import { generateMockHistoryTxt, toExportableResult } from "@/lib/export";
import { attemptStore } from "@/server/attempts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await getRememberedUserFromCookies();
  if (!user || new URL(request.url).searchParams.get("user") !== user) notFound();

  const data = await attemptStore.getMockExportData(id.toLowerCase(), user);
  if (!data) notFound();

  const results = data.attempts.map((entry) => toExportableResult({
    attempt: entry.attempt,
    mock: { title: data.mock.title, durationMinutes: entry.durationMinutes, marksCorrect: entry.marksCorrect },
    questions: entry.questions,
    allScores: data.allScores,
  }));
  const text = generateMockHistoryTxt(data.mock.title, user, results);
  const title = data.mock.title.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 80) || "mock";

  return new Response(text, {
    headers: {
      "Cache-Control": "private, no-store",
      "Vary": "Cookie",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${title}_${user}_all_attempts.txt"`,
    },
  });
}
