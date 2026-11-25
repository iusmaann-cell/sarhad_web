-- Delivery area tests: named areas on zones, the public area list, and orders
-- that go to the branch whose zone lists the chosen area.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(17);

insert into auth.users (id, email, aud, role) values
  ('a9000000-0000-4000-8000-000000000001', 'acust@t.test', 'authenticated', 'authenticated'),
  ('a9000000-0000-4000-8000-000000000002', 'amgr@t.test', 'authenticated', 'authenticated');

-- Two branches, both open all day.
insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, accepts_pickup, opening_hours, sort_order) values
  ('b9000000-0000-4000-8000-000000000001', 'a-east', 'East', 'شرق', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}', 1),
  ('b9000000-0000-4000-8000-000000000002', 'a-west', 'West', 'غرب', true, true, true,
   '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}', 2);

insert into public.staff_roles (user_id, role, branch_id) values
  ('a9000000-0000-4000-8000-000000000002', 'branch_manager', 'b9000000-0000-4000-8000-000000000001');

insert into public.menu_categories (id, name_en, name_ar) values
  ('c9000000-0000-4000-8000-000000000001', 'Area cat', 'فئة');
insert into public.menu_items (id, category_id, name_en, name_ar, price_fils) values
  ('d9000000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 'Broast', 'بروستد', 3000);

-- Map shapes far from Kuwait and far from each other: areas, not pins, decide.
insert into public.delivery_zones (id, branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes, is_active) values
  ('e9000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'East zone', 'شرق',
   st_geomfromtext('MULTIPOLYGON(((40 40,40.1 40,40.1 40.1,40 40.1,40 40)))', 4326), 500, 2000, 30, true),
  ('e9000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000002', 'West zone', 'غرب',
   st_geomfromtext('MULTIPOLYGON(((50 50,50.1 50,50.1 50.1,50 50.1,50 50)))', 4326), 750, 0, 40, true),
  ('e9000000-0000-4000-8000-000000000003', 'b9000000-0000-4000-8000-000000000002', 'Paused zone', 'متوقف',
   st_geomfromtext('MULTIPOLYGON(((60 60,60.1 60,60.1 60.1,60 60.1,60 60)))', 4326), 0, 0, 40, false);

insert into public.delivery_areas (id, zone_id, city_en, city_ar, name_en, name_ar, is_active) values
  ('f9000000-0000-4000-8000-000000000001', 'e9000000-0000-4000-8000-000000000001', 'Testcity', 'مدينة', 'Alpha', 'ألفا', true),
  ('f9000000-0000-4000-8000-000000000002', 'e9000000-0000-4000-8000-000000000002', 'Testcity', 'مدينة', 'Beta', 'بيتا', true),
  -- Listed by both branches: the cheaper East zone wins.
  ('f9000000-0000-4000-8000-000000000003', 'e9000000-0000-4000-8000-000000000001', 'Testcity', 'مدينة', 'Gamma', 'جاما', true),
  ('f9000000-0000-4000-8000-000000000004', 'e9000000-0000-4000-8000-000000000002', 'Testcity', 'مدينة', 'Gamma', 'جاما', true),
  ('f9000000-0000-4000-8000-000000000005', 'e9000000-0000-4000-8000-000000000001', 'Testcity', 'مدينة', 'Hidden', 'مخفي', false),
  ('f9000000-0000-4000-8000-000000000006', 'e9000000-0000-4000-8000-000000000003', 'Testcity', 'مدينة', 'Paused', 'متوقف', true);

-- Visitors
set local role anon;
select is(
  (select count(*)::int from public.list_delivery_areas() where city_en = 'Testcity'), 3,
  'the area list shows each active area once, without hidden areas or paused zones');
select is(
  (select branch_slug from public.list_delivery_areas() where name_en = 'Gamma'), 'a-east',
  'an area listed by two zones goes to the cheaper one');
select is(
  (select branch_slug from public.list_delivery_areas() where name_en = 'Beta'), 'a-west',
  'each area knows the branch that delivers to it');
select is(
  (select count(*)::int from public.delivery_areas where name_en in ('Hidden', 'Paused')), 0,
  'visitors cannot read hidden areas or areas of paused zones');
select throws_ok(
  $$insert into public.delivery_areas (zone_id, city_en, city_ar, name_en, name_ar) values ('e9000000-0000-4000-8000-000000000001', 'x', 'x', 'x', 'x')$$,
  '42501', null, 'visitors cannot add areas');
reset role;

-- A branch manager edits their own zone's areas only.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select public.save_delivery_zone('{"id":"e9000000-0000-4000-8000-000000000001","branch_id":"b9000000-0000-4000-8000-000000000001","name_en":"East zone","name_ar":"شرق","area":{"type":"Polygon","coordinates":[[[40,40],[40.1,40],[40.1,40.1],[40,40.1],[40,40]]]},"fee_fils":500,"min_order_fils":5000,"eta_minutes":30,"areas":[{"city_en":"Testcity","city_ar":"مدينة","name_en":"Alpha","name_ar":"ألفا"},{"city_en":"Testcity","city_ar":"مدينة","name_en":"Delta","name_ar":"دلتا"}]}')$$,
  'a manager saves a zone with its list of areas');
