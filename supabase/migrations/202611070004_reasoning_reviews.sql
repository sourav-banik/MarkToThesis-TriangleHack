-- Part 8: append-only, evidence-grounded reasoning reviews.
create table public.reasoning_reviews (
  id uuid primary key,
  claim_version_id uuid not null references public.claim_versions(id),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and payload->>'id' = id::text
    and payload->>'claimVersionId' = claim_version_id::text
  ),
  recorded_at timestamptz not null default clock_timestamp()
);
create index reasoning_reviews_claim_version_idx on public.reasoning_reviews(claim_version_id, recorded_at desc);
alter table public.reasoning_reviews enable row level security;
create policy reasoning_review_read on public.reasoning_reviews for select to anon, authenticated
  using (exists (select 1 from public.claim_versions v where v.id = claim_version_id));
revoke all on public.reasoning_reviews from public, anon, authenticated;
grant select on public.reasoning_reviews to anon, authenticated;
create trigger reasoning_reviews_immutable before update or delete on public.reasoning_reviews
  for each row execute function provenalpha_private.reject_record_change();

create or replace function public.persist_reasoning_review(
  p_claim_version_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare review_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'trusted service role required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.claim_versions where id = p_claim_version_id) then
    raise exception 'claim version not found' using errcode = '22023';
  end if;
  review_id := (p_payload->>'id')::uuid;
  insert into public.reasoning_reviews(id, claim_version_id, payload)
  values (review_id, p_claim_version_id, p_payload)
  on conflict (id) do nothing;
  return review_id;
end;
$$;
revoke all on function public.persist_reasoning_review(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.persist_reasoning_review(uuid, jsonb) to service_role;
