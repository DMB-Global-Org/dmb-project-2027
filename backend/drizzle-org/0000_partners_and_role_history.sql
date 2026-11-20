CREATE TABLE "org_template"."partners" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"role" "app"."role" DEFAULT 'GENERAL' NOT NULL,
	"status" "app"."partner_status" DEFAULT 'INACTIVE' NOT NULL,
	"state" "app"."account_state" DEFAULT 'PENDING_ACTIVATION' NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"recommender_id" uuid,
	"invited_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_template"."role_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "app"."role" NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD CONSTRAINT "partners_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD CONSTRAINT "partners_recommender_id_partners_account_id_fk" FOREIGN KEY ("recommender_id") REFERENCES "org_template"."partners"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_template"."partners" ADD CONSTRAINT "partners_invited_by_id_accounts_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_template"."role_history" ADD CONSTRAINT "role_history_account_id_partners_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "org_template"."partners"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_template"."role_history" ADD CONSTRAINT "role_history_changed_by_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partners_recommender_id_idx" ON "org_template"."partners" USING btree ("recommender_id");--> statement-breakpoint
CREATE INDEX "role_history_account_id_idx" ON "org_template"."role_history" USING btree ("account_id");