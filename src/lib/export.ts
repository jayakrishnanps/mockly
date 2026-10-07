import type { AnswerRecord } from "./scoring";

export type ExportableResult = {
  mockTitle: string;
  user: string;
  dateStr: string;
  durationMinutes: number;
  timeTakenSeconds: number;
  score: number;
  maxScore: number;
  scorePercent: number;
  grade: string;
  percentile: number | null;
  attempted: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  accuracy: number;
  avgTimeMsPerAttempted: number;
  questions: {
    position: number;
    questionText: string;
    options: string[];
    correctIndex: number;
    answer: AnswerRecord;
  }[];
};

const OPTION_LABELS = ["A", "B", "C", "D"];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function generateResultTxt(r: ExportableResult): string {
  const lines: string[] = [];
  lines.push(`MOCK: ${r.mockTitle}`);
  lines.push(`User: ${r.user} | Date: ${r.dateStr} | Duration: ${r.durationMinutes}m`);
  lines.push(`Time used: ${formatTime(r.timeTakenSeconds)} of ${r.durationMinutes}m`);
  lines.push("");
  lines.push(`Score: ${r.score} / ${r.maxScore} (${r.scorePercent.toFixed(2)}%)`);
  lines.push(`Grade: ${r.grade}`);
  lines.push(`Mockly attempt percentile (other same-mock attempts scoring strictly lower): ${r.percentile !== null ? r.percentile.toFixed(1) : "Not enough attempts"}`);
  lines.push(`Attempted: ${r.attempted} / ${r.totalQuestions}`);
  lines.push(`Correct: ${r.correctCount}`);
  lines.push(`Wrong: ${r.wrongCount}`);
  lines.push(`Skipped: ${r.skippedCount}`);
  lines.push(`Accuracy: ${r.accuracy.toFixed(1)}%`);
  lines.push(`Average time per attempted question: ${r.attempted > 0 ? Math.round(r.avgTimeMsPerAttempted / 1000) + "s" : "N/A"}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const q of r.questions) {
    lines.push(`Q${q.position}`);
    lines.push(`Question: ${q.questionText}`);
    q.options.forEach((opt, i) => {
      lines.push(`${OPTION_LABELS[i]}) ${opt}`);
    });
    const correctLetter = OPTION_LABELS[q.correctIndex];
    const userLetter = q.answer.selectedIndex !== null ? OPTION_LABELS[q.answer.selectedIndex] : "—";
    let result: string;
    if (q.answer.selectedIndex === null) result = "SKIPPED";
    else if (q.answer.selectedIndex === q.correctIndex) result = "CORRECT";
    else result = "WRONG";
    lines.push(`Correct answer: ${correctLetter} | Your answer: ${userLetter} | Result: ${result} | Time: ${Math.round(q.answer.timeSpentMs / 1000)}s`);
    lines.push("");
  }

  return lines.join("\n");
}
