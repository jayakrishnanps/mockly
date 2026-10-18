import type { AnswerRecord } from "./scoring.ts";

type ReviewStatus = "wrong" | "skipped" | "correct";
const statusOrder: Record<ReviewStatus, number> = { wrong: 0, skipped: 1, correct: 2 };

export function buildAnswerReview<Question extends { id: string; correctIndex: number }>(
  questions: readonly Question[],
  answers: readonly AnswerRecord[],
) {
  const answersById = new Map(answers.map((answer) => [answer.questionId, answer]));
  const review = questions.map((question) => {
    const answer = answersById.get(question.id);
    let status: ReviewStatus = "skipped";
    if (answer && answer.selectedIndex !== null) {
      status = answer.selectedIndex === question.correctIndex ? "correct" : "wrong";
    }
    return { question, answer, status };
  });

  return review.sort((first, second) =>
    statusOrder[first.status] - statusOrder[second.status] ||
    (second.answer?.timeSpentMs ?? 0) - (first.answer?.timeSpentMs ?? 0),
  );
}
