export const OPTION_LABELS = ["A", "B", "C", "D"] as const;
export type OptionLabel = (typeof OPTION_LABELS)[number];
export type CorrectIndex = 0 | 1 | 2 | 3;

export type ParsedQuestion = {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: CorrectIndex;
  sourceNumber: string | null;
  raw: string;
};

export const ERROR_CODES = [
  "missing_question", "option_count", "missing_option", "duplicate_option",
  "unexpected_option", "empty_option", "missing_answer", "invalid_answer",
  "duplicate_answer", "answer_without_option", "unexpected_content",
  "unclosed_fence", "unclosed_math",
] as const;

export type ParserError = {
  code: (typeof ERROR_CODES)[number];
  message: string;
  /** One-based line within the original block. */
  line?: number;
};

export type InvalidQuestion = {
  sourceNumber: string | null;
  raw: string;
  errors: ParserError[];
};

export type ParseResult = {
  total: number;
  valid: ParsedQuestion[];
  invalid: InvalidQuestion[];
};

type Line = { text: string; start: number; number: number };
type Option = { label: string; start: number; end: number; line: number };

// Explicit Q headers delimit a batch, even if a previous block is malformed.
// Plain numbered Markdown lists inside a question are not question boundaries.
const QUESTION_HEADER = /^[ \t]*(?:Q(?:uestion)?[ \t]*)(\d+)[ \t]*[.):][ \t]*/i;
const OPTION_HEADER = /^[ \t]*(?:\(([a-z])\)|([a-z])[.)])[ \t]*/i;
const ANSWER_HEADER = /^[ \t]*(?:ans(?:wer)?|correct)[ \t]*:[ \t]*(.*)$/i;

function linesOf(source: string): Line[] {
  const lines: Line[] = [];
  for (const match of source.matchAll(/([^\r\n]*)(?:\r\n|\r|\n|$)/g)) {
    if (match[0]) lines.push({ text: match[1], start: match.index, number: lines.length + 1 });
  }
  return lines;
}

// Remove separator blank lines, not internal whitespace, Markdown, or LaTeX.
// Slicing the source also preserves CRLF and Markdown's two-space hard breaks.
function contentBetween(source: string, start: number, end: number): string {
  return source.slice(start, end)
    .replace(/^(?:[ \t]*(?:\r\n|\r|\n))+/, "")
    .replace(/(?:\r\n|\r|\n)[ \t\r\n]*$/, "");
}

