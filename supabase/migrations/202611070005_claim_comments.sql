-- Part 9: discussion stays attached to a claim and cannot change its terms or score.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id),
  author_id uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create index comments_claim_created_idx on public.comments(claim_id, created_at asc, id asc);
alter table public.comments enable row level security;
create policy comments_read on public.comments for select to anon, authenticated
  using (exists (
    select 1 from public.claims c
    where c.id = claim_id and (c.visibility = 'public' or c.author_id = (select auth.uid()))
  ));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid()) and exists (
      select 1 from public.claims c
      where c.id = claim_id and (c.visibility = 'public' or c.author_id = (select auth.uid()))
    )
  );
revoke all on public.comments from public, anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (claim_id, author_id, body) on public.comments to authenticated;
create trigger comments_immutable before update or delete on public.comments
  for each row execute function provenalpha_private.reject_record_change();
