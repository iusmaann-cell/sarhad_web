-- Payments and promo codes: gateway keys stay secret, online orders wait for
-- payment, promo codes are checked and applied on the server.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

insert into auth.users (id, email, aud, role) values
  ('a3000000-0000-4000-8000-000000000001', 'buyer@pay.test', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000002', 'admin@pay.test', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000003', 'staff@pay.test', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000004', 'manager@pay.test', 'authenticated', 'authenticated'),
  ('a3000000-0000-4000-8000-000000000005', 'buyer2@pay.test', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, accepts_pickup, opening_hours) values
  ('b3000000-0000-4000-8000-000000000001', 'pay-one', 'Pay One', 'واحد', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}'),
  ('b3000000-0000-4000-8000-000000000002', 'pay-two', 'Pay Two', 'اثنان', true, true, true, '{}');

insert into public.staff_roles (user_id, role, branch_id) values
  ('a3000000-0000-4000-8000-000000000002', 'admin', null),
  ('a3000000-0000-4000-8000-000000000003', 'staff', 'b3000000-0000-4000-8000-000000000001'),
  ('a3000000-0000-4000-8000-000000000004', 'branch_manager', 'b3000000-0000-4000-8000-000000000001');

insert into public.menu_categories (id, name_en, name_ar) values
  ('c3000000-0000-4000-8000-000000000001', 'Pay cat', 'فئة');
insert into public.menu_items (id, category_id, name_en, name_ar, price_fils) values
  ('d3000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000001', 'Biryani', 'برياني', 4000);
insert into public.delivery_zones (branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes) values
  ('b3000000-0000-4000-8000-000000000001', 'Zone', 'منطقة',
   st_geomfromtext('MULTIPOLYGON(((20 20,20.1 20,20.1 20.1,20 20.1,20 20)))', 4326), 500, 1000, 30);

insert into public.payment_providers (id, kind, name_en, name_ar, is_active) values
  ('e3000000-0000-4000-8000-000000000001', 'test', 'Test card', 'بطاقة تجريبية', true),
  ('e3000000-0000-4000-8000-000000000002', 'tap', 'Tap', 'تاب', false);

insert into public.promo_codes (id, code, name_en, name_ar, kind, value, min_subtotal_fils, max_discount_fils, max_uses_per_customer) values
  ('f3000000-0000-4000-8000-000000000001', 'TENOFF', '10% off', 'خصم 10%', 'percent', 10, 5000, 1500, 1);
insert into public.promo_codes (code, name_en, name_ar, kind, value, first_order_only, max_uses_per_customer) values
  ('WELCOME', 'Welcome', 'أهلاً', 'fixed', 1000, true, null),
  ('FREEDEL', 'Free delivery', 'توصيل مجاني', 'free_delivery', 0, false, null);
insert into public.promo_codes (code, name_en, name_ar, kind, value, ends_at) values
  ('OLD', 'Old', 'قديم', 'fixed', 500, now() - interval '1 day');

-- Admin saves a gateway key
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select public.set_payment_provider_key('e3000000-0000-4000-8000-000000000002', 'sk_test_abcd1234')$$,
  'admins save a gateway key');
select is(
  (select key_hint from public.payment_providers where id = 'e3000000-0000-4000-8000-000000000002'),
  '1234', 'only the last 4 characters are shown');
select throws_ok(
  $$select api_key from public.payment_provider_secrets$$, '42501', null, 'even admins cannot read keys back');
reset role;

