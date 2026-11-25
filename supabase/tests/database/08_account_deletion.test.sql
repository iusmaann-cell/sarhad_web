-- Account deletion: customers can delete themselves; orders stay without personal data.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, aud, role) values
  ('a4000000-0000-4000-8000-000000000001', 'leaver@del.test', 'authenticated', 'authenticated'),
  ('a4000000-0000-4000-8000-000000000002', 'staffer@del.test', 'authenticated', 'authenticated'),
  ('a4000000-0000-4000-8000-000000000003', 'busy@del.test', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, accepts_pickup, opening_hours) values
  ('b4000000-0000-4000-8000-000000000001', 'del-one', 'Del One', 'واحد', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}');
insert into public.staff_roles (user_id, role, branch_id) values
  ('a4000000-0000-4000-8000-000000000002', 'staff', 'b4000000-0000-4000-8000-000000000001');
insert into public.menu_categories (id, name_en, name_ar) values
  ('c4000000-0000-4000-8000-000000000001', 'Del cat', 'فئة');
insert into public.menu_items (id, category_id, name_en, name_ar, price_fils) values
  ('d4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'Tea', 'شاي', 200);
insert into public.delivery_zones (branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes) values
  ('b4000000-0000-4000-8000-000000000001', 'Zone', 'منطقة',
   st_geomfromtext('MULTIPOLYGON(((30 30,30.1 30,30.1 30.1,30 30.1,30 30)))', 4326), 0, 0, 30);

-- The leaver orders, and the order is completed.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin perform public.place_order('{"client_ref":"44444444-0000-4000-8000-000000000001","branch_id":"b4000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Huda","customer_phone":"50000000","notes":"Ring twice","address":{"area":"Salmiya","block":"1","street":"2","building":"3","latitude":30.05,"longitude":30.05},"items":[{"item_id":"d4000000-0000-4000-8000-000000000001","quantity":1}]}'); end $$;
insert into public.customer_addresses (area, block, street, building, latitude, longitude)
values ('Salmiya', '1', '2', '3', 30.05, 30.05);
reset role;
update public.orders set status = 'completed' where client_ref = '44444444-0000-4000-8000-000000000001';

-- Someone with an order in progress
set local role authenticated;
set local request.jwt.claims = '{"sub":"a4000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$ begin perform public.place_order('{"client_ref":"44444444-0000-4000-8000-000000000002","branch_id":"b4000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Busy","customer_phone":"50000000","items":[{"item_id":"d4000000-0000-4000-8000-000000000001","quantity":1}]}'); end $$;
select throws_ok($$select public.delete_my_account()$$, 'P0001', 'open_orders',
  'an account with an order in progress cannot be deleted yet');
reset role;

set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'visitors cannot call it');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a4000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.delete_my_account()$$, 'P0001', 'staff_account',
  'staff accounts are removed by an admin instead');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.delete_my_account()$$, 'a customer deletes their account');
reset role;

select ok(not exists (select 1 from auth.users where id = 'a4000000-0000-4000-8000-000000000001'),
  'the login is gone');
select ok(not exists (select 1 from public.profiles where id = 'a4000000-0000-4000-8000-000000000001'),
  'the profile is gone');
select is((select count(*)::int from public.customer_addresses where user_id = 'a4000000-0000-4000-8000-000000000001'),
  0, 'saved addresses are gone');
select is(
  (select array[customer_name, customer_phone, coalesce(notes, 'none')] from public.orders where client_ref = '44444444-0000-4000-8000-000000000001'),
  array['Deleted customer', '-', 'none'], 'the order is kept without name, phone or notes');
select is(
  (select address from public.orders where client_ref = '44444444-0000-4000-8000-000000000001'),
  '{"area":"Salmiya"}'::jsonb, 'only the area of the address is kept');
select ok(
  (select customer_id is null from public.orders where client_ref = '44444444-0000-4000-8000-000000000001'),
  'the order no longer points to the user');

select * from finish();
rollback;
