import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWeakAreaReportPrompt, normalizeWeakAreaSubtaskText, parseWeakAreaReport, validateSavedWeakAreaReportInput, validateWeakAreaReportInput } from "../src/lib/weak-area-report.ts";

const mockId = "5d1d09b6-7ac2-4a95-a69b-dd9d3eb42440";
const header = `# Mockly Weak Areas v1\nMock: ${mockId}\n| Subject | Area | Focus | Priority |\n| --- | --- | --- | --- |`;
const row = "| Math | Reverse percentages | Accuracy | High |";
const area = () => ({ subject: "Math", area: "Reverse percentages", focus: "Accuracy", priority: "High" });
const subtasks = () => [
  { text: "Find the original price in 8 examples with 10% or 20% discounts.", completed: false },
  { text: "Check each original price by applying the stated discount again.", completed: false },
  { text: "Redo 5 missed discount examples without the earlier working.", completed: false },
];
const taskArea = () => ({ ...area(), subtasks: subtasks() });
const taskHeader = `# Mockly Weak Areas v2\nMock: ${mockId}`;
const taskBlock = (value = taskArea()) => `## ${value.area}\nSubject: ${value.subject}\nFocus: ${value.focus}\nPriority: ${value.priority}\n${value.subtasks.map((task) => `- [${task.completed ? "x" : " "}] ${task.text}`).join("\n")}`;

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
    header.replace("v1", "v3"),
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
  assert.ok(prompt.includes("# Mockly Weak Areas v2"));
  assert.ok(prompt.includes("- [ ]"));
  assert.ok(prompt.includes("80/20 rule as a focus heuristic"));
  assert.ok(prompt.includes("3–10"));
  assert.ok(prompt.includes("finite completion condition"));
  assert.ok(prompt.includes('"Study addition"'));
  assert.ok(prompt.includes("Completing steps records practice, not proof of mastery"));
  assert.ok(prompt.includes(JSON.stringify('A title with "quotes"')));
  assert.ok(prompt.includes("fractions and decimals"));
  assert.ok(prompt.includes("do not infer causes"));
  assert.ok(prompt.includes('"Multiplying 9 by 7"'));
  assert.ok(prompt.includes("never invent a narrower issue"));
  assert.ok(prompt.split(/\s+/).length < 700);
  assert.throws(() => buildWeakAreaReportPrompt("invalid", "Mock"), /valid mock ID/);
});

test("v2 reports preserve ordered concrete practice steps while v1 remains unchanged", () => {
  const second = { ...taskArea(), subject: "Reasoning", area: "Changing differences", focus: "Speed", priority: "Medium" };
  assert.deepEqual(parseWeakAreaReport(`${taskHeader}\n\n${taskBlock()}\n\n${taskBlock(second)}`), {
    ok: true, value: { sourceTestId: mockId, areas: [taskArea(), second] },
  });
  assert.deepEqual(parseWeakAreaReport(`${taskHeader}\n${taskBlock()}\n${taskBlock(second).replace("## ", "##\t")}`), {
    ok: true, value: { sourceTestId: mockId, areas: [taskArea(), second] },
  });
  assert.deepEqual(parseWeakAreaReport(`${header}\n${row}`), { ok: true, value: { sourceTestId: mockId, areas: [area()] } });
});

test("v2 accepts empty reports, complete fences, case-normalised categories and CRLF", () => {
  assert.deepEqual(parseWeakAreaReport(taskHeader), { ok: true, value: { sourceTestId: mockId, areas: [] } });
  const report = `${taskHeader.replace(mockId, mockId.toUpperCase())}\n${taskBlock().replace("Subject: Math", "Subject: math").replace("Focus: Accuracy", "Focus: accuracy")}`;
  assert.deepEqual(parseWeakAreaReport(`\`\`\`md\n${report}\n\`\`\``.replaceAll("\n", "\r\n")), {
    ok: true, value: { sourceTestId: mockId, areas: [taskArea()] },
  });
});

