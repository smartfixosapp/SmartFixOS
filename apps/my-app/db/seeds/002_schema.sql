-- One-time extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

BEGIN;

-- === accessory_category ===
CREATE TABLE IF NOT EXISTS "public"."accessory_category" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "icon_name" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for accessory_category
CREATE OR REPLACE FUNCTION accessory_category_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "accessory_category_set_updated_at_trg" ON "public"."accessory_category";
CREATE TRIGGER "accessory_category_set_updated_at_trg"
BEFORE UPDATE ON "public"."accessory_category"
FOR EACH ROW
EXECUTE FUNCTION accessory_category_set_updated_at();
-- Column descriptions


-- === announcement ===
CREATE TABLE IF NOT EXISTS "public"."announcement" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "title" text,
  "message" text NOT NULL,
  "sent_to" text,
  "recipients" jsonb,
  "sent_by" text NOT NULL,
  "sent_by_name" text NOT NULL,
  "sent_at" text,
  "type" text DEFAULT 'note',
  "priority" text DEFAULT 'normal',
  "expires_at" text,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for announcement
CREATE OR REPLACE FUNCTION announcement_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "announcement_set_updated_at_trg" ON "public"."announcement";
CREATE TRIGGER "announcement_set_updated_at_trg"
BEFORE UPDATE ON "public"."announcement"
FOR EACH ROW
EXECUTE FUNCTION announcement_set_updated_at();
-- Column descriptions


-- === app_employee ===
CREATE TABLE IF NOT EXISTS "public"."app_employee" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "employee_code" text,
  "pin" text,
  "position" text,
  "role" text DEFAULT 'technician',
  "hourly_rate" numeric DEFAULT 0,
  "active" boolean DEFAULT true,
  "permissions" jsonb,
  "hire_date" text,
  "notes" text,
  "store_branch" text,
  "store_phone" text,
  "portal_access_enabled" boolean DEFAULT false,
  "status" text DEFAULT 'pending',
  "activation_token" text,
  "activation_expires_at" text
);
-- Auto-update updated_at on row changes for app_employee
CREATE OR REPLACE FUNCTION app_employee_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "app_employee_set_updated_at_trg" ON "public"."app_employee";
CREATE TRIGGER "app_employee_set_updated_at_trg"
BEFORE UPDATE ON "public"."app_employee"
FOR EACH ROW
EXECUTE FUNCTION app_employee_set_updated_at();
-- Column descriptions


-- === app_settings ===
CREATE TABLE IF NOT EXISTS "public"."app_settings" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "slug" text NOT NULL,
  "payload" jsonb NOT NULL,
  "description" text
);
-- Auto-update updated_at on row changes for app_settings
CREATE OR REPLACE FUNCTION app_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "app_settings_set_updated_at_trg" ON "public"."app_settings";
CREATE TRIGGER "app_settings_set_updated_at_trg"
BEFORE UPDATE ON "public"."app_settings"
FOR EACH ROW
EXECUTE FUNCTION app_settings_set_updated_at();
-- Column descriptions


-- === audit_log ===
CREATE TABLE IF NOT EXISTS "public"."audit_log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "entity_number" text,
  "user_id" text,
  "user_name" text,
  "user_role" text,
  "changes" jsonb,
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb,
  "severity" text DEFAULT 'info'
);
-- Auto-update updated_at on row changes for audit_log
CREATE OR REPLACE FUNCTION audit_log_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "audit_log_set_updated_at_trg" ON "public"."audit_log";
CREATE TRIGGER "audit_log_set_updated_at_trg"
BEFORE UPDATE ON "public"."audit_log"
FOR EACH ROW
EXECUTE FUNCTION audit_log_set_updated_at();
-- Column descriptions


-- === biometric_credential ===
CREATE TABLE IF NOT EXISTS "public"."biometric_credential" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "user_name" text,
  "device_id" text NOT NULL,
  "device_fingerprint" text,
  "credential_id" text NOT NULL,
  "public_key" text NOT NULL,
  "device_info" jsonb,
  "last_used" text,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for biometric_credential
CREATE OR REPLACE FUNCTION biometric_credential_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "biometric_credential_set_updated_at_trg" ON "public"."biometric_credential";
CREATE TRIGGER "biometric_credential_set_updated_at_trg"
BEFORE UPDATE ON "public"."biometric_credential"
FOR EACH ROW
EXECUTE FUNCTION biometric_credential_set_updated_at();
-- Column descriptions


-- === brand ===
CREATE TABLE IF NOT EXISTS "public"."brand" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "category_id" text NOT NULL,
  "icon_url" text,
  "icon_svg" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for brand
CREATE OR REPLACE FUNCTION brand_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "brand_set_updated_at_trg" ON "public"."brand";
CREATE TRIGGER "brand_set_updated_at_trg"
BEFORE UPDATE ON "public"."brand"
FOR EACH ROW
EXECUTE FUNCTION brand_set_updated_at();
-- Column descriptions


-- === cash_drawer_movement ===
CREATE TABLE IF NOT EXISTS "public"."cash_drawer_movement" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "drawer_id" text NOT NULL,
  "type" text NOT NULL,
  "amount" numeric NOT NULL,
  "description" text,
  "reference" text,
  "employee" text NOT NULL,
  "denominations" jsonb
);
-- Auto-update updated_at on row changes for cash_drawer_movement
CREATE OR REPLACE FUNCTION cash_drawer_movement_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "cash_drawer_movement_set_updated_at_trg" ON "public"."cash_drawer_movement";
CREATE TRIGGER "cash_drawer_movement_set_updated_at_trg"
BEFORE UPDATE ON "public"."cash_drawer_movement"
FOR EACH ROW
EXECUTE FUNCTION cash_drawer_movement_set_updated_at();
-- Column descriptions


