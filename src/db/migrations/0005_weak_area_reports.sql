CREATE TABLE IF NOT EXISTS "public"."weak_area_reports" (
  "id" uuid PRIMARY KEY NOT NULL,
  "source_test_id" uuid NOT NULL,
  "source_title" text NOT NULL,
  "areas" jsonb NOT NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "weak_area_reports_source_title_check" CHECK (length(trim("source_title")) BETWEEN 1 AND 200),
  CONSTRAINT "weak_area_reports_areas_check" CHECK (CASE WHEN jsonb_typeof("areas") = 'array' THEN jsonb_array_length("areas") <= 12 ELSE false END)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "weak_area_reports_imported_at_idx"
  ON "public"."weak_area_reports" ("imported_at" DESC);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "weak_area_reports_source_test_idx"
  ON "public"."weak_area_reports" ("source_test_id");
