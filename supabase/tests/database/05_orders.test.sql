-- Ordering tests: server-side price checks, delivery rules and who sees orders.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(23);

insert into auth.users (id, email, aud, role) values
  ('a1000000-0000-4000-8000-000000000001', 'buyer1@t.test', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000002', 'buyer2@t.test', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000003', 'ostaff@t.test', 'authenticated', 'authenticated'),
  ('a1000000-0000-4000-8000-000000000004', 'ostaff2@t.test', 'authenticated', 'authenticated');

-- Open all day, every day ("00:00"-"00:00").
insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, accepts_pickup, opening_hours) values
  ('b1000000-0000-4000-8000-000000000001', 'o-one', 'Order One', 'واحد', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}'),
  ('b1000000-0000-4000-8000-000000000002', 'o-closed', 'Closed', 'مغلق', true, true, true, '{}');

insert into public.staff_roles (user_id, role, branch_id) values
  ('a1000000-0000-4000-8000-000000000003', 'staff', 'b1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000004', 'staff', 'b1000000-0000-4000-8000-000000000002');

insert into public.menu_categories (id, name_en, name_ar) values
  ('c1000000-0000-4000-8000-000000000001', 'Order cat', 'فئة');
insert into public.menu_items (id, category_id, name_en, name_ar, price_fils) values
  ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Karahi', 'كراهي', 3000),
  ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000001', 'Naan', 'نان', 250),
  ('d1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001', 'Sold out', 'نفد', 1000);
insert into public.modifier_groups (id, item_id, name_en, name_ar, min_select, max_select) values
  ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Size', 'الحجم', 1, 1);
insert into public.modifier_options (id, group_id, name_en, name_ar, price_delta_fils) values
  ('f1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001', 'Half', 'نصف', 0),
  ('f1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', 'Full', 'كامل', 2500);
insert into public.branch_menu_items (branch_id, item_id, is_available) values
  ('b1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000003', false);
insert into public.delivery_zones (branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes) values
  ('b1000000-0000-4000-8000-000000000001', 'Zone', 'منطقة',
   st_geomfromtext('MULTIPOLYGON(((10 10,10.1 10,10.1 10.1,10 10.1,10 10)))', 4326), 500, 5000, 30);

select ok(public.branch_is_open('b1000000-0000-4000-8000-000000000001'), 'a branch open 00:00-00:00 is open all day');
select ok(not public.branch_is_open('b1000000-0000-4000-8000-000000000002'), 'a branch with no hours is closed');

set local role anon;
select throws_ok(
  $$select public.place_order('{}')$$, '42501', null, 'visitors must sign in to order');
reset role;

-- Customer one orders
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000001","branch_id":"b1000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Ali","customer_phone":"+965 5000 0000","items":[{"item_id":"d1000000-0000-4000-8000-000000000001","quantity":2,"option_ids":["f1000000-0000-4000-8000-000000000002"]},{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":3,"option_ids":[],"total_fils":1}],"total_fils":1}')$$,
  'a customer places a pickup order');
select is(
  (select total_fils from public.orders where client_ref = '11111111-0000-4000-8000-000000000001'),
  (3000 + 2500) * 2 + 250 * 3, 'the server works out the total from the menu, ignoring prices sent by the app');
select is(
  (select count(*)::int from public.order_items i join public.orders o on o.id = i.order_id
   where o.client_ref = '11111111-0000-4000-8000-000000000001'), 2, 'order lines are saved');
select is(
  (select options -> 0 ->> 'name_en' from public.order_items i join public.orders o on o.id = i.order_id
   where o.client_ref = '11111111-0000-4000-8000-000000000001' and i.name_en = 'Karahi'),
  'Full', 'chosen add-ons are kept with the line');
select is(
  public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000001","branch_id":"b1000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Ali","customer_phone":"+965 5000 0000","items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":1}]}') ->> 'id',
  (select id::text from public.orders where client_ref = '11111111-0000-4000-8000-000000000001'),
  'sending the same order twice does not create a second order');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000002","branch_id":"b1000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Ali","customer_phone":"50000000","items":[{"item_id":"d1000000-0000-4000-8000-000000000001","quantity":1,"option_ids":[]}]}')$$,
  'P0001', 'invalid_options', 'a required add-on must be chosen');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000003","branch_id":"b1000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Ali","customer_phone":"50000000","items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":1,"option_ids":["f1000000-0000-4000-8000-000000000002"]}]}')$$,
  'P0001', 'invalid_options', 'an add-on from another dish is rejected');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000004","branch_id":"b1000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Ali","customer_phone":"50000000","items":[{"item_id":"d1000000-0000-4000-8000-000000000003","quantity":1}]}')$$,
  'P0001', 'item_unavailable', 'sold out dishes cannot be ordered');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000005","branch_id":"b1000000-0000-4000-8000-000000000002","type":"pickup","customer_name":"Ali","customer_phone":"50000000","items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":1}]}')$$,
  'P0001', 'branch_closed', 'closed branches do not take orders');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000006","branch_id":"b1000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"area":"A","block":"1","street":"2","building":"3","latitude":0,"longitude":0},"items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":40}]}')$$,
  'P0001', 'outside_zone', 'addresses outside every delivery area are rejected');
select throws_ok(
  $$select public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000007","branch_id":"b1000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"area":"A","block":"1","street":"2","building":"3","latitude":10.05,"longitude":10.05},"items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":2}]}')$$,
  'P0001', 'below_minimum', 'delivery orders must reach the area minimum');
select is(
  (public.place_order('{"client_ref":"11111111-0000-4000-8000-000000000008","branch_id":"b1000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"area":"A","block":"1","street":"2","building":"3","latitude":10.05,"longitude":10.05},"items":[{"item_id":"d1000000-0000-4000-8000-000000000002","quantity":20}]}') ->> 'order_number') is not null,
  true, 'a delivery order inside the area goes through');
select is(
  (select total_fils - subtotal_fils from public.orders where client_ref = '11111111-0000-4000-8000-000000000008'),
  500, 'the delivery fee comes from the area');
select throws_ok(
  $$update public.orders set total_fils = 0$$, '42501', null, 'customers cannot edit orders directly');
select is(
  (select e.status::text from public.order_events e join public.orders o on o.id = e.order_id
   where o.client_ref = '11111111-0000-4000-8000-000000000001'),
  'pending', 'the first status is recorded');
select lives_ok(
  $$select public.cancel_my_order((select id from public.orders where client_ref = '11111111-0000-4000-8000-000000000001'))$$,
  'a customer can cancel a pending order');
select throws_ok(
  $$select public.cancel_my_order((select id from public.orders where client_ref = '11111111-0000-4000-8000-000000000001'))$$,
  'P0001', 'cannot_cancel', 'a cancelled order cannot be cancelled again');
insert into public.customer_addresses (area, block, street, building, latitude, longitude)
values ('Salmiya', '10', '5', '12', 29.33, 48.07);
reset role;

-- Customer two sees nothing of customer one
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.orders) + (select count(*)::int from public.customer_addresses), 0,
  'customers see only their own orders and addresses');
reset role;

-- Branch staff see their branch's orders only
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.orders where branch_id = 'b1000000-0000-4000-8000-000000000001'), 2,
  'branch staff see the orders of their branch');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is(
  (select count(*)::int from public.orders), 0, 'staff of another branch do not');
reset role;

select * from finish();
rollback;
