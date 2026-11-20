CREATE TYPE "app"."invitation_kind" AS ENUM('PARTNER', 'PLATINUM');--> statement-breakpoint
CREATE TABLE "app"."invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"kind" "app"."invitation_kind" NOT NULL,
	"inviter_account_id" uuid NOT NULL,
	"recommender_account_id" uuid,
	"org_schema" text,
	"recipient_email" text,
	"recipient_phone" text,
	"locale" text DEFAULT 'pl' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_account_id" uuid,
	CONSTRAINT "invitations_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "invitations_kind_shape" CHECK (("app"."invitations"."kind" = 'PARTNER' and "app"."invitations"."recommender_account_id" is not null and "app"."invitations"."org_schema" is not null)
        or ("app"."invitations"."kind" = 'PLATINUM' and "app"."invitations"."recommender_account_id" is null and "app"."invitations"."org_schema" is null)),
	CONSTRAINT "invitations_has_recipient" CHECK ("app"."invitations"."recipient_email" is not null or "app"."invitations"."recipient_phone" is not null),
	CONSTRAINT "invitations_recipient_email_lowercase" CHECK ("app"."invitations"."recipient_email" is null or "app"."invitations"."recipient_email" = lower("app"."invitations"."recipient_email")),
	CONSTRAINT "invitations_consumed_pair" CHECK (("app"."invitations"."consumed_at" is null) = ("app"."invitations"."consumed_by_account_id" is null))
);
--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_inviter_account_id_accounts_id_fk" FOREIGN KEY ("inviter_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_recommender_account_id_accounts_id_fk" FOREIGN KEY ("recommender_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_org_schema_org_schemas_name_fk" FOREIGN KEY ("org_schema") REFERENCES "app"."org_schemas"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."invitations" ADD CONSTRAINT "invitations_consumed_by_account_id_accounts_id_fk" FOREIGN KEY ("consumed_by_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_inviter_created_idx" ON "app"."invitations" USING btree ("inviter_account_id","created_at");