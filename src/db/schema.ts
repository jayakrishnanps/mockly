import { pgTable, check, uuid, text, integer, numeric, timestamp, foreignKey, unique, smallint, index, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const tests = pgTable("tests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	details: text(),
	forUsers: text("for_users").array().notNull(),
	durationMinutes: integer("duration_minutes").default(60).notNull(),
	marksCorrect: numeric("marks_correct", { precision: 5, scale:  2 }).default('2').notNull(),
	marksWrong: numeric("marks_wrong", { precision: 5, scale:  2 }).default('0.5').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	questionLimit: integer("question_limit"),
}, (table) => [
	check("tests_for_users_check", sql`(cardinality(for_users) > 0) AND (for_users <@ ARRAY['JK'::text, 'HE'::text])`),
	check("tests_duration_minutes_check", sql`duration_minutes > 0`),
	check("tests_question_limit_check", sql`question_limit IS NULL OR question_limit > 0`),
]);

export const questionBanks = pgTable("question_banks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("question_banks_title_check", sql`length(trim(${table.title})) BETWEEN 1 AND 200`),
]);

export const bankQuestions = pgTable("bank_questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	bankId: uuid("bank_id").notNull(),
	position: integer().notNull(),
	questionText: text("question_text").notNull(),
	options: text().array().notNull(),
	correctIndex: smallint("correct_index").notNull(),
}, (table) => [
	foreignKey({
		columns: [table.bankId],
		foreignColumns: [questionBanks.id],
		name: "bank_questions_bank_id_fkey",
	}).onDelete("cascade"),
	unique("bank_questions_bank_id_position_key").on(table.bankId, table.position),
	check("bank_questions_position_check", sql`${table.position} > 0`),
	check("bank_questions_text_check", sql`length(trim(${table.questionText})) > 0`),
	check("bank_questions_options_check", sql`array_ndims(${table.options}) = 1 AND cardinality(${table.options}) = 4 AND array_position(${table.options}, NULL) IS NULL AND length(trim(${table.options}[1])) > 0 AND length(trim(${table.options}[2])) > 0 AND length(trim(${table.options}[3])) > 0 AND length(trim(${table.options}[4])) > 0`),
	check("bank_questions_correct_index_check", sql`${table.correctIndex} BETWEEN 0 AND 3`),
]);

export const questions = pgTable("questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	testId: uuid("test_id").notNull(),
	position: integer().notNull(),
	questionText: text("question_text").notNull(),
	options: text().array().notNull(),
	correctIndex: smallint("correct_index").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.testId],
			foreignColumns: [tests.id],
			name: "questions_test_id_fkey"
		}).onDelete("cascade"),
	unique("questions_test_id_position_key").on(table.position, table.testId),
	check("questions_options_check", sql`cardinality(options) = 4`),
	check("questions_correct_index_check", sql`(correct_index >= 0) AND (correct_index <= 3)`),
]);

export const attempts = pgTable("attempts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	testId: uuid("test_id").notNull(),
	takenBy: text("taken_by").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }),
	timeTakenSeconds: integer("time_taken_seconds"),
	score: numeric({ precision: 6, scale:  2 }),
	correctCount: integer("correct_count"),
	wrongCount: integer("wrong_count"),
	skippedCount: integer("skipped_count"),
	answers: jsonb().default([]).notNull(),
}, (table) => [
	index("attempts_person_idx").using("btree", table.takenBy.asc().nullsLast().op("text_ops"), table.submittedAt.desc().nullsFirst().op("text_ops")),
	index("attempts_test_idx").using("btree", table.testId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.testId],
			foreignColumns: [tests.id],
			name: "attempts_test_id_fkey"
		}).onDelete("cascade"),
	check("attempts_taken_by_check", sql`taken_by = ANY (ARRAY['JK'::text, 'HE'::text])`),
]);
