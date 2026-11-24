-- =============================================================================
-- Sarhad Phase 1: Foundations
-- Multi-branch core, user profiles, staff roles, settings and audit log.
-- Every table has Row Level Security enabled. Access is decided by the helper
-- functions in the "authorization helpers" section.
-- =============================================================================

create extension if not exists postgis with schema extensions;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------

-- Staff roles. Customers have no role row at all.
--   owner           full control, including other owners and admins
--   admin           full control of the business, cannot touch owners
--   branch_manager  manages one branch (menu availability, orders, staff view)
--   staff           works orders in one branch
create type public.app_role as enum ('owner', 'admin', 'branch_manager', 'staff');

create type public.app_locale as enum ('ar', 'en');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Branches
-- -----------------------------------------------------------------------------

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  address_en text,
  address_ar text,
  phone text,
  whatsapp text,
  -- Pin of the branch. Delivery zones (Phase 3) are stored separately.
  location extensions.geography(point, 4326),
  timezone text not null default 'Asia/Kuwait',
  -- Weekly hours, e.g. {"sat":[{"open":"11:00","close":"23:30"}], ...}
  opening_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  accepts_delivery boolean not null default true,
  accepts_pickup boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.branches is 'Restaurant branches. Everything operational (menu availability, zones, orders) hangs off a branch.';

create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Profiles (one per auth user: customers and staff alike)
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  preferred_locale public.app_locale not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'preferred_locale';
begin
  insert into public.profiles (id, full_name, phone, preferred_locale)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    case when v_locale in ('ar', 'en') then v_locale::public.app_locale else 'ar' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Staff roles
-- -----------------------------------------------------------------------------

create table public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  -- null = all branches (owner/admin). Branch roles must name a branch.
  branch_id uuid references public.branches (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint staff_roles_branch_scope check (
    (role in ('owner', 'admin') and branch_id is null)
    or (role in ('branch_manager', 'staff') and branch_id is not null)
  ),
  constraint staff_roles_unique unique nulls not distinct (user_id, role, branch_id)
);

create index staff_roles_user_idx on public.staff_roles (user_id);
create index staff_roles_branch_idx on public.staff_roles (branch_id);

comment on table public.staff_roles is 'Who can use the back office, with which role, in which branch.';

-- -----------------------------------------------------------------------------
-- Settings (key/value, some keys public)
-- -----------------------------------------------------------------------------

create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit log (append only, written by triggers)
-- -----------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key'),
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      else v_row
    end
  );
  return null;
end;
$$;

create trigger branches_audit
after insert or update or delete on public.branches
for each row execute function public.write_audit_log();

create trigger staff_roles_audit
after insert or update or delete on public.staff_roles
for each row execute function public.write_audit_log();

create trigger settings_audit
after insert or update or delete on public.settings
for each row execute function public.write_audit_log();

-- -----------------------------------------------------------------------------
-- Authorization helpers
-- SECURITY DEFINER so they can read staff_roles without recursing into RLS.
-- -----------------------------------------------------------------------------

create or replace function public.has_any_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = auth.uid() and role = any (p_roles)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff_roles where user_id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_any_role(array['owner']::public.app_role[]);
$$;

-- Owner or admin: business-wide control.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_any_role(array['owner', 'admin']::public.app_role[]);
$$;

-- Any staff role that covers this branch.
create or replace function public.can_access_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.staff_roles
    where user_id = auth.uid() and branch_id = p_branch_id
  );
$$;

-- Admin, or manager of this branch.
create or replace function public.can_manage_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.staff_roles
    where user_id = auth.uid() and branch_id = p_branch_id and role = 'branch_manager'
  );
$$;

-- -----------------------------------------------------------------------------
-- Guard rails on staff_roles
-- -----------------------------------------------------------------------------

-- Only owners may grant or revoke the owner role, and there must always be at
-- least one owner. Direct SQL as postgres/service_role (auth.uid() is null) is
-- allowed so the first owner can be bootstrapped.
create or replace function public.guard_staff_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if (tg_op in ('INSERT', 'UPDATE') and new.role = 'owner')
       or (tg_op in ('UPDATE', 'DELETE') and old.role = 'owner') then
      if not public.is_owner() then
        raise exception 'Only an owner can change owner roles' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' then
    if not exists (
      select 1 from public.staff_roles
      where role = 'owner' and id <> old.id
    ) and (tg_op = 'DELETE' or new.role <> 'owner') then
      raise exception 'At least one owner is required' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger staff_roles_guard