-- === cash_register ===
CREATE TABLE IF NOT EXISTS "public"."cash_register" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "date" text NOT NULL,
  "opening_balance" numeric NOT NULL,
  "closing_balance" numeric,
  "total_revenue" numeric DEFAULT 0,
  "total_expenses" numeric DEFAULT 0,
  "net_profit" numeric DEFAULT 0,
  "estimated_tax" numeric DEFAULT 0,
  "status" text NOT NULL DEFAULT 'open',
  "needs_recount" boolean DEFAULT false,
  "recount_reason" text,
  "count_snapshot" jsonb,
  "final_count" jsonb,
  "opened_by" text,
  "closed_by" text,
  "last_movement_at" text
);
-- Auto-update updated_at on row changes for cash_register
CREATE OR REPLACE FUNCTION cash_register_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "cash_register_set_updated_at_trg" ON "public"."cash_register";
CREATE TRIGGER "cash_register_set_updated_at_trg"
BEFORE UPDATE ON "public"."cash_register"
FOR EACH ROW
EXECUTE FUNCTION cash_register_set_updated_at();
-- Column descriptions


-- === catalog_import_log ===
CREATE TABLE IF NOT EXISTS "public"."catalog_import_log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "file_name" text NOT NULL,
  "file_hash" text,
  "import_type" text NOT NULL,
  "mode" text,
  "status" text NOT NULL,
  "summary" jsonb NOT NULL,
  "errors" jsonb,
  "imported_by" text
);
-- Auto-update updated_at on row changes for catalog_import_log
CREATE OR REPLACE FUNCTION catalog_import_log_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "catalog_import_log_set_updated_at_trg" ON "public"."catalog_import_log";
CREATE TRIGGER "catalog_import_log_set_updated_at_trg"
BEFORE UPDATE ON "public"."catalog_import_log"
FOR EACH ROW
EXECUTE FUNCTION catalog_import_log_set_updated_at();
-- Column descriptions


-- === client ===
CREATE TABLE IF NOT EXISTS "public"."client" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "company" text,
  "notes" text
);
-- Auto-update updated_at on row changes for client
CREATE OR REPLACE FUNCTION client_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "client_set_updated_at_trg" ON "public"."client";
CREATE TRIGGER "client_set_updated_at_trg"
BEFORE UPDATE ON "public"."client"
FOR EACH ROW
EXECUTE FUNCTION client_set_updated_at();
-- Column descriptions


-- === communication_queue ===
CREATE TABLE IF NOT EXISTS "public"."communication_queue" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "type" text NOT NULL,
  "user_id" text NOT NULL,
  "subject" text,
  "body_html" text NOT NULL,
  "status" text DEFAULT 'pending',
  "meta" jsonb,
  "sent_at" text,
  "read_at" text
);
-- Auto-update updated_at on row changes for communication_queue
CREATE OR REPLACE FUNCTION communication_queue_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "communication_queue_set_updated_at_trg" ON "public"."communication_queue";
CREATE TRIGGER "communication_queue_set_updated_at_trg"
BEFORE UPDATE ON "public"."communication_queue"
FOR EACH ROW
EXECUTE FUNCTION communication_queue_set_updated_at();
-- Column descriptions


-- === customer ===
CREATE TABLE IF NOT EXISTS "public"."customer" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "phone" text,
  "additional_phones" jsonb,
  "email" text,
  "notes" text,
  "total_orders" numeric DEFAULT 0,
  "loyalty_points" numeric DEFAULT 0,
  "loyalty_tier" text DEFAULT 'bronze',
  "total_spent" numeric DEFAULT 0,
  "next_appointment" jsonb,
  "is_b2b" boolean DEFAULT false,
  "company_name" text,
  "company_tax_id" text,
  "billing_contact_person" text,
  "billing_address" text,
  "payment_terms" text DEFAULT 'NET-30',
  "credit_limit" numeric,
  "b2b_contacts" jsonb,
  "portal_access_token" text,
  "portal_access_enabled" boolean DEFAULT false
);
-- Auto-update updated_at on row changes for customer
CREATE OR REPLACE FUNCTION customer_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "customer_set_updated_at_trg" ON "public"."customer";
CREATE TRIGGER "customer_set_updated_at_trg"
BEFORE UPDATE ON "public"."customer"
FOR EACH ROW
EXECUTE FUNCTION customer_set_updated_at();
-- Column descriptions


-- === customer_portal_token ===
CREATE TABLE IF NOT EXISTS "public"."customer_portal_token" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "order_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" text,
  "last_accessed_at" text,
  "access_count" numeric DEFAULT 0,
  "revoked" boolean DEFAULT false,
  "revoked_at" text,
  "revoked_by" text,
  "ip_address" text,
  "user_agent" text,
  "metadata" jsonb
);
-- Auto-update updated_at on row changes for customer_portal_token
CREATE OR REPLACE FUNCTION customer_portal_token_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "customer_portal_token_set_updated_at_trg" ON "public"."customer_portal_token";
CREATE TRIGGER "customer_portal_token_set_updated_at_trg"
BEFORE UPDATE ON "public"."customer_portal_token"
FOR EACH ROW
EXECUTE FUNCTION customer_portal_token_set_updated_at();
-- Column descriptions


-- === device_category ===
CREATE TABLE IF NOT EXISTS "public"."device_category" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "icon" text,
  "icon_url" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for device_category
CREATE OR REPLACE FUNCTION device_category_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "device_category_set_updated_at_trg" ON "public"."device_category";
CREATE TRIGGER "device_category_set_updated_at_trg"
BEFORE UPDATE ON "public"."device_category"
FOR EACH ROW
EXECUTE FUNCTION device_category_set_updated_at();
-- Column descriptions


-- === device_family ===
CREATE TABLE IF NOT EXISTS "public"."device_family" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "brand_id" text NOT NULL,
  "icon_url" text,
  "icon_svg" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for device_family
CREATE OR REPLACE FUNCTION device_family_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "device_family_set_updated_at_trg" ON "public"."device_family";
CREATE TRIGGER "device_family_set_updated_at_trg"
BEFORE UPDATE ON "public"."device_family"
FOR EACH ROW
EXECUTE FUNCTION device_family_set_updated_at();
-- Column descriptions


-- === device_model ===
CREATE TABLE IF NOT EXISTS "public"."device_model" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "brand_id" text NOT NULL,
  "brand" text,
  "category_id" text,
  "subcategory_id" text,
  "family_id" text NOT NULL,
  "alias" text,
  "icon_url" text,
  "icon_svg" text,
  "common_problems" jsonb,
  "suggested_parts" jsonb,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for device_model
