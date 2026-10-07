import { QuestionContent } from "@/components/question-content";
import { OPTION_LABELS } from "@/lib/parser";
import type { QuestionInput } from "@/lib/mock-validation";

type QuestionPreviewProps = {
  question: Omit<QuestionInput, "id">;
  number: number;
};

/** The same wording, maths and answer layout for browser drafts and saved mocks. */
export function QuestionPreview({ question, number }: QuestionPreviewProps) {
  return (
    <>
      <QuestionContent text={question.questionText} />
      <ol className="mt-4 divide-y divide-line border-y border-line" aria-label={`Options for question ${number}`}>
        {question.options.map((option, index) => {
          const correct = index === question.correctIndex;

          return (
            <li key={index} className={`min-w-0 px-3 py-3 sm:px-4 ${correct ? "bg-accent-soft/60" : ""}`}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
                <span>{OPTION_LABELS[index]}</span>
                {correct && <span className="text-accent">Correct answer</span>}
              </div>
              <QuestionContent text={option} />
            </li>
          );
        })}
      </ol>
    </>
  );
}