before insert or update or delete on public.staff_roles
for each row execute function public.guard_staff_roles();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_roles enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- Branches: the public sees active branches; staff see the branches they work in.
create policy "Active branches are public"
on public.branches for select
to anon, authenticated
using (is_active or public.can_access_branch(id));

create policy "Admins create branches"
on public.branches for insert
to authenticated
with check (public.is_admin());

create policy "Managers update their branch"
on public.branches for update
to authenticated
using (public.can_manage_branch(id))
with check (public.can_manage_branch(id));

create policy "Admins delete branches"
on public.branches for delete
to authenticated
using (public.is_admin());

-- Profiles: you see and edit your own; admins and branch staff can read all
-- (needed to see customer names on orders).
create policy "Read own profile or as staff"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_staff());

create policy "Update own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Staff roles: you can see your own; admins see all; managers see their branch.
create policy "Read staff roles"
on public.staff_roles for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
  or (branch_id is not null and public.can_manage_branch(branch_id))
);

create policy "Admins grant roles"
on public.staff_roles for insert
to authenticated
with check (public.is_admin());

create policy "Admins change roles"
on public.staff_roles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins revoke roles"
on public.staff_roles for delete
to authenticated
using (public.is_admin());

-- Settings: public keys for everyone, all keys for staff, writes by admins.
create policy "Read settings"
on public.settings for select
to anon, authenticated
using (is_public or public.is_staff());

create policy "Admins write settings"
on public.settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Audit log: admins read. No one writes directly (triggers only).
create policy "Admins read audit log"
on public.audit_log for select
to authenticated
using (public.is_admin());

-- Column privileges: profiles.id cannot be changed by clients.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, preferred_locale) on public.profiles to authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPCs used by the apps
-- -----------------------------------------------------------------------------

-- Everything the back office needs to know about the signed-in user.
create or replace function public.my_roles()
returns table (role public.app_role, branch_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select role, branch_id from public.staff_roles where user_id = auth.uid();
$$;

-- Staff directory for the back office (emails live in auth.users).
create or replace function public.list_staff()
returns table (
  role_id uuid,
  user_id uuid,
  email text,
  full_name text,
  role public.app_role,
  branch_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select sr.id, sr.user_id, u.email::text, p.full_name, sr.role, sr.branch_id, sr.created_at
  from public.staff_roles sr
  join auth.users u on u.id = sr.user_id
  left join public.profiles p on p.id = sr.user_id
  where public.is_admin()
     or (sr.branch_id is not null and public.can_manage_branch(sr.branch_id))
  order by sr.created_at;
$$;

-- Give an existing account a staff role by email. The person must have signed
-- up first (website, app or back office invite in a later phase).
create or replace function public.assign_staff_role(
  p_email text,
  p_role public.app_role,
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account with that email. Ask them to sign up first.' using errcode = 'P0002';
  end if;

  insert into public.staff_roles (user_id, role, branch_id, created_by)
  values (v_user_id, p_role, p_branch_id, auth.uid())
  on conflict on constraint staff_roles_unique do update set role = excluded.role
  returning id into v_id;

  return v_id;
end;
$$;

-- Make the very first owner. Only callable from the SQL editor / service role,
-- and only while no owner exists.
create or replace function public.bootstrap_owner(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if exists (select 1 from public.staff_roles where role = 'owner') then
    raise exception 'An owner already exists. Use the back office to add more.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account with email %. Sign up first.', p_email;
  end if;

  insert into public.staff_roles (user_id, role) values (v_user_id, 'owner')
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.bootstrap_owner(text) from public, anon, authenticated;
revoke execute on function public.assign_staff_role(text, public.app_role, uuid) from public, anon;
revoke execute on function public.list_staff() from public, anon;
revoke execute on function public.my_roles() from public, anon;
grant execute on function public.assign_staff_role(text, public.app_role, uuid) to authenticated;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.my_roles() to authenticated;

-- Internal trigger functions are not callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.write_audit_log() from public, anon, authenticated;
revoke execute on function public.guard_staff_roles() from public, anon, authenticated;
