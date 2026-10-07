import { relations } from "drizzle-orm/relations";
import { tests, questions, attempts } from "./schema";

export const questionsRelations = relations(questions, ({one}) => ({
	test: one(tests, {
		fields: [questions.testId],
		references: [tests.id]
	}),
}));

export const testsRelations = relations(tests, ({many}) => ({
	questions: many(questions),
	attempts: many(attempts),
}));

export const attemptsRelations = relations(attempts, ({one}) => ({
	test: one(tests, {
		fields: [attempts.testId],
		references: [tests.id]
	}),
}));