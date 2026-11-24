-- save_menu_item(): items with add-ons saved atomically, admins only.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, aud, role) values
  ('70000000-0000-4000-8000-000000000001', 'admin3@t.test', 'authenticated', 'authenticated'),
  ('70000000-0000-4000-8000-000000000002', 'cust3@t.test', 'authenticated', 'authenticated');
insert into public.staff_roles (user_id, role) values ('70000000-0000-4000-8000-000000000001', 'admin');
insert into public.menu_categories (id, name_en, name_ar) values ('80000000-0000-4000-8000-000000000001', 'Cat', 'قسم');

set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select public.save_menu_item('{"category_id":"80000000-0000-4000-8000-000000000001","name_en":"x","name_ar":"x","price_fils":1}')$$,
  '42501', null, 'customers cannot save items');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}';

create temp table t_ids (item uuid);
grant all on t_ids to authenticated;
insert into t_ids select public.save_menu_item('{
  "category_id":"80000000-0000-4000-8000-000000000001","name_en":"Karahi","name_ar":"كراهي","price_fils":3500,
  "modifier_groups":[
    {"name_en":"Size","name_ar":"الحجم","min_select":1,"max_select":1,"options":[
      {"name_en":"Half","name_ar":"نصف","price_delta_fils":0},{"name_en":"Full","name_ar":"كامل","price_delta_fils":2500}]},
    {"name_en":"Extras","name_ar":"إضافات","min_select":0,"max_select":2,"options":[
      {"name_en":"Butter","name_ar":"زبدة","price_delta_fils":250}]}]}');

select is((select count(*)::int from public.modifier_groups where item_id = (select item from t_ids)), 2, 'creates groups');
select is((select count(*)::int from public.modifier_options o join public.modifier_groups g on g.id = o.group_id
  where g.item_id = (select item from t_ids)), 3, 'creates options');

-- Edit: keep Size (rename Full -> Large, drop Half), remove Extras.
select lives_ok(format($$select public.save_menu_item(%L::jsonb)$$, jsonb_build_object(
  'id', (select item from t_ids), 'category_id', '80000000-0000-4000-8000-000000000001',
  'name_en', 'Karahi', 'name_ar', 'كراهي', 'price_fils', 3750,
  'modifier_groups', jsonb_build_array(jsonb_build_object(
    'id', (select id from public.modifier_groups where name_en = 'Size' and item_id = (select item from t_ids)),
    'name_en', 'Size', 'name_ar', 'الحجم', 'min_select', 1, 'max_select', 1,
    'options', jsonb_build_array(jsonb_build_object(
      'id', (select o.id from public.modifier_options o join public.modifier_groups g on g.id = o.group_id
             where g.item_id = (select item from t_ids) and o.name_en = 'Full'),
      'name_en', 'Large', 'name_ar', 'كبير', 'price_delta_fils', 3000)))))),
  'admin can edit the item and its add-ons');

select is((select price_fils from public.menu_items where id = (select item from t_ids)), 3750, 'updates the price');
select is((select count(*)::int from public.modifier_groups where item_id = (select item from t_ids)), 1, 'removes dropped groups');
select results_eq(
  $$select o.name_en, o.price_delta_fils from public.modifier_options o join public.modifier_groups g on g.id = o.group_id
    where g.item_id = (select item from t_ids)$$,
  $$values ('Large'::text, 3000)$$, 'keeps the edited option and removes the others');
select throws_ok(
  $$select public.save_menu_item('{"category_id":"80000000-0000-4000-8000-000000000001","name_en":"Bad","name_ar":"x","price_fils":1,
    "modifier_groups":[{"name_en":"G","name_ar":"G","min_select":3,"max_select":1,"options":[]}]}')$$,
  '23514', null, 'invalid groups roll back the whole save');
reset role;

select * from finish();
rollback;
