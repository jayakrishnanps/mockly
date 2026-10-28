CREATE TABLE IF NOT EXISTS "jk_practice_records" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"correct_count" integer NOT NULL,
	"wrong_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"time_taken_seconds" integer NOT NULL,
	"xp" bigint GENERATED ALWAYS AS (10::bigint * correct_count + floor(20.0 * (correct_count::bigint + wrong_count) / (correct_count::bigint + wrong_count + skipped_count))::bigint) STORED,
	CONSTRAINT "jk_practice_records_counts_check" CHECK ("jk_practice_records"."correct_count" >= 0 AND "jk_practice_records"."wrong_count" >= 0 AND "jk_practice_records"."skipped_count" >= 0 AND "jk_practice_records"."correct_count"::bigint + "jk_practice_records"."wrong_count" + "jk_practice_records"."skipped_count" > 0),
	CONSTRAINT "jk_practice_records_time_check" CHECK ("jk_practice_records"."time_taken_seconds" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jk_practice_records_completed_at_idx" ON "jk_practice_records" USING btree ("completed_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "public"."record_jk_practice"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."taken_by" = 'JK' AND NEW."submitted_at" IS NOT NULL
     AND NEW."correct_count" >= 0 AND NEW."wrong_count" >= 0 AND NEW."skipped_count" >= 0
     AND NEW."correct_count"::bigint + NEW."wrong_count" + NEW."skipped_count" > 0
     AND NEW."time_taken_seconds" >= 0 THEN
    INSERT INTO "public"."jk_practice_records"
      ("attempt_id", "completed_at", "correct_count", "wrong_count", "skipped_count", "time_taken_seconds")
    VALUES (NEW."id", NEW."submitted_at", NEW."correct_count", NEW."wrong_count", NEW."skipped_count", NEW."time_taken_seconds")
    ON CONFLICT ("attempt_id") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "attempts_record_jk_practice" ON "public"."attempts";
--> statement-breakpoint
CREATE TRIGGER "attempts_record_jk_practice"
AFTER INSERT OR UPDATE OF "submitted_at", "taken_by", "correct_count", "wrong_count", "skipped_count", "time_taken_seconds"
ON "public"."attempts"
FOR EACH ROW EXECUTE FUNCTION "public"."record_jk_practice"();
--> statement-breakpoint
INSERT INTO "public"."jk_practice_records"
  ("attempt_id", "completed_at", "correct_count", "wrong_count", "skipped_count", "time_taken_seconds")
SELECT "id", "submitted_at", "correct_count", "wrong_count", "skipped_count", "time_taken_seconds"
FROM "public"."attempts"
WHERE "taken_by" = 'JK' AND "submitted_at" IS NOT NULL
  AND "correct_count" >= 0 AND "wrong_count" >= 0 AND "skipped_count" >= 0
  AND "correct_count"::bigint + "wrong_count" + "skipped_count" > 0
  AND "time_taken_seconds" >= 0
ON CONFLICT ("attempt_id") DO NOTHING;
