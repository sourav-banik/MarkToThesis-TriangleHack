begin;
create function test_support.base_terms() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'schemaVersion', 1,
    'instrument', (select definition from public.instruments where id = 'us:nasdaq:aapl'),
    'prediction', jsonb_build_object('kind','outperform','metric','price_return','benchmark',(select definition from public.instruments where id = 'us:nyse arca:spy')),
    'horizon', '{"kind":"duration","value":30,"unit":"days"}'::jsonb,
    'confidencePct', null, 'rationale', 'Test-only rationale.', 'assumptions', '[]'::jsonb,
    'returnConvention', '{"kind":"price_return","dividends":"excluded","splits":"adjusted"}'::jsonb,
    'measurement', '{"start":"first_observation_after_commitment","end":"first_observation_on_or_after_target","sampling":"daily","calendarArithmetic":"calendar_units_clamp_month_end","missingData":"await_data_never_substitute"}'::jsonb
  );
$$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('11111111-1111-4111-8111-111111111111','owner@example.test','{"display_name":"Owner"}'),
 ('22222222-2222-4222-8222-222222222222','reader@example.test','{}');
select test_support.assert((select count(*) = 2 from public.profiles), 'Auth inserts create profiles');
select test_support.assert((select display_name = 'Investor' from public.profiles where id = '22222222-2222-4222-8222-222222222222'), 'Default public name does not disclose email');

