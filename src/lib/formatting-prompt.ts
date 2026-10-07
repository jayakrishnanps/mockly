export const FORMATTING_PROMPT = String.raw`Convert the questions I provide separately into Mockly's import format. Do not generate a topic, sample questions, or additional questions. If I have not supplied questions yet, ask me to send them.

Output only the formatted questions as plain text, without a preamble, Markdown code fence, headings, explanations, or a separate answer key.

For each question:
- Start a new line with Q followed by its sequential number and a period, then the question text.
- Put exactly four nonempty options on separate lines, labelled (A), (B), (C), and (D), in that order.
- End with exactly one line: Ans: followed by the single correct option letter A, B, C, or D.
- Leave one blank line between question blocks. Keep all question and option content before the answer line. Question and option text may span multiple lines.
- Preserve the supplied meaning, language, numbers, option order, and correct answer. Do not invent missing options or guess an uncertain answer. If the source is incomplete or ambiguous, ask me to clarify before formatting it.

Math formatting:
- Mockly renders Markdown with KaTeX using dollar delimiters: $...$ for inline math and $$...$$ on separate lines for display equations.
- Use standard KaTeX-supported LaTeX. Fractions: \frac{numerator}{denominator}; nested fractions: \frac{\frac{a}{b}}{\frac{c}{d}}; roots: \sqrt{x} or \sqrt[n]{x}; powers: x^{n}; subscripts: x_{i}; multiplication: \times; division: \div; text inside math: \text{...}.
- Enclose every formula in the dollar delimiters, balance braces and delimiters, and use a single literal backslash for LaTeX commands. Do not JSON-escape the output.
- Do not use \(...\), \[...\], full LaTeX documents, custom macros, HTML, images, or Unicode fraction substitutes. Plain a/b stays plain text; use $\frac{a}{b}$ when a rendered fraction is intended.
- Keep (A)–(D), Q-number markers, and Ans: outside math and at the start of their own lines. Escape a literal non-math dollar sign as \$.

Wait for or use the questions I provide separately.`;
