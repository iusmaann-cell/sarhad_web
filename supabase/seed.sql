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
