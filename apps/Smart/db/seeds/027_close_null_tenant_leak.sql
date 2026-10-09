create or replace function public.auth_can_access_tenant(target_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    auth_is_super_admin()
    or exists (
      select 1 from auth_user_tenants() as u
      where u.tenant_id = target_tenant_id
    )
    or (target_tenant_id is null and auth.role() = 'authenticated')
$function$;
