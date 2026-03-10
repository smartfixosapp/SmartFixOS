CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END; $$ language 'plpgsql';

DROP VIEW IF EXISTS "public"."users";
CREATE TABLE IF NOT EXISTS "public"."users" (
  id text PRIMARY KEY DEFAULT CAST(gen_random_uuid() AS text),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "role" text CHECK ("role" IN ('admin', 'user',NULL)),
  "email" text,
  "full_name" text,
  "position" text,
  "employee_code" text,
  "pin" text,
  "phone" text,
  "active" boolean DEFAULT true,
  UNIQUE ("email")
);
CREATE INDEX IF NOT EXISTS idx_users_email ON "public"."users"(email);
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."users" TO authenticated';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."users" TO service_role';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  EXECUTE 'GRANT SELECT ON "public"."users" TO anon';
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DROP TRIGGER IF EXISTS "update_users_updated_at" ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- User ID Synchronization System: sync auth.users ID with public.users and FK references
CREATE OR REPLACE FUNCTION sync_user_id_from_auth()
RETURNS TRIGGER AS $$
DECLARE
    old_user_id text;
    new_user_id UUID;
    user_email TEXT;
    table_rec RECORD;
    column_rec RECORD;
    update_sql TEXT;
    affected_rows INTEGER;
BEGIN
    new_user_id := NEW.id;
    user_email := NEW.email;
    IF user_email IS NULL OR user_email = '' THEN
        RETURN NEW;
    END IF;
    SELECT id INTO old_user_id FROM public.users WHERE email = user_email LIMIT 1;
    IF old_user_id IS NULL OR old_user_id = new_user_id::text THEN
        RETURN NEW;
    END IF;
    UPDATE public.users SET id = new_user_id::text, updated_at = NOW() WHERE id = old_user_id;
    FOR table_rec IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'users'
    LOOP
        FOR column_rec IN
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = table_rec.table_name
              AND (column_name IN ('user_id', 'created_by_id', 'updated_by_id', 'owner_id', 'assigned_to_id')
                   OR column_name LIKE '%_user_id' OR column_name LIKE '%user_id%')
              AND data_type IN ('uuid', 'text', 'varchar', 'character varying')
        LOOP
            IF column_rec.data_type = 'uuid' THEN
                update_sql := format('UPDATE public.%I SET %I = $1 WHERE %I = $2', table_rec.table_name, column_rec.column_name, column_rec.column_name);
                EXECUTE update_sql USING new_user_id::text, old_user_id;
            ELSE
                update_sql := format('UPDATE public.%I SET %I = $1::text WHERE %I = $2::text', table_rec.table_name, column_rec.column_name, column_rec.column_name);
                EXECUTE update_sql USING new_user_id::text, old_user_id::text;
            END IF;
        END LOOP;
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_user_id_trigger ON auth.users;
CREATE TRIGGER sync_user_id_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_id_from_auth();

CREATE OR REPLACE FUNCTION sync_user_id_manual(auth_user_id UUID, user_email TEXT DEFAULT NULL, user_phone TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    old_user_id TEXT;
    table_rec RECORD;
    column_rec RECORD;
    update_sql TEXT;
    affected_rows INTEGER;
    total_affected INTEGER := 0;
BEGIN
    IF user_email IS NULL OR user_email = '' THEN
        RETURN 0;
    END IF;
    SELECT id INTO old_user_id FROM public.users WHERE email = user_email LIMIT 1;
    IF old_user_id IS NULL OR old_user_id = auth_user_id::text THEN
        RETURN 0;
    END IF;
    UPDATE public.users SET id = auth_user_id::text, updated_at = NOW() WHERE id = old_user_id;
    total_affected := 1;
    FOR table_rec IN
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != 'users'
    LOOP
        FOR column_rec IN
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = table_rec.table_name
              AND (column_name IN ('user_id', 'created_by_id', 'updated_by_id', 'owner_id', 'assigned_to_id')
                   OR column_name LIKE '%_user_id' OR column_name LIKE '%user_id%')
              AND data_type IN ('uuid', 'text', 'varchar', 'character varying')
        LOOP
            IF column_rec.data_type = 'uuid' THEN
                update_sql := format('UPDATE %I SET %I = $1 WHERE %I = $2', table_rec.table_name, column_rec.column_name, column_rec.column_name);
                EXECUTE update_sql USING auth_user_id::text, old_user_id;
            ELSE
                update_sql := format('UPDATE %I SET %I = $1::text WHERE %I = $2::text', table_rec.table_name, column_rec.column_name, column_rec.column_name);
                EXECUTE update_sql USING auth_user_id::text, old_user_id::text;
            END IF;
            GET DIAGNOSTICS affected_rows = ROW_COUNT;
            total_affected := total_affected + affected_rows;
        END LOOP;
    END LOOP;
    RETURN total_affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Uploads storage bucket (for unified SDK UploadFile)
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow select on uploads" ON storage.objects;
CREATE POLICY "Allow select on uploads"
ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "Allow upload on uploads" ON storage.objects;
CREATE POLICY "Allow upload on uploads"
ON storage.objects FOR INSERT TO authenticated, anon
WITH CHECK (bucket_id = 'uploads');

DROP POLICY IF EXISTS "Allow update on uploads" ON storage.objects;
CREATE POLICY "Allow update on uploads"
ON storage.objects FOR UPDATE TO authenticated, anon
USING (bucket_id = 'uploads');
