import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { AttemptError } from "@/server/attempt-store";
import { isUuid } from "@/lib/mock-validation";
import { attemptStore } from "@/server/attempts";
import { gradeFromPercentage } from "@/lib/grades";
import { calculatePercentile } from "@/lib/scoring";
import { generateResultTxt, type ExportableResult } from "@/lib/export";

export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!isUuid(attemptId)) notFound();

  await connection();
  const user = await getRememberedUserFromCookies();
  if (!user) notFound();
  let data;
  try {
    data = await attemptStore.getResult(attemptId, user);
  } catch (error) {
    if (error instanceof AttemptError && (error.code === "not-found" || error.code === "forbidden")) notFound();
    throw error;
  }
  if (!data) notFound();

  const { attempt, mock, questions, allScores } = data;
  
  const scorePercent = Number(mock.marksCorrect) > 0 && questions.length > 0 
    ? (Number(attempt.score) / (questions.length * Number(mock.marksCorrect))) * 100 
    : 0;
  const grade = gradeFromPercentage(scorePercent);
  const percentile = calculatePercentile(Number(attempt.score), allScores);
  const answers = attempt.answers;

  const attempted = (attempt.correctCount || 0) + (attempt.wrongCount || 0);
  const accuracy = attempted > 0 ? ((attempt.correctCount || 0) / attempted) * 100 : 0;
  
  const totalTimeMs = answers.reduce((sum, a) => sum + (a.timeSpentMs || 0), 0);
  const avgTimeMsPerAttempted = attempted > 0 ? totalTimeMs / attempted : 0;

  const dateFormatter = new Intl.DateTimeFormat("en-IN", { 
    day: "numeric", month: "short", year: "numeric", 
    hour: "numeric", minute: "numeric", timeZone: "Asia/Kolkata" 
  });

  const exportData: ExportableResult = {
    mockTitle: mock.title,
    user: attempt.takenBy,
    dateStr: dateFormatter.format(new Date(attempt.submittedAt!)),
    durationMinutes: mock.durationMinutes,
    timeTakenSeconds: attempt.timeTakenSeconds || 0,
    score: Number(attempt.score),
    maxScore: questions.length * Number(mock.marksCorrect),
    scorePercent,
    grade,
    percentile,
    attempted,
    correctCount: attempt.correctCount || 0,
    wrongCount: attempt.wrongCount || 0,
    skippedCount: attempt.skippedCount || 0,
    totalQuestions: questions.length,
    accuracy,
    avgTimeMsPerAttempted,
    questions: questions.map(q => ({
      position: q.position,
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      answer: answers.find(a => a.questionId === q.id) || {
        questionId: q.id,
        selectedIndex: null,
        timeSpentMs: 0,
        markedForReview: false
      }
    }))
  };

  const textContent = generateResultTxt(exportData);
  const filename = `${mock.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_result.txt`;

  return new Response(textContent, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
