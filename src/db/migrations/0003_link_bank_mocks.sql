ALTER TABLE "tests" ADD COLUMN "source_bank_id" uuid;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_source_bank_id_fkey" FOREIGN KEY ("source_bank_id") REFERENCES "public"."question_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tests_source_bank_idx" ON "tests" USING btree ("source_bank_id");