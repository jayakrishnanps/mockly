import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkStatementBreaks } from "../src/lib/remark-statement-breaks.ts";
import { parseHEWeakReport } from "../src/lib/he-weak-report.ts";

test("HE practice content preserves Malayalam and renders fractions through the existing Markdown stack", () => {
  const explanation = "- ഒൻപതിന്റെ ഗുണനപ്പട്ടിക പതുക്കെ വായിക്കൂ.\n- ക്\u200dഷ എന്നതിലും ന്\u200c എന്നതിലും അക്ഷരങ്ങൾ മാറ്റരുത്.";
  const practice = "- ആദ്യം $\\frac{3}{4}$ നോക്കൂ.\n\n$$\n\\sqrt{9}=3\n$$\n\n- വീണ്ടും ചെയ്യൂ.";
  const parsed = parseHEWeakReport(`# Mockly HE Weak v1\nMock: 5d1d09b6-7ac2-4a95-a69b-dd9d3eb42440\n## ഭിന്നസംഖ്യകൾ\n### Understand\n${explanation}\n### Practise\n${practice}`);
  assert.equal(parsed.ok, true);
  const html = renderToStaticMarkup(createElement(Markdown, {
    skipHtml: true,
    remarkPlugins: [remarkMath, remarkStatementBreaks],
    rehypePlugins: [[rehypeKatex, { trust: false, strict: "ignore", maxExpand: 1000, maxSize: 20 }]],
  }, `${parsed.value.explanation}\n\n${parsed.value.practice}`));
  assert.ok(html.includes("ഒൻപതിന്റെ ഗുണനപ്പട്ടിക"));
  assert.ok(html.includes("ക്\u200dഷ"));
  assert.ok(html.includes("ന്\u200c"));
  assert.ok(html.includes('class="katex"'));
  assert.ok(html.includes('class="katex-display"'));
  assert.equal((html.match(/<li>/g) ?? []).length, 4);
  assert.equal(html.includes("katex-error"), false);
  assert.equal(html.includes("�"), false);
  assert.equal(html.includes("<img"), false);
});
