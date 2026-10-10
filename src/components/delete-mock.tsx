"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMock } from "@/app/studio/actions";
import type { User } from "@/lib/users";

const focusCancel = (node: HTMLButtonElement | null) => { node?.focus(); };

export function DeleteMock({ id, user }: { id: string; user: User }) {
  const router = useRouter();
  const [confirmingUser, setConfirmingUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function cancel() {
    if (busy.current) return;
    setConfirmingUser(null);
    trigger.current?.focus();
  }

  async function remove() {
    if (busy.current || !confirmingUser) return;
    const deletingUser = confirmingUser;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await deleteMock(id, deletingUser);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/u/${deletingUser}`);
      router.refresh();
    } catch {
      setError("Deletion could not be confirmed. Try again; repeating this action is safe.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <section className="mt-12 border-t border-line pt-6">
      <button ref={trigger} type="button" onClick={() => setConfirmingUser(user)} className="cursor-pointer rounded-sm py-2 text-sm text-muted hover:text-red-800">Delete mock</button>
      {confirmingUser && <div role="group" aria-labelledby="delete-confirm-title" onKeyDown={(event) => { if (event.key === "Escape") cancel(); }} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 id="delete-confirm-title" className="font-semibold text-red-950">Delete this mock for {confirmingUser}?</h2>
        <p className="mt-2 text-sm leading-6 text-red-950">This permanently removes the mock from {confirmingUser}&apos;s library and deletes all their completed and unfinished attempts, including results and History. If shared, the other person&apos;s mock and history are kept. This cannot be undone.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button ref={focusCancel} type="button" disabled={pending} onClick={cancel} className="cursor-pointer rounded-lg border border-line bg-white px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" disabled={pending} onClick={remove} className="cursor-pointer rounded-lg bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-900 disabled:opacity-50">{pending ? "Deleting…" : "Yes, delete mock"}</button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      </div>}
    </section>
  );
}
