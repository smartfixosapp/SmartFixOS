CREATE TABLE IF NOT EXISTS public.receipt_link (
  token text PRIMARY KEY,
  order_id text NOT NULL,
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS receipt_link_order_idx ON public.receipt_link (order_id);

ALTER TABLE public.receipt_link ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.receipt_link FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_receipt_link(p_order_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant text;
  v_mine text;
  v_token text;
BEGIN
  SELECT tenant_id INTO v_tenant
    FROM public."order"
   WHERE id = p_order_id AND COALESCE(is_deleted, false) = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  v_mine := public.get_my_tenant_id();
  IF v_mine IS NOT NULL AND v_tenant IS NOT NULL AND v_mine <> v_tenant THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT token INTO v_token
    FROM public.receipt_link
   WHERE order_id = p_order_id
     AND revoked_at IS NULL
     AND expires_at > now() + interval '14 days'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_token IS NULL THEN
    v_token := substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
    INSERT INTO public.receipt_link (token, order_id, tenant_id)
    VALUES (v_token, p_order_id, v_tenant);
  END IF;

  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_receipt_links(p_order_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant text;
  v_mine text;
  v_count integer;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public."order" WHERE id = p_order_id;
  v_mine := public.get_my_tenant_id();
  IF v_mine IS NOT NULL AND v_tenant IS NOT NULL AND v_mine <> v_tenant THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.receipt_link
     SET revoked_at = now()
   WHERE order_id = p_order_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_receipt(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.receipt_link;
  v_order public."order";
  v_tenant public.tenant;
  v_o jsonb;
  v_t jsonb;
  v_sig text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 12 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_link
    FROM public.receipt_link
   WHERE token = p_token AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_order
    FROM public."order"
   WHERE id = v_link.order_id AND COALESCE(is_deleted, false) = false;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_object_agg(e.k, e.v), '{}'::jsonb) INTO v_o
    FROM jsonb_each(to_jsonb(v_order)) AS e(k, v)
   WHERE e.k = ANY (ARRAY[
     'order_number', 'created_date', 'customer_name', 'customer_phone', 'customer_email',
     'device_type', 'device_brand', 'device_model', 'device_serial', 'initial_problem',
     'cost_estimate', 'labor_cost', 'amount_paid', 'balance_due', 'paid', 'warranty_days', 'currency'
   ]);

  v_sig := COALESCE(v_order.device_security ->> 'signatureUrl', v_order.device_security ->> 'signature_url');

  v_o := v_o || jsonb_build_object(
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'name', i -> 'name', 'quantity', i -> 'quantity',
               'price', i -> 'price', 'total', i -> 'total', 'type', i -> 'type'))
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(v_order.order_items) = 'array' THEN v_order.order_items ELSE '[]'::jsonb END
             ) AS i
    ), '[]'::jsonb),
    'device_photos', CASE
      WHEN jsonb_typeof(v_order.device_photos) = 'array' AND jsonb_array_length(v_order.device_photos) > 0 THEN
        jsonb_build_array(
          CASE WHEN jsonb_typeof(v_order.device_photos -> 0) = 'string'
               THEN v_order.device_photos -> 0
               ELSE jsonb_build_object('url', v_order.device_photos -> 0 ->> 'url') END)
      ELSE '[]'::jsonb END,
    'device_security', CASE WHEN v_sig IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('signatureUrl', v_sig) END,
    'status_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status', h ->> 'status', 'timestamp', h ->> 'timestamp'))
        FROM jsonb_array_elements(
               CASE WHEN jsonb_typeof(v_order.status_history) = 'array' THEN v_order.status_history ELSE '[]'::jsonb END
             ) AS h
       WHERE h ->> 'status' = 'delivered'
    ), '[]'::jsonb)
  );

  SELECT * INTO v_tenant FROM public.tenant WHERE id::text = v_order.tenant_id;
  IF FOUND THEN
    v_t := jsonb_build_object(
      'name', v_tenant.name,
      'address', v_tenant.address,
      'admin_phone', v_tenant.admin_phone,
      'email', v_tenant.email,
      'currency', v_tenant.currency,
      'logo_url', v_tenant.logo_url,
      'settings', jsonb_build_object('merchant_registration', to_jsonb(v_tenant) -> 'settings' ->> 'merchant_registration')
    );
  ELSE
    v_t := '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('order', v_o, 'tenant', v_t, 'expires_at', v_link.expires_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_receipt_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_receipt_links(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(text) TO anon, authenticated;
