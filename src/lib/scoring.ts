export type AnswerRecord = {
  questionId: string;
  selectedIndex: number | null;
  timeSpentMs: number;
  markedForReview: boolean;
  visited?: boolean;
};

export type ScoringInput = {
  marksCorrect: number;
  marksWrong: number;
  correctIndexes: Map<string, number>;
  answers: AnswerRecord[];
};

export type ScoringResult = {
  score: number;
  maxScore: number;
  scorePercent: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  attempted: number;
  accuracy: number;
  totalTimeMs: number;
  avgTimeMsPerAttempted: number;
};

export function scoreAttempt(input: ScoringInput): ScoringResult {
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let totalTimeMs = 0;

  const byId = new Map(input.answers.map((answer) => [answer.questionId, answer]));
  for (const [questionId, correctIndex] of input.correctIndexes) {
    const answer = byId.get(questionId);
    totalTimeMs += answer?.timeSpentMs ?? 0;
    if (!answer || answer.selectedIndex === null) {
      skippedCount++;
    } else if (answer.selectedIndex === correctIndex) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const attempted = correctCount + wrongCount;
  const score = (correctCount * Math.round(input.marksCorrect * 100) - wrongCount * Math.round(input.marksWrong * 100)) / 100;
  const maxScore = input.correctIndexes.size * Math.round(input.marksCorrect * 100) / 100;
  const scorePercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const accuracy = attempted > 0 ? (correctCount / attempted) * 100 : 0;
  const avgTimeMsPerAttempted = attempted > 0 ? totalTimeMs / attempted : 0;

  return { score, maxScore, scorePercent, correctCount, wrongCount, skippedCount, attempted, accuracy, totalTimeMs, avgTimeMsPerAttempted };
}

export function calculatePercentile(currentScore: number, allScores: number[]): number | null {
  if (allScores.length < 2) return null;
  const below = allScores.filter((s) => s < currentScore).length;
  return (below / (allScores.length - 1)) * 100;
}
