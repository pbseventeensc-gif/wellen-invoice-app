-- Run against a disposable PostgreSQL database with auth.uid() and migrations installed.
-- All fixtures and assertions are rolled back.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-000000000001','admin@test.local'),
 ('00000000-0000-0000-0000-000000000002','ar@test.local'),
 ('00000000-0000-0000-0000-000000000003','other@test.local'),
 ('00000000-0000-0000-0000-000000000004','unassigned@test.local');
insert into public.profiles(id,role,full_name) values
 ('00000000-0000-0000-0000-000000000001','super admin','Admin'),
 ('00000000-0000-0000-0000-000000000002','ar creator','AR'),
 ('00000000-0000-0000-0000-000000000003','ar creator','Other AR');
insert into public.invoice_staging(source_key,owner_id,status,payload,claimed_by_id) values
 ('test-draft','00000000-0000-0000-0000-000000000001','draft','{}','00000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
do $$ begin
  begin
    perform public.submit_invoice_workflow('{"invoice_number":"TEST","items":[{"id":"test-draft"}]}');
    raise exception 'FAIL: account without profile submitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.clear_waiting_invoice_workflows();
    raise exception 'FAIL: account without profile cleared queue';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin
  begin
    perform public.submit_invoice_workflow('{"invoice_number":"TEST","items":[{"id":"test-draft"}]}');
    raise exception 'FAIL: another AR consumed claimed draft';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.submit_invoice_workflow('{"invoice_number":"TEST","items":[{"id":"test-draft"}]}');
do $$ begin
  if (select count(*) from public.invoice_workflows) <> 1 then raise exception 'FAIL: owner cannot read'; end if;
  begin
    perform public.submit_invoice_workflow('{"invoice_number":"TEST-DOUBLE","items":[{"id":"test-draft"}]}');
    raise exception 'FAIL: consumed draft invoiced twice';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin
  if exists(select 1 from public.invoice_workflows) then raise exception 'FAIL: AR sees another owner'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.reject_invoice_workflow(id,'Fix details') from public.invoice_workflows where invoice_number='TEST';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select public.submit_invoice_workflow('{"invoice_number":"TEST","items":[{"id":"test-draft"}],"revision":2}');
do $$ begin
  if (select count(*) from public.invoice_workflows) <> 1 then raise exception 'FAIL: revision duplicated invoice'; end if;
  if not exists(select 1 from public.invoice_workflows where status='waiting_approval' and jsonb_array_length(revision_history)=1 and revision_history->0->>'reason'='Fix details') then raise exception 'FAIL: revision history missing'; end if;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.invoice_staging where source_key='test-draft' and status='invoiced') then raise exception 'FAIL: revision did not consume draft'; end if;
end $$;
rollback;