CREATE OR REPLACE FUNCTION device_model_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "device_model_set_updated_at_trg" ON "public"."device_model";
CREATE TRIGGER "device_model_set_updated_at_trg"
BEFORE UPDATE ON "public"."device_model"
FOR EACH ROW
EXECUTE FUNCTION device_model_set_updated_at();
-- Column descriptions


-- === device_subcategory ===
CREATE TABLE IF NOT EXISTS "public"."device_subcategory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "brand_id" text NOT NULL,
  "icon" text,
  "icon_url" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for device_subcategory
CREATE OR REPLACE FUNCTION device_subcategory_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "device_subcategory_set_updated_at_trg" ON "public"."device_subcategory";
CREATE TRIGGER "device_subcategory_set_updated_at_trg"
BEFORE UPDATE ON "public"."device_subcategory"
FOR EACH ROW
EXECUTE FUNCTION device_subcategory_set_updated_at();
-- Column descriptions


-- === discount_code ===
CREATE TABLE IF NOT EXISTS "public"."discount_code" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "code" text NOT NULL,
  "type" text NOT NULL,
  "value" numeric NOT NULL,
  "description" text,
  "valid_from" text,
  "valid_until" text,
  "usage_limit" numeric,
  "times_used" numeric DEFAULT 0,
  "min_purchase" numeric DEFAULT 0,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for discount_code
CREATE OR REPLACE FUNCTION discount_code_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "discount_code_set_updated_at_trg" ON "public"."discount_code";
CREATE TRIGGER "discount_code_set_updated_at_trg"
BEFORE UPDATE ON "public"."discount_code"
FOR EACH ROW
EXECUTE FUNCTION discount_code_set_updated_at();
-- Column descriptions


-- === email_log ===
CREATE TABLE IF NOT EXISTS "public"."email_log" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "from_name" text,
  "to_email" text NOT NULL,
  "subject" text NOT NULL,
  "body_html" text,
  "status" text DEFAULT 'pending',
  "error_message" text,
  "sent_at" text,
  "metadata" jsonb
);
-- Auto-update updated_at on row changes for email_log
CREATE OR REPLACE FUNCTION email_log_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "email_log_set_updated_at_trg" ON "public"."email_log";
CREATE TRIGGER "email_log_set_updated_at_trg"
BEFORE UPDATE ON "public"."email_log"
FOR EACH ROW
EXECUTE FUNCTION email_log_set_updated_at();
-- Column descriptions


-- === employee_payment ===
CREATE TABLE IF NOT EXISTS "public"."employee_payment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "employee_code" text,
  "amount" numeric NOT NULL,
  "payment_type" text NOT NULL DEFAULT 'salary',
  "payment_method" text DEFAULT 'cash',
  "period_start" text,
  "period_end" text,
  "notes" text,
  "paid_by" text,
  "paid_by_name" text
);
-- Auto-update updated_at on row changes for employee_payment
CREATE OR REPLACE FUNCTION employee_payment_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "employee_payment_set_updated_at_trg" ON "public"."employee_payment";
CREATE TRIGGER "employee_payment_set_updated_at_trg"
BEFORE UPDATE ON "public"."employee_payment"
FOR EACH ROW
EXECUTE FUNCTION employee_payment_set_updated_at();
-- Column descriptions


-- === event ===
CREATE TABLE IF NOT EXISTS "public"."event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "title" text NOT NULL,
  "description" text,
  "date" text NOT NULL,
  "time" text,
  "location" text,
  "client_id" text,
  "is_personal" boolean DEFAULT true,
  "status" text DEFAULT 'upcoming',
  "notes" text
);
-- Auto-update updated_at on row changes for event
CREATE OR REPLACE FUNCTION event_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "event_set_updated_at_trg" ON "public"."event";
CREATE TRIGGER "event_set_updated_at_trg"
BEFORE UPDATE ON "public"."event"
FOR EACH ROW
EXECUTE FUNCTION event_set_updated_at();
-- Column descriptions


-- === expense ===
CREATE TABLE IF NOT EXISTS "public"."expense" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "title" text NOT NULL,
  "amount" numeric NOT NULL,
  "type" text DEFAULT 'outcome',
  "currency" text DEFAULT 'USD',
  "date" text NOT NULL,
  "client_id" text,
  "is_personal" boolean DEFAULT true,
  "receipt_url" text,
  "notes" text
);
-- Auto-update updated_at on row changes for expense
CREATE OR REPLACE FUNCTION expense_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "expense_set_updated_at_trg" ON "public"."expense";
CREATE TRIGGER "expense_set_updated_at_trg"
BEFORE UPDATE ON "public"."expense"
FOR EACH ROW
EXECUTE FUNCTION expense_set_updated_at();
-- Column descriptions


-- === external_link ===
CREATE TABLE IF NOT EXISTS "public"."external_link" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "description" text,
  "category" text NOT NULL DEFAULT 'other',
  "icon" text,
  "color" text,
  "active" boolean DEFAULT true,
  "order" numeric,
  "opens_in" text DEFAULT 'new_tab'
);
-- Auto-update updated_at on row changes for external_link
CREATE OR REPLACE FUNCTION external_link_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "external_link_set_updated_at_trg" ON "public"."external_link";
CREATE TRIGGER "external_link_set_updated_at_trg"
BEFORE UPDATE ON "public"."external_link"
FOR EACH ROW
EXECUTE FUNCTION external_link_set_updated_at();
-- Column descriptions


-- === file_upload ===
CREATE TABLE IF NOT EXISTS "public"."file_upload" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "file_name" text NOT NULL,
  "file_url" text NOT NULL,
  "file_size" numeric NOT NULL,
  "mime_type" text,
  "bucket" text DEFAULT 'public/device-photos',
  "uploaded_by" text NOT NULL,
  "uploaded_by_role" text,
  "related_entity_type" text,
  "related_entity_id" text,
  "metadata" jsonb,
  "version" text
);
-- Auto-update updated_at on row changes for file_upload
CREATE OR REPLACE FUNCTION file_upload_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "file_upload_set_updated_at_trg" ON "public"."file_upload";
CREATE TRIGGER "file_upload_set_updated_at_trg"
BEFORE UPDATE ON "public"."file_upload"
FOR EACH ROW
EXECUTE FUNCTION file_upload_set_updated_at();
-- Column descriptions


