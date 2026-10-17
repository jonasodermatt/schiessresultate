-- Read-only. Run as administrator in the Supabase SQL Editor.
-- Export the single JSON result; it contains definitions, not application rows.
-- Review function definitions for hard-coded secrets before sharing the export.
with relations as (
  select c.oid, n.nspname as schema_name, c.relname as name, c.relkind,
         c.relrowsecurity, c.relforcerowsecurity, c.reloptions, c.relacl
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
)
select jsonb_pretty(jsonb_build_object(
  'server_version', current_setting('server_version'),
  'relations', (select jsonb_agg(jsonb_build_object(
    'schema', r.schema_name, 'name', r.name, 'kind', r.relkind,
    'rls', r.relrowsecurity, 'force_rls', r.relforcerowsecurity,
    'options', r.reloptions, 'acl', r.relacl,
    'columns', (select jsonb_agg(jsonb_build_object(
      'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid)
    ) order by a.attnum) from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped),
    'constraints', (select jsonb_agg(jsonb_build_object(
      'name', conname, 'definition', pg_get_constraintdef(oid), 'validated', convalidated
    )) from pg_constraint where conrelid = r.oid),
    'view_definition', case when r.relkind in ('v', 'm') then pg_get_viewdef(r.oid, true) end,
    'triggers', (select jsonb_agg(pg_get_triggerdef(oid)) from pg_trigger
                where tgrelid = r.oid and not tgisinternal)
  ) order by r.name) from relations r),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname = 'public'),
  'functions', (select jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'security_definer', p.prosecdef,
    'acl', p.proacl, 'definition', pg_get_functiondef(p.oid)
  )) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')),
  'table_grants', (select jsonb_agg(to_jsonb(g)) from information_schema.table_privileges g
                   where table_schema = 'public'),
  'column_grants', (select jsonb_agg(to_jsonb(g)) from information_schema.column_privileges g
                    where table_schema = 'public'),
  'default_privileges', (select jsonb_agg(to_jsonb(d)) from pg_default_acl d)
)) as security_inventory;
