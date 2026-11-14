begin;

alter table public.clients add column if not exists phone_number text not null default ''
  check (length(phone_number) <= 50);

-- Keep the existing save_client signature used by imports. Contact editing saves
-- name, address, and phone together, with the same role checks as save_client.
create or replace function public.save_client_contact(
  p_name text, p_address text, p_phone_number text, p_id uuid default null
)
returns public.clients language plpgsql security definer set search_path = public, pg_temp
as $$
declare saved public.clients%rowtype;
begin
  if public.invoice_workflow_actor_role() is null or public.invoice_workflow_actor_role() not in (
    'super admin','superadmin','administrator','admin','approval','approval manager','approver'
  ) then raise exception 'Not authorized to edit clients' using errcode='42501'; end if;
  if length(coalesce(p_phone_number,'')) > 50 then
    raise exception 'Phone number must be at most 50 characters' using errcode='22023';
  end if;
  saved := public.save_client(p_name, p_address, p_id);
  update public.clients set phone_number=btrim(coalesce(p_phone_number,'')), updated_at=now()
    where id=saved.id returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_client_contact(text,text,text,uuid) from public, anon;
grant execute on function public.save_client_contact(text,text,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
