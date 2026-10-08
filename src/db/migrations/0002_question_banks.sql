CREATE TABLE "bank_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_text" text NOT NULL,
	"options" text[] NOT NULL,
	"correct_index" smallint NOT NULL,
	CONSTRAINT "bank_questions_bank_id_position_key" UNIQUE("bank_id","position"),
	CONSTRAINT "bank_questions_position_check" CHECK ("bank_questions"."position" > 0),
	CONSTRAINT "bank_questions_text_check" CHECK (length(trim("bank_questions"."question_text")) > 0),
	CONSTRAINT "bank_questions_options_check" CHECK (array_ndims("bank_questions"."options") = 1 AND cardinality("bank_questions"."options") = 4 AND array_position("bank_questions"."options", NULL) IS NULL AND length(trim("bank_questions"."options"[1])) > 0 AND length(trim("bank_questions"."options"[2])) > 0 AND length(trim("bank_questions"."options"[3])) > 0 AND length(trim("bank_questions"."options"[4])) > 0),
	CONSTRAINT "bank_questions_correct_index_check" CHECK ("bank_questions"."correct_index" BETWEEN 0 AND 3)
);
--> statement-breakpoint
CREATE TABLE "question_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_banks_title_check" CHECK (length(trim("question_banks"."title")) BETWEEN 1 AND 200)
);
--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "question_limit" integer;--> statement-breakpoint
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_question_limit_check" CHECK (question_limit IS NULL OR question_limit > 0);