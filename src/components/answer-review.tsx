"use client";

import { useId, useRef, useState } from "react";
import { QuestionContent } from "@/components/question-content";
import { OPTION_LABELS } from "@/lib/parser";
import type { AnswerRecord } from "@/lib/scoring";
import type { User } from "@/lib/users";

export type ReviewEntry = {
  question: {
    id: string;
    position: number;
    questionText: string;
    options: string[];
    correctIndex: number;
  };
  answer?: AnswerRecord;
  status: "wrong" | "skipped" | "correct";
};

const INITIAL_REVIEW_COUNT = 12;

export function AnswerReview({ user, entries, marksCorrect, marksWrong }: {
  user: User;
  entries: readonly ReviewEntry[];
  marksCorrect: string;
  marksWrong: string;
}) {
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const isJK = user === "JK";
  const visibleEntries = expanded ? entries : entries.slice(0, INITIAL_REVIEW_COUNT);

  function toggleReview() {
    setExpanded(!expanded);
    if (expanded) requestAnimationFrame(() => button.current?.scrollIntoView({ block: "nearest" }));
  }

  return <>
    <ol id={listId} data-result-feedback aria-label="Questions review" className={`mt-4 ${isJK ? "space-y-6" : "space-y-4"}`}>
      {visibleEntries.map(({ question, answer: ans, status }) => {
        let statusBadge;
        if (status === "skipped") statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium text-muted ${isJK ? "border border-black bg-white" : "bg-background"}`}>Skipped</span>;
        else if (status === "correct") statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium ${isJK ? "border border-green-900 bg-white text-green-900" : "bg-green-50 text-green-800"}`}>Correct (+{marksCorrect})</span>;
        else statusBadge = <span className={`rounded-md px-2 py-1 text-xs font-medium ${isJK ? "border border-red-900 bg-white text-red-900" : "bg-red-50 text-red-700"}`}>Wrong (−{marksWrong})</span>;

        return (
          <li key={question.id} className={`min-w-0 border border-line bg-white p-5 sm:p-7 ${isJK ? "rounded-md" : "rounded-xl"}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h3 className="text-sm font-semibold">Question {question.position}</h3>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {isJK && (
                  <span className="text-xs whitespace-nowrap text-muted tabular-nums">
                    Time spent: {ans ? `${(ans.timeSpentMs / 1000).toFixed(1)}s` : "—"}
                  </span>
                )}
                {ans?.markedForReview && <span className="text-xs font-medium text-muted">Marked for review</span>}
                {statusBadge}
              </div>
            </div>
            <QuestionContent text={question.questionText} />
            <ol className="mt-4 space-y-2">
              {question.options.map((option, index) => {
                const correct = index === question.correctIndex;
                const selected = index === ans?.selectedIndex;
                const correctTextClass = isJK ? "text-green-900" : "text-green-800";
                const wrongTextClass = isJK ? "text-red-900" : "text-red-700";
                let borderClass = "border-line";
                let bgClass = "";

                if (correct) {
                  borderClass = isJK ? "border-green-900" : "border-green-300";
                  bgClass = isJK ? "bg-white" : "bg-green-50";
                } else if (selected && !correct) {
                  borderClass = isJK ? "border-red-900" : "border-red-400";
                  bgClass = isJK ? "bg-white" : "bg-red-50";
                }

                return (
                  <li key={index} className={`min-w-0 border px-3 py-3 sm:px-4 ${isJK ? "rounded-sm" : "rounded-lg"} ${borderClass} ${bgClass}`}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                      <span>{OPTION_LABELS[index]}</span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {selected && <span className={correct ? correctTextClass : wrongTextClass}>Your answer</span>}
                        {correct && <span className={correctTextClass}>Correct answer</span>}
                      </div>
                    </div>
                    <QuestionContent text={option} />
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
    {entries.length > INITIAL_REVIEW_COUNT && (
      <div className="mt-6 flex justify-center">
        <button ref={button} type="button" aria-expanded={expanded} aria-controls={listId} onClick={toggleReview} className="min-h-11 rounded-lg border border-line bg-white px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent-soft">
          {expanded ? "Show fewer questions" : "View all questions"}
        </button>
      </div>
    )}
  </>;
}
