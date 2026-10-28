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
  assert.ok(prompt.includes("one fenced markdown code block, with nothing outside it"));
  assert.ok(prompt.includes("Preserve every # marker and line break"));
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

test("mobile copies keep bare area titles and collapsed metadata unambiguous", () => {
  const sourceTestId = "48877d82-b59a-4c96-8ade-700ea4267d8a";
  const tasks = [
    "Recall 4 × 7 and 7 × 4 in 10 mixed trials; answer every trial and record any mistakes.",
    "Complete 10 alternating prompts of 4 × 7 and 7 × 4 without checking an earlier answer; finish all 10 and record the time for each.",
    "Complete a final 10 mixed trials of 4 × 7 and 7 × 4; compare the recorded times with the recent attempt times of 7.16s for 4 × 7 and 7.05s for 7 × 4.",
  ];
  const mobile = `Mockly Weak Areas v2\n\nMock: ${sourceTestId}\n\nMultiplying 4 by 7 and 7 by 4\n\nSubject: Math Focus: Speed Priority: High\n\n${tasks.map((text) => `- [ ] ${text}`).join("\n")}`;
  const expected = {
    ok: true,
    value: { sourceTestId, areas: [{ subject: "Math", area: "Multiplying 4 by 7 and 7 by 4", focus: "Speed", priority: "High", subtasks: tasks.map((text) => ({ text, completed: false })) }] },
  };
  assert.deepEqual(parseWeakAreaReport(mobile), expected);
  assert.deepEqual(parseWeakAreaReport(`\`\`\`markdown\n${mobile}\n\`\`\``), expected);
  const second = mobile.slice(mobile.indexOf("Multiplying 4 by 7")).replace("Multiplying 4 by 7 and 7 by 4", "Multiplying 4 by 8 and 8 by 4");
  const multiple = parseWeakAreaReport(`${mobile}\n\n${second}`);
  assert.equal(multiple.ok, true);
  assert.deepEqual(multiple.value.areas.map((area) => area.area), ["Multiplying 4 by 7 and 7 by 4", "Multiplying 4 by 8 and 8 by 4"]);
  for (const malformed of [
    mobile.replace("Subject: Math Focus: Speed Priority: High", "Subject: Science Focus: Speed Priority: High"),
    mobile.replace("Subject: Math Focus: Speed Priority: High", "Subject: Math Priority: High"),
    mobile.replace("Subject: Math Focus: Speed Priority: High", "Subject: Math Focus: Speed Priority: High extra"),
    mobile.replace("- [ ] Recall", "- [x] Recall"),
    `${mobile}\nHere are some extra tips.`,
  ]) assert.equal(parseWeakAreaReport(malformed).ok, false, malformed);
});

