ALTER TABLE "org_template"."partners" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD COLUMN "removed_by" uuid;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD COLUMN "removed_recommender_id" uuid;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD CONSTRAINT "partners_removed_by_accounts_id_fk" FOREIGN KEY ("removed_by") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD CONSTRAINT "partners_removed_recommender_id_accounts_id_fk" FOREIGN KEY ("removed_recommender_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;