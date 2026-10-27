import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { remarkStatementBreaks } from "../src/lib/remark-statement-breaks.ts";
import { parseHEWeakReport } from "../src/lib/he-weak-report.ts";

function renderContent(text) {
  return renderToStaticMarkup(createElement(Markdown, {
    skipHtml: true,
    remarkPlugins: [remarkMath, remarkStatementBreaks],
    rehypePlugins: [[rehypeKatex, { trust: false, strict: "ignore", maxExpand: 1000, maxSize: 20 }]],
  }, text));
}

test("HE practice content preserves Malayalam and renders fractions through the existing Markdown stack", () => {
  const explanation = "- ഒൻപതിന്റെ ഗുണനപ്പട്ടിക പതുക്കെ വായിക്കൂ.\n- ക്\u200dഷ എന്നതിലും ന്\u200c എന്നതിലും അക്ഷരങ്ങൾ മാറ്റരുത്.";
  const practice = "- ആദ്യം $\\frac{3}{4}$ നോക്കൂ.\n\n$$\n\\sqrt{9}=3\n$$\n\n- വീണ്ടും ചെയ്യൂ.";
  const parsed = parseHEWeakReport(`# Mockly HE Weak v1\nMock: 5d1d09b6-7ac2-4a95-a69b-dd9d3eb42440\n## ഭിന്നസംഖ്യകൾ\n### Understand\n${explanation}\n### Practise\n${practice}`);
  assert.equal(parsed.ok, true);
  const html = renderContent(`${parsed.value.explanation}\n\n${parsed.value.practice}`);
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

test("HE's comma-separated multiplication example retains both formulas and surrounding Malayalam", () => {
  const practice = "- ആദ്യം $4 \\times 8 = 32$, $8 \\times 4 = 32$ എന്നിവ നോക്കി വായിക്കുക. പിന്നീട് ഉത്തരങ്ങൾ മറച്ചുവെച്ച് പറയുക.";
  const source = `# Mockly HE Weak v1\nMock: 6b123384-7cbc-4995-a3ee-d01b7297c02f\n## നാലിന്റെ ഗുണനപ്പട്ടികയിൽ ചില ഉത്തരങ്ങൾ പറയാൻ സമയം കൂടുന്നു\n### Understand\n- നാലിന്റെ ഗുണനപ്പട്ടികയിലെ ചോദ്യങ്ങൾ ഇപ്പോൾ ശരിയായി ചെയ്യുന്നുണ്ട്.\n### Practise\n${practice}`;
  const parsed = parseHEWeakReport(source);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.practice, practice);
  const html = renderContent(parsed.value.practice);
  assert.equal((html.match(/class="katex"/g) ?? []).length, 2);
  assert.match(html, /<\/span>, <span class="katex">/);
  assert.ok(html.includes(" എന്നിവ നോക്കി വായിക്കുക."));
  assert.equal(html.includes("katex-error"), false);
});

test("every shared-renderer caller receives math styling and warnings remain conditional", async () => {
  const [component, styles, katexStyles] = await Promise.all([
    readFile(new URL("../src/components/question-content.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/question-content.css", import.meta.url), "utf8"),
    readFile(new URL("../node_modules/katex/dist/katex.min.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /import\s+["']katex\/dist\/katex\.min\.css["']/);
  assert.match(component, /import\s+["']\.\/question-content\.css["']/);
  const mathmlRule = katexStyles.match(/\.katex\s+\.katex-mathml\s*\{([^}]+)\}/)?.[1];
  assert.ok(mathmlRule, "KaTeX must visually hide its accessible MathML representation");
  assert.match(mathmlRule, /position\s*:\s*absolute/);
  assert.match(mathmlRule, /clip-path\s*:\s*inset\(50%\)/);
  assert.match(mathmlRule, /overflow\s*:\s*hidden/);
  assert.match(styles, /\.question-content\s+\.math-warning\s*\{\s*display\s*:\s*none\s*;?\s*\}/);
  assert.match(styles, /\.question-content:has\(\.katex-error\)\s+\.math-warning\s*\{\s*display\s*:\s*block\s*;?\s*\}/);
});

test("malformed LaTeX remains visible for correction rather than disappearing", () => {
  const html = renderContent("- ഇത് പരിശോധിക്കൂ: $\\frac{1}$.");
  assert.ok(html.includes('class="katex-error"'));
  assert.ok(html.includes("\\frac{1}"));
  assert.ok(html.includes("ഇത് പരിശോധിക്കൂ:"));
});
