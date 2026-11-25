-- Local development seed. Runs on `supabase db reset`. Never run in production.
--
-- Sample data so the website, app and back office can be tried end to end:
--   * 2 branches (Kuwait City and Salmiya), open all day so test orders always work
--   * 2 delivery zones with cities and areas; each area routes to its branch
--   * a Sarhad Chicken sample menu (6 categories, 18 dishes, add-ons)
--   * test accounts, 2 promo codes and the built-in test payment gateway
-- Dishes, prices and hours are samples: replace them in the back office.

-- -----------------------------------------------------------------------------
-- Branches. "00:00"-"00:00" means open all day (real hours are set in the
-- back office under Branches).
-- -----------------------------------------------------------------------------
insert into public.branches (slug, name_en, name_ar, address_en, address_ar, phone, whatsapp, location, is_active, sort_order, opening_hours)
values
  (
    'main',
    'Sarhad Chicken - Kuwait City',
    'سرحد تشيكن - مدينة الكويت',
    'Fahad Al-Salem Street, Qibla, Kuwait City',
    'شارع فهد السالم، القبلة، مدينة الكويت',
    '+965 2200 0001',
    '+965 5000 0001',
    extensions.st_setsrid(extensions.st_makepoint(47.9774, 29.3759), 4326)::extensions.geography,
    true,
    1,
    '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}'
  ),
  (
    'salmiya',
    'Sarhad Chicken - Salmiya',
    'سرحد تشيكن - السالمية',
    'Salem Al-Mubarak Street, Salmiya',
    'شارع سالم المبارك، السالمية',
    '+965 2200 0002',
    '+965 5000 0002',
    extensions.st_setsrid(extensions.st_makepoint(48.0757, 29.3339), 4326)::extensions.geography,
    true,
    2,
    '{"sat":[{"open":"00:00","close":"00:00"}],"sun":[{"open":"00:00","close":"00:00"}],"mon":[{"open":"00:00","close":"00:00"}],"tue":[{"open":"00:00","close":"00:00"}],"wed":[{"open":"00:00","close":"00:00"}],"thu":[{"open":"00:00","close":"00:00"}],"fri":[{"open":"00:00","close":"00:00"}]}'
  );

insert into public.settings (key, value, is_public) values
  ('restaurant.name', '{"en":"Sarhad Chicken","ar":"سرحد تشيكن"}', true),
  ('restaurant.currency', '"KWD"', true),
  ('restaurant.default_locale', '"ar"', true),
  ('restaurant.country', '"KW"', true),
  ('payments.cash_on_delivery', 'true', true);

-- -----------------------------------------------------------------------------
-- Test accounts (password for all: Sarhad1234)
--   owner@sarhad.test     owner (everything, all branches)
--   manager@sarhad.test   branch manager, Kuwait City
--   salmiya@sarhad.test   branch manager, Salmiya
--   kitchen@sarhad.test   staff, Kuwait City (orders board only)
--   customer@sarhad.test  customer
-- -----------------------------------------------------------------------------
do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-000000000001';
  v_manager uuid := '00000000-0000-4000-8000-000000000002';
  v_customer uuid := '00000000-0000-4000-8000-000000000003';
  v_salmiya uuid := '00000000-0000-4000-8000-000000000004';
  v_kitchen uuid := '00000000-0000-4000-8000-000000000005';
  v_user record;