-- === fixed_expense ===
CREATE TABLE IF NOT EXISTS "public"."fixed_expense" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "category" text DEFAULT 'other',
  "percentage" numeric NOT NULL,
  "frequency" text NOT NULL DEFAULT 'monthly',
  "due_day" numeric,
  "priority" numeric DEFAULT 5,
  "icon" text,
  "notes" text,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for fixed_expense
CREATE OR REPLACE FUNCTION fixed_expense_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "fixed_expense_set_updated_at_trg" ON "public"."fixed_expense";
CREATE TRIGGER "fixed_expense_set_updated_at_trg"
BEFORE UPDATE ON "public"."fixed_expense"
FOR EACH ROW
EXECUTE FUNCTION fixed_expense_set_updated_at();
-- Column descriptions


-- === inventory_movement ===
CREATE TABLE IF NOT EXISTS "public"."inventory_movement" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "product_id" text NOT NULL,
  "product_name" text,
  "movement_type" text NOT NULL,
  "quantity" numeric NOT NULL,
  "previous_stock" numeric NOT NULL,
  "new_stock" numeric NOT NULL,
  "reference_type" text,
  "reference_id" text,
  "reference_number" text,
  "notes" text,
  "performed_by" text
);
-- Auto-update updated_at on row changes for inventory_movement
CREATE OR REPLACE FUNCTION inventory_movement_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "inventory_movement_set_updated_at_trg" ON "public"."inventory_movement";
CREATE TRIGGER "inventory_movement_set_updated_at_trg"
BEFORE UPDATE ON "public"."inventory_movement"
FOR EACH ROW
EXECUTE FUNCTION inventory_movement_set_updated_at();
-- Column descriptions


-- === invoice ===
CREATE TABLE IF NOT EXISTS "public"."invoice" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "invoice_number" text,
  "company_name" text NOT NULL,
  "company_tax_id" text,
  "billing_address" text,
  "work_order_ids" jsonb NOT NULL,
  "work_order_numbers" jsonb,
  "subtotal" numeric NOT NULL,
  "tax_rate" numeric DEFAULT 0.115,
  "tax_amount" numeric,
  "total" numeric NOT NULL,
  "pdf_url" text,
  "status" text DEFAULT 'draft',
  "notes" text,
  "due_date" text,
  "paid_date" text,
  "created_by" text
);
-- Auto-update updated_at on row changes for invoice
CREATE OR REPLACE FUNCTION invoice_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "invoice_set_updated_at_trg" ON "public"."invoice";
CREATE TRIGGER "invoice_set_updated_at_trg"
BEFORE UPDATE ON "public"."invoice"
FOR EACH ROW
EXECUTE FUNCTION invoice_set_updated_at();
-- Column descriptions


-- === key_value ===
CREATE TABLE IF NOT EXISTS "public"."key_value" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "scope" text NOT NULL,
  "value_json" jsonb
);
-- Auto-update updated_at on row changes for key_value
CREATE OR REPLACE FUNCTION key_value_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "key_value_set_updated_at_trg" ON "public"."key_value";
CREATE TRIGGER "key_value_set_updated_at_trg"
BEFORE UPDATE ON "public"."key_value"
FOR EACH ROW
EXECUTE FUNCTION key_value_set_updated_at();
-- Column descriptions


-- === model_compatibility ===
CREATE TABLE IF NOT EXISTS "public"."model_compatibility" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "model_id" text NOT NULL,
  "model_name" text NOT NULL,
  "family_id" text,
  "suggested_items" jsonb,
  "preload_by_default" boolean DEFAULT true,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for model_compatibility
CREATE OR REPLACE FUNCTION model_compatibility_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "model_compatibility_set_updated_at_trg" ON "public"."model_compatibility";
CREATE TRIGGER "model_compatibility_set_updated_at_trg"
BEFORE UPDATE ON "public"."model_compatibility"
FOR EACH ROW
EXECUTE FUNCTION model_compatibility_set_updated_at();
-- Column descriptions


-- === notification ===
CREATE TABLE IF NOT EXISTS "public"."notification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" text NOT NULL DEFAULT 'info',
  "priority" text DEFAULT 'normal',
  "is_read" boolean DEFAULT false,
  "read_at" text,
  "related_entity_type" text,
  "related_entity_id" text,
  "rule_id" text,
  "actions" jsonb,
  "metadata" jsonb
);
-- Auto-update updated_at on row changes for notification
CREATE OR REPLACE FUNCTION notification_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "notification_set_updated_at_trg" ON "public"."notification";
CREATE TRIGGER "notification_set_updated_at_trg"
BEFORE UPDATE ON "public"."notification"
FOR EACH ROW
EXECUTE FUNCTION notification_set_updated_at();
-- Column descriptions


-- === notification_rule ===
CREATE TABLE IF NOT EXISTS "public"."notification_rule" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "trigger_type" text NOT NULL,
  "conditions" jsonb NOT NULL,
  "notification_config" jsonb NOT NULL,
  "target_roles" jsonb,
  "target_users" jsonb,
  "frequency" text DEFAULT 'once',
  "last_triggered" text,
  "next_evaluation" text,
  "active" boolean DEFAULT true,
  "trigger_count" numeric DEFAULT 0
);
-- Auto-update updated_at on row changes for notification_rule
CREATE OR REPLACE FUNCTION notification_rule_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "notification_rule_set_updated_at_trg" ON "public"."notification_rule";
CREATE TRIGGER "notification_rule_set_updated_at_trg"
BEFORE UPDATE ON "public"."notification_rule"
FOR EACH ROW
EXECUTE FUNCTION notification_rule_set_updated_at();
-- Column descriptions


-- === notification_settings ===
CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "email_notifications" jsonb,
  "push_notifications" jsonb,
  "sms_notifications" jsonb,
  "in_app_notifications" jsonb
);
-- Auto-update updated_at on row changes for notification_settings
CREATE OR REPLACE FUNCTION notification_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "notification_settings_set_updated_at_trg" ON "public"."notification_settings";
CREATE TRIGGER "notification_settings_set_updated_at_trg"
BEFORE UPDATE ON "public"."notification_settings"
FOR EACH ROW
EXECUTE FUNCTION notification_settings_set_updated_at();
-- Column descriptions


