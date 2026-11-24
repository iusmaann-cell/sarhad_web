-- Row Level Security tests for Phase 1. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('10000000-0000-4000-8000-000000000001', 'o@t.test', '{"full_name":"Owner","preferred_locale":"en"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000002', 'a@t.test', '{"full_name":"Admin"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000003', 'm@t.test', '{"full_name":"Manager"}', 'authenticated', 'authenticated'),
  ('10000000-0000-4000-8000-000000000004', 'c@t.test', '{"full_name":"Customer","preferred_locale":"xx"}', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active) values
  ('20000000-0000-4000-8000-000000000001', 't-open', 'Open', 'مفتوح', true),
  ('20000000-0000-4000-8000-000000000002', 't-hidden', 'Hidden', 'مخفي', false);

insert into public.staff_roles (user_id, role, branch_id) values
  ('10000000-0000-4000-8000-000000000001', 'owner', null),
  ('10000000-0000-4000-8000-000000000002', 'admin', null),
  ('10000000-0000-4000-8000-000000000003', 'branch_manager', '20000000-0000-4000-8000-000000000002');

-- Profile trigger
select is(
  (select full_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'Owner', 'profile created from sign-up metadata');
select is(
  (select preferred_locale::text from public.profiles where id = '10000000-0000-4000-8000-000000000004'),
  'ar', 'unknown locale falls back to Arabic');

-- Role scope constraint
select throws_ok(
  $$insert into public.staff_roles (user_id, role) values ('10000000-0000-4000-8000-000000000004', 'staff')$$,
  '23514', null, 'branch roles must name a branch');

-- ---------------------------------------------------------------------------
-- Anonymous visitor
-- ---------------------------------------------------------------------------
set local role anon;
select results_eq(
  $$select slug from public.branches where slug like 't-%' order by slug$$,
  array['t-open'], 'anon sees only active branches');
select is_empty($$select * from public.staff_roles$$, 'anon sees no staff roles');
select is_empty($$select * from public.profiles$$, 'anon sees no profiles');
reset role;

-- ---------------------------------------------------------------------------
-- Customer
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}';

select results_eq($$select count(*)::int from public.profiles$$, array[1], 'customer sees only own profile');
select lives_ok(
  $$update public.profiles set full_name = 'New Name' where id = '10000000-0000-4000-8000-000000000004'$$,
  'customer can update own profile');
select is_empty(
  $$update public.profiles set full_name = 'Hacked' where id = '10000000-0000-4000-8000-000000000001' returning id$$,
  'customer cannot update another profile');
select throws_ok(
  $$insert into public.staff_roles (user_id, role) values ('10000000-0000-4000-8000-000000000004', 'admin')$$,
  '42501', null, 'customer cannot make themselves admin');
select throws_ok(
  $$select public.assign_staff_role('c@t.test', 'admin')$$,
  '42501', null, 'customer cannot call assign_staff_role');
select is_empty(
  $$update public.branches set name_en = 'x' where slug = 't-open' returning id$$,
  'customer cannot edit branches');
select is_empty($$select * from public.audit_log$$, 'customer cannot read audit log');
reset role;

-- ---------------------------------------------------------------------------
-- Branch manager (hidden branch only)
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';

select results_eq(
  $$select slug from public.branches where slug like 't-%' order by slug$$,
  array['t-hidden', 't-open'], 'manager also sees their inactive branch');
select isnt_empty(
  $$update public.branches set phone = '123' where slug = 't-hidden' returning id$$,
  'manager can update own branch');
select is_empty(
  $$update public.branches set phone = '123' where slug = 't-open' returning id$$,
  'manager cannot update another branch');
select throws_ok(
  $$insert into public.branches (slug, name_en, name_ar) values ('nope', 'n', 'n')$$,
  '42501', null, 'manager cannot create branches');
reset role;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$select public.assign_staff_role('c@t.test', 'staff', '20000000-0000-4000-8000-000000000001')$$,
  'admin can give a customer a staff role');
select throws_ok(
  $$select public.assign_staff_role('c@t.test', 'owner')$$,
  '42501', null, 'admin cannot create owners');
select throws_ok(
  $$delete from public.staff_roles where role = 'owner'$$,
  '42501', null, 'admin cannot remove owners');
reset role;

-- ---------------------------------------------------------------------------
-- Owner
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';

select throws_ok(
  $$delete from public.staff_roles where role = 'owner'$$,
  'P0001', null, 'the last owner cannot be removed');
select isnt_empty(
  $$select * from public.audit_log where entity = 'staff_roles'$$,
  'role changes are written to the audit log');
reset role;

select * from finish();
rollback;
