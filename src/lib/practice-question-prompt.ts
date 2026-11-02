export const PRACTICE_QUESTION_PROMPT = String.raw`Use the lessons, worked examples, or weak areas already discussed in this chat to create exactly 50 multiple-choice practice questions for me, a beginner preparing for SSC CGL. Focus on the most recently studied topics or the current difficulties supported by this chat. If there is no clear topic or learning context, ask one short clarification before generating questions.

Match the difficulty, number ranges, and required knowledge to what I have learned here. Use SSC CGL-style wording and applications where appropriate, with simple questions when the topic calls for them. Combine focused repetition with varied values and question styles within that scope. Keep every question self-contained; do not require the reader to see this chat. Do not add unrelated or untaught advanced topics.

Check every answer internally. Give exactly one correct answer and four distinct, plausible options. Avoid options that refer to another option's letter or position, such as "A and B" or "all of the above", because Mockly shuffles options.

Return only one fenced markdown code block, with nothing outside it. Number the questions Q1. through Q50. Use this layout for each question:
Q1. Question text
(A) First option
(B) Second option
(C) Third option
(D) Fourth option
Ans: A

Replace the placeholders with actual content and use the correct answer letter A, B, C, or D. Put each marker on its own line, the Ans: line last, and one blank line between questions. Do not include explanations, solutions, extra headings, or a separate answer key. Label any statements Statement I:, Statement II:, etc., each on its own line; keep references such as "Only I" consistent.

For mathematical content, Mockly uses Markdown and KaTeX: $...$ for inline math, or $$ on separate lines around display math. Use standard LaTeX with single literal backslashes: \frac{a}{b}, \sqrt{x}, x^{2}, x_{i}, \times, \div. Balance braces and delimiters. Keep Q-number, option, and Ans: markers outside math. Do not use \(...\), \[...\], JSON escaping, custom macros, HTML, or images. Preserve all markers and line breaks inside the code block for copying on mobile.`;
