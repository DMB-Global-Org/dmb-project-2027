-- Custom SQL migration file, put your code below! --
-- The system log is append-only (rule 9): reject UPDATE, DELETE and TRUNCATE.
CREATE FUNCTION "app"."audit_log_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'app.audit_log is append-only (% is not allowed)', TG_OP
		USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "audit_log_no_update_delete"
	BEFORE UPDATE OR DELETE ON "app"."audit_log"
	FOR EACH ROW EXECUTE FUNCTION "app"."audit_log_immutable"();--> statement-breakpoint
CREATE TRIGGER "audit_log_no_truncate"
	BEFORE TRUNCATE ON "app"."audit_log"
	FOR EACH STATEMENT EXECUTE FUNCTION "app"."audit_log_immutable"();
