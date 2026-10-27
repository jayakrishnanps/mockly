import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeakAreaReportPrompt, parseWeakAreaReport, validateWeakAreaReportInput } from "../src/lib/weak-area-report.ts";

const mockId = "5d1d09b6-7ac2-4a95-a69b-dd9d3eb42440";
const header = `# Mockly Weak Areas v1\nMock: ${mockId}\n| Subject | Area | Focus | Priority |\n| --- | --- | --- | --- |`;
const row = "| Math | Reverse percentages | Accuracy | High |";
const area = () => ({ subject: "Math", area: "Reverse percentages", focus: "Accuracy", priority: "High" });

test("weak-area reports preserve ranked rows and canonicalise permitted values", () => {
  const report = `${header}\n${row}\n| reasoning | Changing differences | speed | medium |`;
  assert.deepEqual(parseWeakAreaReport(report), { ok: true, value: {
    sourceTestId: mockId,
    areas: [area(), { subject: "Reasoning", area: "Changing differences", focus: "Speed", priority: "Medium" }],
  } });
});

test("empty reports remain valid and do not invent a weakness", () => {
  assert.deepEqual(parseWeakAreaReport(header), { ok: true, value: { sourceTestId: mockId, areas: [] } });
  assert.equal(parseWeakAreaReport(`${header}\n| Math | None | None | None |`).ok, false);
});

test("complete outer Markdown fences, CRLF, spacing and aligned separators are accepted", () => {
  const report = `\n\n\`\`\`markdown\n${header.replace("| --- | --- | --- | --- |", "| :--- | ---: | :---: | --- |")}\n\n${row}\n\`\`\`\n`.replaceAll("\n", "\r\n");
  assert.equal(parseWeakAreaReport(report).ok, true);
  assert.equal(parseWeakAreaReport(`\`\`\`\n${header}\n${row}\n\`\`\``).ok, true);
  assert.equal(parseWeakAreaReport(`\`\`\`markdown\n${header}\n${row}`).ok, false);
});

test("unrelated prose, changed report versions and malformed table rows are rejected", () => {
  const invalid = [
    `Here are your weaknesses.\n${header}\n${row}`,
    header.replace("v1", "v2"),
    header.replace(mockId, "unknown"),
    header.replace("Subject | Area", "Topic | Area"),
    header.replace("| --- | --- | --- | --- |", "| --- | --- | --- |"),
    `${header}\n| Math | Percentages | Accuracy |`,
    `${header}\n${row}\nPractice daily.`,
    `${header}\n| Math | Percentages\nand ratios | Both | High |`,
  ];
  for (const report of invalid) assert.equal(parseWeakAreaReport(report).ok, false, report);
});

test("unknown categories, rich content, long areas and duplicate names are rejected", () => {
  for (const value of [
    { ...area(), subject: "Science" },
    { ...area(), focus: "Recovered" },
    { ...area(), priority: "Urgent" },
    { ...area(), area: "<script>alert(1)</script>" },
    { ...area(), area: "https://example.com" },
    { ...area(), area: "www.example.com" },
    { ...area(), area: "[Percentages](example.com)" },
    { ...area(), area: "**Percentages**" },
    { ...area(), area: "Percentages\nRatios" },
    { ...area(), area: "x".repeat(101) },
    { ...area(), area: "   " },
    { ...area(), score: 90 },
  ]) assert.equal(validateWeakAreaReportInput({ sourceTestId: mockId, areas: [value] }).ok, false);
  assert.equal(validateWeakAreaReportInput({ sourceTestId: mockId, areas: [area(), { ...area(), area: "reverse   PERCENTAGES" }] }).ok, false);
});

test("server validation enforces shape and bounds without mutating supplied input", () => {
  const input = { sourceTestId: mockId.toUpperCase(), areas: [{ ...area(), area: " Reverse  percentages " }] };
  const snapshot = structuredClone(input);
  assert.deepEqual(validateWeakAreaReportInput(input), { ok: true, value: { sourceTestId: mockId, areas: [area()] } });
  assert.deepEqual(input, snapshot);
  for (const value of [null, [], {}, { sourceTestId: "wrong", areas: [] }, { sourceTestId: mockId, areas: null }, { ...input, user: "HE" }]) {
    assert.equal(validateWeakAreaReportInput(value).ok, false);
  }
  assert.equal(validateWeakAreaReportInput({ sourceTestId: mockId, areas: Array.from({ length: 13 }, (_, index) => ({ ...area(), area: `Area ${index}` })) }).ok, false);
  assert.equal(validateWeakAreaReportInput({ sourceTestId: mockId, areas: Array.from({ length: 12 }, (_, index) => ({ ...area(), area: `Area ${index}` })) }).ok, true);
  assert.equal(parseWeakAreaReport("x".repeat(20001)).ok, false);
});

test("the separate follow-up prompt binds its report to the mock and keeps the format compact", () => {
  const prompt = buildWeakAreaReportPrompt(mockId.toUpperCase(), 'A title\nwith "quotes"');
  assert.ok(prompt.includes(`Mock: ${mockId}`));
  assert.ok(prompt.includes('| Subject | Area | Focus | Priority |'));
  assert.ok(prompt.includes(JSON.stringify('A title with "quotes"')));
  assert.ok(prompt.includes("fractions and decimals"));
  assert.ok(prompt.includes("do not infer causes"));
  assert.ok(prompt.split(/\s+/).length < 700);
  assert.throws(() => buildWeakAreaReportPrompt("invalid", "Mock"), /valid mock ID/);
});
