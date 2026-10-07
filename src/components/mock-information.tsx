"use client";

import type { MetadataErrors, MockMetadata } from "@/lib/mock-validation";
import { USERS } from "@/lib/users";

const inputClass = "mt-2 block min-h-11 w-full rounded-md border border-line bg-white px-3 py-2.5 text-base sm:text-sm";

export function MockInformation({ value, errors, onChange }: {
  value: MockMetadata; errors: MetadataErrors; onChange: (value: MockMetadata) => void;
}) {
  function error(field: keyof MockMetadata) {
    return errors[field] ? <p id={`error-${field}`} className="mt-2 text-xs text-red-800">{errors[field]}</p> : null;
  }
  return (
    <section aria-labelledby="mock-info-title" className="border-b border-line pb-8">
      <h2 id="mock-info-title" className="text-lg font-semibold tracking-tight">Mock information</h2>
      <div className="mt-5 space-y-5">
        <div>
          <label htmlFor="mock-title" className="text-sm font-medium">Title <span className="text-muted">(required)</span></label>
          <input id="mock-title" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} maxLength={200} aria-invalid={!!errors.title} aria-describedby={errors.title ? "error-title" : undefined} className={inputClass} />
          {error("title")}
        </div>
        <div>
          <label htmlFor="mock-details" className="text-sm font-medium">Details <span className="text-muted">(optional)</span></label>
          <textarea id="mock-details" rows={3} value={value.details} onChange={(e) => onChange({ ...value, details: e.target.value })} maxLength={10000} aria-invalid={!!errors.details} aria-describedby={errors.details ? "error-details" : undefined} className={inputClass} />
          {error("details")}
        </div>
        <fieldset aria-describedby={errors.forUsers ? "error-forUsers" : undefined}>
          <legend className="text-sm font-medium">Assigned to</legend>
          <div className="mt-1 flex gap-6">
            {USERS.map((user) => <label key={user} className="flex min-h-11 cursor-pointer items-center gap-2.5 pr-3 text-sm">
              <input type="checkbox" checked={value.forUsers.includes(user)} onChange={(e) => onChange({ ...value, forUsers: e.target.checked ? [...value.forUsers, user] : value.forUsers.filter((item) => item !== user) })} className="size-4 accent-accent" />{user}
            </label>)}
          </div>
          {error("forUsers")}
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-3">
          {([
            ["durationMinutes", "Duration (minutes)", "1", "1"],
            ["marksCorrect", "Correct answer (+)", "0.01", "0.01"],
            ["marksWrong", "Wrong answer (deduct)", "0", "0.01"],
          ] as const).map(([field, label, min, step]) => <div key={field}>
            <label htmlFor={`mock-${field}`} className="text-sm font-medium">{label}</label>
            <input id={`mock-${field}`} type="number" min={min} step={step} max={field === "durationMinutes" ? 2147483647 : 999.99} value={value[field]} onChange={(e) => onChange({ ...value, [field]: e.target.value })} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `error-${field}` : undefined} className={inputClass} />
            {error(field)}
          </div>)}
        </div>
        <p className="text-xs leading-5 text-muted">Enter the deduction as a positive amount: 0.5 means −0.5 for a wrong answer. Use 0 for no negative marking.</p>
      </div>
    </section>
  );
}
