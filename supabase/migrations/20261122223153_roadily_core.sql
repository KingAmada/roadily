-- Use a dedicated Roadily project. Pending or unverified plates are not public.
create table public.roadily_vehicles (
  id integer generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plate text not null check (plate ~ '^[A-Z0-9]{1,7}$'),
  kind text not null check (length(kind) between 1 and 32),
  qr_token uuid not null default gen_random_uuid() unique,
  accept_pay boolean not null default false check (not accept_pay),
  open_chat boolean not null default false check (not open_chat),
  open_social boolean not null default false check (not open_social),
  show_name boolean not null default false check (not show_name),
  created_at timestamptz not null default now(),
  unique (owner_id, plate)
);
alter table public.roadily_vehicles enable row level security;
revoke all on public.roadily_vehicles from public, anon, authenticated;
grant select on public.roadily_vehicles to authenticated;
grant insert (owner_id, plate, kind) on public.roadily_vehicles to authenticated;
grant update (accept_pay, open_chat, open_social, show_name) on public.roadily_vehicles to authenticated;
create policy read_own on public.roadily_vehicles for select to authenticated using (owner_id = (select auth.uid()));
create policy create_own on public.roadily_vehicles for insert to authenticated with check (owner_id = (select auth.uid()));
create policy update_own on public.roadily_vehicles for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