set local role anon;
select test_support.assert((select count(*) = 2 from public.profiles), 'Public profiles expose no auth user table');
select test_support.expect_error('select * from auth.users','42501','Anon cannot read auth users');
select test_support.expect_error($q$select public.commit_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Anon',test_support.base_terms(),'public')$q$,'42501','Anon cannot execute commitment');
select test_support.expect_error($q$insert into public.profiles(id,handle,display_name) values ('33333333-3333-4333-8333-333333333333','spoof','Spoof')$q$,'42501','Anon cannot create profiles');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.commit_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Original private call',test_support.base_terms(),'private') as private_id \gset
select public.commit_claim('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Original public call',test_support.base_terms(),'public') as public_id \gset
select test_support.assert((select count(*) = 2 from public.claims), 'Owner sees public and private claims');
select test_support.assert((select count(*) = 2 from public.claim_versions), 'Owner sees both immutable versions');
select test_support.assert(public.commit_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Original private call',test_support.base_terms(),'private') = :'private_id'::uuid, 'Identical retry returns original claim ID');
select test_support.assert((select count(*) = 2 from public.claims), 'Retry creates no duplicate claim');
select test_support.expect_error($q$select public.commit_claim('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Changed text',test_support.base_terms(),'private')$q$,'23505','Changed request cannot reuse idempotency key');
select test_support.assert((select c.created_at = v.committed_at and c.created_at >= transaction_timestamp() and c.created_at <= clock_timestamp() from public.claims c join public.claim_versions v on v.claim_id=c.id where c.id=:'private_id'), 'Claim and version share a database-issued timestamp');
select test_support.assert((select context = '{"kind":"live"}'::jsonb from public.claim_versions where claim_id=:'private_id'), 'Replay context cannot enter live versions');
select test_support.assert((select market_bindings->'asset'->>'provider' = 'massive' from public.claim_versions where claim_id=:'private_id'), 'Exact provider binding is saved with the version');
select test_support.expect_error('select idempotency_key from public.claims','42501','Idempotency metadata is not exposed');
select test_support.expect_error(format('update public.claims set visibility=''private'' where id=%L',:'public_id'),'42501','Public claims cannot be hidden');
select test_support.expect_error(format('delete from public.claims where id=%L',:'public_id'),'42501','Owners cannot delete misses');
select test_support.expect_error(format('update public.claim_versions set original_text=''rewritten'' where claim_id=%L',:'public_id'),'42501','Owners cannot rewrite original text');
select test_support.expect_error(format('select public.commit_claim(''66666666-6666-4666-8666-666666666666'',''public link to private'',test_support.base_terms(),''public'',%L)',:'private_id'),'42501','Public updates cannot expose private predecessor IDs');
select test_support.expect_error($q$insert into public.claim_versions(claim_id,version,original_text,terms,market_bindings,context,committed_at) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'fake','{}','{}','{"kind":"live"}',now())$q$,'42501','No direct version insert or client timestamp');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bad confidence',jsonb_set(test_support.base_terms(),'{confidencePct}','101'),'public')$q$,'22023','Direct RPC rejects invalid confidence');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bad units',jsonb_set(test_support.base_terms(),'{prediction,metric}','"yield_change_bps"'),'public')$q$,'22023','Direct RPC rejects incompatible comparison units');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','fake owner',test_support.base_terms() || '{"authorId":"fake"}','public')$q$,'22023','Terms cannot smuggle author fields');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','backdated',jsonb_set(test_support.base_terms(),'{horizon}','{"kind":"date","targetDate":"2020-01-01"}'),'public')$q$,'22023','Direct RPC rejects review dates before database time');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','bad horizon',jsonb_set(test_support.base_terms(),'{horizon,value}','1.5'),'public')$q$,'22023','Direct RPC rejects fractional durations');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','dividends',jsonb_set(test_support.base_terms(),'{returnConvention}','{"kind":"total_return","dividends":"reinvested","splits":"adjusted","methodologyId":"fake"}'),'public')$q$,'22023','Reserved total-return method cannot be enabled by RPC');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','spoof instrument',jsonb_set(test_support.base_terms(),'{instrument,name}','"Different asset"'),'public')$q$,'22023','Canonical identity cannot be changed while reusing a symbol');
select test_support.expect_error($q$select public.commit_claim('cccccccc-cccc-4ccc-8ccc-cccccccccccc','unsupported source',jsonb_set(test_support.base_terms(),'{instrument}',(select definition from public.instruments where id='crypto:btc:usd')),'public')$q$,'22023','Unbound reference sources cannot be silently published');
select test_support.assert((select count(*) = 2 from public.claims), 'Invalid requests leave no partial claims');
update public.profiles set display_name='Updated Owner', bio='Public bio' where id='11111111-1111-4111-8111-111111111111';
select test_support.assert((select display_name='Updated Owner' from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'Owner can edit public profile fields');
select test_support.expect_error($q$update public.profiles set id='33333333-3333-4333-8333-333333333333' where id='11111111-1111-4111-8111-111111111111'$q$,'42501','Profile ownership cannot be rewritten');
select public.commit_claim('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Changed terms are a new call',jsonb_set(test_support.base_terms(),'{horizon,value}','90'),'public',:'public_id') as amended_id \gset
select test_support.assert(:'amended_id' <> :'public_id', 'Changed terms create a separate claim');
select test_support.assert((select original_text='Original public call' from public.claim_versions where claim_id=:'public_id'), 'Amendment preserves original text');
select test_support.assert((select supersedes_claim_id=:'public_id' from public.claims where id=:'amended_id'), 'Amendment links original provenance');
select public.commit_claim('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Position only',jsonb_set(test_support.base_terms(),'{prediction}','{"kind":"hold","meaning":{"kind":"maintain_position"}}'),'private') as hold_id \gset
select test_support.assert((select initial_status='unscored' from public.claims where id=:'hold_id'), 'Position statements remain unscored');

reset role;
insert into public.price_snapshots(claim_version_id,payload) select id,'{"source":{"isSynthetic":false}}' from public.claim_versions where claim_id in (:'private_id',:'public_id');
insert into public.resolutions(claim_version_id,payload) select id,jsonb_build_object('context','{"kind":"live"}'::jsonb,'claimVersionId',id::text,'outcome','met') from public.claim_versions where claim_id in (:'private_id',:'public_id');
select test_support.expect_error(format('update public.claim_versions set original_text=''admin overwrite'' where claim_id=%L',:'public_id'),'42501','Append-only trigger also rejects privileged overwrites');
select test_support.expect_error('delete from public.resolutions','42501','Resolution records are append-only');

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.assert((select count(*) = 2 from public.claims), 'Other user sees only the two public claims');
select test_support.assert((select count(*) = 2 from public.claim_versions), 'Private child versions do not leak');
select test_support.assert((select count(*) = 1 from public.price_snapshots), 'Private snapshots inherit claim privacy');
select test_support.assert((select count(*) = 1 from public.resolutions), 'Private resolutions inherit claim privacy');
update public.profiles set display_name='Hijacked' where id='11111111-1111-4111-8111-111111111111';
select test_support.assert((select display_name='Updated Owner' from public.profiles where id='11111111-1111-4111-8111-111111111111'), 'Other user cannot edit owner profile');
select test_support.expect_error(format('select public.commit_claim(''ffffffff-ffff-4fff-8fff-ffffffffffff'',''false link'',test_support.base_terms(),''public'',%L)',:'private_id'),'42501','Other user cannot link someone else private claim');
select test_support.expect_error('insert into public.resolutions(claim_version_id,payload) select id,''{}'' from public.claim_versions limit 1','42501','Other user cannot invent resolution scores');
select test_support.expect_error('insert into public.price_snapshots(claim_version_id,payload) select id,''{}'' from public.claim_versions limit 1','42501','Other user cannot invent market data');
select set_config('request.jwt.claim.sub','',true);
select test_support.expect_error($q$select public.commit_claim('ffffffff-ffff-4fff-8fff-ffffffffffff','missing uid',test_support.base_terms(),'public')$q$,'42501','Authenticated role still requires a verified subject');
reset role;
set local role anon;
select test_support.assert((select count(*) = 2 from public.claims), 'Anon reads public claims only');
select test_support.assert((select count(*) = 2 from public.claim_versions), 'Anon reads only public versions');
select test_support.assert((select count(*) = 1 from public.price_snapshots), 'Anon cannot read private snapshots');
select test_support.assert((select count(*) = 1 from public.resolutions), 'Anon cannot read private resolutions');
reset role;

create function test_support.fail_version() returns trigger language plpgsql as $$
begin if new.original_text='force version insert failure' then raise exception 'Test failure' using errcode='23514'; end if; return new; end;
$$;
create trigger test_atomic_failure before insert on public.claim_versions for each row execute function test_support.fail_version();
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select test_support.expect_error($q$select public.commit_claim('99999999-9999-4999-8999-999999999999','force version insert failure',test_support.base_terms(),'public')$q$,'23514','A failed version insert aborts the whole commitment');
select test_support.assert((select count(*) = 4 from public.claims), 'Atomic rollback leaves no orphan claim');
reset role;
-- Preserve only this helper for the separate concurrent-connection test.
set local role authenticated;
select public.commit_claim('77777777-7777-4777-8777-777777777777','Bitcoin position stance',jsonb_set(jsonb_set(test_support.base_terms(),'{instrument}',(select definition from public.instruments where id='crypto:btc:usd')),'{prediction}','{"kind":"hold","meaning":{"kind":"maintain_position"}}'),'private') as bitcoin_hold_id \gset
select test_support.assert((select initial_status='unscored' from public.claims where id=:'bitcoin_hold_id'), 'Unscored crypto stance does not require a pricing provider');
reset role;
-- Resolution writer and blockchain receipts are tested through their real RPCs.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
insert into public.comments(claim_id,author_id,body) values(:'private_id','11111111-1111-4111-8111-111111111111','Private discussion');
insert into public.comments(claim_id,author_id,body) values(:'public_id','11111111-1111-4111-8111-111111111111','Public evidence');
select test_support.assert((select count(*)=2 from public.comments), 'Owner can read public and private discussion');
select test_support.expect_error('update public.comments set body=''rewritten''','42501','Comments cannot rewrite their original content');
select test_support.expect_error('delete from public.comments','42501','Comments cannot be deleted by clients');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
select test_support.assert((select count(*)=1 from public.comments), 'Private discussion is hidden from other users');
insert into public.comments(claim_id,author_id,body) values(:'public_id','22222222-2222-4222-8222-222222222222','Reader reply');
select test_support.assert((select count(*)=2 from public.comments), 'Signed-in readers can join public discussion');
select test_support.expect_error(format('insert into public.comments(claim_id,author_id,body) values(%L,''22222222-2222-4222-8222-222222222222'',''intrusion'')',:'private_id'),'42501','Readers cannot post to private discussions');
select test_support.expect_error(format('insert into public.comments(claim_id,author_id,body) values(%L,''11111111-1111-4111-8111-111111111111'',''spoof'')',:'public_id'),'42501','Comment authorship cannot be spoofed');
reset role;
select id as anchor_version from public.claim_versions where claim_id=:'amended_id' \gset
select set_config('request.jwt.claim.role','service_role',true);
select public.persist_live_resolution(:'anchor_version', jsonb_build_object('id',:'anchor_version','context','{"kind":"live"}'::jsonb,'claimVersionId',:'anchor_version','outcome','met'), '[]'::jsonb);
select test_support.assert((select count(*)=1 from public.resolutions where claim_version_id=:'anchor_version'), 'Trusted resolution RPC writes the existing schema');
select public.persist_live_resolution(:'anchor_version', jsonb_build_object('context','{"kind":"live"}'::jsonb,'claimVersionId',:'anchor_version','outcome','not_met'), '[]'::jsonb);
select test_support.assert((select payload->>'outcome'='met' from public.resolutions where claim_version_id=:'anchor_version'), 'Repeated resolution preserves the original outcome');
select public.persist_claim_anchor(:'anchor_version','commitment',repeat('a',64),'0x'||repeat('b',64),123,'0x'||repeat('c',64),clock_timestamp());
select test_support.assert((select count(*)=1 from public.claim_anchors), 'Trusted writer stores blockchain receipt');
select test_support.expect_error('delete from public.claim_anchors','42501','Blockchain receipts are append-only');
select set_config('request.jwt.claim.role','',true);
set local role anon;
select test_support.assert((select count(*)=1 from public.claim_anchors), 'Public blockchain receipts are readable');
select test_support.expect_error(format('select public.persist_claim_anchor(%L,''commitment'',repeat(''a'',64),''0x''||repeat(''b'',64),123,''0x''||repeat(''c'',64),clock_timestamp())',:'anchor_version'),'42501','Anonymous callers cannot forge blockchain receipts');
select test_support.expect_error('insert into public.comments(claim_id,author_id,body) values (gen_random_uuid(),gen_random_uuid(),''fake'')','42501','Anonymous callers cannot post discussion');
reset role;
commit;
