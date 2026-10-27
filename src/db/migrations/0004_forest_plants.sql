CREATE TABLE IF NOT EXISTS "public"."forest_plants" (
  "attempt_id" uuid PRIMARY KEY NOT NULL,
  "planted_at" timestamp with time zone NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "forest_plants_planted_at_idx"
  ON "public"."forest_plants" ("planted_at");--> statement-breakpoint

CREATE OR REPLACE FUNCTION "public"."record_he_forest_plant"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."taken_by" = 'HE' AND NEW."submitted_at" IS NOT NULL THEN
    INSERT INTO "public"."forest_plants" ("attempt_id", "planted_at")
    VALUES (NEW."id", NEW."submitted_at")
    ON CONFLICT ("attempt_id") DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "attempts_record_he_forest_plant" ON "public"."attempts";--> statement-breakpoint

CREATE TRIGGER "attempts_record_he_forest_plant"
AFTER INSERT OR UPDATE OF "submitted_at", "taken_by" ON "public"."attempts"
FOR EACH ROW EXECUTE FUNCTION "public"."record_he_forest_plant"();--> statement-breakpoint

INSERT INTO "public"."forest_plants" ("attempt_id", "planted_at")
SELECT "id", "submitted_at"
FROM "public"."attempts"
WHERE "taken_by" = 'HE' AND "submitted_at" IS NOT NULL
ON CONFLICT ("attempt_id") DO NOTHING;
