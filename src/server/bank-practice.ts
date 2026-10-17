import { sql } from "drizzle-orm";
import type { db } from "../db/index";
import { attempts, bankQuestions, tests } from "../db/schema.ts";
import { isRecord, isUuid } from "../lib/mock-validation.ts";
import type { QuestionPractice } from "../lib/question-selection.ts";
import type { User } from "../lib/users.ts";

export function parseBankPractice(rows: unknown[]): Map<string, QuestionPractice> {
  const practice = new Map<string, QuestionPractice>();
  for (const row of rows) {
    if (!isRecord(row) || !isUuid(row.question_id) || typeof row.practice_count !== "string" || !/^[1-9]\d*$/.test(row.practice_count) ||
      typeof row.last_practised_at !== "string" || !isOutcome(row.latest_outcome) || typeof row.unresolved_wrong !== "boolean") {
      throw new Error("This bank's saved practice history could not be read.");
    }
    const count = Number(row.practice_count);
    const lastPractisedAt = Date.parse(row.last_practised_at);
    const id = row.question_id.toLowerCase();
    if (!Number.isSafeInteger(count) || !Number.isFinite(lastPractisedAt) || practice.has(id)) {
      throw new Error("This bank's saved practice history could not be read.");
    }
    const review = row.unresolved_wrong ? "wrong" : row.latest_outcome === "skipped" ? "skipped" : null;
    practice.set(id, { count, lastPractisedAt, review });
  }
  return practice;
}

function isOutcome(value: unknown): value is "correct" | "wrong" | "skipped" {
  return value === "correct" || value === "wrong" || value === "skipped";
}

export async function getBankPractice(database: Pick<typeof db, "execute">, bankId: string, user: User): Promise<Map<string, QuestionPractice>> {
  const result = await database.execute(sql`
    with completed as (
      select ${attempts.id} as attempt_id, ${attempts.submittedAt} as submitted_at,
        ${attempts.answers} as snapshot
      from ${attempts}
      inner join ${tests} on ${tests.id} = ${attempts.testId}
      where ${tests.sourceBankId} = ${bankId} and ${attempts.takenBy} = ${user}
        and ${attempts.submittedAt} is not null
        and ${attempts.answers} -> 'version' = '1'::jsonb
    ), encounters as (
      select completed.attempt_id, completed.submitted_at, ${bankQuestions.id}::text as question_id,
        case
          when answer.value -> 'selectedIndex' = 'null'::jsonb then 'skipped'
          when answer.value -> 'selectedIndex' = question.value -> 'correctIndex' then 'correct'
          else 'wrong'
        end as outcome
      from completed
      cross join lateral jsonb_array_elements(case
        when jsonb_typeof(completed.snapshot -> 'questions') = 'array'
        then completed.snapshot -> 'questions' else '[]'::jsonb end) as question(value)
      inner join lateral jsonb_array_elements(case
        when jsonb_typeof(completed.snapshot -> 'answers') = 'array'
        then completed.snapshot -> 'answers' else '[]'::jsonb end) as answer(value)
        on lower(answer.value ->> 'questionId') = lower(question.value ->> 'id')
      inner join ${bankQuestions} on ${bankQuestions.bankId} = ${bankId}
        and ${bankQuestions.id}::text = lower(question.value ->> 'id')
      where question.value -> 'correctIndex' in ('0'::jsonb, '1'::jsonb, '2'::jsonb, '3'::jsonb)
        and (
          answer.value -> 'selectedIndex' in ('0'::jsonb, '1'::jsonb, '2'::jsonb, '3'::jsonb)
          or (
            answer.value -> 'selectedIndex' = 'null'::jsonb
            and answer.value -> 'visited' is distinct from 'false'::jsonb
            and case when jsonb_typeof(answer.value -> 'timeSpentMs') = 'number'
              then (answer.value ->> 'timeSpentMs')::numeric between 5000 and 9007199254740991
              else false end
          )
        )
    ), unique_encounters as (
      select attempt_id, submitted_at, question_id, min(outcome) as outcome
      from encounters
      group by attempt_id, submitted_at, question_id
      having count(*) = 1
    ), ranked as (
      select question_id, submitted_at, outcome,
        count(*) over (partition by question_id) as practice_count,
        row_number() over (partition by question_id order by submitted_at desc, attempt_id desc) as encounter_rank
      from unique_encounters
    ), latest_wrong as (
      select question_id, min(encounter_rank) as encounter_rank
      from ranked where outcome = 'wrong'
      group by question_id
    ), correct_since_wrong as (
      select ranked.question_id, count(*) as correct_count
      from ranked inner join latest_wrong on latest_wrong.question_id = ranked.question_id
      where ranked.outcome = 'correct' and ranked.encounter_rank < latest_wrong.encounter_rank
      group by ranked.question_id
    ), summaries as (
      select question_id, max(practice_count)::text as practice_count,
        max(submitted_at) filter (where encounter_rank = 1)::text as last_practised_at,
        max(outcome) filter (where encounter_rank = 1) as latest_outcome
      from ranked group by question_id
    )
    select summaries.question_id, summaries.practice_count, summaries.last_practised_at,
      summaries.latest_outcome,
      latest_wrong.question_id is not null and coalesce(correct_since_wrong.correct_count, 0) < 2 as unresolved_wrong
    from summaries
    left join latest_wrong on latest_wrong.question_id = summaries.question_id
    left join correct_since_wrong on correct_since_wrong.question_id = summaries.question_id
  `);
  return parseBankPractice(result.rows);
}
