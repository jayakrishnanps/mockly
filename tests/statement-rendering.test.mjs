import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { parseQuestions } from "../src/lib/parser.ts";
import { remarkStatementBreaks } from "../src/lib/remark-statement-breaks.ts";

function render(text, preserveStatements = true) {
  return renderToStaticMarkup(createElement(Markdown, {
    remarkPlugins: preserveStatements ? [remarkMath, remarkStatementBreaks] : [remarkMath],
    rehypePlugins: [rehypeKatex],
    children: text,
  }));
}

for (const newline of ["\n", "\r\n"]) for (const labels of [["I", "II", "III"], ["1", "2", "3"]]) {
  test(`pasted Statement ${labels[0]} labels retain separate rendered lines with ${JSON.stringify(newline)}`, () => {
    const source = [
      "Q1. Consider the following statements:",
      `Statement ${labels[0]}: The first statement is **bold**.`,
      `Statement ${labels[1]}: The second statement has $x^2$.`,
      `Statement ${labels[2]}: The third statement.`,
      "(A) Only I", "(B) Only II", "(C) I and II", "(D) All three", "Ans: C",
    ].join(newline);
    const { valid, invalid } = parseQuestions(source);
    assert.equal(invalid.length, 0);
    const html = render(valid[0].questionText);
    assert.equal((html.match(/<br\/>/g) ?? []).length, 3);
    for (const label of labels) {
      assert.match(html, new RegExp(`<br/>\\s*Statement ${label}:`));
    }
    assert.ok(html.includes("<strong>bold</strong>"));
    assert.ok(html.includes('class="katex"'));
    assert.equal(valid[0].options[0], "Only I");
  });
}

test("bold or italic statement labels retain their formatting and separate lines", () => {
  for (const label of ["II", "2"]) for (const marker of ["**", "*"]) {
    for (const statement of [`${marker}Statement ${label}:${marker}`, `${marker}Statement ${label}${marker}:`]) {
      const html = render(`Statement I: First.\n${statement} Second with $x^2$.`);
      assert.equal((html.match(/<br\/>/g) ?? []).length, 1);
      assert.match(html, new RegExp(`<br/>\\s*<(?:strong|em)>Statement ${label}`));
      assert.ok(html.includes('class="katex"'));
    }
  }
});

test("existing Markdown hard breaks and paragraph boundaries are not doubled", () => {
  for (const text of [
    "Statement I: First.  \nStatement II: Second.",
    "Statement I: First.\\\nStatement II: Second.",
    "Statement I: First.\n\nStatement II: Second.",
    "Statement 1: First.  \n**Statement 2:** Second.",
  ]) {
    assert.equal(render(text), render(text, false));
  }
});

test("ordinary wrapping, code, math, lists and inline statement references stay unchanged", () => {
  const samples = [
    "An ordinary wrapped\nparagraph with **emphasis** and [a link](#details).",
    "Statement I: A statement that wraps\nonto another source line.",
    "Compare Statement I: first and Statement II: second.",
    "Compare **Statement 1:** first and **Statement 2:** second.",
    "- First item\n- Second item\n\n1. First\n2. Second",
    "```text\nStatement I: First.\nStatement II: Second.\n```",
    "```text\nStatement 1: First.\n**Statement 2:** Second.\n```",
    "`Statement I: First.\nStatement II: Second.`",
    "$\\text{Statement I: first}\nStatement II: second$",
    "$\\text{Statement 1: first}\nStatement 2: second$",
    "$$\n\\text{Statement I: first}\nStatement II: second\n$$",
  ];
  for (const text of samples) assert.equal(render(text), render(text, false));
});
