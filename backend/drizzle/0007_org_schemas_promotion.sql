ALTER TABLE "app"."org_schemas" ADD COLUMN "source_schema" text;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD COLUMN "promoted_by" uuid;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD COLUMN "promoted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD COLUMN "previous_recommender_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD CONSTRAINT "org_schemas_source_schema_org_schemas_name_fk" FOREIGN KEY ("source_schema") REFERENCES "app"."org_schemas"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD CONSTRAINT "org_schemas_promoted_by_accounts_id_fk" FOREIGN KEY ("promoted_by") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD CONSTRAINT "org_schemas_previous_recommender_id_accounts_id_fk" FOREIGN KEY ("previous_recommender_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD CONSTRAINT "org_schemas_promotion_shape" CHECK (("app"."org_schemas"."source_schema" is null) = ("app"."org_schemas"."promoted_by" is null) and ("app"."org_schemas"."source_schema" is null) = ("app"."org_schemas"."promoted_at" is null));