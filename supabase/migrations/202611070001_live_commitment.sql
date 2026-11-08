-- Authenticated commitment has one transaction, one database clock, and no client write grants.
create schema if not exists provenalpha_private;
revoke all on schema provenalpha_private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id),
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,40}$'),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  bio text not null default '' check (length(bio) <= 500),
  created_at timestamptz not null default clock_timestamp()
);
create table public.instruments (
  id text primary key,
  definition jsonb not null check ((jsonb_typeof(definition) = 'object' and definition->>'id' = id) is true),
  live_enabled boolean not null default false,
  provider_binding jsonb,
  check ((not live_enabled or jsonb_typeof(provider_binding) = 'object') is true)
);
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  visibility text not null check (visibility in ('public','private')),
  initial_status text not null check (initial_status in ('awaiting_start','unscored')),
  created_at timestamptz not null,
  supersedes_claim_id uuid references public.claims(id),
  idempotency_key uuid not null,
  request_hash text not null,
  unique (author_id, idempotency_key)
);
create index claims_public_created_idx on public.claims(created_at desc, id) where visibility = 'public';
create index claims_author_created_idx on public.claims(author_id, created_at desc, id);
create table public.claim_versions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id),
  version integer not null check (version = 1),
  original_text text not null check (length(btrim(original_text)) between 1 and 8000),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  market_bindings jsonb not null check (jsonb_typeof(market_bindings) = 'object'),
  context jsonb not null check (context = '{"kind":"live"}'::jsonb),
  committed_at timestamptz not null,
  unique (claim_id, version)
);
create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  claim_version_id uuid not null references public.claim_versions(id),
  payload jsonb not null check ((jsonb_typeof(payload) = 'object' and payload->'source'->'isSynthetic' = 'false'::jsonb) is true),
  recorded_at timestamptz not null default clock_timestamp()
);
create index snapshots_claim_version_idx on public.price_snapshots(claim_version_id);
create table public.resolutions (
  id uuid primary key default gen_random_uuid(),
  claim_version_id uuid not null references public.claim_versions(id),
  payload jsonb not null check ((jsonb_typeof(payload) = 'object' and payload->'context' = '{"kind":"live"}'::jsonb and payload->>'claimVersionId' = claim_version_id::text) is true),
  recorded_at timestamptz not null default clock_timestamp()
);
create index resolutions_claim_version_idx on public.resolutions(claim_version_id);

alter table public.profiles enable row level security;
alter table public.instruments enable row level security;
alter table public.claims enable row level security;
alter table public.claim_versions enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.resolutions enable row level security;

create policy profile_read on public.profiles for select to anon, authenticated using (true);
create policy profile_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy instrument_read on public.instruments for select to anon, authenticated using (true);
create policy claim_read on public.claims for select to anon, authenticated using (visibility = 'public' or author_id = (select auth.uid()));
create policy version_read on public.claim_versions for select to anon, authenticated using (exists (select 1 from public.claims c where c.id = claim_id));
create policy snapshot_read on public.price_snapshots for select to anon, authenticated using (exists (select 1 from public.claim_versions v where v.id = claim_version_id));
create policy resolution_read on public.resolutions for select to anon, authenticated using (exists (select 1 from public.claim_versions v where v.id = claim_version_id));

revoke all on public.profiles, public.instruments, public.claims, public.claim_versions, public.price_snapshots, public.resolutions from public, anon, authenticated;
grant select on public.profiles, public.instruments, public.claim_versions, public.price_snapshots, public.resolutions to anon, authenticated;
grant select (id, author_id, visibility, initial_status, created_at, supersedes_claim_id) on public.claims to anon, authenticated;
grant update (handle, display_name, bio) on public.profiles to authenticated;

create function provenalpha_private.reject_record_change() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Committed records are append-only.' using errcode = '42501'; end;
$$;
create trigger claims_immutable before update or delete on public.claims for each row execute function provenalpha_private.reject_record_change();
create trigger versions_immutable before update or delete on public.claim_versions for each row execute function provenalpha_private.reject_record_change();
create trigger snapshots_immutable before update or delete on public.price_snapshots for each row execute function provenalpha_private.reject_record_change();
create trigger resolutions_immutable before update or delete on public.resolutions for each row execute function provenalpha_private.reject_record_change();