begin
  for v_user in
    select * from (values
      (v_owner, 'owner@sarhad.test', 'Sarhad Owner'),
      (v_manager, 'manager@sarhad.test', 'Kuwait City Manager'),
      (v_customer, 'customer@sarhad.test', 'Test Customer'),
      (v_salmiya, 'salmiya@sarhad.test', 'Salmiya Manager'),
      (v_kitchen, 'kitchen@sarhad.test', 'Kitchen Staff')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_user.id, 'authenticated', 'authenticated',
      v_user.email, extensions.crypt('Sarhad1234', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_user.full_name, 'preferred_locale', 'en'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (
      gen_random_uuid(), v_user.id, v_user.id::text,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  insert into public.staff_roles (user_id, role) values (v_owner, 'owner');
  insert into public.staff_roles (user_id, role, branch_id)
  select v_manager, 'branch_manager', id from public.branches where slug = 'main';
  insert into public.staff_roles (user_id, role, branch_id)
  select v_salmiya, 'branch_manager', id from public.branches where slug = 'salmiya';
  insert into public.staff_roles (user_id, role, branch_id)
  select v_kitchen, 'staff', id from public.branches where slug = 'main';
end $$;

-- -----------------------------------------------------------------------------
-- Sample menu (placeholder dishes and prices until the real menu is entered).
-- -----------------------------------------------------------------------------
do $$
declare
  c_chicken uuid; c_meals uuid; c_sandwiches uuid; c_strips uuid; c_sides uuid; c_drinks uuid;
  i uuid; g uuid;
begin
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Fried Chicken', 'دجاج مقلي', 1) returning id into c_chicken;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Meals', 'الوجبات', 2) returning id into c_meals;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Sandwiches', 'السندويشات', 3) returning id into c_sandwiches;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Strips and Wings', 'ستربس وأجنحة', 4) returning id into c_strips;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Sides', 'الأطباق الجانبية', 5) returning id into c_sides;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Drinks', 'المشروبات', 6) returning id into c_drinks;

  -- Fried Chicken -------------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, is_featured, sort_order)
  values (c_chicken, 'Crispy Fried Chicken', 'دجاج مقلي مقرمش',
    'Fresh chicken, marinated overnight and fried golden and crispy',
    'دجاج طازج متبل طوال الليل ومقلي حتى يصبح ذهبياً ومقرمشاً', 1250, 520, true, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Pieces', 'عدد القطع', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, '2 pieces', 'قطعتان', 0, 1), (g, '4 pieces', '4 قطع', 1000, 2), (g, '8 pieces', '8 قطع', 3000, 3);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Flavour', 'النكهة', 1, 1, 2) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Original', 'عادي', 0, 1), (g, 'Spicy', 'حار', 0, 2);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Extras', 'إضافات', 0, 3, 3) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Garlic sauce', 'صوص الثوم', 100, 1), (g, 'Extra bun', 'خبز إضافي', 100, 2), (g, 'Coleslaw', 'كول سلو', 250, 3);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, is_featured, sort_order)
  values (c_chicken, 'Broasted Chicken', 'دجاج بروستد',
    'Pressure-fried chicken with fries, garlic sauce and bread',
    'دجاج بروستد مع بطاطس وصوص الثوم والخبز', 2000, 980, true, 2)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Size', 'الحجم', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Quarter', 'ربع', 0, 1), (g, 'Half', 'نصف', 1000, 2), (g, 'Whole', 'كامل', 3250, 3);

  -- Meals ---------------------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, is_featured, sort_order)
  values (c_meals, 'Sarhad Meal', 'وجبة سرحد',
    '3 pieces of chicken, fries, coleslaw, bun and a soft drink',
    '3 قطع دجاج مع بطاطس وكول سلو وخبز ومشروب غازي', 2250, 1150, true, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Flavour', 'النكهة', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Original', 'عادي', 0, 1), (g, 'Spicy', 'حار', 0, 2), (g, 'Mix', 'مشكل', 0, 3);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Drink', 'المشروب', 1, 1, 2) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Pepsi', 'بيبسي', 0, 1), (g, '7Up', 'سفن أب', 0, 2), (g, 'Water', 'ماء', 0, 3), (g, 'Fresh lemon mint', 'ليمون نعناع طازج', 350, 4);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, is_featured, sort_order)
  values (c_meals, 'Family Bucket', 'سطل العائلة',
    '12 pieces of chicken, 2 large fries, 2 coleslaw, 4 buns and a 1.25 L drink',
    '12 قطعة دجاج، 2 بطاطس كبير، 2 كول سلو، 4 خبز ومشروب 1.25 لتر', 7500, 4600, true, 2)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Flavour', 'النكهة', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Original', 'عادي', 0, 1), (g, 'Spicy', 'حار', 0, 2), (g, 'Half and half', 'نصف ونصف', 0, 3);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_meals, 'Strips Meal', 'وجبة ستربس',
    '4 crispy strips, fries, garlic sauce and a soft drink',
    '4 قطع ستربس مقرمشة مع بطاطس وصوص الثوم ومشروب غازي', 2000, 990, 3);

  -- Sandwiches ----------------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, is_featured, sort_order)
  values (c_sandwiches, 'Spicy Crispy Burger', 'برجر الدجاج الحار',
    'Spicy crispy fillet, lettuce and Sarhad sauce in a toasted bun',
    'فيليه دجاج حار ومقرمش مع خس وصوص سرحد في خبز محمص', 1250, 610, true, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Make it a meal', 'اجعلها وجبة', 0, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Add fries and a drink', 'أضف بطاطس ومشروب', 750, 1);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Extras', 'إضافات', 0, 2, 2) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Cheese slice', 'شريحة جبن', 150, 1), (g, 'Jalapeños', 'هالابينو', 100, 2);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_sandwiches, 'Classic Chicken Burger', 'برجر الدجاج الكلاسيكي',
    'Crispy fillet, lettuce, pickles and mayonnaise',
    'فيليه دجاج مقرمش مع خس ومخلل ومايونيز', 1100, 560, 2)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Make it a meal', 'اجعلها وجبة', 0, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Add fries and a drink', 'أضف بطاطس ومشروب', 750, 1);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_sandwiches, 'Chicken Wrap', 'راب الدجاج',
    'Crispy strips, garlic sauce, fries and pickles rolled in tortilla',
    'ستربس مقرمشة مع صوص الثوم والبطاطس والمخلل في خبز التورتيلا', 1000, 540, 3);

  -- Strips and Wings ----------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_strips, 'Chicken Strips', 'ستربس الدجاج',
    'Boneless crispy chicken strips with a dip of your choice',
    'قطع دجاج مقرمشة بدون عظم مع صوص من اختيارك', 1250, 450, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Pieces', 'عدد القطع', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, '3 pieces', '3 قطع', 0, 1), (g, '5 pieces', '5 قطع', 750, 2), (g, '10 pieces', '10 قطع', 2250, 3);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Dip', 'الصوص', 1, 1, 2) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Garlic', 'ثوم', 0, 1), (g, 'Honey mustard', 'عسل وخردل', 0, 2), (g, 'Spicy mayo', 'مايونيز حار', 0, 3), (g, 'BBQ', 'باربكيو', 0, 4);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_strips, 'Hot Wings', 'أجنحة حارة',
    '6 crispy wings tossed in Sarhad hot sauce',
    '6 أجنحة مقرمشة بصوص سرحد الحار', 1500, 620, 2);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_strips, 'Popcorn Chicken', 'بوب كورن دجاج',
    'Bite-size crispy chicken pieces',
    'قطع دجاج صغيرة ومقرمشة', 900, 380, 3);

  -- Sides ---------------------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order)
  values (c_sides, 'French Fries', 'بطاطس مقلية', 'Golden fries with Sarhad seasoning', 'بطاطس ذهبية بتتبيلة سرحد', 500, 320, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Size', 'الحجم', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Regular', 'عادي', 0, 1), (g, 'Large', 'كبير', 250, 2);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, calories, sort_order) values
    (c_sides, 'Cheese Fries', 'بطاطس بالجبن', 'Fries topped with melted cheese sauce and jalapeños', 'بطاطس مع صوص الجبن الذائب والهالابينو', 900, 540, 2),
    (c_sides, 'Coleslaw', 'كول سلو', 'Fresh and creamy', 'طازج وكريمي', 350, 150, 3),
    (c_sides, 'Garlic Sauce', 'صوص الثوم', 'Our signature garlic sauce', 'صوص الثوم الخاص بسرحد', 100, 90, 4);

  -- Drinks --------------------------------------------------------------------
  insert into public.menu_items (category_id, name_en, name_ar, price_fils, sort_order)
  values (c_drinks, 'Soft Drink', 'مشروب غازي', 300, 1)
  returning id into i;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i, 'Choose', 'اختر', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Pepsi', 'بيبسي', 0, 1), (g, '7Up', 'سفن أب', 0, 2), (g, 'Mirinda', 'ميرندا', 0, 3), (g, 'Diet Pepsi', 'بيبسي دايت', 0, 4);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, sort_order) values
    (c_drinks, 'Fresh Lemon Mint', 'ليمون نعناع طازج', 'Freshly squeezed', 'معصور طازج', 750, 2),
    (c_drinks, 'Water', 'ماء', null, null, 150, 3);