-- === one_time_expense ===
CREATE TABLE IF NOT EXISTS "public"."one_time_expense" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "category" text DEFAULT 'tool',
  "target_amount" numeric NOT NULL,
  "saved_amount" numeric DEFAULT 0,
  "status" text DEFAULT 'planning',
  "priority" text DEFAULT 'medium',
  "target_date" text,
  "purchased_date" text,
  "vendor" text,
  "notes" text,
  "payment_method" text,
  "invoice_url" text,
  "created_by_name" text
);
-- Auto-update updated_at on row changes for one_time_expense
CREATE OR REPLACE FUNCTION one_time_expense_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "one_time_expense_set_updated_at_trg" ON "public"."one_time_expense";
CREATE TRIGGER "one_time_expense_set_updated_at_trg"
BEFORE UPDATE ON "public"."one_time_expense"
FOR EACH ROW
EXECUTE FUNCTION one_time_expense_set_updated_at();
-- Column descriptions


-- === order ===
CREATE TABLE IF NOT EXISTS "public"."order" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "order_number" text,
  "created_date" text,
  "updated_date" text,
  "store_id" text,
  "customer_id" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_email" text,
  "customer_additional_phones" jsonb,
  "device_type" text NOT NULL,
  "device_brand" text,
  "device_subcategory" text,
  "device_family" text,
  "device_model" text,
  "device_color" text,
  "device_serial" text,
  "initial_problem" text,
  "device_photos" jsonb,
  "photos_metadata" jsonb,
  "device_security" jsonb,
  "known_issues" jsonb,
  "repair_tasks" jsonb,
  "labor_cost" numeric DEFAULT 0,
  "parts_needed" jsonb,
  "order_items" jsonb,
  "currency" text DEFAULT 'USD',
  "tax_rate" numeric DEFAULT 0.115,
  "cost_estimate" numeric,
  "amount_paid" numeric DEFAULT 0,
  "balance_due" numeric,
  "paid" boolean DEFAULT false,
  "deposit_amount" numeric DEFAULT 0,
  "status" text DEFAULT 'intake',
  "status_note" text,
  "status_note_visible_to_customer" boolean DEFAULT false,
  "status_metadata" jsonb,
  "status_history" jsonb,
  "priority" text DEFAULT 'normal',
  "progress_percentage" numeric DEFAULT 0,
  "estimated_completion" text,
  "checklist_items" jsonb,
  "checklist_notes" text,
  "comments" jsonb,
  "customer_signature" text,
  "customer_signature_meta" jsonb,
  "terms_accepted" boolean DEFAULT false,
  "terms_accepted_at" text,
  "terms_version" text,
  "wo_to_sale_id" text,
  "can_reopen" boolean DEFAULT false,
  "deleted" boolean DEFAULT false,
  "deleted_by" text,
  "deleted_at" text,
  "created_by" text,
  "created_by_name" text,
  "created_by_role" text,
  "assigned_to" text,
  "assigned_to_name" text,
  "tags" jsonb,
  "company_id" text,
  "company_name" text,
  "po_number" text,
  "net_terms" text DEFAULT 'NET-30',
  "tax_exempt" boolean DEFAULT false,
  "sla_level" text,
  "logistics" jsonb,
  "account_summary" jsonb
);
-- Auto-update updated_at on row changes for order
CREATE OR REPLACE FUNCTION order_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "order_set_updated_at_trg" ON "public"."order";
CREATE TRIGGER "order_set_updated_at_trg"
BEFORE UPDATE ON "public"."order"
FOR EACH ROW
EXECUTE FUNCTION order_set_updated_at();
-- Column descriptions


-- === part_type ===
CREATE TABLE IF NOT EXISTS "public"."part_type" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "icon_name" text,
  "active" boolean DEFAULT true,
  "order" numeric
);
-- Auto-update updated_at on row changes for part_type
CREATE OR REPLACE FUNCTION part_type_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "part_type_set_updated_at_trg" ON "public"."part_type";
CREATE TRIGGER "part_type_set_updated_at_trg"
BEFORE UPDATE ON "public"."part_type"
FOR EACH ROW
EXECUTE FUNCTION part_type_set_updated_at();
-- Column descriptions


-- === permission ===
CREATE TABLE IF NOT EXISTS "public"."permission" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "is_system" boolean DEFAULT false
);
-- Auto-update updated_at on row changes for permission
CREATE OR REPLACE FUNCTION permission_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "permission_set_updated_at_trg" ON "public"."permission";
CREATE TRIGGER "permission_set_updated_at_trg"
BEFORE UPDATE ON "public"."permission"
FOR EACH ROW
EXECUTE FUNCTION permission_set_updated_at();
-- Column descriptions


-- === personal_note ===
CREATE TABLE IF NOT EXISTS "public"."personal_note" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "title" text NOT NULL,
  "description" text,
  "type" text NOT NULL DEFAULT 'note',
  "priority" text DEFAULT 'medium',
  "status" text DEFAULT 'pending',
  "due_date" text,
  "completed_at" text,
  "linked_order_id" text,
  "linked_order_number" text,
  "linked_customer_id" text,
  "linked_customer_name" text,
  "linked_customer_phone" text,
  "assigned_to" text,
  "assigned_to_name" text,
  "reminder_sent" boolean DEFAULT false,
  "tags" jsonb
);
-- Auto-update updated_at on row changes for personal_note
CREATE OR REPLACE FUNCTION personal_note_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "personal_note_set_updated_at_trg" ON "public"."personal_note";
CREATE TRIGGER "personal_note_set_updated_at_trg"
BEFORE UPDATE ON "public"."personal_note"
FOR EACH ROW
EXECUTE FUNCTION personal_note_set_updated_at();
-- Column descriptions


