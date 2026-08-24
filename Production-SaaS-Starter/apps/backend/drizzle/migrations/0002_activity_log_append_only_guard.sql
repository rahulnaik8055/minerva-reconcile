CREATE FUNCTION prevent_activity_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_log_no_update
  BEFORE UPDATE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();

CREATE TRIGGER activity_log_no_delete
  BEFORE DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION prevent_activity_log_mutation();

CREATE TRIGGER activity_log_no_truncate
  BEFORE TRUNCATE ON activity_log
  FOR STATEMENT EXECUTE FUNCTION prevent_activity_log_mutation();
