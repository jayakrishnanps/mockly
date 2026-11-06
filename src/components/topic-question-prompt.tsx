"use client";

import { useId, useRef, useState } from "react";
import { TOPIC_QUESTION_PROMPT } from "@/lib/topic-question-prompt";
import styles from "./topic-question-prompt.module.css";

export function TopicQuestionPrompt() {
  const id = useId();
  const text = useRef<HTMLTextAreaElement>(null);
  const [manualCopy, setManualCopy] = useState(false);
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(TOPIC_QUESTION_PROMPT);
      setManualCopy(false);
      setMessage("Copied");
    } catch {
      setManualCopy(true);
      setMessage("Select and copy the prompt below.");
      requestAnimationFrame(() => { text.current?.focus(); text.current?.select(); });
    }
  }

  return <section className={styles.panel} aria-labelledby={`${id}-title`}>
    <div className={styles.row}>
      <span className={styles.icon} aria-hidden="true"><svg width="24" height="28" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 1h10l6 6v20H4zM14 1v7h6M8 13h8M8 17h8M8 21h5" /></svg></span>
      <div className={styles.copy}>
        <h2 id={`${id}-title`}>Questions from a topic</h2>
        <p>Use a PDF, image, notes or a topic in another chat.</p>
      </div>
      <button type="button" onClick={copy} className={styles.button}>Copy topic prompt <span aria-hidden="true">↗</span></button>
    </div>
    <p role="status" className={styles.status}>{message}</p>
    {manualCopy && <div className={styles.manual}>
      <label htmlFor={`${id}-text`} className="sr-only">Topic question prompt</label>
      <textarea id={`${id}-text`} ref={text} readOnly value={TOPIC_QUESTION_PROMPT} rows={12} />
    </div>}
  </section>;
}