test("v2 requires exactly the area metadata and 3 to 10 unchecked steps", () => {
  const valid = `${taskHeader}\n${taskBlock()}`;
  for (const report of [
    `${taskHeader}\n${taskBlock({ ...taskArea(), subtasks: subtasks().slice(0, 2) })}`,
    `${taskHeader}\n${taskBlock({ ...taskArea(), subtasks: [] })}`,
    `${taskHeader}\n${taskBlock({ ...taskArea(), subtasks: Array.from({ length: 11 }, (_, index) => ({ text: `Complete step ${index + 1}.`, completed: false })) })}`,
    valid.replace("- [ ]", "- [x]"), valid.replace("- [ ]", "- [X]"),
    valid.replace("Subject: Math", "Subject: Science"), valid.replace("Focus: Accuracy", "Focus: Recovered"),
    valid.replace("Priority: High", "Urgency: High"), valid.replace("## Reverse", "### Reverse"),
    `${valid}\nHere are some extra tips.`, `${valid}\n### Extra`,
    `${taskHeader}\n| Subject | Area | Focus | Priority |`,
    valid.replace("- [ ] Find", "1. Find"), valid.replace("- [ ] Find", "- [ ] **Find**"),
  ]) assert.equal(parseWeakAreaReport(report).ok, false, report);
  const ten = { ...taskArea(), subtasks: Array.from({ length: 10 }, (_, index) => ({ text: `Complete set ${index + 1} of 5 reverse-percentage questions.`, completed: false })) };
  assert.equal(parseWeakAreaReport(`${taskHeader}\n${taskBlock(ten)}`).ok, true);
});

test("subtask validation rejects malformed, duplicate or precompleted imported actions", () => {
  const input = { sourceTestId: mockId, areas: [taskArea()] };
  const before = structuredClone(input);
  assert.deepEqual(validateWeakAreaReportInput(input), { ok: true, value: input });
  assert.deepEqual(input, before);
  for (const tasks of [
    null, [], ["Read notes", "Practise", "Check"],
    subtasks().map((task, index) => index ? task : { ...task, completed: true }),
    subtasks().map((task, index) => index ? task : { ...task, completed: "false" }),
    subtasks().map((task, index) => index ? task : { text: task.text }),
    subtasks().map((task, index) => index ? task : { ...task, id: "invented" }),
    subtasks().map((task, index) => index ? task : { ...task, text: "x".repeat(241) }),
    [subtasks()[0], { ...subtasks()[0], text: `  ${subtasks()[0].text.toUpperCase()}  ` }, subtasks()[2]],
    subtasks().map((task, index) => index ? task : { ...task, text: "See https://example.com" }),
    subtasks().map((task, index) => index ? task : { ...task, text: "Read\nthen practise" }),
    subtasks().map((task, index) => index ? task : { ...task, text: "$\\frac{1}{2}$" }),
  ]) assert.equal(validateWeakAreaReportInput({ sourceTestId: mockId, areas: [{ ...area(), subtasks: tasks }] }).ok, false);
  assert.equal(normalizeWeakAreaSubtaskText("  Recall  9 × 7 in 10 trials.  "), "Recall 9 × 7 in 10 trials.");
  assert.equal(normalizeWeakAreaSubtaskText("x".repeat(240)), "x".repeat(240));
  assert.equal(normalizeWeakAreaSubtaskText("x".repeat(241)), null);
});

test("stored validation preserves real progress without allowing it through new imports", () => {
  const completedArea = { ...taskArea(), subtasks: subtasks().map((task, index) => ({ ...task, completed: index === 0 })) };
  const input = { sourceTestId: mockId, areas: [completedArea, { ...area(), area: "Combining work rates" }] };
  assert.deepEqual(validateSavedWeakAreaReportInput(input), { ok: true, value: input });
  assert.equal(validateWeakAreaReportInput(input).ok, false);
  assert.equal(validateSavedWeakAreaReportInput({ sourceTestId: mockId, areas: [{ ...completedArea, subtasks: [{ text: "One incomplete task", completed: true }] }] }).ok, false);
  const malformed = { ...completedArea, subtasks: completedArea.subtasks.map((task, index) => index ? task : { ...task, completed: null }) };
  assert.equal(validateSavedWeakAreaReportInput({ sourceTestId: mockId, areas: [malformed] }).ok, false);
});
