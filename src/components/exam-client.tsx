"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useExam, type ExamProgress } from "@/components/use-exam";
import { questionState, type QuestionState } from "@/lib/attempt-state";
import { QuestionContent } from "@/components/question-content";
import { OPTION_LABELS } from "@/lib/parser";

type ExamQuestion = {
  id: string;
  position: number;
  questionText: string;
  options: string[];
};

type ExamClientProps = ExamProgress & { mockTitle: string; questions: ExamQuestion[] };
const subscribe = () => () => {};

export function ExamClient(props: ExamClientProps) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return hydrated ? <ExamWorkspace {...props} /> : <p className="p-8 text-sm text-muted">Loading your attempt…</p>;
}

const STATE_COLORS: Record<QuestionState, string> = {
  "not-visited": "bg-gray-200 text-gray-600",
  "not-answered": "bg-red-500 text-white",
  "answered": "bg-green-600 text-white",
  "marked": "bg-purple-600 text-white",
  "answered-marked": "bg-purple-600 text-white ring-2 ring-green-400 ring-offset-1",
};

const STATE_LABELS: Record<QuestionState, string> = {
  "not-visited": "Not visited",
  "not-answered": "Not answered",
  "answered": "Answered",
  "marked": "Marked for review",
  "answered-marked": "Answered & Marked",
};

