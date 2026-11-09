-- CISPOLstore Business : synchronisation entre appareils (Supabase)
-- À coller dans « SQL Editor » de votre projet Supabase, puis « Run ».
-- Les données sont chiffrées dans l'application avant l'envoi : le serveur ne stocke qu'un bloc illisible.
-- Une seule table, fermée au public (aucun accès direct) : tout passe par trois fonctions protégées par un jeton.

create table if not exists public.business_sync (
  ws         text primary key,
  token      text not null,
  version    bigint not null default 1,
  blob       text not null,
  updated_at timestamptz not null default now()
);

alter table public.business_sync enable row level security;
revoke all on public.business_sync from anon, authenticated;

create or replace function public.biz_pull(p_ws text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.business_sync;
begin
  select * into r from public.business_sync where ws = p_ws;
  if not found then return json_build_object('exists', false); end if;
  if r.token <> p_token then raise exception 'forbidden'; end if;
  return json_build_object('exists', true, 'version', r.version, 'blob', r.blob, 'updated_at', r.updated_at);
end $$;

create or replace function public.biz_head(p_ws text, p_token text)
returns json language plpgsql security definer set search_path = public as $$
declare r public.business_sync;
begin
  select * into r from public.business_sync where ws = p_ws;
  if not found then return json_build_object('exists', false); end if;
  if r.token <> p_token then raise exception 'forbidden'; end if;
  return json_build_object('exists', true, 'version', r.version);
end $$;

create or replace function public.biz_push(p_ws text, p_token text, p_blob text, p_base bigint)
returns json language plpgsql security definer set search_path = public as $$
declare r public.business_sync;
begin
  select * into r from public.business_sync where ws = p_ws for update;
  if not found then
    insert into public.business_sync(ws, token, version, blob) values (p_ws, p_token, 1, p_blob);
    return json_build_object('ok', true, 'version', 1);
  end if;
  if r.token <> p_token then raise exception 'forbidden'; end if;
  if r.version <> p_base then return json_build_object('ok', false, 'version', r.version); end if;
  update public.business_sync set blob = p_blob, version = version + 1, updated_at = now() where ws = p_ws;
  return json_build_object('ok', true, 'version', r.version + 1);
end $$;

revoke all on function public.biz_pull(text, text) from public;
revoke all on function public.biz_head(text, text) from public;
revoke all on function public.biz_push(text, text, text, bigint) from public;
grant execute on function public.biz_pull(text, text) to anon, authenticated;
grant execute on function public.biz_head(text, text) to anon, authenticated;
grant execute on function public.biz_push(text, text, text, bigint) to anon, authenticated;
