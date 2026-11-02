import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as attemptState from "../src/lib/attempt-state.ts";
import { attempts, questions, tests } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

const hookCode = ts.transpileModule(await readFile(new URL("../src/components/use-exam.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function examHarness(user, actions) {
  const startedAt = Date.parse("2026-11-02T10:00:00Z");
  const slots = [];
  const effects = [];
  const intervals = new Set();
  const events = new Map();
  const storage = new Map();
  const navigations = [];
  let cursor = 0;
  let localNow = 0;
  let mounted = false;
  const props = {
    attemptId: randomUUID(), user, expiresAt: new Date(startedAt + 60000).toISOString(), serverNow: startedAt, revision: 0,
    savedAnswers: [{ questionId: randomUUID(), selectedIndex: 1, timeSpentMs: 0, visited: false, markedForReview: false }],
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback) { return callback; },
    useEffect(effect) { if (!mounted) effects.push(effect); },
  };
  const document = { hidden: false, addEventListener: (event, listener) => events.set(event, listener), removeEventListener: (event) => events.delete(event) };
  const loadedModule = { exports: {} };
  runInNewContext(hookCode, {
    module: loadedModule, exports: loadedModule.exports,
    require(name) {
      if (name === "react") return react;
      if (name === "next/navigation") return { useRouter: () => ({ replace: (path) => navigations.push(path) }) };
      if (name === "@/app/exam/actions") return actions;
      if (name === "@/lib/attempt-state") return attemptState;
      throw new Error(`Unexpected hook dependency: ${name}`);
    },
    performance: { now: () => localNow }, document,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    window: { addEventListener() {}, removeEventListener() {} },
    setInterval: (callback) => { intervals.add(callback); return callback; }, clearInterval: (callback) => intervals.delete(callback),
  });
  function render() {
    cursor = 0;
    const state = loadedModule.exports.useExam(props);
    if (!mounted) { mounted = true; for (const effect of effects) effect(); }
    return state;
  }
  render();
  return {
    props, startedAt, navigations, storage, render,
    advance(ms) { localNow += ms; for (const interval of intervals) interval(); return render(); },
    hide() { document.hidden = true; events.get("visibilitychange")(); return render(); },
  };
}

for (const user of ["JK", "HE"]) {
  test(`${user} final confirmation freezes time before queued autosave and throughout result loading`, async () => {
    const saved = deferred();
    const submitted = deferred();
    const requests = [];
    const harness = examHarness(user, {
      saveExamProgress: () => saved.promise,
      submitExam: (...args) => { requests.push(args); return submitted.promise; },
    });
    assert.equal(harness.advance(5000).timeLeft, 55);
    assert.equal(harness.advance(2000).timeLeft, 53);
    const submission = harness.render().handleSubmit();
    await harness.render().handleSubmit();
    assert.equal(harness.advance(5000).timeLeft, 53);
    assert.equal(harness.hide().answers[0].timeSpentMs, 7000);
    saved.resolve({ ok: true, submitted: false, revision: 1 });
    await settle();
    assert.equal(requests.length, 1);
    assert.equal(requests[0][1], user);
    assert.equal(requests[0][2][0].timeSpentMs, 7000);
    assert.equal(requests[0][3], 1);
    assert.equal(requests[0][4], harness.startedAt + 7000);
    assert.equal(harness.advance(5000).timeLeft, 53);
    submitted.resolve({ ok: true, attemptId: harness.props.attemptId });
    await submission;
    assert.equal(harness.advance(5000).timeLeft, 53);
    assert.equal(harness.render().submitting, true);
    assert.equal(harness.hide().timeLeft, 53);
    assert.equal(harness.storage.size, 0);
    assert.deepEqual(harness.navigations, [`/result/${harness.props.attemptId}`]);
  });
}

test("failed submission restores the deadline countdown and preserves answers for retry", async () => {
  const failed = deferred();
  const harness = examHarness("JK", {
    saveExamProgress: async (_id, _user, _answers, revision) => ({ ok: true, submitted: false, revision: revision + 1 }),
    submitExam: () => failed.promise,
  });
  harness.advance(5000);
  await settle();
  const submission = harness.render().handleSubmit();
  await Promise.resolve();
  assert.equal(harness.advance(10000).timeLeft, 55);
  failed.reject(new Error("Disconnected"));
  await submission;
  assert.equal(harness.render().submitting, false);
  assert.equal(harness.render().timeLeft, 45);
  assert.equal(harness.render().answers[0].selectedIndex, 1);
  assert.equal(harness.render().answers[0].timeSpentMs, 5000);
  assert.match(harness.render().saveError, /Could not submit/);
  assert.equal(harness.storage.size, 1);
  assert.equal(harness.advance(5000).answers[0].timeSpentMs, 10000);
});

test("submission timestamps reject impossible times and keep the server fallback for existing callers", () => {
  assert.equal(attemptState.submissionTimestamp(7000, 0, 12000, 60000, 5000), 7000);
  assert.equal(attemptState.submissionTimestamp(undefined, 0, 12000, 60000, 5000), 12000);
  assert.equal(attemptState.submissionTimestamp(undefined, 0, 90000, 60000, 5000), 60000);
  for (const value of [null, "7000", NaN, Infinity, 7000.5, -1, 12001, 4999]) {
    assert.equal(attemptState.submissionTimestamp(value, 0, 12000, 60000, 5000), null);
  }
});

test("saved completion times exclude submission delay while deadline scoring and duplicate retries remain intact", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const testId = randomUUID();
  await database.insert(tests).values({ id: testId, title: "Submission timing", forUsers: ["JK", "HE"], durationMinutes: 1 });
  await database.insert(questions).values({ id: randomUUID(), testId, position: 1, questionText: "Choose one", options: ["Right", "Wrong", "Other", "Last"], correctIndex: 0 });
  let clock = Date.parse("2026-11-02T10:00:00Z");
  const store = createAttemptStore(database, () => clock);
  for (const user of ["JK", "HE"]) {
    const start = clock;
    const { attemptId } = await store.startOrResume(testId, user);
    const exam = await store.getExamData(attemptId, user);
    clock += 5000;
    const answers = exam.answers.map((answer) => ({ ...answer, selectedIndex: exam.questions[0].options.indexOf("Right"), timeSpentMs: 5000, visited: true }));
    await store.saveProgress(attemptId, user, answers, 0);
    clock += 7000;
    await assert.rejects(store.submitAttempt(attemptId, user, answers, 1, start + 1000), { code: "invalid" });
    await assert.rejects(store.submitAttempt(attemptId, user, answers, 1, clock + 1000), { code: "invalid" });
    await store.submitAttempt(attemptId, user, answers, 1, start + 7000);
    const result = await store.getResult(attemptId, user);
    assert.equal(result.attempt.timeTakenSeconds, 7);
    assert.equal(Date.parse(result.attempt.submittedAt), start + 7000);
    assert.equal(result.attempt.correctCount, 1);
    clock += 5000;
    await store.submitAttempt(attemptId, user, [], -1, 0);
    assert.deepEqual(await store.getResult(attemptId, user), result);
  }
  const start = clock;
  const { attemptId } = await store.startOrResume(testId, "JK");
  const exam = await store.getExamData(attemptId, "JK");
  clock += 90000;
  await store.submitAttempt(attemptId, "JK", exam.answers.map((answer) => ({ ...answer, selectedIndex: exam.questions[0].options.indexOf("Right") })), 0, start + 60000);
  const expired = await store.getResult(attemptId, "JK");
  assert.equal(expired.attempt.correctCount, 0);
  assert.equal(expired.attempt.skippedCount, 1);
  assert.equal(expired.attempt.timeTakenSeconds, 60);
  assert.equal(Date.parse(expired.attempt.submittedAt), start + 60000);
  assert.equal((await database.select().from(attempts)).length, 3);
});
