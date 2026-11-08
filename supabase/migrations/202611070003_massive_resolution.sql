-- Part 7: bind liquid U.S. stocks and ETFs to Massive daily bars.
-- Existing claim versions remain immutable; this affects future commitments only.
update public.instruments
set provider_binding = jsonb_build_object(
  'provider', 'massive',
  'seriesId', definition->>'symbol',
  'fixing', 'regular_session_close',
  'version', 1
)
where live_enabled = true and (definition->>'assetClass') in ('stock', 'etf');

-- Resolution persistence is server-only. The function is deliberately restricted to
-- the trusted service role and writes append-only price snapshots plus one resolution.
create or replace function public.persist_live_resolution(
  p_claim_version_id uuid,
  p_resolution jsonb,
  p_snapshots jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  item jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'trusted service role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.claim_versions where id = p_claim_version_id) then
    raise exception 'claim version not found' using errcode = '22023';
  end if;
  select id into existing_id from public.resolutions where claim_version_id = p_claim_version_id limit 1;
  if existing_id is not null then return existing_id; end if;
  for item in select value from jsonb_array_elements(p_snapshots) loop
    insert into public.price_snapshots(claim_version_id, payload)
    values (p_claim_version_id, item);
  end loop;
  insert into public.resolutions(id, claim_version_id, outcome, payload)
  values (p_claim_version_id, p_claim_version_id, p_resolution->>'outcome', p_resolution);
  return p_claim_version_id;
end;
$$;
revoke all on function public.persist_live_resolution(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.persist_live_resolution(uuid, jsonb, jsonb) to service_role;
