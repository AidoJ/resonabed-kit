REVOKE EXECUTE ON FUNCTION public.client_item_cleared(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.client_item_cleared(uuid, text) TO authenticated, service_role;