end $$;

-- Per-branch examples: Salmiya has run out of Cheese Fries and sells Hot Wings
-- for a little more. Change these in the back office under Availability.
insert into public.branch_menu_items (branch_id, item_id, is_available, price_override_fils)
select b.id, m.id, x.available, x.price
from (values ('Cheese Fries', false, null::integer), ('Hot Wings', true, 1650)) as x(item, available, price)
join public.menu_items m on m.name_en = x.item
cross join public.branches b
where b.slug = 'salmiya';

-- -----------------------------------------------------------------------------
-- Delivery zones (rough shapes, redraw in the back office) and the cities and
-- areas customers pick from. An order for an area goes to its zone's branch.
-- -----------------------------------------------------------------------------
insert into public.delivery_zones (branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes, color, sort_order)
select b.id, z.name_en, z.name_ar, extensions.st_geomfromtext(z.wkt, 4326), z.fee, z.min_order, z.eta, z.color, z.sort_order
from (values
  ('main', 'Kuwait City', 'مدينة الكويت', 'MULTIPOLYGON(((47.92 29.33,48.01 29.33,48.01 29.40,47.92 29.40,47.92 29.33)))', 500, 3000, 35, '#F84511', 1),
  ('salmiya', 'Hawalli and Salmiya', 'حولي والسالمية', 'MULTIPOLYGON(((48.01 29.29,48.11 29.29,48.11 29.36,48.01 29.36,48.01 29.29)))', 750, 4000, 45, '#FF8B00', 2)
) as z(branch_slug, name_en, name_ar, wkt, fee, min_order, eta, color, sort_order)
join public.branches b on b.slug = z.branch_slug;