-- === product ===
CREATE TABLE IF NOT EXISTS "public"."product" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "tipo_principal" text DEFAULT 'dispositivos',
  "subcategoria" text,
  "device_imei" text,
  "device_condition" text,
  "device_storage" text,
  "device_color" text,
  "device_carrier" text,
  "device_battery_health" numeric,
  "device_warranty" boolean DEFAULT false,
  "device_warranty_months" numeric,
  "description" text,
  "type" text DEFAULT 'product',
  "category" text,
  "price" numeric NOT NULL,
  "cost" numeric NOT NULL,
  "stock" numeric DEFAULT 0,
  "min_stock" numeric DEFAULT 5,
  "taxable" boolean DEFAULT true,
  "is_serialized" boolean DEFAULT false,
  "compatibility_models" jsonb,
  "compatible_families" jsonb,
  "compatible_brands" jsonb,
  "tags" jsonb,
  "active" boolean DEFAULT true,
  "image_url" text,
  "sku" text,
  "barcode" text,
  "discount_percentage" numeric DEFAULT 0,
  "discount_active" boolean DEFAULT false,
  "discount_end_date" text,
  "discount_label" text,
  "supplier_id" text,
  "supplier_name" text,
  "device_category" text,
  "part_type" text,
  "low_stock_notified" boolean DEFAULT false,
  "last_stock_alert" text
);
-- Auto-update updated_at on row changes for product
CREATE OR REPLACE FUNCTION product_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "product_set_updated_at_trg" ON "public"."product";
CREATE TRIGGER "product_set_updated_at_trg"
BEFORE UPDATE ON "public"."product"
FOR EACH ROW
EXECUTE FUNCTION product_set_updated_at();
-- Column descriptions


-- === purchase_order ===
CREATE TABLE IF NOT EXISTS "public"."purchase_order" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "po_number" text NOT NULL,
  "supplier_id" text NOT NULL,
  "supplier_name" text,
  "status" text DEFAULT 'draft',
  "order_date" text NOT NULL,
  "expected_date" text,
  "received_date" text,
  "line_items" jsonb,
  "subtotal" numeric DEFAULT 0,
  "tax_amount" numeric DEFAULT 0,
  "shipping_cost" numeric DEFAULT 0,
  "total_amount" numeric DEFAULT 0,
  "currency" text DEFAULT 'USD',
  "notes" text,
  "tracking_number" text,
  "created_by" text,
  "created_by_name" text,
  "received_by" text,
  "received_by_name" text
);
-- Auto-update updated_at on row changes for purchase_order
CREATE OR REPLACE FUNCTION purchase_order_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "purchase_order_set_updated_at_trg" ON "public"."purchase_order";
CREATE TRIGGER "purchase_order_set_updated_at_trg"
BEFORE UPDATE ON "public"."purchase_order"
FOR EACH ROW
EXECUTE FUNCTION purchase_order_set_updated_at();
-- Column descriptions


-- === recharge ===
CREATE TABLE IF NOT EXISTS "public"."recharge" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "recharge_number" text,
  "phone_number" text NOT NULL,
  "carrier" text NOT NULL,
  "carrier_custom" text,
  "amount" numeric NOT NULL,
  "commission" numeric DEFAULT 0,
  "customer_name" text,
  "customer_id" text,
  "payment_method" text NOT NULL DEFAULT 'cash',
  "status" text DEFAULT 'completed',
  "confirmation_code" text,
  "sale_id" text,
  "sale_number" text,
  "employee_id" text,
  "employee_name" text,
  "notes" text,
  "refund_reason" text,
  "refunded_at" text
);
-- Auto-update updated_at on row changes for recharge
CREATE OR REPLACE FUNCTION recharge_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "recharge_set_updated_at_trg" ON "public"."recharge";
CREATE TRIGGER "recharge_set_updated_at_trg"
BEFORE UPDATE ON "public"."recharge"
FOR EACH ROW
EXECUTE FUNCTION recharge_set_updated_at();
-- Column descriptions


-- === role ===
CREATE TABLE IF NOT EXISTS "public"."role" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for role
CREATE OR REPLACE FUNCTION role_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "role_set_updated_at_trg" ON "public"."role";
CREATE TRIGGER "role_set_updated_at_trg"
BEFORE UPDATE ON "public"."role"
FOR EACH ROW
EXECUTE FUNCTION role_set_updated_at();
-- Column descriptions


-- === role_permission ===
CREATE TABLE IF NOT EXISTS "public"."role_permission" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "role_id" text NOT NULL,
  "permission_code" text NOT NULL
);
-- Auto-update updated_at on row changes for role_permission
CREATE OR REPLACE FUNCTION role_permission_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "role_permission_set_updated_at_trg" ON "public"."role_permission";
CREATE TRIGGER "role_permission_set_updated_at_trg"
BEFORE UPDATE ON "public"."role_permission"
FOR EACH ROW
EXECUTE FUNCTION role_permission_set_updated_at();
-- Column descriptions


-- === sale ===
CREATE TABLE IF NOT EXISTS "public"."sale" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "sale_number" text NOT NULL,
  "customer_id" text,
  "customer_name" text,
  "items" jsonb NOT NULL,
  "subtotal" numeric NOT NULL,
  "tax_rate" numeric DEFAULT 0.115,
  "tax_amount" numeric,
  "discount_amount" numeric DEFAULT 0,
  "deposit_credit" numeric DEFAULT 0,
  "total" numeric NOT NULL,
  "amount_paid" numeric,
  "amount_due" numeric,
  "payment_method" text NOT NULL,
  "payment_details" jsonb,
  "employee" text NOT NULL,
  "order_id" text,
  "order_number" text,
  "voided" boolean DEFAULT false,
  "void_reason" text,
  "voided_by" text,
  "voided_at" text,
  "credit_note_id" text,
  "notes" text
);
-- Auto-update updated_at on row changes for sale
CREATE OR REPLACE FUNCTION sale_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "sale_set_updated_at_trg" ON "public"."sale";
CREATE TRIGGER "sale_set_updated_at_trg"
BEFORE UPDATE ON "public"."sale"
FOR EACH ROW
EXECUTE FUNCTION sale_set_updated_at();
-- Column descriptions


-- === sequence_counter ===
CREATE TABLE IF NOT EXISTS "public"."sequence_counter" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "sequence_type" text NOT NULL,
  "period_type" text NOT NULL DEFAULT 'daily',
  "period_key" text NOT NULL,
  "current_count" numeric DEFAULT 0,
  "last_number" text,
  "last_incremented_at" text
);
-- Auto-update updated_at on row changes for sequence_counter
CREATE OR REPLACE FUNCTION sequence_counter_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "sequence_counter_set_updated_at_trg" ON "public"."sequence_counter";
CREATE TRIGGER "sequence_counter_set_updated_at_trg"
BEFORE UPDATE ON "public"."sequence_counter"
FOR EACH ROW
EXECUTE FUNCTION sequence_counter_set_updated_at();
-- Column descriptions


