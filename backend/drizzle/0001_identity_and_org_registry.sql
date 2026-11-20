CREATE TYPE "app"."account_state" AS ENUM('PENDING_ACTIVATION', 'ACTIVE', 'DEACTIVATED');--> statement-breakpoint
CREATE TYPE "app"."partner_status" AS ENUM('INACTIVE', 'ACTIVE', 'GO_MAGIC', 'DIAMOND_SCHOOL');--> statement-breakpoint
CREATE TYPE "app"."role" AS ENUM('GENERAL', 'FOUNDATION', 'BUILDER', 'SILVER', 'PLATINUM', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR');--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"org_schema" text,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'pl' NOT NULL,
	"partner_number" text,
	"partner_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_key" UNIQUE("email"),
	CONSTRAINT "accounts_partner_number_key" UNIQUE("partner_country","partner_number"),
	CONSTRAINT "accounts_email_lowercase" CHECK ("app"."accounts"."email" = lower("app"."accounts"."email")),
	CONSTRAINT "accounts_partner_number_pair" CHECK (("app"."accounts"."partner_number" is null) = ("app"."accounts"."partner_country" is null)),
	CONSTRAINT "accounts_org_schema_or_super_admin" CHECK ("app"."accounts"."is_super_admin" = ("app"."accounts"."org_schema" is null))
);
--> statement-breakpoint
CREATE TABLE "app"."org_schema_migrations" (
	"schema_name" text NOT NULL,
	"file" text NOT NULL,
	"hash" text NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_schema_migrations_schema_name_file_pk" PRIMARY KEY("schema_name","file")
);
--> statement-breakpoint
CREATE TABLE "app"."org_schemas" (
	"name" text PRIMARY KEY NOT NULL,
	"root_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_schemas_name_format" CHECK ("app"."org_schemas"."name" ~ '^org_[0-9a-f]{8}$')
);
--> statement-breakpoint
CREATE TABLE "app"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text,
	"subject_account_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_org_schema_org_schemas_name_fk" FOREIGN KEY ("org_schema") REFERENCES "app"."org_schemas"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."org_schema_migrations" ADD CONSTRAINT "org_schema_migrations_schema_name_org_schemas_name_fk" FOREIGN KEY ("schema_name") REFERENCES "app"."org_schemas"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."org_schemas" ADD CONSTRAINT "org_schemas_root_account_id_accounts_id_fk" FOREIGN KEY ("root_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_subject_account_id_accounts_id_fk" FOREIGN KEY ("subject_account_id") REFERENCES "app"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_subject_at_idx" ON "app"."audit_log" USING btree ("subject_account_id","at");