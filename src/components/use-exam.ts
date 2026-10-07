"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveExamProgress, submitExam } from "@/app/exam/actions";
import { addQuestionTime, readRecovery, remainingSeconds } from "@/lib/attempt-state";
import type { AnswerRecord } from "@/lib/scoring";

type ExamState = { answers: AnswerRecord[]; current: number; revision: number };
export type ExamProgress = {
  attemptId: string; user: string; expiresAt: string; serverNow: number;
  revision: number; savedAnswers: AnswerRecord[];
};

export function useExam(props: ExamProgress) {
  const { attemptId, user, expiresAt, serverNow, revision, savedAnswers } = props;
  const router = useRouter();
  const key = `mockly:attempt:${user}:${attemptId}`;
  const deadline = Date.parse(expiresAt);
  const [anchor] = useState(() => ({ server: serverNow, local: performance.now() }));
  const now = useCallback(() => anchor.server + performance.now() - anchor.local, [anchor]);
  const [state, setState] = useState<ExamState>(() => {
    let recovery = null;
    try { recovery = readRecovery(localStorage.getItem(key), attemptId, user, revision, savedAnswers.map((a) => a.questionId)); } catch { /* Server progress remains available. */ }
    const initial = recovery ?? { answers: savedAnswers, current: 0, revision };
    return { ...initial, answers: initial.answers.map((a, i) => i === initial.current ? { ...a, visited: true } : a) };
  });
  const model = useRef(state);
  const enteredAt = useRef(serverNow);
  const visible = useRef(true);
  const busy = useRef(false);
  const finished = useRef(false);
  const pending = useRef<Promise<void> | null>(null);
  const dirty = useRef(true);
  const [timeLeft, setTimeLeft] = useState(() => remainingSeconds(deadline, serverNow));
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const commit = useCallback((next: ExamState) => {
    model.current = next;
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, attemptId, user, ...next }));
      setStorageError(null);
    } catch { setStorageError("Browser recovery is unavailable. Keep this page open until progress is saved."); }
  }, [key, attemptId, user]);

  const flushTime = useCallback(() => {
    const timestamp = now();
    const next = { ...model.current, answers: visible.current ? addQuestionTime(model.current.answers, model.current.current, enteredAt.current, timestamp, deadline) : model.current.answers };
    enteredAt.current = timestamp;
    commit(next);
    return next;
  }, [commit, now, deadline]);

  const complete = useCallback(() => {
    finished.current = true;
    try { localStorage.removeItem(key); } catch { /* A completed attempt cannot reopen. */ }
    router.replace(`/result/${attemptId}`);
  }, [key, router, attemptId]);

  const save = useCallback(() => {
    if (pending.current || busy.current || finished.current) return pending.current;
    const snapshot = flushTime();
    dirty.current = false;
    const request = (async () => {
      try {
        const result = await saveExamProgress(attemptId, user, snapshot.answers, snapshot.revision);
        if (!result.ok) { setSaveError(result.error); dirty.current = true; return; }
        if (result.submitted) { complete(); return; }
        commit({ ...model.current, revision: result.revision });
        setSaveError(null);
      } catch {
        dirty.current = true;
        setSaveError("Connection lost. Progress remains on this device; saving will retry.");
      } finally { pending.current = null; }
    })();
    pending.current = request;
    return request;
  }, [attemptId, user, flushTime, commit, complete]);

  const handleSubmit = useCallback(async () => {
    if (busy.current || finished.current) return;
    busy.current = true;
    setSubmitting(true);
    try {
      await pending.current;
      if (finished.current) return;
      const latest = flushTime();
      const result = await submitExam(attemptId, user, latest.answers, latest.revision);
      if (result.ok) complete();
      else setSaveError(result.error);
    } catch { setSaveError("Could not submit. Your progress is kept. Please retry; expired attempts retry automatically."); }
    finally { busy.current = false; setSubmitting(false); }
  }, [attemptId, user, flushTime, complete]);

  const change = useCallback((patch: Partial<AnswerRecord>, nextIndex?: number) => {
    if (busy.current || finished.current || now() >= deadline) return;
    const latest = flushTime();
    const current = nextIndex ?? latest.current;
    if (current < 0 || current >= latest.answers.length) return;
    const answers = latest.answers.map((a, i) => ({ ...a, ...(i === latest.current ? patch : {}), visited: a.visited || i === current }));
    commit({ ...latest, current, answers });
    dirty.current = true;
  }, [now, deadline, flushTime, commit]);

  useEffect(() => {
    let lastSave = now();
    let lastSubmit = -Infinity;
    const timer = setInterval(() => {
      const timestamp = now();
      setTimeLeft(remainingSeconds(deadline, timestamp));
      if (timestamp >= deadline) {
        if (timestamp - lastSubmit >= 5000) { lastSubmit = timestamp; void handleSubmit(); }
      } else if (dirty.current || timestamp - lastSave >= 5000) {
        lastSave = timestamp;
        void save();
      }
    }, 1000);
    const visibility = () => {
      if (document.hidden) { flushTime(); visible.current = false; void save(); }
      else { visible.current = true; enteredAt.current = now(); }
    };
    const leave = (event: BeforeUnloadEvent) => {
      if (!finished.current) { flushTime(); event.preventDefault(); event.returnValue = ""; }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("beforeunload", leave);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("beforeunload", leave); };
  }, [deadline, now, save, handleSubmit, flushTime]);

  return { ...state, timeLeft, submitting, saveError: saveError ?? storageError, handleSubmit, change };
}