create function provenalpha_private.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, handle, display_name)
  values (new.id, 'u_' || replace(new.id::text, '-', ''),
    case when jsonb_typeof(new.raw_user_meta_data->'display_name') = 'string' and length(btrim(new.raw_user_meta_data->>'display_name')) between 1 and 80
      then btrim(new.raw_user_meta_data->>'display_name') else 'Investor' end);
  return new;
end;
$$;
create trigger create_provenalpha_profile after insert on auth.users for each row execute function provenalpha_private.create_profile();
-- Existing Auth users also receive a safe public profile with no email-derived name.
insert into public.profiles(id, handle, display_name)
select id, 'u_' || replace(id::text, '-', ''), 'Investor' from auth.users on conflict (id) do nothing;

create function provenalpha_private.require(condition boolean, message text) returns void language plpgsql set search_path = '' as $$
begin if condition is not true then raise exception '%', message using errcode = '22023'; end if; end;
$$;
create function provenalpha_private.keys_match(value jsonb, allowed text[], required text[]) returns boolean language plpgsql immutable set search_path = '' as $$
declare item text;
begin
  if jsonb_typeof(value) is distinct from 'object' then return false; end if;
  if not (value ?& required) then return false; end if;
  for item in select jsonb_object_keys(value) loop if not (item = any(allowed)) then return false; end if; end loop;
  return true;
