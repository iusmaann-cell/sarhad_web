-- Order operations: staff status updates, cancelling, pausing orders.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(18);

insert into auth.users (id, email, aud, role) values
  ('a2000000-0000-4000-8000-000000000001', 'buyer@ops.test', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000002', 'staff@ops.test', 'authenticated', 'authenticated'),
  ('a2000000-0000-4000-8000-000000000003', 'other@ops.test', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, accepts_pickup, opening_hours) values
  ('b2000000-0000-4000-8000-000000000001', 'ops-one', 'Ops One', 'واحد', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}'),
  ('b2000000-0000-4000-8000-000000000002', 'ops-two', 'Ops Two', 'اثنان', true, true, true, '{}');

insert into public.staff_roles (user_id, role, branch_id) values
  ('a2000000-0000-4000-8000-000000000002', 'staff', 'b2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000003', 'staff', 'b2000000-0000-4000-8000-000000000002');

insert into public.menu_categories (id, name_en, name_ar) values
  ('c2000000-0000-4000-8000-000000000001', 'Ops cat', 'فئة');
insert into public.menu_items (id, category_id, name_en, name_ar, price_fils) values
  ('d2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Tikka', 'تكا', 2000);

-- The customer places two pickup orders.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$ begin perform public.place_order('{"client_ref":"22222222-0000-4000-8000-000000000001","branch_id":"b2000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Sara","customer_phone":"50000000","items":[{"item_id":"d2000000-0000-4000-8000-000000000001","quantity":1}]}'); end $$;
do $$ begin perform public.place_order('{"client_ref":"22222222-0000-4000-8000-000000000002","branch_id":"b2000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Sara","customer_phone":"50000000","items":[{"item_id":"d2000000-0000-4000-8000-000000000001","quantity":2}]}'); end $$;
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'accepted')$$,
  'P0001', 'not_found', 'customers cannot move their own order on');
select throws_ok(
  $$select public.set_accepting_orders('b2000000-0000-4000-8000-000000000001', false)$$,
  '42501', null, 'customers cannot pause a branch');
reset role;

-- Staff of another branch
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'accepted')$$,
  'P0001', 'not_found', 'staff of another branch cannot touch the order');
select throws_ok(
  $$select public.set_accepting_orders('b2000000-0000-4000-8000-000000000001', false)$$,
  '42501', null, 'staff of another branch cannot pause it');
reset role;

-- Staff of the branch
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'ready')$$,
  'P0001', 'invalid_status', 'steps cannot be skipped');
select is(
  public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'accepted'),
  'accepted'::public.order_status, 'staff accept an order');
select ok(
  (select accepted_at is not null from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'),
  'the accepted time is recorded');
select lives_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'preparing')$$,
  'accepted orders go to preparing');
select lives_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'ready')$$,
  'then ready');
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'out_for_delivery')$$,
  'P0001', 'invalid_status', 'pickup orders are never out for delivery');
select lives_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'), 'completed')$$,
  'a ready pickup order is completed');
select is(
  (select payment_status::text from public.orders where client_ref = '22222222-0000-4000-8000-000000000001'),
  'paid', 'cash is marked as collected on completion');
select is(
  (select count(*)::int from public.order_events e join public.orders o on o.id = e.order_id
   where o.client_ref = '22222222-0000-4000-8000-000000000001'),
  5, 'every status change is in the history');
select is(
  (select e.actor_id::text from public.order_events e join public.orders o on o.id = e.order_id
   where o.client_ref = '22222222-0000-4000-8000-000000000001' and e.status = 'completed'),
  'a2000000-0000-4000-8000-000000000002', 'the history records who changed the status');
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000002'), 'cancelled', '  ')$$,
  'P0001', 'reason_required', 'cancelling needs a reason');
select lives_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '22222222-0000-4000-8000-000000000002'), 'cancelled', 'Out of tikka')$$,
  'staff cancel with a reason');
select is(
  public.set_accepting_orders('b2000000-0000-4000-8000-000000000001', false), false,
  'staff pause online orders');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$select public.place_order('{"client_ref":"22222222-0000-4000-8000-000000000003","branch_id":"b2000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Sara","customer_phone":"50000000","items":[{"item_id":"d2000000-0000-4000-8000-000000000001","quantity":1}]}')$$,
  'P0001', 'branch_closed', 'a paused branch does not take orders');
reset role;

select * from finish();
rollback;
