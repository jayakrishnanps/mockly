type GradeEntry = { min: number; label: string };

const THRESHOLDS: GradeEntry[] = [
  { min: 100, label: "S" },
  { min: 95, label: "A+" },
  { min: 90, label: "A" },
  { min: 85, label: "B+" },
  { min: 80, label: "B" },
  { min: 75, label: "C+" },
  { min: 70, label: "C" },
  { min: 60, label: "D" },
  { min: 0, label: "Very Bad" },
];

export function gradeFromPercentage(scorePercent: number): string {
  const clamped = Math.max(0, scorePercent);
  for (const { min, label } of THRESHOLDS) {
    if (clamped >= min) return label;
  }
  return "Very Bad";
}
