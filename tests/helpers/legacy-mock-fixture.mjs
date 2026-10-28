import { tests, questions } from "../../src/db/schema.ts";

export async function insertLegacyMockFixture(database, input) {
  await database.transaction(async (tx) => {
    await tx.insert(tests).values({ id: input.testId, ...input.metadata });
    await tx.insert(questions).values(input.questions.map((question, index) => ({
      id: question.id, testId: input.testId, position: index + 1,
      questionText: question.questionText, options: question.options, correctIndex: question.correctIndex,
    })));
  });
}
