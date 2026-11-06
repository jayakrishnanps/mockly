import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as bankDraft from "../src/lib/bank-draft.ts";
import * as questionDraft from "../src/lib/question-draft.ts";
import * as parser from "../src/lib/parser.ts";

const componentCode = ts.transpileModule(await readFile(new URL("../src/components/bank-workspace.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const question = (number = 1) => `Q${number}. Calculate ${number} + 2.\n(A) ${number + 1}\n(B) ${number + 2}\n(C) ${number + 3}\n(D) ${number + 4}\nAns: B`;

function textOf(node) {
  if (Array.isArray(node)) return node.map(textOf).join("");
  return node && typeof node === "object" ? textOf(node.props.children) : node === false || node == null ? "" : String(node);
}

function nodesOf(node) {
  if (Array.isArray(node)) return node.flatMap(nodesOf);
  return node && typeof node === "object" ? [node, ...nodesOf(node.props.children)] : [];
}

function workspaceHarness(initialDraft) {
  const bankId = initialDraft?.context.testId ?? randomUUID();
  const storageValues = new Map();
  const storage = { getItem: (key) => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value) };
  if (initialDraft) bankDraft.saveBankQuestions(bankId, initialDraft, () => storage);
  const slots = [];
  const effects = [];
  const scrollCalls = [];
  const requests = [];
  let cursor = 0;
  let previewRenders = 0;
  let tree;
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
    useLayoutEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, position) => !Object.is(value, previous[position]))) effects.push(effect);
      slots[index] = dependencies;
    },
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
  };
  const fragment = Symbol("fragment");
  const jsx = (type, props) => ({ type, props });
  const viewport = {
    scrollX: 0, scrollY: 0,
    scrollTo(options) { scrollCalls.push(options); viewport.scrollX = options.left; viewport.scrollY = options.top; },
  };
  const loadedModule = { exports: {} };
  const prompt = () => jsx("span", { children: "Prompt" });
  runInNewContext(componentCode, {
    module: loadedModule, exports: loadedModule.exports, crypto: { randomUUID }, window: viewport,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: fragment };
      if (name === "next/navigation") return { useRouter: () => ({ refresh() { requests.push("refresh"); } }) };
      if (name === "@/app/u/[user]/bank/actions") return { appendBankQuestions(input) { requests.push(input); throw new Error("This check must not save to a bank."); } };
      if (name === "@/components/formatting-prompt") return { FormattingPrompt: prompt };
      if (name === "@/components/practice-question-prompt") return { PracticeQuestionPrompt: prompt };
      if (name === "@/components/topic-question-prompt") return { TopicQuestionPrompt: prompt };
      if (name === "@/components/question-preview") return { QuestionPreview(props) { previewRenders++; return jsx("preview", { ...props, children: props.question.questionText }); } };
      if (name === "@/lib/bank-draft") return {
        ...bankDraft,
        loadBankQuestions: (id) => bankDraft.loadBankQuestions(id, () => storage),
        saveBankQuestions: (id, draft) => bankDraft.saveBankQuestions(id, draft, () => storage),
      };
      if (name === "@/lib/parser") return parser;
      if (name === "@/lib/question-draft") return questionDraft;
      throw new Error(`Unexpected workspace dependency: ${name}`);
    },
  });
  function resolve(node) {
    if (Array.isArray(node)) return node.map(resolve);
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") return resolve(node.type(node.props));
    if (node.type === fragment) return resolve(node.props.children);
    return { ...node, props: { ...node.props, children: resolve(node.props.children) } };
  }
  function render() {
    cursor = 0;
    effects.length = 0;
    tree = resolve(loadedModule.exports.BankWorkspace({ bankId }));
    for (const effect of effects) effect();
    return tree;
  }
  const find = (predicate) => {
    const node = nodesOf(tree).find(predicate);
    assert.ok(node, "Expected workspace control was not rendered.");
    return node;
  };
  const button = (label) => find((node) => node.type === "button" && textOf(node) === label);
  const input = () => find((node) => node.type === "textarea" && node.props.id === "bank-question-input");
  render();
  return {
    render, find, button, input, viewport, scrollCalls, requests,
    nodes: () => nodesOf(tree),
    previewRenders: () => previewRenders,
    draft: () => bankDraft.loadBankQuestions(bankId, () => storage).draft,
    paste(source) { input().props.onChange({ target: { value: source } }); render(); },
    click(label) { const control = button(label); assert.ok(!control.props.disabled); control.props.onClick(); render(); },
  };
}

