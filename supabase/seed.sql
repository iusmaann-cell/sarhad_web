-- Local development seed. Runs on `supabase db reset`. Never run in production.

insert into public.branches (slug, name_en, name_ar, address_en, address_ar, phone, location, is_active, opening_hours)
values (
  'main',
  'Sarhad - Main Branch',
  'سرحد - الفرع الرئيسي',
  'Kuwait City, Kuwait',
  'مدينة الكويت، الكويت',
  '+965 0000 0000',
  extensions.st_setsrid(extensions.st_makepoint(47.9774, 29.3759), 4326)::extensions.geography,
  true,
  '{"sat":[{"open":"11:00","close":"23:30"}],"sun":[{"open":"11:00","close":"23:30"}],"mon":[{"open":"11:00","close":"23:30"}],"tue":[{"open":"11:00","close":"23:30"}],"wed":[{"open":"11:00","close":"23:30"}],"thu":[{"open":"11:00","close":"00:30"}],"fri":[{"open":"13:00","close":"00:30"}]}'
);

insert into public.settings (key, value, is_public) values
  ('restaurant.name', '{"en":"Sarhad","ar":"سرحد"}', true),
  ('restaurant.currency', '"KWD"', true),
  ('restaurant.default_locale', '"ar"', true),
  ('restaurant.country', '"KW"', true),
  ('payments.cash_on_delivery', 'true', true);

-- Dev accounts (password for all: Sarhad1234)
--   owner@sarhad.test    owner
--   manager@sarhad.test  branch manager of "main"
--   customer@sarhad.test customer
do $$
declare
  v_owner uuid := '00000000-0000-4000-8000-000000000001';
  v_manager uuid := '00000000-0000-4000-8000-000000000002';
  v_customer uuid := '00000000-0000-4000-8000-000000000003';
  v_user record;
begin
  for v_user in
    select * from (values
      (v_owner, 'owner@sarhad.test', 'Sarhad Owner'),
      (v_manager, 'manager@sarhad.test', 'Branch Manager'),
      (v_customer, 'customer@sarhad.test', 'Test Customer')
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
end $$;

-- Sample menu (placeholder dishes and prices until the real menu is entered).
do $$
declare
  c_grill uuid; c_karahi uuid; c_rice uuid; c_bread uuid; c_drinks uuid;
  i_karahi uuid; i_tea uuid; g uuid;
begin
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Grills', 'المشاوي', 1) returning id into c_grill;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Karahi', 'كراهي', 2) returning id into c_karahi;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Rice', 'الأرز', 3) returning id into c_rice;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Breads', 'الخبز', 4) returning id into c_bread;
  insert into public.menu_categories (name_en, name_ar, sort_order) values ('Drinks', 'المشروبات', 5) returning id into c_drinks;

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, is_featured, sort_order) values
    (c_grill, 'Chapli Kebab', 'كباب تشبلي', 'Peshawari minced beef patties with spices', 'أقراص لحم مفروم على الطريقة البيشاورية مع البهارات', 2250, true, 1),
    (c_grill, 'Seekh Kebab', 'سيخ كباب', 'Minced lamb skewers from the charcoal grill', 'أسياخ لحم غنم مفروم على الفحم', 2500, false, 2),
    (c_grill, 'Chicken Tikka', 'تكا دجاج', 'Marinated chicken pieces, charcoal grilled', 'قطع دجاج متبلة مشوية على الفحم', 2000, false, 3),
    (c_rice, 'Kabuli Pulao', 'كابلي بلاو', 'Rice with lamb, carrots and raisins', 'أرز مع لحم غنم وجزر وزبيب', 3000, true, 1),
    (c_bread, 'Naan', 'خبز نان', 'Fresh from the tandoor', 'طازج من التنور', 250, false, 1),
    (c_bread, 'Roghni Naan', 'نان روغني', 'Soft naan with sesame', 'نان طري بالسمسم', 400, false, 2);

  insert into public.menu_items (category_id, name_en, name_ar, description_en, description_ar, price_fils, is_featured, sort_order)
  values (c_karahi, 'Chicken Karahi', 'كراهي دجاج', 'Chicken cooked in a wok with tomatoes and green chilli', 'دجاج مطبوخ بالطماطم والفلفل الأخضر', 3500, true, 1)
  returning id into i_karahi;
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i_karahi, 'Size', 'الحجم', 1, 1, 1) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Half', 'نصف', 0, 1), (g, 'Full', 'كامل', 2500, 2);
  insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
  values (i_karahi, 'Extras', 'إضافات', 0, 2, 2) returning id into g;
  insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order) values
    (g, 'Extra butter', 'زبدة إضافية', 250, 1), (g, 'Extra naan', 'نان إضافي', 250, 2);

  insert into public.menu_items (category_id, name_en, name_ar, price_fils, sort_order)
  values (c_drinks, 'Kahwa (Green Tea)', 'قهوة خضراء (كهوة)', 500, 1) returning id into i_tea;
  insert into public.menu_items (category_id, name_en, name_ar, price_fils, sort_order)
  values (c_drinks, 'Doodh Patti Tea', 'شاي بالحليب', 400, 2);
end $$;