test("pasted v2 reports accept plain practice bullets and Markdown metadata line breaks", () => {
  const sourceTestId = "8cbd445a-c88d-4f1e-87ca-fe790f21abe4";
  const areas = [
    {
      subject: "Math", area: "Subtracting decimal numbers", focus: "Both", priority: "High",
      subtasks: [
        "Solve 14.2 − 6.85 and 9.03 − 2.6 three times each. Check all 6 answers and record every mistake.",
        "Solve 5.0 − 0.67, 7.8 − 2.35 and 9.06 − 1.7 twice each in mixed order. Check all 6 answers and record the time for each.",
        "Time one fresh attempt each of 14.2 − 6.85, 5.0 − 0.67 and 9.03 − 2.6. Compare with the recorded 30, 28 and 42 seconds. Check all 3 answers.",
      ].map((text) => ({ text, completed: false })),
    },
    {
      subject: "Math", area: "Adding and subtracting several decimals", focus: "Both", priority: "High",
      subtasks: [
        "Solve 2.75 + 3.4 − 1.08 three times. Check each answer and record any errors.",
        "Solve 8.24 − 3.95 + 0.67 and 9.0 − 2.86 − 1.7 twice each. Check all 4 answers and record any skipped questions.",
        "Solve 4.6 + 2.05 − 1.3 and 5.25 + 0.7 − 2.4 twice each. Record accuracy and time. Compare with the recorded 34 and 74 seconds.",
      ].map((text) => ({ text, completed: false })),
    },
    {
      subject: "Math", area: "Subtracting two-digit whole numbers", focus: "Speed", priority: "Medium",
      subtasks: [
        "Solve 76 − 38 and 72 − 38 twice each. Check all 4 answers and record the time taken.",
        "Solve 91 − 56, 81 − 39 and 70 − 36 twice each in mixed order. Check all 6 answers and record their times.",
        "Compare your new times for 76 − 38, 72 − 38 and 70 − 36 with the recorded 58, 51 and 11 seconds. Record whether each became faster without losing accuracy.",
      ].map((text) => ({ text, completed: false })),
    },
    {
      subject: "Math", area: "Finding missing numbers in equations", focus: "Speed", priority: "Medium",
      subtasks: [
        "Solve 84 ÷ x = 12, 63 ÷ x = 7 and x ÷ 5 = 9 twice each. Check all 6 answers and record any mistakes.",
        "Solve x + 28 = 50, 45 − x = 19 and x − 4 = 7 twice each. Record accuracy and time for all 6 attempts.",
        "Solve 4 × x − 3 = 29, 3 × x + 5 = 26 and (x + 5) × 2 = 24 twice each. Check all answers and compare the time for 4 × x − 3 = 29 with its recorded 65 seconds.",
      ].map((text) => ({ text, completed: false })),
    },
    {
      subject: "Math", area: "Adding two-digit whole numbers", focus: "Accuracy", priority: "Medium",
      subtasks: [
        "Solve 37 + 49 and 66 + 29 three times each in mixed order. Check all 6 answers and record every incorrect total.",
        "Solve 72 + 19 and 87 + 15 twice each. Check all 4 answers for accuracy.",
        "Solve 37 + 49 and 66 + 29 once each without looking at previous answers. Check both answers and compare your times with the recorded 29 and 20 seconds.",
      ].map((text) => ({ text, completed: false })),
    },
    {
      subject: "Math", area: "Calculating with brackets and mixed operations", focus: "Speed", priority: "Low",
      subtasks: [
        "Solve 18 ÷ 3 + 2 × 4 and (10 − 2) × 3 ÷ 4 twice each. Check all 4 answers and record their times.",
        "Solve (15 − 2) × 5 and (7 + 5) × (6 − 4) twice each. Check all 4 answers and record their times.",
        "Solve 20 − (4 × 3), 18 ÷ 3 + 2 × 4 and (10 − 2) × 3 ÷ 4 once each. Compare with the recorded 22, 38 and 39 seconds and check all 3 answers.",
      ].map((text) => ({ text, completed: false })),
    },
  ];
  const report = `Mockly Weak Areas v2\n\nMock: ${sourceTestId}\n\n${areas.map((value) =>
    `## ${value.area}\n\nSubject: ${value.subject}\\\nFocus: ${value.focus}\\\nPriority: ${value.priority}\n\n${value.subtasks.map((task) => `- ${task.text}`).join("\n")}`,
  ).join("\n\n")}`;
  assert.deepEqual(parseWeakAreaReport(report), { ok: true, value: { sourceTestId, areas } });
});

test("v2 accepts mixed plain and unchecked bullets without importing completed checkboxes", () => {
  const report = `${taskHeader}\n${taskBlock()}`;
  assert.deepEqual(parseWeakAreaReport(report.replace("- [ ] Find", "- Find")), {
    ok: true, value: { sourceTestId: mockId, areas: [taskArea()] },
  });
  const plainReport = report.replaceAll("- [ ] ", "- ");
  for (const marker of ["[x] ", "[X] ", "[✓] ", "[] ", "[ ]"]) {
    assert.equal(parseWeakAreaReport(plainReport.replace("- Find", `- ${marker}Find`)).ok, false, marker);
  }
  for (const value of [
    report.replace("Subject: Math", "Subject: Math\\\\"),
    report.replace("- [ ] Find", "- [ ] \\frac{1}{2} Find"),
    report.replace("- [ ] Find", "- [ ] Find\\"),
    report.replace("Subject: Math", "Subject: Ma\\th"),
  ]) assert.equal(parseWeakAreaReport(value).ok, false, value);
  const structuralBreaks = [
    "# Mockly Weak Areas v2\\", `Mock: ${mockId}\\`, "## Reverse percentages\\",
    "Subject: Math\\", "Focus: Accuracy\\", "Priority: High\\",
    ...subtasks().map((task) => `- ${task.text}`),
  ].join("\n");
  assert.deepEqual(parseWeakAreaReport(structuralBreaks), { ok: true, value: { sourceTestId: mockId, areas: [taskArea()] } });
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
