-- =============================================================================
-- Sarhad Phase 2: Menu and branches
-- One menu for the whole restaurant. Each branch can switch items off (sold out
-- or not offered there) and can override the price. Money is integer fils
-- (1 KWD = 1000 fils).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  description_en text,
  description_ar text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger menu_categories_set_updated_at
before update on public.menu_categories
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Items
-- -----------------------------------------------------------------------------

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  description_en text,
  description_ar text,
  price_fils integer not null check (price_fils >= 0),
  -- Path inside the "menu-images" storage bucket, or a full https URL.
  image_path text,
  calories integer check (calories is null or calories >= 0),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_category_idx on public.menu_items (category_id, sort_order);

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Add-ons ("modifiers"): groups of options attached to an item,
-- e.g. "Size" (choose 1, required) or "Extras" (choose up to 3).
-- -----------------------------------------------------------------------------

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= 1),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint modifier_groups_min_max check (min_select <= max_select)
);

create index modifier_groups_item_idx on public.modifier_groups (item_id, sort_order);

create table public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups (id) on delete cascade,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  price_delta_fils integer not null default 0 check (price_delta_fils >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index modifier_options_group_idx on public.modifier_options (group_id, sort_order);

-- -----------------------------------------------------------------------------
-- Per-branch overrides. No row = available at the base price.
-- -----------------------------------------------------------------------------

create table public.branch_menu_items (
  branch_id uuid not null references public.branches (id) on delete cascade,
  item_id uuid not null references public.menu_items (id) on delete cascade,
  is_available boolean not null default true,
  price_override_fils integer check (price_override_fils is null or price_override_fils >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (branch_id, item_id)
);

create index branch_menu_items_item_idx on public.branch_menu_items (item_id);

create trigger branch_menu_items_set_updated_at
before update on public.branch_menu_items
for each row execute function public.set_updated_at();

-- Audit menu changes that affect what customers pay or see.
create trigger menu_items_audit
after insert or update or delete on public.menu_items
for each row execute function public.write_audit_log();

create trigger menu_categories_audit
after insert or update or delete on public.menu_categories
for each row execute function public.write_audit_log();

-- branch_menu_items has a composite key, so audit it with its own function.
create or replace function public.write_branch_menu_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.branch_menu_items := case when tg_op = 'DELETE' then old else new end;
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    'branch_menu_items',
    v_row.branch_id::text || ':' || v_row.item_id::text,
    to_jsonb(v_row)
  );
  return null;
end;
$$;

create trigger branch_menu_items_audit
after insert or update or delete on public.branch_menu_items
for each row execute function public.write_branch_menu_audit();

revoke execute on function public.write_branch_menu_audit() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Customers read active menu data. Admins edit the menu. Branch managers and
-- staff set availability (and managers prices) for their own branch.
-- -----------------------------------------------------------------------------

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifier_options enable row level security;
alter table public.branch_menu_items enable row level security;

create policy "Active categories are public"
on public.menu_categories for select to anon, authenticated
using (is_active or public.is_staff());

create policy "Admins manage categories"
on public.menu_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Active items are public"
on public.menu_items for select to anon, authenticated
using (is_active or public.is_staff());

create policy "Admins manage items"
on public.menu_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Modifier groups are public"
on public.modifier_groups for select to anon, authenticated
using (true);

create policy "Admins manage modifier groups"
on public.modifier_groups for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Active modifier options are public"
on public.modifier_options for select to anon, authenticated
using (is_active or public.is_staff());

create policy "Admins manage modifier options"
on public.modifier_options for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Branch availability is public"
on public.branch_menu_items for select to anon, authenticated
using (true);

create policy "Branch staff set availability"
on public.branch_menu_items for insert to authenticated
with check (public.can_access_branch(branch_id));

create policy "Branch staff update availability"
on public.branch_menu_items for update to authenticated
using (public.can_access_branch(branch_id))
with check (public.can_access_branch(branch_id));

create policy "Managers remove overrides"
on public.branch_menu_items for delete to authenticated
using (public.can_manage_branch(branch_id));

-- Only managers and admins may change prices. Plain staff may only toggle
-- availability, so block price changes from them in a trigger (RLS cannot
-- compare old and new values per column).
create or replace function public.guard_branch_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.price_override_fils is distinct from
         (case when tg_op = 'UPDATE' then old.price_override_fils else null end)
     and not public.can_manage_branch(new.branch_id) then
    raise exception 'Only a branch manager can change prices' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger branch_menu_items_guard_price
before insert or update on public.branch_menu_items
for each row execute function public.guard_branch_price();

revoke execute on function public.guard_branch_price() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Menu for one branch, as the website and app show it.
-- Effective price = branch override or base price. Inactive items and
-- categories are left out; items switched off at the branch are kept but
-- marked unavailable ("sold out").
-- -----------------------------------------------------------------------------

create or replace function public.get_branch_menu(p_branch_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name_en', c.name_en,
      'name_ar', c.name_ar,
      'description_en', c.description_en,
      'description_ar', c.description_ar,
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'name_en', i.name_en,
            'name_ar', i.name_ar,
            'description_en', i.description_en,
            'description_ar', i.description_ar,
            'image_path', i.image_path,
            'calories', i.calories,
            'is_featured', i.is_featured,
            'price_fils', coalesce(bmi.price_override_fils, i.price_fils),
            'is_available', coalesce(bmi.is_available, true),
            'modifier_groups', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', g.id,
                  'name_en', g.name_en,
                  'name_ar', g.name_ar,
                  'min_select', g.min_select,
                  'max_select', g.max_select,
                  'options', coalesce((
                    select jsonb_agg(
                      jsonb_build_object(
                        'id', o.id,
                        'name_en', o.name_en,
                        'name_ar', o.name_ar,
                        'price_delta_fils', o.price_delta_fils
                      ) order by o.sort_order, o.name_en
                    )
                    from public.modifier_options o
                    where o.group_id = g.id and o.is_active
                  ), '[]'::jsonb)
                ) order by g.sort_order, g.name_en
              )
              from public.modifier_groups g
              where g.item_id = i.id
            ), '[]'::jsonb)
          ) order by i.sort_order, i.name_en
        )
        from public.menu_items i
        left join public.branch_menu_items bmi
          on bmi.item_id = i.id and bmi.branch_id = p_branch_id
        where i.category_id = c.id and i.is_active
      ), '[]'::jsonb)
    ) order by c.sort_order, c.name_en
  ), '[]'::jsonb)
    from public.menu_categories c
    where c.is_active
      and exists (select 1 from public.branches b where b.id = p_branch_id and (b.is_active or public.can_access_branch(b.id)))
      and exists (select 1 from public.menu_items i where i.category_id = c.id and i.is_active);