test("checking a batch keeps the viewport and defers question previews until manual review", () => {
  const workspace = workspaceHarness();
  workspace.paste(Array.from({ length: 50 }, (_, index) => question(index + 1)).join("\n\n"));
  workspace.viewport.scrollX = 12;
  workspace.viewport.scrollY = 950;
  workspace.button("Check questions").props.onClick();
  workspace.viewport.scrollY = 5000;
  workspace.render();
  assert.equal(workspace.viewport.scrollX, 12);
  assert.equal(workspace.viewport.scrollY, 950);
  assert.equal(workspace.scrollCalls.length, 1);
  assert.equal(workspace.scrollCalls[0].behavior, "instant");
  assert.equal(workspace.draft().questions.length, 50);
  assert.equal(workspace.draft().problems.length, 0);
  assert.equal(workspace.input().props.value, "");
  assert.equal(workspace.previewRenders(), 0);
  assert.equal(workspace.button("Review questions").props["aria-expanded"], false);
  workspace.click("Review questions");
  assert.equal(workspace.nodes().filter((node) => node.type === "preview").length, 20);
  workspace.click("Show more questions (30 remaining)");
  assert.equal(workspace.nodes().filter((node) => node.type === "preview").length, 40);
  workspace.click("Show more questions (10 remaining)");
  assert.equal(workspace.nodes().filter((node) => node.type === "preview").length, 50);
  assert.equal(workspace.scrollCalls.length, 1);
  workspace.paste(question(51));
  workspace.click("Check questions");
  assert.equal(workspace.nodes().filter((node) => node.type === "preview").length, 0);
  workspace.click("Review questions");
  assert.equal(workspace.nodes().filter((node) => node.type === "preview").length, 20);
  assert.equal(workspace.draft().questions.length, 51);
  assert.deepEqual(workspace.requests, []);
});

test("invalid blocks remain repairable and discardable without forcing a draft preview or repair scroll", () => {
  const workspace = workspaceHarness();
  const invalid = question(2).replace("\nAns: B", "");
  workspace.paste(`${question(1)}\n\n${invalid}`);
  workspace.click("Check questions");
  const firstId = workspace.draft().questions[0].id;
  assert.equal(workspace.draft().questions.length, 1);
  assert.equal(workspace.draft().problems.length, 1);
  assert.ok(workspace.draft().problems[0].errors.some((error) => error.code === "missing_answer"));
  assert.equal(workspace.previewRenders(), 0);
  workspace.paste("Unfinished next batch");
  const repair = workspace.find((node) => node.type === "textarea" && node.props.id.startsWith("bank-repair-"));
  repair.props.onChange({ target: { value: question(2) } });
  workspace.render();
  const scrollCount = workspace.scrollCalls.length;
  workspace.click("Recheck block");
  assert.equal(workspace.draft().questions.length, 2);
  assert.equal(workspace.draft().questions[0].id, firstId);
  assert.equal(workspace.draft().problems.length, 0);
  assert.equal(workspace.draft().input, "Unfinished next batch");
  assert.equal(workspace.scrollCalls.length, scrollCount);
  assert.equal(workspace.previewRenders(), 0);
  workspace.paste(invalid);
  workspace.click("Check questions");
  workspace.click("Discard block");
  assert.equal(workspace.draft().problems.length, 0);
  assert.equal(workspace.draft().questions.length, 2);
  assert.deepEqual(workspace.requests, []);
});

test("a restored pending save keeps editing locked and retry question IDs unchanged", () => {
  const bankId = randomUUID();
  const original = questionDraft.appendParsedBatch(questionDraft.emptyQuestionDraft(bankId), parser.parseQuestions(`${question(1)}\n\n${question(2).replace("\nAns: B", "")}`), randomUUID);
  const pendingQuestionIds = original.questions.map((entry) => entry.id);
  const draft = { ...original, input: "Unfinished next paste", pendingQuestionIds };
  const workspace = workspaceHarness(draft);
  assert.equal(workspace.input().props.disabled, true);
  assert.equal(workspace.button("Check questions").props.disabled, true);
  assert.equal(workspace.button("Clear draft").props.disabled, true);
  assert.ok(workspace.button("Retry save"));
  assert.ok(workspace.nodes().some((node) => node.type === "fieldset" && node.props.disabled && textOf(node).includes("Repair this block")));
  workspace.click("Review questions");
  assert.equal(workspace.button("Remove").props.disabled, true);
  assert.deepEqual(bankDraft.retryBankBatch(workspace.draft()), bankDraft.retryBankBatch(draft));
  assert.deepEqual(workspace.draft().pendingQuestionIds, pendingQuestionIds);
  assert.deepEqual(workspace.scrollCalls, []);
  assert.deepEqual(workspace.requests, []);
});
