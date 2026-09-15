-- REUSE & RESHARE DATABASE
-- Run this whole file in Supabase SQL Editor.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null unique,
  phone text default '',
  role text not null default 'student' check (role in ('student','faculty','admin')),
  department text default '',
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  category text not null,
  description text not null,
  type text not null check (type in ('Free/Give away','Borrow','Exchange','Sell')),
  meeting_date date,
  meeting_time time,
  location text not null,
  contact_phone text not null,
  image_url text,
  status text not null default 'active' check (status in ('active','removed','completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.item_requests (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message text default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique(item_id, requester_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.emergency_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'Found' check (kind in ('Lost','Found','Urgent')),
  title text not null,
  description text not null,
  location text not null,
  contact_phone text default '',
  status text not null default 'active' check (status in ('active','resolved','removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.flags (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  category text not null,
  description text not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',''),
    new.email,
    coalesce(new.raw_user_meta_data->>'phone',''),
    case when new.raw_user_meta_data->>'role' = 'faculty' then 'faculty' else 'student' end,
    coalesce(new.raw_user_meta_data->>'department','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.notify_new_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  itemname text;
begin
  select owner_id, item_name into owner, itemname
  from public.items where id = new.item_id;

  if owner is not null then
    insert into public.notifications(user_id,title,message)
    values(owner,'New item request','Someone requested your item: ' || itemname);
  end if;
  return new;
end;
$$;

drop trigger if exists after_item_request on public.item_requests;
create trigger after_item_request
after insert on public.item_requests
for each row execute procedure public.notify_new_request();

create or replace function public.notify_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  itemname text;
begin
  if old.status is distinct from new.status and new.status in ('accepted','rejected') then
    select item_name into itemname from public.items where id = new.item_id;
    insert into public.notifications(user_id,title,message)
    values(
      new.requester_id,
      case when new.status='accepted' then 'Request accepted' else 'Request rejected' end,
      case when new.status='accepted'
        then 'Your request for "' || itemname || '" was accepted.'
        else 'Your request for "' || itemname || '" was rejected.'
      end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists after_request_decision on public.item_requests;
create trigger after_request_decision
after update on public.item_requests
for each row execute procedure public.notify_request_decision();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.item_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.emergency_posts enable row level security;
alter table public.flags enable row level security;
alter table public.feedback enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());

drop policy if exists items_public_read on public.items;
create policy items_public_read on public.items for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());

drop policy if exists items_insert_auth on public.items;
create policy items_insert_auth on public.items for insert with check (owner_id = auth.uid());

drop policy if exists items_update_owner_admin on public.items;
create policy items_update_owner_admin on public.items for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists items_delete_admin on public.items;
create policy items_delete_admin on public.items for delete using (public.is_admin());

drop policy if exists requests_select_related on public.item_requests;
create policy requests_select_related on public.item_requests for select using (
  requester_id = auth.uid()
  or exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid())
  or public.is_admin()
);

drop policy if exists requests_insert_own on public.item_requests;
create policy requests_insert_own on public.item_requests for insert with check (requester_id = auth.uid());

drop policy if exists requests_update_owner on public.item_requests;
create policy requests_update_owner on public.item_requests for update using (
  exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid())
  or public.is_admin()
) with check (
  exists(select 1 from public.items i where i.id=item_id and i.owner_id=auth.uid())
  or public.is_admin()
);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists emergency_read on public.emergency_posts;
create policy emergency_read on public.emergency_posts for select using (status='active' or user_id=auth.uid() or public.is_admin());

drop policy if exists emergency_insert on public.emergency_posts;
create policy emergency_insert on public.emergency_posts for insert with check (user_id=auth.uid());

drop policy if exists emergency_update on public.emergency_posts;
create policy emergency_update on public.emergency_posts for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

drop policy if exists flags_insert_own on public.flags;
create policy flags_insert_own on public.flags for insert with check (reporter_id=auth.uid());

drop policy if exists flags_select_related on public.flags;
create policy flags_select_related on public.flags for select using (reporter_id=auth.uid() or public.is_admin());

drop policy if exists flags_update_admin on public.flags;
create policy flags_update_admin on public.flags for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert with check (user_id=auth.uid());

drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback for select using (user_id=auth.uid() or public.is_admin());

-- Storage
insert into storage.buckets (id,name,public)
values ('item-images','item-images',true)
on conflict (id) do update set public=true;

drop policy if exists item_images_upload on storage.objects;
create policy item_images_upload on storage.objects for insert
to authenticated
with check (bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists item_images_update on storage.objects;
create policy item_images_update on storage.objects for update
to authenticated
using (bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists item_images_delete on storage.objects;
create policy item_images_delete on storage.objects for delete
to authenticated
using ((bucket_id='item-images' and (storage.foldername(name))[1]=auth.uid()::text) or public.is_admin());

-- Helpful indexes
create index if not exists items_status_created_idx on public.items(status, created_at desc);
create index if not exists requests_item_idx on public.item_requests(item_id);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists emergency_status_idx on public.emergency_posts(status, created_at desc);
create index if not exists flags_status_idx on public.flags(status, created_at desc);
