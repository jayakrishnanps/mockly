export type ComparisonAttempt = {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  score: number;
  maxScore: number;
  timeTakenSeconds: number | null;
};

export type MockComparison = {
  JK: ComparisonAttempt[];
  HE: ComparisonAttempt[];
};

export function pairLatestAttempts(data: MockComparison): MockComparison {
  const count = Math.min(data.JK.length, data.HE.length);
  if (count === 0) return { JK: [], HE: [] };
  return { JK: data.JK.slice(-count), HE: data.HE.slice(-count) };
}
