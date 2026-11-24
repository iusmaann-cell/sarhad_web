-- Menu and per-branch availability tests. Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

insert into auth.users (id, email, aud, role) values
  ('30000000-0000-4000-8000-000000000001', 'admin2@t.test', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000002', 'mgr2@t.test', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000003', 'staff2@t.test', 'authenticated', 'authenticated'),
  ('30000000-0000-4000-8000-000000000004', 'cust2@t.test', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active) values
  ('40000000-0000-4000-8000-000000000001', 'm-one', 'One', 'واحد', true),
  ('40000000-0000-4000-8000-000000000002', 'm-two', 'Two', 'اثنان', true);

insert into public.staff_roles (user_id, role, branch_id) values
  ('30000000-0000-4000-8000-000000000001', 'admin', null),
  ('30000000-0000-4000-8000-000000000002', 'branch_manager', '40000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'staff', '40000000-0000-4000-8000-000000000001');

insert into public.menu_categories (id, name_en, name_ar, sort_order) values
  ('50000000-0000-4000-8000-000000000001', 'Test cat', 'تجربة', 100),
  ('50000000-0000-4000-8000-000000000002', 'Hidden cat', 'مخفي', 101);
update public.menu_categories set is_active = false where id = '50000000-0000-4000-8000-000000000002';

insert into public.menu_items (id, category_id, name_en, name_ar, price_fils, is_active) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Dish A', 'طبق أ', 1500, true),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'Dish B', 'طبق ب', 900, false),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 'Dish C', 'طبق ج', 900, true);

-- Constraints
select throws_ok(
  $$insert into public.menu_items (category_id, name_en, name_ar, price_fils) values ('50000000-0000-4000-8000-000000000001', 'x', 'x', -1)$$,
  '23514', null, 'prices cannot be negative');
select throws_ok(
  $$insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select) values ('60000000-0000-4000-8000-000000000001', 'g', 'g', 3, 1)$$,
  '23514', null, 'min_select cannot exceed max_select');

-- Anonymous visitor
set local role anon;
select is(
  (select count(*)::int from public.menu_items where category_id = '50000000-0000-4000-8000-000000000001'),
  1, 'anon sees only active items');
select is_empty(
  $$select 1 from public.menu_categories where id = '50000000-0000-4000-8000-000000000002'$$,
  'anon does not see inactive categories');
select throws_ok(
  $$insert into public.menu_categories (name_en, name_ar) values ('x', 'x')$$,
  '42501', null, 'anon cannot add categories');
select is(
  (select jsonb_array_length(c -> 'items') from jsonb_array_elements(public.get_branch_menu('40000000-0000-4000-8000-000000000001')) c
   where c ->> 'id' = '50000000-0000-4000-8000-000000000001'),
  1, 'branch menu lists only active items');
reset role;

-- Branch staff toggles availability but cannot change prices
set local role authenticated;
set local request.jwt.claims = '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into public.branch_menu_items (branch_id, item_id, is_available) values ('40000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', false)$$,
  'staff can mark an item sold out in their branch');
select throws_ok(
  $$update public.branch_menu_items set price_override_fils = 100 where branch_id = '40000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'staff cannot change prices');
select throws_ok(
  $$insert into public.branch_menu_items (branch_id, item_id, is_available) values ('40000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', false)$$,
  '42501', null, 'staff cannot touch another branch');
select is_empty(
  $$update public.menu_items set price_fils = 1 where id = '60000000-0000-4000-8000-000000000001' returning id$$,
  'staff cannot edit the menu');
reset role;

-- Branch manager sets a branch price
set local role authenticated;
set local request.jwt.claims = '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$update public.branch_menu_items set price_override_fils = 1750, is_available = true where branch_id = '40000000-0000-4000-8000-000000000001' and item_id = '60000000-0000-4000-8000-000000000001'$$,
  'manager can set a branch price');
reset role;

set local role anon;
select is(
  (select (i ->> 'price_fils')::int from jsonb_array_elements(public.get_branch_menu('40000000-0000-4000-8000-000000000001')) c,
     jsonb_array_elements(c -> 'items') i where i ->> 'id' = '60000000-0000-4000-8000-000000000001'),
  1750, 'branch price override is used');
select is(
  (select (i ->> 'price_fils')::int from jsonb_array_elements(public.get_branch_menu('40000000-0000-4000-8000-000000000002')) c,
     jsonb_array_elements(c -> 'items') i where i ->> 'id' = '60000000-0000-4000-8000-000000000001'),
  1500, 'other branches keep the base price');
reset role;

-- Admin edits the menu
set local role authenticated;
set local request.jwt.claims = '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$insert into public.menu_categories (name_en, name_ar) values ('New', 'جديد')$$,
  'admin can add a category');
select lives_ok(
  $$update public.menu_items set price_fils = 1600 where id = '60000000-0000-4000-8000-000000000001'$$,
  'admin can change a base price');
select isnt_empty(
  $$select 1 from public.audit_log where entity = 'menu_items' and entity_id = '60000000-0000-4000-8000-000000000001' and action = 'update'$$,
  'menu price changes are audited');
reset role;

select * from finish();
rollback;