-- === service ===
CREATE TABLE IF NOT EXISTS "public"."service" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "price" numeric NOT NULL,
  "duration_minutes" numeric DEFAULT 60,
  "compatibility" text,
  "compatibility_scope" text DEFAULT 'generic',
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for service
CREATE OR REPLACE FUNCTION service_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "service_set_updated_at_trg" ON "public"."service";
CREATE TRIGGER "service_set_updated_at_trg"
BEFORE UPDATE ON "public"."service"
FOR EACH ROW
EXECUTE FUNCTION service_set_updated_at();
-- Column descriptions


-- === supplier ===
CREATE TABLE IF NOT EXISTS "public"."supplier" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "contact_name" text,
  "email" text,
  "phone" text NOT NULL,
  "address" text,
  "website" text,
  "payment_terms" text DEFAULT 'NET-30',
  "currency" text DEFAULT 'USD',
  "tax_id" text,
  "notes" text,
  "active" boolean DEFAULT true,
  "rating" numeric,
  "total_orders" numeric DEFAULT 0,
  "total_spent" numeric DEFAULT 0
);
-- Auto-update updated_at on row changes for supplier
CREATE OR REPLACE FUNCTION supplier_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "supplier_set_updated_at_trg" ON "public"."supplier";
CREATE TRIGGER "supplier_set_updated_at_trg"
BEFORE UPDATE ON "public"."supplier"
FOR EACH ROW
EXECUTE FUNCTION supplier_set_updated_at();
-- Column descriptions


-- === system_config ===
CREATE TABLE IF NOT EXISTS "public"."system_config" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "category" text NOT NULL,
  "description" text
);
-- Auto-update updated_at on row changes for system_config
CREATE OR REPLACE FUNCTION system_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "system_config_set_updated_at_trg" ON "public"."system_config";
CREATE TRIGGER "system_config_set_updated_at_trg"
BEFORE UPDATE ON "public"."system_config"
FOR EACH ROW
EXECUTE FUNCTION system_config_set_updated_at();
-- Column descriptions


-- === technician_metrics ===
CREATE TABLE IF NOT EXISTS "public"."technician_metrics" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "technician_id" text NOT NULL,
  "period_start" text NOT NULL,
  "period_end" text NOT NULL,
  "jobs_completed" numeric DEFAULT 0,
  "jobs_in_progress" numeric DEFAULT 0,
  "avg_completion_time_hours" numeric DEFAULT 0,
  "customer_ratings" jsonb,
  "avg_rating" numeric DEFAULT 0,
  "revenue_generated" numeric DEFAULT 0,
  "success_rate" numeric DEFAULT 0,
  "on_time_rate" numeric DEFAULT 0
);
-- Auto-update updated_at on row changes for technician_metrics
CREATE OR REPLACE FUNCTION technician_metrics_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "technician_metrics_set_updated_at_trg" ON "public"."technician_metrics";
CREATE TRIGGER "technician_metrics_set_updated_at_trg"
BEFORE UPDATE ON "public"."technician_metrics"
FOR EACH ROW
EXECUTE FUNCTION technician_metrics_set_updated_at();
-- Column descriptions


-- === technician_profile ===
CREATE TABLE IF NOT EXISTS "public"."technician_profile" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "phone" text,
  "specializations" jsonb,
  "skills" jsonb,
  "certifications" jsonb,
  "performance_metrics" jsonb,
  "availability" jsonb,
  "notification_preferences" jsonb,
  "active" boolean DEFAULT true,
  "hire_date" text,
  "employee_number" text,
  "profile_photo_url" text
);
-- Auto-update updated_at on row changes for technician_profile
CREATE OR REPLACE FUNCTION technician_profile_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "technician_profile_set_updated_at_trg" ON "public"."technician_profile";
CREATE TRIGGER "technician_profile_set_updated_at_trg"
BEFORE UPDATE ON "public"."technician_profile"
FOR EACH ROW
EXECUTE FUNCTION technician_profile_set_updated_at();
-- Column descriptions


-- === tenant ===
CREATE TABLE IF NOT EXISTS "public"."tenant" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "status" text DEFAULT 'trial',
  "plan" text DEFAULT 'trial',
  "settings" jsonb,
  "features" jsonb,
  "subscription" jsonb,
  "owner_id" text,
  "owner_email" text NOT NULL
);
-- Auto-update updated_at on row changes for tenant
CREATE OR REPLACE FUNCTION tenant_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "tenant_set_updated_at_trg" ON "public"."tenant";
CREATE TRIGGER "tenant_set_updated_at_trg"
BEFORE UPDATE ON "public"."tenant"
FOR EACH ROW
EXECUTE FUNCTION tenant_set_updated_at();
-- Column descriptions


-- === tenant_membership ===
CREATE TABLE IF NOT EXISTS "public"."tenant_membership" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "tenant_id" text NOT NULL,
  "user_id" text,
  "user_email" text NOT NULL,
  "user_name" text,
  "role_id" text NOT NULL,
  "role_name" text,
  "status" text DEFAULT 'pending',
  "invited_by" text,
  "invited_at" text,
  "accepted_at" text,
  "permissions_override" jsonb
);
-- Auto-update updated_at on row changes for tenant_membership
CREATE OR REPLACE FUNCTION tenant_membership_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "tenant_membership_set_updated_at_trg" ON "public"."tenant_membership";
CREATE TRIGGER "tenant_membership_set_updated_at_trg"
BEFORE UPDATE ON "public"."tenant_membership"
FOR EACH ROW
EXECUTE FUNCTION tenant_membership_set_updated_at();
-- Column descriptions


-- === tenant_role ===
CREATE TABLE IF NOT EXISTS "public"."tenant_role" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "tenant_id" text NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false,
  "permissions" jsonb,
  "level" numeric DEFAULT 0
);
-- Auto-update updated_at on row changes for tenant_role
CREATE OR REPLACE FUNCTION tenant_role_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "tenant_role_set_updated_at_trg" ON "public"."tenant_role";
CREATE TRIGGER "tenant_role_set_updated_at_trg"
BEFORE UPDATE ON "public"."tenant_role"
FOR EACH ROW
EXECUTE FUNCTION tenant_role_set_updated_at();
-- Column descriptions