$$;

grant execute on function public.get_branch_menu(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Menu photos: public bucket, admins upload. Storage only exists when the
-- Supabase storage service is running, so skip this block otherwise (for
-- example in the plain database used by CI).
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found, skipping menu-images bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('menu-images', 'menu-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy "Admins upload menu images" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'menu-images' and public.is_admin())
  $p$;
  execute $p$
    create policy "Admins update menu images" on storage.objects
    for update to authenticated
    using (bucket_id = 'menu-images' and public.is_admin())
  $p$;
  execute $p$
    create policy "Admins delete menu images" on storage.objects
    for delete to authenticated
    using (bucket_id = 'menu-images' and public.is_admin())
  $p$;
end $$;

-- -----------------------------------------------------------------------------
-- Branch map pin as plain numbers for the apps. Write the pin by sending
-- location = 'SRID=4326;POINT(<lng> <lat>)'.
-- -----------------------------------------------------------------------------

alter table public.branches
  add column latitude double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column longitude double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored;

-- -----------------------------------------------------------------------------
-- Save an item with its add-on groups and options in one transaction.
-- p_item: { id?, category_id, name_en, name_ar, description_en, description_ar,
--           price_fils, calories, image_path, sort_order, is_active, is_featured,
--           modifier_groups: [{ id?, name_en, name_ar, min_select, max_select,
--                               options: [{ id?, name_en, name_ar, price_delta_fils }] }] }
-- Groups and options missing from the payload are deleted. Runs with the
-- caller's rights, so Row Level Security still requires an admin.
-- -----------------------------------------------------------------------------

create or replace function public.save_menu_item(p_item jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item_id uuid := nullif(p_item ->> 'id', '')::uuid;
  v_group jsonb;
  v_group_id uuid;
  v_option jsonb;
  v_option_id uuid;
  v_keep_groups uuid[] := '{}';
  v_keep_options uuid[];
  v_g_order integer := 0;
  v_o_order integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_item_id is null then
    insert into public.menu_items (
      category_id, name_en, name_ar, description_en, description_ar, price_fils,
      calories, image_path, sort_order, is_active, is_featured
    ) values (
      (p_item ->> 'category_id')::uuid, p_item ->> 'name_en', p_item ->> 'name_ar',
      p_item ->> 'description_en', p_item ->> 'description_ar', (p_item ->> 'price_fils')::integer,
      (p_item ->> 'calories')::integer, p_item ->> 'image_path',
      coalesce((p_item ->> 'sort_order')::integer, 0),
      coalesce((p_item ->> 'is_active')::boolean, true),
      coalesce((p_item ->> 'is_featured')::boolean, false)
    ) returning id into v_item_id;
  else
    update public.menu_items set
      category_id = (p_item ->> 'category_id')::uuid,
      name_en = p_item ->> 'name_en',
      name_ar = p_item ->> 'name_ar',
      description_en = p_item ->> 'description_en',
      description_ar = p_item ->> 'description_ar',
      price_fils = (p_item ->> 'price_fils')::integer,
      calories = (p_item ->> 'calories')::integer,
      image_path = p_item ->> 'image_path',
      sort_order = coalesce((p_item ->> 'sort_order')::integer, 0),
      is_active = coalesce((p_item ->> 'is_active')::boolean, true),
      is_featured = coalesce((p_item ->> 'is_featured')::boolean, false)
    where id = v_item_id;
    if not found then
      raise exception 'Item not found' using errcode = 'P0002';
    end if;
  end if;

  for v_group in select * from jsonb_array_elements(coalesce(p_item -> 'modifier_groups', '[]'::jsonb))
  loop
    v_g_order := v_g_order + 1;
    v_group_id := nullif(v_group ->> 'id', '')::uuid;
    if v_group_id is not null and exists (
      select 1 from public.modifier_groups where id = v_group_id and item_id = v_item_id
    ) then
      update public.modifier_groups set
        name_en = v_group ->> 'name_en', name_ar = v_group ->> 'name_ar',
        min_select = (v_group ->> 'min_select')::integer,
        max_select = (v_group ->> 'max_select')::integer,
        sort_order = v_g_order
      where id = v_group_id;
    else
      insert into public.modifier_groups (item_id, name_en, name_ar, min_select, max_select, sort_order)
      values (v_item_id, v_group ->> 'name_en', v_group ->> 'name_ar',
        (v_group ->> 'min_select')::integer, (v_group ->> 'max_select')::integer, v_g_order)
      returning id into v_group_id;
    end if;
    v_keep_groups := v_keep_groups || v_group_id;

    v_keep_options := '{}';
    v_o_order := 0;
    for v_option in select * from jsonb_array_elements(coalesce(v_group -> 'options', '[]'::jsonb))
    loop
      v_o_order := v_o_order + 1;
      if nullif(v_option ->> 'id', '') is not null and exists (
        select 1 from public.modifier_options where id = (v_option ->> 'id')::uuid and group_id = v_group_id
      ) then
        update public.modifier_options set
          name_en = v_option ->> 'name_en', name_ar = v_option ->> 'name_ar',
          price_delta_fils = (v_option ->> 'price_delta_fils')::integer,
          sort_order = v_o_order
        where id = (v_option ->> 'id')::uuid;
        v_keep_options := v_keep_options || (v_option ->> 'id')::uuid;
      else
        insert into public.modifier_options (group_id, name_en, name_ar, price_delta_fils, sort_order)
        values (v_group_id, v_option ->> 'name_en', v_option ->> 'name_ar',
          (v_option ->> 'price_delta_fils')::integer, v_o_order)
        returning id into v_option_id;
        v_keep_options := v_keep_options || v_option_id;
      end if;
    end loop;
    delete from public.modifier_options where group_id = v_group_id and not (id = any (v_keep_options));
  end loop;

  delete from public.modifier_groups where item_id = v_item_id and not (id = any (v_keep_groups));
  return v_item_id;
end;
$$;

revoke execute on function public.save_menu_item(jsonb) from public, anon;
grant execute on function public.save_menu_item(jsonb) to authenticated;
