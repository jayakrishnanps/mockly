LOCK TABLE "public"."tests", "public"."weak_area_reports" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint

DELETE FROM "public"."weak_area_reports" AS report
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."tests" AS mock
  WHERE mock."id" = report."source_test_id"
    AND mock."deleted_at" IS NULL
    AND 'JK' = ANY(mock."for_users")
);--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.weak_area_reports'::regclass
      AND conname = 'weak_area_reports_source_test_id_fkey'
  ) THEN
    ALTER TABLE "public"."weak_area_reports"
      ADD CONSTRAINT "weak_area_reports_source_test_id_fkey"
      FOREIGN KEY ("source_test_id") REFERENCES "public"."tests" ("id")
      ON DELETE CASCADE;
  END IF;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."remove_inaccessible_weak_area_reports"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."deleted_at" IS NOT NULL OR NOT ('JK' = ANY(NEW."for_users")) THEN
    DELETE FROM "public"."weak_area_reports"
    WHERE "source_test_id" = NEW."id";
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "tests_remove_inaccessible_weak_area_reports" ON "public"."tests";--> statement-breakpoint

CREATE TRIGGER "tests_remove_inaccessible_weak_area_reports"
AFTER UPDATE OF "for_users", "deleted_at" ON "public"."tests"
FOR EACH ROW EXECUTE FUNCTION "public"."remove_inaccessible_weak_area_reports"();
