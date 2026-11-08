-- MVP hardening and Base Sepolia receipts. Existing commitments remain unchanged.
update public.instruments set live_enabled = false
where definition->>'assetClass' not in ('stock', 'etf');

create or replace function public.persist_live_resolution(p_claim_version_id uuid, p_resolution jsonb, p_snapshots jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing_id uuid; item jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'trusted service role required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_claim_version_id::text, 0));
  if not exists(select 1 from public.claim_versions where id = p_claim_version_id) then raise exception 'missing version' using errcode = '22023'; end if;
  if p_resolution->>'outcome' not in ('met','not_met','unclear','unscored') then raise exception 'invalid outcome' using errcode = '22023'; end if;
  select id into existing_id from public.resolutions where claim_version_id = p_claim_version_id limit 1;
  if existing_id is not null then return existing_id; end if;
  for item in select value from jsonb_array_elements(p_snapshots) loop
    insert into public.price_snapshots(claim_version_id,payload) values(p_claim_version_id,item);
  end loop;
  insert into public.resolutions(id,claim_version_id,payload) values(p_claim_version_id,p_claim_version_id,p_resolution);
  return p_claim_version_id;
end; $$;
revoke all on function public.persist_live_resolution(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_live_resolution(uuid,jsonb,jsonb) to service_role;

create table public.claim_anchors (
  id uuid primary key default gen_random_uuid(),
  claim_version_id uuid not null references public.claim_versions(id),
  record_kind text not null check(record_kind in ('commitment','resolution')),
  digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  chain_id integer not null default 84532 check(chain_id = 84532),
  transaction_hash text not null unique check(transaction_hash ~ '^0x[0-9a-f]{64}$'),
  block_number bigint not null check(block_number >= 0),
  block_hash text not null,
  anchored_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  unique(claim_version_id, record_kind, digest)
);
alter table public.claim_anchors enable row level security;
create policy anchor_read on public.claim_anchors for select to anon,authenticated using (
  exists(select 1 from public.claim_versions v join public.claims c on c.id=v.claim_id where v.id=claim_version_id and c.visibility='public')
);
revoke all on public.claim_anchors from public,anon,authenticated;
grant select on public.claim_anchors to anon,authenticated;
create trigger anchors_immutable before update or delete on public.claim_anchors for each row execute function provenalpha_private.reject_record_change();
create function public.persist_claim_anchor(p_version_id uuid,p_kind text,p_digest text,p_tx_hash text,p_block_number bigint,p_block_hash text,p_anchored_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'trusted service role required' using errcode='42501'; end if;
  if not exists(select 1 from public.claim_versions v join public.claims c on c.id=v.claim_id where v.id=p_version_id and c.visibility='public') then raise exception 'public version required' using errcode='22023'; end if;
  insert into public.claim_anchors(claim_version_id,record_kind,digest,transaction_hash,block_number,block_hash,anchored_at)
  values(p_version_id,p_kind,p_digest,p_tx_hash,p_block_number,p_block_hash,p_anchored_at)
  on conflict(claim_version_id,record_kind,digest) do nothing;
end; $$;
revoke all on function public.persist_claim_anchor(uuid,text,text,text,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.persist_claim_anchor(uuid,text,text,text,bigint,text,timestamptz) to service_role;