function ExamWorkspace(props: ExamClientProps) {
  const { mockTitle, user, questions } = props;
  const { current, answers, timeLeft, submitting, saveError, handleSubmit, change } = useExam(props);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const controlsDisabled = submitting || timeLeft === 0;
  const isLastQuestion = current === questions.length - 1;
  const navigateTo = (index: number) => {
    if (controlsDisabled) return;
    change({}, index);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const selectOption = (index: number) => change({ selectedIndex: index });
  const clearResponse = () => change({ selectedIndex: null });
  const saveAndNext = () => {
    if (controlsDisabled) return;
    change({ markedForReview: false }, Math.min(current + 1, questions.length - 1));
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const markAndNext = () => {
    if (controlsDisabled) return;
    change({ markedForReview: true }, Math.min(current + 1, questions.length - 1));
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const goPrevious = () => navigateTo(current - 1);

  const q = questions[current];
  const a = answers[current];
  const mm = Math.floor(timeLeft / 60);
  const ss = timeLeft % 60;
  const timeStr = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  const isUrgent = timeLeft <= 60;

  const counts = useMemo(() => {
    const c = { answered: 0, notAnswered: 0, notVisited: 0, marked: 0, answeredMarked: 0 };
    answers.forEach((ans) => {
      const state = questionState(ans);
      if (state === "answered") c.answered++;
      else if (state === "not-answered") c.notAnswered++;
      else if (state === "not-visited") c.notVisited++;
      else if (state === "marked") c.marked++;
      else if (state === "answered-marked") c.answeredMarked++;
    });
    return c;
  }, [answers]);

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="submit-heading" onKeyDown={(event) => { if (event.key === "Escape" && !submitting) setShowConfirm(false); }} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 sm:p-8">
          <h2 id="submit-heading" className="text-xl font-semibold">Submit Test?</h2>
          <p className="mt-2 text-sm text-muted">Review your progress before submitting. Submission is final.</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted">Total</dt><dd className="font-semibold">{questions.length}</dd></div>
            <div><dt className="text-muted">Answered</dt><dd className="font-semibold text-green-700">{counts.answered + counts.answeredMarked}</dd></div>
            <div><dt className="text-muted">Unanswered</dt><dd className="font-semibold text-red-600">{counts.notAnswered + counts.marked}</dd></div>
            <div><dt className="text-muted">Not visited</dt><dd className="font-semibold">{counts.notVisited}</dd></div>
            <div><dt className="text-muted">Marked for review</dt><dd className="font-semibold text-purple-600">{counts.marked + counts.answeredMarked}</dd></div>
            <div><dt className="text-muted">Time left</dt><dd className="font-semibold">{timeStr}</dd></div>
          </dl>
          {saveError && <p role="alert" className="mt-4 text-sm text-red-700">{saveError}</p>}
          <div className="mt-6 flex gap-3">
            <button autoFocus disabled={submitting} onClick={() => setShowConfirm(false)} className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-gray-50">Go back</button>
            <button onClick={() => handleSubmit()} disabled={submitting} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Test"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh min-w-0 flex-col bg-gray-50 pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <h1 className="truncate text-sm font-semibold">{mockTitle}</h1>
            <span className="hidden shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent sm:inline">{user}</span>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3">
            <span className="text-xs text-muted sm:inline">{current + 1}/{questions.length}</span>
            <div className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${isUrgent ? "bg-red-100 text-red-700" : "bg-gray-100 text-foreground"}`} role="timer" aria-label="Time remaining">
              {timeStr}
            </div>
            <button disabled={submitting} onClick={() => setShowConfirm(true)} className="min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit test"}
            </button>
          </div>
        </div>
      </header>

      {saveError && (
        <div role="alert" className="bg-yellow-50 px-4 py-2 text-center text-xs text-yellow-800">⚠ {saveError}</div>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row">
        {/* Question area */}
        <div className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="rounded-2xl border border-line bg-white p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Question {q.position}</h2>
              {a.markedForReview && <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">Marked for review</span>}
            </div>
            <QuestionContent text={q.questionText} />

            <fieldset disabled={submitting || timeLeft === 0} className="mt-6 space-y-3" aria-label={`Options for question ${q.position}`}>
              {q.options.map((option, index) => {
                const selected = a.selectedIndex === index;
                return (
                  <label
                    key={index}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${selected ? "border-accent bg-accent-soft/50" : "border-line hover:border-accent/30"}`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      checked={selected}
                      onChange={() => selectOption(index)}
                      className="mt-1 accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold">{OPTION_LABELS[index]}</span>
                      <div className="mt-1">
                        <QuestionContent text={option} />
                      </div>
                    </div>
                  </label>
                );
              })}
            </fieldset>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={goPrevious} disabled={controlsDisabled || current === 0} className="hidden min-h-11 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-30 lg:block">
                ← Previous
              </button>
              <button onClick={clearResponse} disabled={controlsDisabled} className="min-h-11 rounded-lg border border-line px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-30">
                Clear response
              </button>
              <button onClick={markAndNext} disabled={controlsDisabled} className="min-h-11 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-30">
                {isLastQuestion ? "Mark for review" : "Mark & Next"}
              </button>
              <button onClick={isLastQuestion ? () => setShowConfirm(true) : saveAndNext} disabled={controlsDisabled} className="hidden min-h-11 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-30 lg:block">
                {isLastQuestion ? "Review & submit" : a.selectedIndex === null ? "Skip / Next →" : "Save & Next →"}
              </button>
            </div>
          </div>
        </div>

        {/* Desktop palette */}
        <aside className="hidden w-64 shrink-0 border-l border-line bg-white p-5 lg:block" aria-label="Question palette">
          <h3 className="mb-4 text-xs font-semibold text-muted">QUESTION PALETTE</h3>
          <div className="grid grid-cols-5 gap-2">
            {questions.map((_, i) => {
              const state = questionState(answers[i]);
              return (
                <button
                  key={i}
                  disabled={controlsDisabled}
                  onClick={() => navigateTo(i)}
                  aria-label={`Question ${i + 1}, ${STATE_LABELS[state]}`}
                  aria-current={i === current ? "true" : undefined}
                  className={`flex size-10 items-center justify-center rounded-lg text-xs font-medium transition-colors ${STATE_COLORS[state]} ${i === current ? "ring-2 ring-accent ring-offset-1" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-5 space-y-1.5 text-[11px]">
            {(Object.entries(STATE_LABELS) as [QuestionState, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`inline-block size-3.5 rounded ${STATE_COLORS[key]}`} />
                <span className="text-muted">{label}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Keep primary actions reachable even after scrolling a long question. */}
      <nav aria-label="Mobile exam controls" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
        {showPalette && (
          <section id="mobile-question-palette" aria-label="Jump to a question" className="absolute inset-x-0 bottom-full max-h-[45dvh] overflow-y-auto overscroll-contain border-t border-line bg-white p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-semibold">Jump to a question</h2>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
            {questions.map((_, i) => {
              const state = questionState(answers[i]);
              return (
                <button
                  key={i}
                  disabled={controlsDisabled}
                  onClick={() => { navigateTo(i); setShowPalette(false); }}
                  aria-label={`Question ${i + 1}, ${STATE_LABELS[state]}`}
                  aria-current={i === current ? "true" : undefined}
                  className={`flex min-h-11 min-w-0 items-center justify-center rounded text-sm font-medium ${STATE_COLORS[state]} ${i === current ? "ring-2 ring-accent" : ""}`}
                >
                  {i + 1}
                </button>
              );
            })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-[11px]">
              {(Object.entries(STATE_LABELS) as [QuestionState, string][]).map(([key, label]) => <span key={key} className="flex items-center gap-1.5"><span aria-hidden="true" className={`size-3 rounded ${STATE_COLORS[key]}`} />{label}</span>)}
            </div>
          </section>
        )}
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2">
          <button onClick={goPrevious} disabled={controlsDisabled || current === 0} className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium disabled:opacity-40">← Previous</button>
          <button onClick={isLastQuestion ? () => setShowConfirm(true) : saveAndNext} disabled={controlsDisabled} className="min-h-11 rounded-lg border border-accent/30 bg-accent-soft px-3 text-sm font-medium text-accent disabled:opacity-40">{isLastQuestion ? "Review & submit" : a.selectedIndex === null ? "Skip / Next →" : "Save & Next →"}</button>
          <button aria-expanded={showPalette} aria-controls="mobile-question-palette" onClick={() => setShowPalette(!showPalette)} className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium">{showPalette ? "Close questions" : `Questions · ${current + 1}/${questions.length}`}</button>
          <button onClick={() => { setShowPalette(false); setShowConfirm(true); }} disabled={submitting} className="min-h-11 rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50">{submitting ? "Submitting…" : "Submit test"}</button>
        </div>
      </nav>
    </div>
  );
}
