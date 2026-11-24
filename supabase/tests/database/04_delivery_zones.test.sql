-- Delivery zone tests: who can see and edit zones, and the point lookup.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

insert into auth.users (id, email, aud, role) values
  ('70000000-0000-4000-8000-000000000001', 'zadmin@t.test', 'authenticated', 'authenticated'),
  ('70000000-0000-4000-8000-000000000002', 'zmgr@t.test', 'authenticated', 'authenticated'),
  ('70000000-0000-4000-8000-000000000003', 'zstaff@t.test', 'authenticated', 'authenticated'),
  ('70000000-0000-4000-8000-000000000004', 'zcust@t.test', 'authenticated', 'authenticated');

insert into public.branches (id, slug, name_en, name_ar, is_active, accepts_delivery, sort_order) values
  ('80000000-0000-4000-8000-000000000001', 'z-one', 'Zone One', 'واحد', true, true, 1),
  ('80000000-0000-4000-8000-000000000002', 'z-two', 'Zone Two', 'اثنان', true, true, 2),
  ('80000000-0000-4000-8000-000000000003', 'z-pickup', 'Pickup only', 'استلام', true, false, 3);

insert into public.staff_roles (user_id, role, branch_id) values
  ('70000000-0000-4000-8000-000000000001', 'admin', null),
  ('70000000-0000-4000-8000-000000000002', 'branch_manager', '80000000-0000-4000-8000-000000000001'),
  ('70000000-0000-4000-8000-000000000003', 'staff', '80000000-0000-4000-8000-000000000001');

-- Far from Kuwait (around 10N 10E) so seed data never overlaps the fixtures.
-- Branch one: small square, cheap. Branch two: big square around it, dearer.
insert into public.delivery_zones (id, branch_id, name_en, name_ar, area, fee_fils, eta_minutes, is_active) values
  ('90000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', 'Inner', 'داخلي',
    st_geomfromtext('MULTIPOLYGON(((10 10,10.1 10,10.1 10.1,10 10.1,10 10)))', 4326), 500, 30, true),
  ('90000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000002', 'Outer', 'خارجي',
    st_geomfromtext('MULTIPOLYGON(((9.9 9.9,10.2 9.9,10.2 10.2,9.9 10.2,9.9 9.9)))', 4326), 1000, 45, true),
  ('90000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000001', 'Paused', 'متوقف',
    st_geomfromtext('MULTIPOLYGON(((20 20,20.1 20,20.1 20.1,20 20.1,20 20)))', 4326), 0, 30, false),
  ('90000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000003', 'Pickup zone', 'استلام',
    st_geomfromtext('MULTIPOLYGON(((30 30,30.1 30,30.1 30.1,30 30.1,30 30)))', 4326), 0, 30, true);

-- Customers (not signed in)
set local role anon;
select is(
  (select count(*)::int from public.delivery_zones where id::text like '90000000-%'), 3,
  'anyone sees active zones but not paused ones');
select is(
  (select area_geojson ->> 'type' from public.delivery_zones where id = '90000000-0000-4000-8000-000000000001'),
  'MultiPolygon', 'zones expose their area as GeoJSON');
select throws_ok(
  $$insert into public.delivery_zones (branch_id, name_en, name_ar, area) values ('80000000-0000-4000-8000-000000000001', 'x', 'x', 'SRID=4326;MULTIPOLYGON(((0 0,1 0,1 1,0 0)))')$$,
  '42501', null, 'anonymous users cannot add zones');
select is(
  (select branch_slug from public.find_delivery_zone(10.05, 10.05) limit 1), 'z-one',
  'lookup picks the cheapest zone that covers the point');
select is(
  (select count(*)::int from public.find_delivery_zone(10.05, 10.05)), 2,
  'lookup returns every covering zone');
select is(
  (select branch_slug from public.find_delivery_zone(9.95, 9.95) limit 1), 'z-two',
  'a point only in the outer zone gets the outer branch');
select is_empty(
  $$select * from public.find_delivery_zone(0, 0)$$,
  'no zone outside every area');
select is_empty(
  $$select * from public.find_delivery_zone(20.05, 20.05)$$,
  'paused zones do not deliver');
select is_empty(
  $$select * from public.find_delivery_zone(30.05, 30.05)$$,
  'branches without delivery do not deliver');
reset role;

-- Branch staff sees paused zones of their branch but cannot edit
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.delivery_zones where id = '90000000-0000-4000-8000-000000000003'), 1,
  'staff sees paused zones of their branch');
select throws_ok(
  $$select public.save_delivery_zone('{"branch_id":"80000000-0000-4000-8000-000000000001","name_en":"S","name_ar":"S","area":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}')$$,
  '42501', null, 'staff cannot save zones');
reset role;

-- Branch manager edits zones of their own branch only
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$select public.save_delivery_zone('{"id":"90000000-0000-4000-8000-000000000001","branch_id":"80000000-0000-4000-8000-000000000001","name_en":"Inner","name_ar":"داخلي","fee_fils":750,"eta_minutes":25,"area":{"type":"Polygon","coordinates":[[[10,10],[10.1,10],[10.1,10.1],[10,10.1],[10,10]]]}}')$$,
  'manager can edit a zone of their branch');
select throws_ok(
  $$select public.save_delivery_zone('{"branch_id":"80000000-0000-4000-8000-000000000002","name_en":"M","name_ar":"M","area":{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,0]]]}}')$$,
  '42501', null, 'manager cannot add zones to another branch');
select throws_ok(
  $$select public.save_delivery_zone('{"branch_id":"80000000-0000-4000-8000-000000000001","name_en":"L","name_ar":"L","area":{"type":"LineString","coordinates":[[0,0],[1,1]]}}')$$,
  '22023', null, 'a line is not a delivery area');
select lives_ok(
  $$select public.save_delivery_zone('{"branch_id":"80000000-0000-4000-8000-000000000001","name_en":"Bow","name_ar":"Bow","area":{"type":"Polygon","coordinates":[[[40,40],[40.1,40.1],[40.1,40],[40,40.1],[40,40]]]}}')$$,
  'a self-crossing shape can be saved');
select is(
  (select st_isvalid(area) and geometrytype(area) = 'MULTIPOLYGON' from public.delivery_zones where name_en = 'Bow'),
  true, 'a self-crossing shape is repaired into a valid area');
select is_empty(
  $$delete from public.delivery_zones where id = '90000000-0000-4000-8000-000000000002' returning id$$,
  'manager cannot delete another branch''s zone');
reset role;

-- Admin deletes any zone
set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}';
select isnt_empty(
  $$delete from public.delivery_zones where id = '90000000-0000-4000-8000-000000000002' returning id$$,
  'admin can delete any zone');
reset role;

select ok(
  exists (select 1 from public.audit_log where entity = 'delivery_zones'
          and entity_id = '90000000-0000-4000-8000-000000000001' and action = 'update'),
  'zone changes are audited');

select * from finish();
rollback;
