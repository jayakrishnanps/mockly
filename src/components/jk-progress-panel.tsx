import type { JKProgress } from "@/lib/jk-progress";
import { JKProgressActivity } from "./jk-progress-activity";
import styles from "./jk-progress-panel.module.css";

const number = new Intl.NumberFormat("en-IN");

export function JKProgressPanel({ progress }: { progress: JKProgress }) {
  const periods = [
    ["Today", progress.counts.today],
    ["This week", progress.counts.week],
    ["This month", progress.counts.month],
    ["This year", progress.counts.year],
    ["All time", progress.counts.allTime],
    ["Active days", progress.activeDays],
  ] as const;

  return <div className={styles.page}>
    <div className={styles.heading}>
      <h1 className="page-title">Your progress</h1>
    </div>

    <section className={styles.levelPanel} aria-label="Level progress">
      <div className={styles.levelNumber}>
        <span className={styles.eyebrow}>LEVEL</span>
        <strong>{number.format(progress.level)}</strong>
      </div>
      <div className={styles.levelDetails}>
        <div className={styles.xpHeading}>
          <span><strong>{number.format(progress.totalXp)}</strong> XP earned</span>
          <span>Level {number.format(progress.level + 1)}</span>
        </div>
        <progress className={styles.xpBar} value={progress.xpIntoLevel} max={progress.xpForNextLevel} aria-label={`Progress towards level ${progress.level + 1}`} />
        <div className={styles.xpRemaining}>
          <span>{number.format(progress.xpIntoLevel)} / {number.format(progress.xpForNextLevel)} XP</span>
          <span>{number.format(progress.xpForNextLevel - progress.xpIntoLevel)} to go</span>
        </div>
        <p className={styles.rule}>+10 XP per correct answer, −10 per wrong answer, plus up to 20 XP for answering the mock. Your XP balance stops at zero.</p>
      </div>
    </section>

    <section aria-labelledby="completed-mocks-title">
      <div className={styles.sectionHeading}><h2 id="completed-mocks-title">Completed mocks</h2></div>
      <dl className={styles.periods}>
        {periods.map(([label, count]) => <div key={label}>
          <dt>{label}</dt><dd>{number.format(count)}</dd>
        </div>)}
      </dl>
    </section>

    <section className={styles.activityPanel} aria-labelledby="practice-activity-title">
      <div className={styles.sectionHeading}>
        <h2 id="practice-activity-title">Practice activity</h2>
        <span>Past year · IST</span>
      </div>
      <JKProgressActivity days={progress.activity} />
      <dl className={styles.streaks}>
        <div><dt>Current streak</dt><dd>{number.format(progress.currentStreak)} <span>{progress.currentStreak === 1 ? "day" : "days"}</span></dd></div>
        <div><dt>Longest streak</dt><dd>{number.format(progress.longestStreak)} <span>{progress.longestStreak === 1 ? "day" : "days"}</span></dd></div>
      </dl>
    </section>

    <section aria-labelledby="practice-totals-title">
      <div className={styles.sectionHeading}><h2 id="practice-totals-title">Practice totals</h2></div>
      <dl className={styles.totals}>
        <div><dt>Correct answers</dt><dd>{number.format(progress.correctAnswers)}</dd></div>
        <div><dt>Answered questions</dt><dd>{number.format(progress.answeredQuestions)}</dd></div>
        <div><dt>Accuracy</dt><dd>{progress.accuracyPercent === null ? "—" : `${progress.accuracyPercent.toFixed(1)}%`}</dd></div>
        <div><dt>Practice time</dt><dd>{number.format(Math.floor(progress.totalPracticeSeconds / 60))}<span> min</span></dd></div>
      </dl>
    </section>
    <p className={styles.savedNote}>Your progress stays saved when mocks, banks or history are deleted.</p>
  </div>;
}
