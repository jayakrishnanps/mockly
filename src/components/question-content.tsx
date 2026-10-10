"use client";

import { memo } from "react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkStatementBreaks } from "@/lib/remark-statement-breaks";

// Memoization keeps a large draft from re-rendering every formula on each keystroke.
export const QuestionContent = memo(function QuestionContent({ text }: { text: string }) {
  return (
    <div className="question-content min-w-0 text-base leading-8">
      <Markdown
        skipHtml
        remarkPlugins={[remarkMath, remarkStatementBreaks]}
        rehypePlugins={[[rehypeKatex, {
          trust: false,
          strict: "ignore",
          maxExpand: 1000,
          maxSize: 20,
          errorColor: "#b42318",
        }]]}
        components={{
          // Keep pasted content local; external images are not fetched in previews.
          img: ({ alt }) => <span className="text-muted">[Image: {alt || "not shown in preview"}]</span>,
        }}
      >
        {text}
      </Markdown>
      <p className="math-warning mt-2 text-xs text-red-800" role="note">
        Some math could not be rendered. Check the expression shown in red.
      </p>
    </div>
  );
});