-- Customer
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.payment_providers), 1, 'customers see only active payment options');
select throws_ok(
  $$select public.set_payment_provider_key('e3000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, 'customers cannot set keys');
select throws_ok(
  $$select api_key from public.payment_provider_secrets$$, '42501', null, 'customers cannot read keys');
select is((select count(*)::int from public.promo_codes), 0, 'customers cannot list promo codes');
select throws_ok(
  $$select public.record_payment_result((select id from public.payments limit 1), 'paid')$$,
  '42501', null, 'customers cannot mark a payment as paid');

-- Promo quotes
select is(
  (public.promo_quote('tenoff', 'b3000000-0000-4000-8000-000000000001', 8000, 0) ->> 'discount_fils')::int,
  800, 'a percent code works, whatever the letter case');
select is(
  (public.promo_quote('TENOFF', 'b3000000-0000-4000-8000-000000000001', 40000, 0) ->> 'discount_fils')::int,
  1500, 'the discount is capped');
select throws_ok(
  $$select public.promo_quote('TENOFF', 'b3000000-0000-4000-8000-000000000001', 4000, 0)$$,
  'P0001', 'promo_min_order', 'the minimum order applies');
select throws_ok(
  $$select public.promo_quote('NOPE', 'b3000000-0000-4000-8000-000000000001', 4000, 0)$$,
  'P0001', 'promo_invalid', 'unknown codes are rejected');
select throws_ok(
  $$select public.promo_quote('OLD', 'b3000000-0000-4000-8000-000000000001', 4000, 0)$$,
  'P0001', 'promo_expired', 'expired codes are rejected');
select throws_ok(
  $$select public.promo_quote('FREEDEL', 'b3000000-0000-4000-8000-000000000001', 4000, 0)$$,
  'P0001', 'promo_delivery_only', 'free delivery needs a delivery order');

-- Order with a promo code, paid online
select is(
  public.place_order('{"client_ref":"33333333-0000-4000-8000-000000000001","branch_id":"b3000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Noor","customer_phone":"50000000","promo_code":"tenoff","payment":{"method":"online","provider_id":"e3000000-0000-4000-8000-000000000001"},"items":[{"item_id":"d3000000-0000-4000-8000-000000000001","quantity":2}]}') ->> 'payment_method',
  'online', 'an online order is placed');
select is(
  (select array[subtotal_fils, discount_fils, total_fils] from public.orders where client_ref = '33333333-0000-4000-8000-000000000001'),
  array[8000, 800, 7200], 'the discount comes off the total');
select is(
  (select promo_code from public.orders where client_ref = '33333333-0000-4000-8000-000000000001'),
  'TENOFF', 'the code is kept on the order');
select throws_ok(
  $$select public.promo_quote('TENOFF', 'b3000000-0000-4000-8000-000000000001', 8000, 0)$$,
  'P0001', 'promo_already_used', 'a customer cannot use a code twice');
select throws_ok(
  $$select public.promo_quote('WELCOME', 'b3000000-0000-4000-8000-000000000001', 8000, 0)$$,
  'P0001', 'promo_first_order', 'first-order codes are for new customers only');
select throws_ok(
  $$select public.place_order('{"client_ref":"33333333-0000-4000-8000-000000000002","branch_id":"b3000000-0000-4000-8000-000000000001","type":"pickup","customer_name":"Noor","customer_phone":"50000000","payment":{"method":"online","provider_id":"e3000000-0000-4000-8000-000000000002"},"items":[{"item_id":"d3000000-0000-4000-8000-000000000001","quantity":1}]}')$$,
  'P0001', 'payment_unavailable', 'inactive gateways cannot be used');
select is(
  (public.place_order('{"client_ref":"33333333-0000-4000-8000-000000000003","branch_id":"b3000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Noor","customer_phone":"50000000","promo_code":"FREEDEL","address":{"area":"A","block":"1","street":"2","building":"3","latitude":20.05,"longitude":20.05},"items":[{"item_id":"d3000000-0000-4000-8000-000000000001","quantity":1}]}') ->> 'payment_method'),
  'cash', 'cash stays the default');
select is(
  (select total_fils from public.orders where client_ref = '33333333-0000-4000-8000-000000000003'),
  4000, 'free delivery removes the fee');
reset role;

-- Staff cannot start an unpaid online order
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '33333333-0000-4000-8000-000000000001'), 'accepted')$$,
  'P0001', 'awaiting_payment', 'unpaid online orders cannot be accepted');
select is(
  (select open_orders from public.order_stats('b3000000-0000-4000-8000-000000000001')), 1,
  'unpaid online orders are not counted as open');
select throws_ok(
  $$insert into public.promo_codes (code, name_en, name_ar, kind, value) values ('STAFF', 'x', 'x', 'fixed', 100)$$,
  '42501', null, 'staff cannot create promo codes');
reset role;

-- The website server confirms the payment
insert into public.payments (id, order_id, provider_id, provider_kind, amount_fils)
select '93000000-0000-4000-8000-000000000001', id, 'e3000000-0000-4000-8000-000000000001', 'test', total_fils
from public.orders where client_ref = '33333333-0000-4000-8000-000000000001';
set local role service_role;
select is(
  public.record_payment_result('93000000-0000-4000-8000-000000000001', 'paid', 'TEST-1', '{"ok":true}'),
  'paid', 'the server records a confirmed payment');
select is(
  public.record_payment_result('93000000-0000-4000-8000-000000000001', 'failed'),
  'paid', 'a paid payment never goes back');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$select public.update_order_status((select id from public.orders where client_ref = '33333333-0000-4000-8000-000000000001'), 'accepted')$$,
  'paid online orders can be accepted');
reset role;

-- Branch managers create codes for their own branch only
set local role authenticated;
set local request.jwt.claims = '{"sub":"a3000000-0000-4000-8000-000000000004","role":"authenticated"}';
select lives_ok(
  $$insert into public.promo_codes (code, name_en, name_ar, kind, value, branch_id) values ('BRANCH1', 'x', 'x', 'fixed', 100, 'b3000000-0000-4000-8000-000000000001')$$,
  'managers create codes for their branch');
select throws_ok(
  $$insert into public.promo_codes (code, name_en, name_ar, kind, value) values ('ALLBR', 'x', 'x', 'fixed', 100)$$,
  '42501', null, 'managers cannot create codes for every branch');
reset role;

select * from finish();
rollback;
