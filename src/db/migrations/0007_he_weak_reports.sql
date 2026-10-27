CREATE TABLE IF NOT EXISTS "public"."he_weak_reports" (
  "id" uuid PRIMARY KEY NOT NULL,
  "source_test_id" uuid NOT NULL,
  "source_title" text NOT NULL,
  "title" text NOT NULL,
  "explanation" text NOT NULL,
  "practice" text NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "he_weak_reports_source_test_id_fkey" FOREIGN KEY ("source_test_id") REFERENCES "public"."tests" ("id") ON DELETE CASCADE,
  CONSTRAINT "he_weak_reports_source_title_check" CHECK (length(trim("source_title")) BETWEEN 1 AND 200),
  CONSTRAINT "he_weak_reports_title_check" CHECK (length(trim("title")) BETWEEN 1 AND 120),
  CONSTRAINT "he_weak_reports_explanation_check" CHECK (length(trim("explanation")) BETWEEN 1 AND 3000),
  CONSTRAINT "he_weak_reports_practice_check" CHECK (length(trim("practice")) BETWEEN 1 AND 5000)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "he_weak_reports_imported_at_idx"
  ON "public"."he_weak_reports" ("imported_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "he_weak_reports_source_test_idx"
  ON "public"."he_weak_reports" ("source_test_id");--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."remove_inaccessible_he_weak_reports"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."deleted_at" IS NOT NULL OR NOT ('HE' = ANY(NEW."for_users")) THEN
    DELETE FROM "public"."he_weak_reports"
    WHERE "source_test_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "tests_remove_inaccessible_he_weak_reports" ON "public"."tests";--> statement-breakpoint

CREATE TRIGGER "tests_remove_inaccessible_he_weak_reports"
AFTER UPDATE OF "for_users", "deleted_at" ON "public"."tests"
FOR EACH ROW EXECUTE FUNCTION "public"."remove_inaccessible_he_weak_reports"();
