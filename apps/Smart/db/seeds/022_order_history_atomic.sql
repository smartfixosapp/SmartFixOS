CREATE OR REPLACE FUNCTION public.append_order_history(p_order_id text, p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_history jsonb;
BEGIN
  UPDATE public."order"
     SET status_history = COALESCE(status_history, '[]'::jsonb) || p_entries
   WHERE id::text = p_order_id
  RETURNING status_history INTO v_history;
  RETURN v_history;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_order_history_note(p_order_id text, p_note_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_history jsonb;
BEGIN
  UPDATE public."order"
     SET status_history = COALESCE(
           (SELECT jsonb_agg(e ORDER BY ord)
              FROM jsonb_array_elements(COALESCE(status_history, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
             WHERE (e ->> 'note_id') IS DISTINCT FROM p_note_id),
           '[]'::jsonb)
   WHERE id::text = p_order_id
  RETURNING status_history INTO v_history;
  RETURN v_history;
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_order_history(text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_order_history_note(text, text) TO anon, authenticated;
