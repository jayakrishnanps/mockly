import assert from "node:assert/strict";
import { test } from "node:test";
import { parseQuestions } from "../src/lib/parser.ts";

function question(number = 1, { syntax = "parentheses", answer = "Ans: A", prompt = "Choose the correct answer." } = {}) {
  const marker = (letter) => syntax === "parentheses" ? `(${letter})` : `${letter}${syntax === "dot" ? "." : ")"}`;
  return `Q${number}. ${prompt}\n${["A", "B", "C", "D"].map((letter, index) => `${marker(letter)} Option ${index + 1}`).join("\n")}\n${answer}`;
}

function invalidWith(source, ...codes) {
  const result = parseQuestions(source);
  assert.equal(result.valid.length, 0);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].raw, source);
  for (const code of codes) assert.ok(result.invalid[0].errors.some((error) => error.code === code), code);
}

test("valid batch keeps nonsequential and repeated source numbers", () => {
  const result = parseQuestions([question(9), question(2), question(9)].join("\n\n"));
  assert.equal(result.total, 3);
  assert.equal(result.invalid.length, 0);
  assert.deepEqual(result.valid.map((item) => item.sourceNumber), ["9", "2", "9"]);
  assert.deepEqual(result.valid[0].options, ["Option 1", "Option 2", "Option 3", "Option 4"]);
});

for (const syntax of ["parentheses", "paren", "dot"]) {
  for (const answer of ["Ans: A", "Answer: b", "Correct: d"]) {
    test(`${syntax} options with ${answer}`, () => {
      const result = parseQuestions(question(1, { syntax, answer }));
      assert.equal(result.invalid.length, 0);
      assert.equal(result.valid.length, 1);
      assert.equal(result.valid[0].correctIndex, "abcd".indexOf(answer.at(-1).toLowerCase()));
    });
  }
}

test("mixed lowercase labels, wrapped answer, and out-of-order labels map correctly", () => {
  const result = parseQuestions("Question 012: Pick one\nc) Third\n(a) First\nD. Fourth\nB) Second\naNsWeR: (b)");
  assert.equal(result.valid[0].sourceNumber, "012");
  assert.deepEqual(result.valid[0].options, ["First", "Second", "Third", "Fourth"]);
  assert.equal(result.valid[0].correctIndex, 1);
});

test("multiline Markdown, CRLF, hard breaks, and nested LaTeX are preserved", () => {
  const prompt = String.raw`Simplify $\frac{\frac{3}{4}}{\frac{5}{6}}$` + "  \r\n**Choose** one.\r\n\r\nPlain 3/4 stays plain.";
  const source = `Q7. ${prompt}\r\n\r\n(A) $\\frac{9}{10}$\r\ncontinued **option**\r\n(B) $\\sqrt{144}$\r\n(C) $5^2$\r\n(D) 3/4\r\nAns: A\r\n`;
  const { valid, invalid } = parseQuestions(source);
  assert.equal(invalid.length, 0);
  assert.equal(valid[0].questionText, prompt);
  assert.equal(valid[0].options[0], "$\\frac{9}{10}$\r\ncontinued **option**");
  assert.equal(valid[0].options[3], "3/4");
  assert.equal(valid[0].raw, source);
});

test("display math and option markers inside code fences stay in content", () => {
  const prompt = "Evaluate:\n$$\n\\left(\\frac{3}{4}\\right)^2 = x\n$$\n```text\nA) This is code, not an option\n```";
  const result = parseQuestions(question(1, { prompt }));
  assert.equal(result.invalid.length, 0);
  assert.equal(result.valid[0].questionText, prompt);
});

test("a standalone unnumbered question is supported", () => {
  const result = parseQuestions(question().replace("Q1. ", ""));
  assert.equal(result.valid.length, 1);
  assert.equal(result.valid[0].sourceNumber, null);
});

test("Markdown numbered lists are not split into questions", () => {
  const result = parseQuestions(question(1, { prompt: "Read:\n1. First statement\n2. Second statement\nChoose one." }));
  assert.equal(result.total, 1);
  assert.equal(result.valid.length, 1);
});

test("missing answer is invalid", () => invalidWith(question().replace("\nAns: A", ""), "missing_answer"));
test("only three options and answer pointing to missing option are invalid", () => {
  invalidWith(question(1, { answer: "Ans: D" }).replace("(D) Option 4\n", ""), "option_count", "missing_option", "answer_without_option");
});
test("duplicate labels conflict even when there are four option lines", () => {
  invalidWith(question().replace("(D)", "(A)"), "duplicate_option", "missing_option");
});
test("five options are invalid", () => invalidWith(question().replace("Ans: A", "(E) Fifth\nAns: A"), "option_count", "unexpected_option"));
test("four options including an unexpected label are invalid", () => invalidWith(question().replace("(D)", "(E)"), "unexpected_option", "missing_option"));
test("empty question is invalid", () => invalidWith(question(1, { prompt: "" }), "missing_question"));
test("empty option is invalid", () => invalidWith(question().replace("Option 2", ""), "empty_option"));
for (const answer of ["E", "", "1", "A or B", "A because it is right", "(A", "A)"]) {
  test(`ambiguous or invalid answer ${JSON.stringify(answer)} is rejected`, () => invalidWith(question(1, { answer: `Ans: ${answer}` }), "invalid_answer"));
}
test("duplicate answers are invalid, even when identical", () => invalidWith(question() + "\nCorrect: A", "duplicate_answer"));
test("text after an answer is not silently discarded", () => invalidWith(question() + "\nForgotten text", "unexpected_content"));
test("an answer before options is not silently accepted", () => invalidWith(question().replace("(A)", "Ans: A\n(A)"), "duplicate_answer", "unexpected_content"));

test("an invalid question between two valid ones cannot poison the batch", () => {
  const result = parseQuestions([question(1), question(2).replace("\nAns: A", ""), question(3)].join("\n\n"));
  assert.equal(result.total, 3);
  assert.deepEqual(result.valid.map((item) => item.sourceNumber), ["1", "3"]);
  assert.equal(result.invalid[0].sourceNumber, "2");
});

test("unclosed math or code blocks cannot swallow the next explicit question", () => {
  for (const start of ["$$", "```text"]) {
    const result = parseQuestions(question(1, { prompt: start + "\nbroken content" }) + "\n\n" + question(2));
    assert.equal(result.invalid.length, 1);
    assert.equal(result.valid[0].sourceNumber, "2");
  }
});

test("malformed LaTeX is preserved for the renderer; structure can still be valid", () => {
  const prompt = String.raw`Broken $\frac{1}{$ and unsupported $\notACommand{x}$`;
  const result = parseQuestions(question(1, { prompt }));
  assert.equal(result.valid[0].questionText, prompt);
});

test("blank input is a no-op", () => assert.deepEqual(parseQuestions(" \r\n\t"), { total: 0, valid: [], invalid: [] }));
test("unrecognized preamble is reported instead of discarded", () => {
  const result = parseQuestions("Import title\n\n" + question());
  assert.equal(result.invalid.length, 1);
  assert.equal(result.valid.length, 1);
  assert.equal(result.invalid[0].raw, "Import title\n\n");
});