function parseBlock(raw: string): ParsedQuestion | InvalidQuestion {
  const lines = linesOf(raw);
  const header = lines[0]?.text.match(QUESTION_HEADER);
  const sourceNumber = header?.[1] ?? null;
  const questionStart = header?.[0].length ?? 0;
  let questionEnd = raw.length;
  const options: Option[] = [];
  const answers: { value: string; line: number }[] = [];
  const errors: ParserError[] = [];
  let activeOption: Option | undefined;
  let fence: { char: string; length: number } | null = null;
  let displayMath = false;

  function endContent(at: number) {
    questionEnd = Math.min(questionEnd, at);
    if (activeOption) activeOption.end = at;
    activeOption = undefined;
  }

  for (const line of lines) {
    const isHeader = line.number === 1 && header !== null;
    let content = isHeader ? line.text.slice(questionStart) : line.text;
    const protectedContent = fence !== null || displayMath;

    if (!isHeader && !protectedContent) {
      const answer = line.text.match(ANSWER_HEADER);
      const option = line.text.match(OPTION_HEADER);
      if (answer) {
        endContent(line.start);
        answers.push({ value: answer[1].trim(), line: line.number });
        continue;
      }
      if (option) {
        endContent(line.start);
        activeOption = {
          label: (option[1] ?? option[2]).toUpperCase(),
          start: line.start + option[0].length,
          end: raw.length,
          line: line.number,
        };
        options.push(activeOption);
        content = line.text.slice(option[0].length);
      }
      if (answers.length && line.text.trim()) {
        errors.push({
          code: "unexpected_content", line: line.number,
          message: "Unexpected text after the answer. Put the answer last and start the next question with Q followed by its number.",
        });
      }
    }

    const fenceMarker = content.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (fenceMarker && fenceMarker[1][0] === fence.char &&
          fenceMarker[1].length >= fence.length && !fenceMarker[2].trim()) fence = null;
    } else if (!displayMath && fenceMarker) {
      fence = { char: fenceMarker[1][0], length: fenceMarker[1].length };
    } else {
      const delimiters = content.match(/(?<!\\)\$\$/g)?.length ?? 0;
      if (delimiters % 2 === 1) displayMath = !displayMath;
    }
  }

  const questionText = contentBetween(raw, questionStart, questionEnd);
  if (!questionText.trim()) errors.push({ code: "missing_question", message: "Question text is missing." });
  if (options.length !== 4) errors.push({
    code: "option_count", message: `Expected exactly 4 options; found ${options.length}.`,
  });

  const byLabel = new Map<string, string>();
  for (const option of options) {
    const value = contentBetween(raw, option.start, option.end);
    if (!OPTION_LABELS.includes(option.label as OptionLabel)) errors.push({
      code: "unexpected_option", line: option.line,
      message: `Option ${option.label} is not supported. Use A, B, C and D only.`,
    });
    if (byLabel.has(option.label)) errors.push({
      code: "duplicate_option", line: option.line, message: `Option ${option.label} appears more than once.`,
    });
    if (!value.trim()) errors.push({
      code: "empty_option", line: option.line, message: `Option ${option.label} has no text.`,
    });
    byLabel.set(option.label, value);
  }
  const missing = OPTION_LABELS.filter((label) => !byLabel.has(label));
  if (missing.length) errors.push({ code: "missing_option", message: `Missing option${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.` });

  if (!answers.length) errors.push({ code: "missing_answer", message: "Answer line is missing. Add Ans: A, Answer: A or Correct: A." });
  if (answers.length > 1) errors.push({ code: "duplicate_answer", message: "More than one answer line was found. Keep exactly one." });
  let correctIndex: CorrectIndex = 0;
  for (const answer of answers) {
    const match = answer.value.match(/^(?:([a-d])|\(([a-d])\))$/i);
    if (!match) {
      errors.push({ code: "invalid_answer", line: answer.line, message: "The answer must be a single letter A, B, C or D (optionally in parentheses)." });
    } else {
      const label = (match[1] ?? match[2]).toUpperCase() as OptionLabel;
      correctIndex = OPTION_LABELS.indexOf(label) as CorrectIndex;
      if (!byLabel.has(label)) errors.push({
        code: "answer_without_option", line: answer.line, message: `The answer refers to option ${label}, but that option is missing.`,
      });
    }
  }
  if (fence) errors.push({ code: "unclosed_fence", message: "A Markdown code fence is not closed." });
  if (displayMath) errors.push({ code: "unclosed_math", message: "A display-math block is not closed. Add its closing $$." });

  if (errors.length) return { sourceNumber, raw, errors };
  return {
    questionText,
    options: OPTION_LABELS.map((label) => byLabel.get(label)!) as ParsedQuestion["options"],
    correctIndex, sourceNumber, raw,
  };
}

/** Pure parser: no storage, rendering, IDs, or database access. */
export function parseQuestions(source: string): ParseResult {
  const result: ParseResult = { total: 0, valid: [], invalid: [] };
  const starts = linesOf(source)
    .filter((line) => QUESTION_HEADER.test(line.text))
    .map((line) => line.start);
  if (starts[0] !== 0) starts.unshift(0);

  for (let index = 0; index < starts.length; index++) {
    const raw = source.slice(starts[index], starts[index + 1] ?? source.length);
    if (!raw.trim()) continue;
    const block = parseBlock(raw);
    result.total++;
    if ("errors" in block) result.invalid.push(block);
    else result.valid.push(block);
  }
  return result;
}
