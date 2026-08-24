CREATE TYPE "public"."import_type" AS ENUM('bank', 'ledger', 'invoice', 'settlement');--> statement-breakpoint
CREATE TYPE "public"."settlement_line_type" AS ENUM('sale', 'fee', 'refund', 'deduction', 'adjustment', 'reserve', 'other');--> statement-breakpoint
CREATE TYPE "public"."proposal_method" AS ENUM('exact', 'rule', 'fuzzy', 'llm', 'manual');--> statement-breakpoint
CREATE TYPE "public"."proposal_source_type" AS ENUM('bank_transaction', 'ledger_entry', 'invoice', 'settlement', 'settlement_line');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" varchar(255) NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload_json" jsonb,
	"previous_hash" varchar(64) NOT NULL,
	"hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"external_reference" varchar(255),
	"posted_at" timestamp with time zone NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"description" text NOT NULL,
	"normalized_vendor" varchar(255) NOT NULL,
	"raw_json" jsonb NOT NULL,
	"source_row" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"source_type" "proposal_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"evidence_type" varchar(64) NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "import_type" NOT NULL,
	"filename" varchar(255) NOT NULL,
	"row_count" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"external_reference" varchar(255),
	"posted_at" timestamp with time zone NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"account_code" varchar(64) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"normalized_vendor" varchar(255) NOT NULL,
	"raw_json" jsonb NOT NULL,
	"source_row" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"invoice_number" varchar(255) NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"vendor" varchar(255) NOT NULL,
	"normalized_vendor" varchar(255) NOT NULL,
	"reference" varchar(255),
	"raw_json" jsonb NOT NULL,
	"source_row" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" uuid NOT NULL,
	"type" "settlement_line_type" NOT NULL,
	"description" varchar(512) NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reference" varchar(255),
	"raw_json" jsonb NOT NULL,
	"source_row" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"provider" varchar(255) NOT NULL,
	"settlement_reference" varchar(255),
	"settlement_date" timestamp with time zone NOT NULL,
	"currency" varchar(3) NOT NULL,
	"gross_amount_cents" bigint NOT NULL,
	"fees_cents" bigint DEFAULT 0 NOT NULL,
	"refunds_cents" bigint DEFAULT 0 NOT NULL,
	"deductions_cents" bigint DEFAULT 0 NOT NULL,
	"adjustments_cents" bigint DEFAULT 0 NOT NULL,
	"expected_net_cents" bigint NOT NULL,
	"raw_json" jsonb NOT NULL,
	"source_row" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"source_type" "proposal_source_type" NOT NULL,
	"record_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"method" "proposal_method" NOT NULL,
	"score" double precision NOT NULL,
	"rationale_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" varchar(255),
	"superseded_by" uuid
);
--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_proposal_id_reconciliation_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."reconciliation_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_lines" ADD CONSTRAINT "settlement_lines_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_links" ADD CONSTRAINT "proposal_links_proposal_id_reconciliation_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."reconciliation_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_proposals" ADD CONSTRAINT "reconciliation_proposals_superseded_by_reconciliation_proposals_id_fk" FOREIGN KEY ("superseded_by") REFERENCES "public"."reconciliation_proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_log_hash_uq" ON "activity_log" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "activity_log_timestamp_idx" ON "activity_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_log_actor_idx" ON "activity_log" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "bank_transactions_import_id_idx" ON "bank_transactions" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_posted_at_idx" ON "bank_transactions" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "bank_transactions_amount_cents_idx" ON "bank_transactions" USING btree ("amount_cents");--> statement-breakpoint
CREATE INDEX "bank_transactions_normalized_vendor_idx" ON "bank_transactions" USING btree ("normalized_vendor");--> statement-breakpoint
CREATE INDEX "bank_transactions_external_reference_idx" ON "bank_transactions" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "bank_transactions_content_hash_idx" ON "bank_transactions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_import_source_row_uq" ON "bank_transactions" USING btree ("import_id","source_row");--> statement-breakpoint
CREATE INDEX "evidence_proposal_id_idx" ON "evidence" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "evidence_source_type_source_id_idx" ON "evidence" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "imports_type_content_hash_uq" ON "imports" USING btree ("type","content_hash");--> statement-breakpoint
CREATE INDEX "imports_created_at_idx" ON "imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_import_id_idx" ON "ledger_entries" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_posted_at_idx" ON "ledger_entries" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "ledger_entries_amount_cents_idx" ON "ledger_entries" USING btree ("amount_cents");--> statement-breakpoint
CREATE INDEX "ledger_entries_normalized_vendor_idx" ON "ledger_entries" USING btree ("normalized_vendor");--> statement-breakpoint
CREATE INDEX "ledger_entries_external_reference_idx" ON "ledger_entries" USING btree ("external_reference");--> statement-breakpoint
CREATE INDEX "ledger_entries_account_code_idx" ON "ledger_entries" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX "ledger_entries_content_hash_idx" ON "ledger_entries" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_entries_import_source_row_uq" ON "ledger_entries" USING btree ("import_id","source_row");--> statement-breakpoint
CREATE INDEX "invoices_import_id_idx" ON "invoices" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_issued_at_idx" ON "invoices" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "invoices_due_at_idx" ON "invoices" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "invoices_amount_cents_idx" ON "invoices" USING btree ("amount_cents");--> statement-breakpoint
CREATE INDEX "invoices_normalized_vendor_idx" ON "invoices" USING btree ("normalized_vendor");--> statement-breakpoint
CREATE INDEX "invoices_reference_idx" ON "invoices" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_import_source_row_uq" ON "invoices" USING btree ("import_id","source_row");--> statement-breakpoint
CREATE INDEX "settlement_lines_settlement_id_idx" ON "settlement_lines" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "settlement_lines_type_idx" ON "settlement_lines" USING btree ("type");--> statement-breakpoint
CREATE INDEX "settlement_lines_amount_cents_idx" ON "settlement_lines" USING btree ("amount_cents");--> statement-breakpoint
CREATE INDEX "settlement_lines_reference_idx" ON "settlement_lines" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_lines_settlement_source_row_uq" ON "settlement_lines" USING btree ("settlement_id","source_row");--> statement-breakpoint
CREATE INDEX "settlements_import_id_idx" ON "settlements" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "settlements_settlement_date_idx" ON "settlements" USING btree ("settlement_date");--> statement-breakpoint
CREATE INDEX "settlements_settlement_reference_idx" ON "settlements" USING btree ("settlement_reference");--> statement-breakpoint
CREATE INDEX "settlements_provider_idx" ON "settlements" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "settlements_gross_amount_cents_idx" ON "settlements" USING btree ("gross_amount_cents");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_import_source_row_uq" ON "settlements" USING btree ("import_id","source_row");--> statement-breakpoint
CREATE INDEX "proposal_links_proposal_id_idx" ON "proposal_links" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposal_links_source_type_record_id_idx" ON "proposal_links" USING btree ("source_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_links_source_record_uq" ON "proposal_links" USING btree ("proposal_id","source_type","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_links_single_bank_transaction_uq" ON "proposal_links" USING btree ("proposal_id") WHERE "proposal_links"."source_type" = 'bank_transaction';--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_links_single_settlement_uq" ON "proposal_links" USING btree ("proposal_id") WHERE "proposal_links"."source_type" = 'settlement';--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_status_idx" ON "reconciliation_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_method_idx" ON "reconciliation_proposals" USING btree ("method");--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_score_idx" ON "reconciliation_proposals" USING btree ("score");--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_created_at_idx" ON "reconciliation_proposals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_decided_at_idx" ON "reconciliation_proposals" USING btree ("decided_at");