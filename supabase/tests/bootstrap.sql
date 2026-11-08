-- Only used in a disposable native PostgreSQL cluster, never applied to Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user);
$$;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema test_support;
grant usage on schema test_support to anon, authenticated;
create function test_support.assert(condition boolean, label text) returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
create function test_support.expect_error(statement text, expected_state text, label text) returns void language plpgsql as $$
declare actual_state text;
begin
  begin execute statement;
  exception when others then actual_state := sqlstate; end;
  perform test_support.assert(actual_state = expected_state, label || ' [expected ' || expected_state || ', got ' || coalesce(actual_state,'no error') || ']');
end;
$$;