insert into public.delivery_areas (zone_id, city_en, city_ar, name_en, name_ar, sort_order)
select z.id, a.city_en, a.city_ar, a.name_en, a.name_ar, a.sort_order
from public.delivery_zones z
join (values
  ('Kuwait City', 'Capital', 'العاصمة', 'Sharq', 'شرق', 1),
  ('Kuwait City', 'Capital', 'العاصمة', 'Qibla', 'القبلة', 2),
  ('Kuwait City', 'Capital', 'العاصمة', 'Dasman', 'دسمان', 3),
  ('Kuwait City', 'Capital', 'العاصمة', 'Mirqab', 'المرقاب', 4),
  ('Kuwait City', 'Capital', 'العاصمة', 'Bneid Al-Gar', 'بنيد القار', 5),
  ('Hawalli and Salmiya', 'Hawalli', 'حولي', 'Hawalli', 'حولي', 1),
  ('Hawalli and Salmiya', 'Hawalli', 'حولي', 'Salmiya', 'السالمية', 2),
  ('Hawalli and Salmiya', 'Hawalli', 'حولي', 'Jabriya', 'الجابرية', 3),
  ('Hawalli and Salmiya', 'Hawalli', 'حولي', 'Rumaithiya', 'الرميثية', 4),
  ('Hawalli and Salmiya', 'Hawalli', 'حولي', 'Salwa', 'سلوى', 5)
) as a(zone_name, city_en, city_ar, name_en, name_ar, sort_order) on a.zone_name = z.name_en;

-- -----------------------------------------------------------------------------
-- Promo codes and the built-in test payment gateway (no real money; it only
-- shows on the website when not running in production mode).
-- -----------------------------------------------------------------------------
insert into public.promo_codes (code, name_en, name_ar, kind, value, min_subtotal_fils, max_discount_fils, max_uses_per_customer) values
  ('WELCOME10', '10% off your order', 'خصم 10% على طلبك', 'percent', 10, 2000, 1500, 5),
  ('FREEDELIVERY', 'Free delivery', 'توصيل مجاني', 'free_delivery', 0, 3000, null, 5);

insert into public.payment_providers (kind, name_en, name_ar, is_active, is_live, sort_order)
values ('test', 'Test payment (no real money)', 'دفع تجريبي (بدون مبالغ حقيقية)', true, false, 1);
