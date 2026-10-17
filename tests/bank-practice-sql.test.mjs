import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { attempts, bankQuestions, questionBanks, tests } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { getBankPractice } from "../src/server/bank-practice.ts";
import { generateMockHistoryTxt, toExportableResult } from "../src/lib/export.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

test("bank history SQL and attempt selection run against local PostgreSQL without Neon", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  let clock = Date.parse("2026-10-17T10:00:00Z");

  async function fixture(size = 10) {
    const bankId = randomUUID();
    const mockId = randomUUID();
    const siblingId = randomUUID();
    await database.insert(questionBanks).values({ id: bankId, title: "Local practice bank" });
    const rows = Array.from({ length: size }, (_, index) => ({
      id: randomUUID(), bankId, position: index + 1, questionText: `Question ${index + 1}`,
      options: ["Correct", "Wrong", "Unused one", "Unused two"], correctIndex: 0,
    }));
    await database.insert(bankQuestions).values(rows);
    await database.insert(tests).values([mockId, siblingId].map((id) => ({
      id, title: "Local bank mock", sourceBankId: bankId, forUsers: ["JK", "HE"], questionLimit: 30, durationMinutes: 20,
    })));
    return { bankId, mockId, siblingId, rows };
  }

  async function encounter(mockId, entries, { user = "JK", submitted = true, snapshot } = {}) {
    clock += 1000;
    const questions = entries.map(({ question }) => ({
      id: question.id, position: question.position, questionText: question.questionText,
      options: ["Wrong", "Unused one", "Unused two", "Correct"], correctIndex: 3,
    }));
    const answers = entries.map(({ question, selectedIndex = 3, timeSpentMs = 1000, visited = true }) => ({
      questionId: question.id, selectedIndex, timeSpentMs, visited, markedForReview: false,
    }));
    await database.insert(attempts).values({
      id: randomUUID(), testId: mockId, takenBy: user,
      startedAt: new Date(clock - 1000).toISOString(), submittedAt: submitted ? new Date(clock).toISOString() : null,
      answers: snapshot ?? { version: 1, revision: 1, durationMinutes: 20, marksCorrect: "2", marksWrong: "0.5", questions, answers },
    });
  }

  await t.test("correct-only histories never become wrong reviews and skip thresholds are exact", async () => {
    const { bankId, mockId, rows } = await fixture();
    assert.equal((await getBankPractice(database, bankId, "JK")).size, 0);
    await encounter(mockId, [
      { question: rows[0] },
      { question: rows[1], selectedIndex: null, timeSpentMs: 5000 },
      { question: rows[2], selectedIndex: null, timeSpentMs: 4999 },
      { question: rows[3], selectedIndex: null, timeSpentMs: 6000, visited: false },
      { question: rows[4], selectedIndex: null, timeSpentMs: 0, visited: false },
    ]);
    const practice = await getBankPractice(database, bankId, "JK");
    assert.equal(practice.size, 2);
    assert.equal(practice.get(rows[0].id).review, null);
    assert.equal(practice.get(rows[0].id).count, 1);
    assert.equal(practice.get(rows[1].id).review, "skipped");
  });

  await t.test("wrong reviews clear after two later correct encounters across sibling mocks", async () => {
    const { bankId, mockId, siblingId, rows } = await fixture();
    const target = rows[0];
    await encounter(mockId, [{ question: target, selectedIndex: 0 }]);
    assert.equal((await getBankPractice(database, bankId, "JK")).get(target.id).review, "wrong");
    await encounter(siblingId, [{ question: target }]);
    await encounter(mockId, [{ question: rows[1] }]);
    await encounter(siblingId, [{ question: target, selectedIndex: null, timeSpentMs: 5000 }]);
    let practice = await getBankPractice(database, bankId, "JK");
    assert.equal(practice.get(target.id).review, "wrong");
    assert.equal(practice.get(target.id).count, 3);
    await encounter(mockId, [{ question: target }]);
    practice = await getBankPractice(database, bankId, "JK");
    assert.equal(practice.get(target.id).review, null);
    assert.equal(practice.get(target.id).count, 4);
    await encounter(siblingId, [{ question: target, selectedIndex: 0 }]);
    await encounter(mockId, [{ question: target }]);
    assert.equal((await getBankPractice(database, bankId, "JK")).get(target.id).review, "wrong");
  });

  await t.test("other users, other banks, unlinked mocks and unfinished attempts do not leak into history", async () => {
    const first = await fixture();
    const second = await fixture();
    const target = first.rows[0];
    await encounter(first.mockId, [{ question: target }]);
    await encounter(first.siblingId, [{ question: target, selectedIndex: 0 }], { user: "HE" });
    await encounter(first.siblingId, [{ question: target, selectedIndex: 0 }], { submitted: false });
    await encounter(second.mockId, [{ question: target, selectedIndex: 0 }]);
    const standaloneId = randomUUID();
    await database.insert(tests).values({ id: standaloneId, title: "Standalone", forUsers: ["JK"] });
    await encounter(standaloneId, [{ question: target, selectedIndex: 0 }]);
    const jk = (await getBankPractice(database, first.bankId, "JK")).get(target.id);
    assert.equal(jk.count, 1);
    assert.equal(jk.review, null);
    const he = (await getBankPractice(database, first.bankId, "HE")).get(target.id);
    assert.equal(he.count, 1);
    assert.equal(he.review, "wrong");
    assert.equal((await getBankPractice(database, second.bankId, "JK")).size, 0);
  });

  await t.test("malformed snapshots and duplicate encounters are excluded safely", async () => {
    const { bankId, mockId, rows } = await fixture();
    const question = { ...rows[0] };
    const answer = { questionId: question.id, selectedIndex: null, visited: true, timeSpentMs: 5000, markedForReview: false };
    for (const snapshot of [
      [], { version: 2, questions: [question], answers: [answer] },
      { version: 1, questions: {}, answers: null },
      { version: 1, questions: [question, question], answers: [answer] },
      { version: 1, questions: [question], answers: [answer, answer] },
      { version: 1, questions: [question], answers: [{ ...answer, selectedIndex: 4 }] },
      { version: 1, questions: [question], answers: [{ ...answer, timeSpentMs: "5000" }] },
    ]) await encounter(mockId, [], { snapshot });
    assert.equal((await getBankPractice(database, bankId, "JK")).size, 0);
    const legacyVisit = { ...answer };
    delete legacyVisit.visited;
    await encounter(mockId, [], { snapshot: { version: 1, questions: [question], answers: [legacyVisit] } });
    const practice = await getBankPractice(database, bankId, "JK");
    assert.equal(practice.size, 1);
    assert.equal(practice.get(question.id).review, "skipped");
    assert.equal(practice.get(question.id).count, 1);
  });

  await t.test("new mocks select six real wrongs and 24 unseen questions, preserve recovery and export saved answers", async () => {
    const { bankId, mockId, siblingId, rows } = await fixture(500);
    await encounter(mockId, rows.slice(0, 7).map((question) => ({ question })));
    const wrongRows = rows.slice(7, 14);
    await encounter(mockId, [
      ...wrongRows.map((question) => ({ question, selectedIndex: 0 })),
      { question: rows[14], selectedIndex: null, timeSpentMs: 5000 },
    ]);
    const store = createAttemptStore(database, () => clock);
    const started = await store.startOrResume(siblingId, "JK");
    const exam = await store.getExamData(started.attemptId, "JK");
    const selectedIds = new Set(exam.questions.map((question) => question.id));
    assert.equal(selectedIds.size, 30);
    assert.equal(wrongRows.filter((question) => selectedIds.has(question.id)).length, 6);
    assert.equal(rows.slice(0, 7).filter((question) => selectedIds.has(question.id)).length, 0);
    assert.equal(selectedIds.has(rows[14].id), false);
    assert.equal(rows.slice(15).filter((question) => selectedIds.has(question.id)).length, 24);
    assert.equal(JSON.stringify(exam).includes("correctIndex"), false);
    await database.insert(bankQuestions).values({
      id: randomUUID(), bankId, position: 501, questionText: "Added later", options: ["Correct", "B", "C", "D"], correctIndex: 0,
    });
    const resumed = await store.startOrResume(siblingId, "JK");
    assert.equal(resumed.attemptId, started.attemptId);
    assert.equal(resumed.resumed, true);
    assert.deepEqual((await store.getExamData(started.attemptId, "JK")).questions, exam.questions);
    const answers = exam.answers.map((answer, index) => ({
      ...answer, selectedIndex: exam.questions[index].options.indexOf(index === 0 ? "Wrong" : "Correct"),
      visited: true, timeSpentMs: 1000,
    }));
    clock += 30_000;
    await store.submitAttempt(started.attemptId, "JK", answers, exam.revision);
    await database.update(bankQuestions).set({ questionText: "Changed after submission" }).where(eq(bankQuestions.bankId, bankId));
    const data = await store.getMockExportData(siblingId, "JK");
    assert.equal(data.attempts.length, 1);
    const results = data.attempts.map((entry) => toExportableResult({
      attempt: entry.attempt, mock: { ...data.mock, durationMinutes: entry.durationMinutes, marksCorrect: entry.marksCorrect },
      questions: entry.questions, allScores: data.allScores,
    }));
    const text = generateMockHistoryTxt(data.mock.title, "JK", results);
    assert.equal(results[0].correctCount, 29);
    assert.equal(results[0].wrongCount, 1);
    assert.match(text, /Correct option: Correct/);
    assert.match(text, /Selected wrong option: Wrong/);
    assert.match(text, /Answered average: 1s/);
    assert.doesNotMatch(text, /Changed after submission|Unused one|Unused two|NaN|Infinity|undefined/);
    assert.equal(await store.getMockExportData(siblingId, "HE"), null);
  });
});