select is(
  (select array_agg(name_en order by sort_order) from public.delivery_areas where zone_id = 'e9000000-0000-4000-8000-000000000001'),
  array['Alpha', 'Delta'], 'saving a zone with areas replaces its list');
select is(
  (select count(*)::int from public.delivery_areas where id = 'f9000000-0000-4000-8000-000000000001'), 1,
  'an area kept in the list keeps its id');
select throws_ok(
  $$insert into public.delivery_areas (zone_id, city_en, city_ar, name_en, name_ar) values ('e9000000-0000-4000-8000-000000000002', 'x', 'x', 'x', 'x')$$,
  '42501', null, 'a manager cannot add areas to another branch''s zone');
reset role;

-- A customer orders delivery by area.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a9000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$select public.place_order('{"client_ref":"99999999-0000-4000-8000-000000000001","branch_id":"b9000000-0000-4000-8000-000000000001","delivery_area_id":"f9000000-0000-4000-8000-000000000002","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"block":"1","street":"2","building":"3"},"items":[{"item_id":"d9000000-0000-4000-8000-000000000001","quantity":1}]}')$$,
  'a delivery order by area needs no map pin');
select is(
  (select branch_id::text from public.orders where client_ref = '99999999-0000-4000-8000-000000000001'),
  'b9000000-0000-4000-8000-000000000002', 'the order goes to the branch that delivers to the area, not the one sent');
select is(
  (select delivery_fee_fils from public.orders where client_ref = '99999999-0000-4000-8000-000000000001'),
  750, 'the fee comes from the area''s zone');
select is(
  (select address ->> 'area' from public.orders where client_ref = '99999999-0000-4000-8000-000000000001'),
  'Beta', 'the listed area name is saved on the address');
select is(
  (select delivery_area_id::text from public.orders where client_ref = '99999999-0000-4000-8000-000000000001'),
  'f9000000-0000-4000-8000-000000000002', 'the order remembers its area');
select throws_ok(
  $$select public.place_order('{"client_ref":"99999999-0000-4000-8000-000000000002","delivery_area_id":"f9000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"block":"1","street":"2","building":"3"},"items":[{"item_id":"d9000000-0000-4000-8000-000000000001","quantity":0}]}')$$,
  'P0001', 'invalid_quantity', 'the usual order checks still apply');
select throws_ok(
  $$select public.place_order('{"client_ref":"99999999-0000-4000-8000-000000000003","delivery_area_id":"f9000000-0000-4000-8000-000000000006","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"block":"1","street":"2","building":"3"},"items":[{"item_id":"d9000000-0000-4000-8000-000000000001","quantity":1}]}')$$,
  'P0001', 'area_unavailable', 'an area of a paused zone cannot be ordered to');
select throws_ok(
  $$select public.place_order('{"client_ref":"99999999-0000-4000-8000-000000000004","delivery_area_id":"f9000000-0000-4000-8000-000000000001","type":"delivery","customer_name":"Ali","customer_phone":"50000000","address":{"block":"1","street":"2","building":"3"},"items":[{"item_id":"d9000000-0000-4000-8000-000000000001","quantity":1}]}')$$,
  'P0001', 'below_minimum', 'the area''s zone minimum order applies');

select * from finish();
rollback;