end;
$$;
create function provenalpha_private.finite_number(value jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if jsonb_typeof(value) is distinct from 'number' then return false; end if;
  return abs(value::text::numeric) <= 1.7976931348623157e308;
end;
$$;

create function provenalpha_private.validate_terms(terms jsonb, logged_at timestamptz) returns jsonb language plpgsql set search_path = '' as $$
declare
  asset public.instruments%rowtype; benchmark public.instruments%rowtype;
  prediction jsonb; horizon jsonb; meaning jsonb; assumption jsonb;
  kind text; metric text; quote_kind text; change_metric text; horizon_value numeric;
  reference_date date; binding jsonb; seen_ids text[] := '{}';
begin
  perform provenalpha_private.require(provenalpha_private.keys_match(terms,
    array['schemaVersion','instrument','prediction','horizon','confidencePct','rationale','assumptions','returnConvention','measurement'],
    array['schemaVersion','instrument','prediction','horizon','confidencePct','rationale','assumptions','returnConvention','measurement']), 'Claim fields are incomplete or unsupported.');
  perform provenalpha_private.require(terms->'schemaVersion' = '1'::jsonb, 'Unsupported claim schema.');
  select * into asset from public.instruments where id = terms->'instrument'->>'id';
  perform provenalpha_private.require(found and (asset.live_enabled or terms->'prediction' = '{"kind":"hold","meaning":{"kind":"maintain_position"}}'::jsonb) and asset.definition = terms->'instrument', 'The asset needs an exact, enabled live source binding.');
  quote_kind := asset.definition->'quote'->>'kind';
  change_metric := case when quote_kind = 'yield' then 'yield_change_bps' else 'price_return_pct' end;
  reference_date := (logged_at at time zone (asset.definition->'observation'->>'timeZone'))::date;
  binding := jsonb_build_object('asset', asset.provider_binding);
  perform provenalpha_private.require(terms->'returnConvention' = '{"kind":"price_return","dividends":"excluded","splits":"adjusted"}'::jsonb, 'Dividend-inclusive scoring is not enabled.');
  perform provenalpha_private.require(terms->'measurement' = '{"start":"first_observation_after_commitment","end":"first_observation_on_or_after_target","sampling":"daily","calendarArithmetic":"calendar_units_clamp_month_end","missingData":"await_data_never_substitute"}'::jsonb, 'Measurement rules cannot be changed.');
  perform provenalpha_private.require(terms->'confidencePct' = 'null'::jsonb or (provenalpha_private.finite_number(terms->'confidencePct') and (terms->>'confidencePct')::numeric between 0 and 100), 'Confidence must be null or between 0 and 100.');
  perform provenalpha_private.require(jsonb_typeof(terms->'rationale') = 'string' and length(terms->>'rationale') <= 8000, 'Rationale must be a string of up to 8000 characters.');
  perform provenalpha_private.require(jsonb_typeof(terms->'assumptions') = 'array', 'Assumptions must be an array.');
  perform provenalpha_private.require(jsonb_array_length(terms->'assumptions') <= 20, 'Use up to 20 assumptions.');
  for assumption in select * from jsonb_array_elements(terms->'assumptions') loop
    perform provenalpha_private.require(provenalpha_private.keys_match(assumption, array['id','statement','falsificationCondition'], array['id','statement','falsificationCondition']), 'An assumption is incomplete.');
    perform provenalpha_private.require(jsonb_typeof(assumption->'id') = 'string' and length(assumption->>'id') between 1 and 100 and not (assumption->>'id' = any(seen_ids)), 'Assumption IDs must be unique, nonempty strings.');
    perform provenalpha_private.require(jsonb_typeof(assumption->'statement') = 'string' and length(assumption->>'statement') between 1 and 2000 and jsonb_typeof(assumption->'falsificationCondition') = 'string' and length(assumption->>'falsificationCondition') between 1 and 2000, 'Assumptions require a statement and falsification condition.');
    seen_ids := array_append(seen_ids, assumption->>'id');
  end loop;
  horizon := terms->'horizon';
  if horizon->>'kind' = 'duration' then
    perform provenalpha_private.require(provenalpha_private.keys_match(horizon,array['kind','value','unit'],array['kind','value','unit']) and provenalpha_private.finite_number(horizon->'value'), 'Invalid duration.');
    horizon_value := (horizon->>'value')::numeric;
    perform provenalpha_private.require(horizon_value >= 1 and horizon_value = trunc(horizon_value) and horizon_value <= 9007199254740991 and horizon->>'unit' in ('days','months','years'), 'Use a positive whole calendar duration.');
    perform provenalpha_private.require(horizon_value <= case horizon->>'unit'
      when 'days' then ('9999-12-31'::date - reference_date)::numeric
      when 'months' then ((9999-extract(year from reference_date))*12+12-extract(month from reference_date))::numeric
      else (9999-extract(year from reference_date))::numeric end, 'The horizon exceeds supported calendar dates.');
  elsif horizon->>'kind' = 'date' then
    perform provenalpha_private.require(provenalpha_private.keys_match(horizon,array['kind','targetDate'],array['kind','targetDate']) and jsonb_typeof(horizon->'targetDate') = 'string' and horizon->>'targetDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', 'Invalid review date.');
    perform provenalpha_private.require((horizon->>'targetDate')::date > reference_date and (horizon->>'targetDate')::date <= '9999-12-31'::date, 'The review date must follow database commitment time.');
  else perform provenalpha_private.require(false, 'Unsupported horizon.'); end if;
  prediction := terms->'prediction'; kind := prediction->>'kind'; metric := prediction->>'metric';
  if kind in ('outperform','underperform') then
    perform provenalpha_private.require(provenalpha_private.keys_match(prediction,array['kind','benchmark','metric'],array['kind','benchmark','metric']), 'Invalid comparison fields.');
    select * into benchmark from public.instruments where id = prediction->'benchmark'->>'id';
    perform provenalpha_private.require(found and benchmark.live_enabled and benchmark.definition = prediction->'benchmark' and benchmark.id <> asset.id, 'Choose a distinct benchmark with an exact live source binding.');
    perform provenalpha_private.require(benchmark.definition->'quote'->>'kind' = quote_kind and metric = case when quote_kind = 'yield' then 'yield_change_bps' else 'price_return' end, 'Comparison units must match.');
    if quote_kind = 'price' then perform provenalpha_private.require(asset.definition->'quote'->>'currency' = benchmark.definition->'quote'->>'currency', 'Cross-currency comparison requires an explicit FX method.'); end if;
    binding := binding || jsonb_build_object('benchmark', benchmark.provider_binding);
  elsif kind = 'hold' then
    perform provenalpha_private.require(provenalpha_private.keys_match(prediction,array['kind','meaning'],array['kind','meaning']), 'Invalid hold fields.');
    meaning := prediction->'meaning';
    if meaning->>'kind' = 'maintain_position' then
      perform provenalpha_private.require(meaning = '{"kind":"maintain_position"}'::jsonb, 'Position-only holds are unscored.');
    else
      perform provenalpha_private.require(provenalpha_private.keys_match(meaning,array['kind','tolerance','metric','evaluation'],array['kind','tolerance','metric','evaluation']) and meaning->>'kind' = 'neutral' and provenalpha_private.finite_number(meaning->'tolerance'), 'Neutral holds require measurable terms.');
      perform provenalpha_private.require((meaning->>'tolerance')::numeric > 0 and meaning->>'metric' = change_metric and meaning->>'evaluation' in ('at_review','every_daily_observation'), 'Invalid neutral hold tolerance or units.');
    end if;
  elsif kind = 'range' then
    perform provenalpha_private.require(provenalpha_private.keys_match(prediction,array['kind','lower','upper','metric','boundaries','evaluation'],array['kind','lower','upper','metric','boundaries','evaluation']) and provenalpha_private.finite_number(prediction->'lower') and provenalpha_private.finite_number(prediction->'upper'), 'Ranges require explicit finite bounds.');
    perform provenalpha_private.require((prediction->>'lower')::numeric < (prediction->>'upper')::numeric and prediction->>'boundaries' = 'inclusive' and prediction->>'evaluation' in ('at_review','every_daily_observation') and metric in ('quoted_value', change_metric), 'Invalid range bounds, timing, or units.');
    if quote_kind = 'price' and asset.definition->'quote'->'allowNonPositive' = 'false'::jsonb then
      if metric = 'quoted_value' then perform provenalpha_private.require((prediction->>'lower')::numeric > 0, 'This quote range must be positive.'); end if;
      if metric = 'price_return_pct' then perform provenalpha_private.require((prediction->>'lower')::numeric >= -100, 'A positive price cannot return less than -100%.'); end if;
    end if;
  else perform provenalpha_private.require(false, 'Unsupported prediction.'); end if;
  return binding;
end;
$$;

create function public.commit_claim(p_idempotency_key uuid, p_original_text text, p_terms jsonb, p_visibility text, p_supersedes_claim_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); logged_at timestamptz; binding jsonb; fingerprint text;
  existing public.claims%rowtype; new_id uuid;
begin
  if actor is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  perform provenalpha_private.require(p_idempotency_key is not null and p_original_text is not null and length(btrim(p_original_text)) between 1 and 8000 and p_visibility in ('public','private'), 'Invalid commitment request.');
  fingerprint := encode(sha256(convert_to(jsonb_build_object('text',btrim(p_original_text),'terms',p_terms,'visibility',p_visibility,'supersedes',p_supersedes_claim_id)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':' || p_idempotency_key::text, 0));
  select * into existing from public.claims where author_id = actor and idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash is distinct from fingerprint then raise exception 'Idempotency key was used for different terms.' using errcode = '23505'; end if;
    return existing.id;
  end if;
  if p_supersedes_claim_id is not null and not exists (select 1 from public.claims where id = p_supersedes_claim_id and author_id = actor) then raise exception 'Only your own claim can be linked.' using errcode = '42501'; end if;
  if p_supersedes_claim_id is not null and p_visibility = 'public' and exists (select 1 from public.claims where id = p_supersedes_claim_id and visibility = 'private') then raise exception 'A public update cannot reveal a private predecessor.' using errcode = '42501'; end if;
  logged_at := clock_timestamp();
  binding := provenalpha_private.validate_terms(p_terms, logged_at);
  insert into public.claims(author_id,visibility,initial_status,created_at,supersedes_claim_id,idempotency_key,request_hash)
  values (actor,p_visibility,case when p_terms->'prediction'->'meaning'->>'kind' = 'maintain_position' then 'unscored' else 'awaiting_start' end,logged_at,p_supersedes_claim_id,p_idempotency_key,fingerprint) returning id into new_id;
  insert into public.claim_versions(claim_id,version,original_text,terms,market_bindings,context,committed_at)
  values (new_id,1,btrim(p_original_text),p_terms,binding,'{"kind":"live"}',logged_at);
  return new_id;
end;
$$;
revoke all on function public.commit_claim(uuid,text,jsonb,text,uuid) from public, anon;
grant execute on function public.commit_claim(uuid,text,jsonb,text,uuid) to authenticated;
revoke all on all functions in schema provenalpha_private from public, anon, authenticated;
