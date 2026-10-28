import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHEWeakReportPrompt, parseHEWeakReport, validateHEWeakReportInput } from "../src/lib/he-weak-report.ts";

const mockId = "5d1d09b6-7ac2-4a95-a69b-dd9d3eb42440";
const report = () => ({ sourceTestId: mockId, title: "ഒൻപതിന്റെ ഗുണനപ്പട്ടിക", explanation: "- ഒൻപത് കൊണ്ട് ഗുണിക്കുമ്പോൾ ഉത്തരം ഓർക്കാൻ സമയം എടുക്കുന്നു.", practice: "- ആദ്യം $9 \\times 7 = 63$ എന്ന് പറഞ്ഞ് നോക്കൂ.\n- പിന്നെ നോക്കാതെ വീണ്ടും പറയൂ." });
const source = (value = report()) => `# Mockly HE Weak v1\nMock: ${value.sourceTestId}\n## ${value.title}\n### Understand\n${value.explanation}\n### Practise\n${value.practice}`;

test("HE reports preserve Malayalam joining marks, Markdown and raw LaTeX", () => {
  const value = { ...report(), explanation: "- ക്\u200dഷ എന്നാണ് എഴുതിയത്; ന്\u200c എന്നതും മാറ്റരുത്.\n\nഇത് പതുക്കെ വായിക്കൂ.", practice: "- ഭിന്നസംഖ്യ $\\frac{3}{4}$ നോക്കൂ.\n\n$$\n\\sqrt{9}=3\n$$\n\n- വീണ്ടും ചെയ്യൂ." };
  assert.deepEqual(parseHEWeakReport(source(value)), { ok: true, value });
});

test("valid mathematical comparisons are not mistaken for HTML tags", () => {
  for (const practice of ["- ആദ്യം $x<y>z$ നോക്കൂ.", "- ഇത് നോക്കൂ.\n\n$$\nx<y>z\n$$"]) {
    const value = { ...report(), practice };
    assert.deepEqual(parseHEWeakReport(source(value)), { ok: true, value });
  }
  for (const practice of ["- മലയാളം <script>bad</script>", "- മലയാളം $x <script>bad</script>", "- മലയാളം \\$ <script>bad</script> \\$"]) {
    assert.equal(validateHEWeakReportInput({ ...report(), practice }).ok, false);
  }
});

test("HE reports accept complete fences, blank lines and Windows line endings", () => {
  assert.deepEqual(parseHEWeakReport(`\n\`\`\`markdown\n${source()}\n\`\`\`\n`.replaceAll("\n", "\r\n")), { ok: true, value: report() });
  assert.deepEqual(parseHEWeakReport(source().replace(mockId, mockId.toUpperCase())), { ok: true, value: report() });
  assert.equal(parseHEWeakReport(`\`\`\`markdown\n${source()}`).ok, false);
});

test("HE report headings and source identity cannot be replaced or extended", () => {
  for (const text of [
    source().replace("v1", "v2"), source().replace(mockId, "unknown"),
    source().replace("### Understand", "### Explanation"), source().replace("### Practise", "### Practice"),
    `Here is your report\n${source()}`, `${source()}\n### More\nമറ്റൊരു കാര്യം`,
    `${source()}\n${source()}`, source().replace("## ഒൻപതിന്റെ", "### ഒൻപതിന്റെ"),
  ]) assert.equal(parseHEWeakReport(text).ok, false, text);
});

test("HE content needs Malayalam and rejects images, HTML, links and control characters", () => {
  for (const patch of [
    { title: "Nine times table" }, { explanation: "Onpathinte gunanappattika" }, { practice: "Practice every day" },
    { title: "**ഗുണനപ്പട്ടിക**" }, { title: "മലയാളം\nതലക്കെട്ട്" },
    { explanation: "മലയാളം <script>bad</script>" }, { explanation: "മലയാളം ![ചിത്രം](photo.png)" },
    { practice: "മലയാളം [ലിങ്ക്](https://example.com)" }, { practice: "മലയാളം https://example.com" },
    { practice: "മലയാളം www.example.com" }, { practice: "മലയാളം\n[link]: example.com" },
    { practice: "മലയാളം\u0000" }, { practice: "മലയാളം\u0085" },
    { practice: "മലയാളം\n### More\nവേറെ" }, { practice: "മലയാളം\n```code```" },
  ]) assert.equal(validateHEWeakReportInput({ ...report(), ...patch }).ok, false);
});

test("HE server validation checks shape and bounded content without mutating input", () => {
  const value = { ...report(), sourceTestId: mockId.toUpperCase(), title: ` ${report().title} ` };
  const before = structuredClone(value);
  assert.deepEqual(validateHEWeakReportInput(value), { ok: true, value: report() });
  assert.deepEqual(value, before);
  for (const invalid of [null, [], {}, { ...report(), sourceTestId: "wrong" }, { ...report(), focus: "Speed" },
    { ...report(), title: "മ".repeat(121) }, { ...report(), explanation: "മ".repeat(3001) },
    { ...report(), practice: "മ".repeat(5001) }, { ...report(), practice: "  " }]) {
    assert.equal(validateHEWeakReportInput(invalid).ok, false);
  }
  assert.equal(parseHEWeakReport("x".repeat(20001)).ok, false);
});

test("HE follow-up prompt asks for beginner spoken Malayalam and renderer-compatible maths", () => {
  const prompt = buildHEWeakReportPrompt(mockId.toUpperCase(), 'Test\nwith "quotes"');
  assert.ok(prompt.includes(`Mock: ${mockId}`));
  assert.ok(prompt.includes(JSON.stringify('Test with "quotes"')));
  assert.ok(prompt.includes("never Manglish"));
  assert.ok(prompt.includes("do not literally translate"));
  assert.ok(prompt.includes("combining marks"));
  assert.ok(prompt.includes("$...$"));
  assert.ok(prompt.includes("\\frac{a}{b}"));
  assert.ok(prompt.includes("### Understand"));
  assert.ok(prompt.includes("### Practise"));
  assert.ok(prompt.includes("one fenced markdown code block, with nothing outside it"));
  assert.ok(prompt.includes("Preserve every # marker and line break"));
  assert.ok(prompt.split(/\s+/).length < 650);
  assert.throws(() => buildHEWeakReportPrompt("invalid", "Mock"), /valid mock ID/);
});