-- === time_entry ===
CREATE TABLE IF NOT EXISTS "public"."time_entry" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "employee_id" text NOT NULL,
  "employee_name" text NOT NULL,
  "clock_in" text NOT NULL,
  "clock_out" text,
  "total_hours" numeric,
  "notes" text
);
-- Auto-update updated_at on row changes for time_entry
CREATE OR REPLACE FUNCTION time_entry_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "time_entry_set_updated_at_trg" ON "public"."time_entry";
CREATE TRIGGER "time_entry_set_updated_at_trg"
BEFORE UPDATE ON "public"."time_entry"
FOR EACH ROW
EXECUTE FUNCTION time_entry_set_updated_at();
-- Column descriptions


-- === transaction ===
CREATE TABLE IF NOT EXISTS "public"."transaction" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "order_id" text,
  "order_number" text,
  "type" text NOT NULL,
  "amount" numeric NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "payment_method" text,
  "recorded_by" text
);
-- Auto-update updated_at on row changes for transaction
CREATE OR REPLACE FUNCTION transaction_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transaction_set_updated_at_trg" ON "public"."transaction";
CREATE TRIGGER "transaction_set_updated_at_trg"
BEFORE UPDATE ON "public"."transaction"
FOR EACH ROW
EXECUTE FUNCTION transaction_set_updated_at();
-- Column descriptions


-- === user_notification_settings ===
CREATE TABLE IF NOT EXISTS "public"."user_notification_settings" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "receive_new_order_notifications" boolean DEFAULT true,
  "receive_status_change_notifications" boolean DEFAULT true,
  "receive_low_stock_notifications" boolean DEFAULT true,
  "receive_order_ready_notifications" boolean DEFAULT true,
  "receive_payment_notifications" boolean DEFAULT true,
  "receive_urgent_notifications" boolean DEFAULT true,
  "receive_assignment_notifications" boolean DEFAULT true,
  "channel_web_push" boolean DEFAULT true,
  "channel_in_app" boolean DEFAULT true,
  "web_push_subscription" jsonb,
  "device_info" jsonb
);
-- Auto-update updated_at on row changes for user_notification_settings
CREATE OR REPLACE FUNCTION user_notification_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "user_notification_settings_set_updated_at_trg" ON "public"."user_notification_settings";
CREATE TRIGGER "user_notification_settings_set_updated_at_trg"
BEFORE UPDATE ON "public"."user_notification_settings"
FOR EACH ROW
EXECUTE FUNCTION user_notification_settings_set_updated_at();
-- Column descriptions


-- === user_role ===
CREATE TABLE IF NOT EXISTS "public"."user_role" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "user_id" text NOT NULL,
  "role_id" text NOT NULL,
  "assigned_by" text,
  "assigned_at" text
);
-- Auto-update updated_at on row changes for user_role
CREATE OR REPLACE FUNCTION user_role_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "user_role_set_updated_at_trg" ON "public"."user_role";
CREATE TRIGGER "user_role_set_updated_at_trg"
BEFORE UPDATE ON "public"."user_role"
FOR EACH ROW
EXECUTE FUNCTION user_role_set_updated_at();
-- Column descriptions


-- === work_order_config ===
CREATE TABLE IF NOT EXISTS "public"."work_order_config" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "key" text NOT NULL,
  "steps_enabled" jsonb,
  "steps_order" jsonb DEFAULT '["device", "model", "problem", "customer", "comments", "media", "signature", "terms"]'::jsonb,
  "customer_fields" jsonb,
  "signature_config" jsonb,
  "media_config" jsonb,
  "terms_text" jsonb,
  "email_template" jsonb,
  "pdf_config" jsonb
);
-- Auto-update updated_at on row changes for work_order_config
CREATE OR REPLACE FUNCTION work_order_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "work_order_config_set_updated_at_trg" ON "public"."work_order_config";
CREATE TRIGGER "work_order_config_set_updated_at_trg"
BEFORE UPDATE ON "public"."work_order_config"
FOR EACH ROW
EXECUTE FUNCTION work_order_config_set_updated_at();
-- Column descriptions


-- === work_order_event ===
CREATE TABLE IF NOT EXISTS "public"."work_order_event" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "order_id" text NOT NULL,
  "order_number" text,
  "event_type" text NOT NULL,
  "description" text NOT NULL,
  "user_id" text,
  "user_name" text NOT NULL,
  "user_role" text,
  "metadata" jsonb,
  "is_private" boolean DEFAULT false
);
-- Auto-update updated_at on row changes for work_order_event
CREATE OR REPLACE FUNCTION work_order_event_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "work_order_event_set_updated_at_trg" ON "public"."work_order_event";
CREATE TRIGGER "work_order_event_set_updated_at_trg"
BEFORE UPDATE ON "public"."work_order_event"
FOR EACH ROW
EXECUTE FUNCTION work_order_event_set_updated_at();
-- Column descriptions


-- === work_order_wizard_config ===
CREATE TABLE IF NOT EXISTS "public"."work_order_wizard_config" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id varchar(255) NOT NULL DEFAULT 'system',
  created_by varchar(255) NOT NULL DEFAULT 'system',
  is_sample boolean DEFAULT false,
  "steps_enabled" jsonb,
  "steps_order" jsonb,
  "customer_search_enabled" boolean DEFAULT true,
  "customer_fields_required" jsonb,
  "device_auto_family" boolean DEFAULT true,
  "problem_presets" jsonb,
  "media_config" jsonb,
  "security_config" jsonb,
  "auto_send_email" boolean DEFAULT true,
  "default_status" text DEFAULT 'intake',
  "auto_assign" boolean DEFAULT false,
  "active" boolean DEFAULT true
);
-- Auto-update updated_at on row changes for work_order_wizard_config
CREATE OR REPLACE FUNCTION work_order_wizard_config_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "work_order_wizard_config_set_updated_at_trg" ON "public"."work_order_wizard_config";
CREATE TRIGGER "work_order_wizard_config_set_updated_at_trg"
BEFORE UPDATE ON "public"."work_order_wizard_config"
FOR EACH ROW
EXECUTE FUNCTION work_order_wizard_config_set_updated_at();
-- Column descriptions

COMMIT;
