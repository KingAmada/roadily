-- Roadily-owned private accounts, unrelated to auth.users and Supabase Auth.
begin;
create schema if not exists roadily_accounts;
revoke all on schema roadily_accounts from public, anon, authenticated;
grant usage on schema roadily_accounts to service_role;
create table roadily_accounts.accounts (
 id uuid primary key default gen_random_uuid(),
 phone text unique not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
 display_name text not null check (char_length(display_name) between 1 and 80),
 salt text not null check (salt ~ '^[0-9a-f]{32}$'),
 password_hash text not null check (password_hash ~ '^[0-9a-f]{64}$')
);
create table roadily_accounts.sessions (
 token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
 account_id uuid not null references roadily_accounts.accounts on delete cascade,
 expires_at timestamptz not null default (now() + interval '12 hours')
);
create index on roadily_accounts.sessions (account_id);
create index on roadily_accounts.sessions (expires_at);
create table roadily_accounts.vehicles (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references roadily_accounts.accounts on delete cascade,
 plate text not null check (plate ~ '^[A-Z0-9]{1,7}$'),
 kind text not null check (char_length(kind) between 1 and 32),
 created_at timestamptz not null default now(),
 unique(account_id, plate)
);
create table roadily_accounts.buckets (
 bucket text primary key,
 window_start timestamptz not null,
 hits int not null
);
create index on roadily_accounts.buckets (window_start);
alter table roadily_accounts.accounts enable row level security;
alter table roadily_accounts.sessions enable row level security;
alter table roadily_accounts.vehicles enable row level security;
alter table roadily_accounts.buckets enable row level security;
revoke all on all tables in schema roadily_accounts from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema roadily_accounts to service_role;
create function public.roadily_private_api(p_op text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 u roadily_accounts.accounts%rowtype;
 v roadily_accounts.vehicles%rowtype;
 h int; t text; op text; w timestamptz;
begin
 case p_op when 'limits' then
  op := p_data->>'action';
  if op not in ('login','register') or (p_data->>'identity') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid input';
  end if;
  -- Stable ordering avoids deadlocks; reject globally before adding a phone bucket.
  w := date_bin(interval '1 minute', now(), '2020-01-01 00:00:00+00'::timestamptz);
  insert into roadily_accounts.buckets as b values ('global:'||op,w,1)
   on conflict (bucket) do update set hits = case when b.window_start < excluded.window_start then 1 else least(b.hits + 1,500) end,
   window_start = greatest(b.window_start, excluded.window_start)
   returning hits into h;
  if h > (case op when 'register' then 20 else 120 end) then return 'false'::jsonb; end if;
  -- Opportunistic cleanup is bounded by the global signup/login caps above.
  if h = 1 then
    delete from roadily_accounts.buckets
      where bucket like (op||':%') and window_start < now() - interval '30 minutes';
    if op = 'register' then delete from roadily_accounts.sessions where expires_at < now(); end if;
  end if;
  w := date_bin(interval '10 minutes', now(), '2020-01-01 00:00:00+00'::timestamptz);
  insert into roadily_accounts.buckets as b values (op||':'||(p_data->>'identity'),w,1)
   on conflict (bucket) do update set hits = case when b.window_start < excluded.window_start then 1 else least(b.hits + 1,500) end,
   window_start = greatest(b.window_start, excluded.window_start)
   returning hits into h;
  return to_jsonb(h <= (case op when 'register' then 4 else 10 end));
 when 'register' then
  insert into roadily_accounts.accounts(phone,display_name,salt,password_hash)
  values (p_data->>'phone',p_data->>'display_name',p_data->>'salt',p_data->>'password_hash')
  on conflict (phone) do nothing returning * into u;
  if not found then return 'null'::jsonb; end if;
  insert into roadily_accounts.sessions(token_hash,account_id) values(p_data->>'token_hash',u.id);
 when 'lookup' then
  select * into u from roadily_accounts.accounts a where a.phone = p_data->>'phone';
  if not found then return 'null'::jsonb; end if;
  return jsonb_build_object('id',u.id,'salt',u.salt,'password_hash',u.password_hash);
 when 'session' then
  select * into strict u from roadily_accounts.accounts where id=(p_data->>'account_id')::uuid;
  delete from roadily_accounts.sessions where account_id=u.id and expires_at < now();
  insert into roadily_accounts.sessions(token_hash,account_id) values(p_data->>'token_hash',u.id);
 when 'logout' then
  delete from roadily_accounts.sessions where token_hash=p_data->>'token_hash';
  return '{}'::jsonb;
 when 'me','list','save' then
  select a.* into u from roadily_accounts.sessions s
    join roadily_accounts.accounts a on a.id=s.account_id
    where s.token_hash=p_data->>'token_hash' and s.expires_at > now() for share of s;
  if not found then return 'null'::jsonb; end if;
  if p_op = 'list' then
   return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'plate',plate,'kind',kind) order by created_at), '[]'::jsonb)
     from roadily_accounts.vehicles where account_id=u.id);
  elsif p_op = 'save' then
   -- Serialize writes per account so the cap cannot be exceeded concurrently.
   perform 1 from roadily_accounts.accounts where id=u.id for update;
   if (select count(*) from roadily_accounts.vehicles where account_id=u.id) >= 50 then
    return '{"capacity":true}'::jsonb;
   end if;
   insert into roadily_accounts.vehicles(account_id,plate,kind)
     values(u.id,p_data->>'plate',p_data->>'kind')
     on conflict (account_id,plate) do nothing returning * into v;
   if not found then return '{"duplicate":true}'::jsonb; end if;
   return jsonb_build_object('id',v.id,'plate',v.plate,'kind',v.kind);
  end if;
 else raise exception 'invalid operation';
 end case;
 return jsonb_build_object('id',u.id,'phone',u.phone,'display_name',u.display_name);
end;
$$;
revoke all on function public.roadily_private_api(text,jsonb) from public, anon, authenticated;
grant execute on function public.roadily_private_api(text,jsonb) to service_role;
commit;
