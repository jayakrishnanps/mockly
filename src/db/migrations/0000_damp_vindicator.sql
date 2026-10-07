-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"for_users" text[] NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"marks_correct" numeric(5, 2) DEFAULT '2' NOT NULL,
	"marks_wrong" numeric(5, 2) DEFAULT '0.5' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tests_for_users_check" CHECK ((cardinality(for_users) > 0) AND (for_users <@ ARRAY['JK'::text, 'HE'::text])),
	CONSTRAINT "tests_duration_minutes_check" CHECK (duration_minutes > 0)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"question_text" text NOT NULL,
	"options" text[] NOT NULL,
	"correct_index" smallint NOT NULL,
	CONSTRAINT "questions_test_id_position_key" UNIQUE("position","test_id"),
	CONSTRAINT "questions_options_check" CHECK (cardinality(options) = 4),
	CONSTRAINT "questions_correct_index_check" CHECK ((correct_index >= 0) AND (correct_index <= 3))
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"taken_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"time_taken_seconds" integer,
	"score" numeric(6, 2),
	"correct_count" integer,
	"wrong_count" integer,
	"skipped_count" integer,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "attempts_taken_by_check" CHECK (taken_by = ANY (ARRAY['JK'::text, 'HE'::text]))
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_person_idx" ON "attempts" USING btree ("taken_by" text_ops,"submitted_at" text_ops);--> statement-breakpoint
CREATE INDEX "attempts_test_idx" ON "attempts" USING btree ("test_id" uuid_ops);
*/