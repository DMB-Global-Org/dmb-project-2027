CREATE TABLE "app"."mailings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_account_id" uuid NOT NULL,
	"min_role" "app"."role" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"translations" jsonb,
	"recipient_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD COLUMN "mailing_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."mailings" ADD CONSTRAINT "mailings_sender_account_id_accounts_id_fk" FOREIGN KEY ("sender_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mailings_sender_created_idx" ON "app"."mailings" USING btree ("sender_account_id","created_at");--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_mailing_id_mailings_id_fk" FOREIGN KEY ("mailing_id") REFERENCES "app"."mailings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_mailing_idx" ON "app"."notifications" USING btree ("mailing_id");