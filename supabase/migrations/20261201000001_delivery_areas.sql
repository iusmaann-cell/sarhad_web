-- =============================================================================
-- Sarhad: named delivery areas
-- Each delivery zone lists the areas it covers by name (city, then area), for
-- example Hawalli > Salmiya. On the website the customer picks a city and an
-- area from these lists and never chooses a branch: the order goes to the
-- branch whose zone lists that area. The zone's map shape stays for the
-- mobile app, which still finds the zone from the customer's map pin.
-- =============================================================================

create table public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.delivery_zones (id) on delete cascade,
  city_en text not null check (length(trim(city_en)) > 0),
  city_ar text not null check (length(trim(city_ar)) > 0),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_areas_zone_idx on public.delivery_areas (zone_id, sort_order);
create unique index delivery_areas_zone_name_key
  on public.delivery_areas (zone_id, lower(trim(city_en)), lower(trim(name_en)));

create trigger delivery_areas_set_updated_at
before update on public.delivery_areas
for each row execute function public.set_updated_at();

create trigger delivery_areas_audit
after insert or update or delete on public.delivery_areas
for each row execute function public.write_audit_log();

-- Orders remember which listed area they were placed for.
alter table public.orders
  add column delivery_area_id uuid references public.delivery_areas (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Row Level Security: same rules as the zone the area belongs to.
-- -----------------------------------------------------------------------------

alter table public.delivery_areas enable row level security;

create policy "Areas of visible zones are public"
on public.delivery_areas for select to anon, authenticated
using (exists (
  select 1 from public.delivery_zones z
  where z.id = delivery_areas.zone_id
    and ((z.is_active and delivery_areas.is_active) or public.can_access_branch(z.branch_id))
));

create policy "Managers add areas"
on public.delivery_areas for insert to authenticated
with check (exists (
  select 1 from public.delivery_zones z
  where z.id = delivery_areas.zone_id and public.can_manage_branch(z.branch_id)
));

create policy "Managers edit areas"
on public.delivery_areas for update to authenticated
using (exists (
  select 1 from public.delivery_zones z
  where z.id = delivery_areas.zone_id and public.can_manage_branch(z.branch_id)
))
with check (exists (
  select 1 from public.delivery_zones z
  where z.id = delivery_areas.zone_id and public.can_manage_branch(z.branch_id)
));

create policy "Managers delete areas"
on public.delivery_areas for delete to authenticated
using (exists (
  select 1 from public.delivery_zones z
  where z.id = delivery_areas.zone_id and public.can_manage_branch(z.branch_id)
));

-- -----------------------------------------------------------------------------
-- save_delivery_zone(): the Phase 3 version, plus an optional "areas" list.
-- When p_zone has "areas" (an array of { city_en, city_ar, name_en, name_ar }),
-- the zone's areas are replaced by that list (areas kept by name keep their id).
-- Without it they stay as they are.
-- -----------------------------------------------------------------------------

create or replace function public.save_delivery_zone(p_zone jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(p_zone ->> 'id', '')::uuid;
  v_branch uuid := nullif(p_zone ->> 'branch_id', '')::uuid;
  v_area extensions.geometry;
  v_item jsonb;
  v_i integer := 0;
begin
  if v_branch is null or not public.can_manage_branch(v_branch) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_area := public.zone_area_from_geojson(p_zone -> 'area');

  if v_id is null then
    insert into public.delivery_zones (
      branch_id, name_en, name_ar, area, fee_fils, min_order_fils, eta_minutes,
      color, is_active, sort_order
    ) values (
      v_branch, p_zone ->> 'name_en', p_zone ->> 'name_ar', v_area,
      coalesce((p_zone ->> 'fee_fils')::integer, 0),
      coalesce((p_zone ->> 'min_order_fils')::integer, 0),
      coalesce((p_zone ->> 'eta_minutes')::integer, 45),
      coalesce(nullif(p_zone ->> 'color', ''), '#c2410c'),
      coalesce((p_zone ->> 'is_active')::boolean, true),
      coalesce((p_zone ->> 'sort_order')::integer, 0)
    ) returning id into v_id;
  else
    update public.delivery_zones set
      branch_id = v_branch,
      name_en = p_zone ->> 'name_en',
      name_ar = p_zone ->> 'name_ar',
      area = v_area,
      fee_fils = coalesce((p_zone ->> 'fee_fils')::integer, 0),
      min_order_fils = coalesce((p_zone ->> 'min_order_fils')::integer, 0),
      eta_minutes = coalesce((p_zone ->> 'eta_minutes')::integer, 45),
      color = coalesce(nullif(p_zone ->> 'color', ''), color),
      is_active = coalesce((p_zone ->> 'is_active')::boolean, true),
      sort_order = coalesce((p_zone ->> 'sort_order')::integer, sort_order)
    where id = v_id;
    if not found then
      raise exception 'Zone not found' using errcode = 'P0002';
    end if;
  end if;

  if jsonb_typeof(p_zone -> 'areas') = 'array' then
    -- Areas that stay keep their id, so past orders still point at them.
    delete from public.delivery_areas a
    where a.zone_id = v_id
      and not exists (
        select 1 from jsonb_array_elements(p_zone -> 'areas') e
        where lower(trim(e ->> 'city_en')) = lower(trim(a.city_en))
          and lower(trim(e ->> 'name_en')) = lower(trim(a.name_en))
      );
    for v_item in select * from jsonb_array_elements(p_zone -> 'areas') loop
      if length(trim(coalesce(v_item ->> 'name_en', ''))) = 0
         or length(trim(coalesce(v_item ->> 'city_en', ''))) = 0 then
        continue;
      end if;
      v_i := v_i + 1;
      insert into public.delivery_areas (zone_id, city_en, city_ar, name_en, name_ar, sort_order, is_active)
      values (
        v_id, trim(v_item ->> 'city_en'), coalesce(nullif(trim(v_item ->> 'city_ar'), ''), trim(v_item ->> 'city_en')),
        trim(v_item ->> 'name_en'), coalesce(nullif(trim(v_item ->> 'name_ar'), ''), trim(v_item ->> 'name_en')), v_i,
        coalesce((v_item ->> 'is_active')::boolean, true)
      )
      on conflict (zone_id, lower(trim(city_en)), lower(trim(name_en))) do update set
        city_en = excluded.city_en, city_ar = excluded.city_ar,
        name_en = excluded.name_en, name_ar = excluded.name_ar,
        sort_order = excluded.sort_order, is_active = excluded.is_active;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_delivery_zone(jsonb) from public, anon;
grant execute on function public.save_delivery_zone(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- The areas customers can order delivery to, for the website's area picker.
-- Only active areas of active zones of active branches that accept delivery.
-- When two zones list the same city and area, the cheaper (then faster) one
-- wins, so each area appears once and always routes to one branch.
-- -----------------------------------------------------------------------------

create or replace function public.list_delivery_areas()
returns table (
  area_id uuid,
  city_en text,
  city_ar text,
  name_en text,
  name_ar text,
  zone_id uuid,
  branch_id uuid,
  branch_slug text,
  branch_name_en text,
  branch_name_ar text,
  fee_fils integer,
  min_order_fils integer,
  eta_minutes integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select area_id, city_en, city_ar, name_en, name_ar, zone_id, branch_id, branch_slug,
         branch_name_en, branch_name_ar, fee_fils, min_order_fils, eta_minutes
  from (
    select distinct on (lower(trim(a.city_en)), lower(trim(a.name_en)))
           a.id as area_id, trim(a.city_en) as city_en, trim(a.city_ar) as city_ar,
           trim(a.name_en) as name_en, trim(a.name_ar) as name_ar,
           z.id as zone_id, b.id as branch_id, b.slug as branch_slug,
           b.name_en as branch_name_en, b.name_ar as branch_name_ar,
           z.fee_fils, z.min_order_fils, z.eta_minutes
    from public.delivery_areas a
    join public.delivery_zones z on z.id = a.zone_id
    join public.branches b on b.id = z.branch_id
    where a.is_active and z.is_active and b.is_active and b.accepts_delivery
    order by lower(trim(a.city_en)), lower(trim(a.name_en)),
             z.fee_fils, z.eta_minutes, b.sort_order, z.sort_order
  ) s
  order by lower(city_en), lower(name_en);
$$;

grant execute on function public.list_delivery_areas() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- place_order(): the Phase 7 version, plus delivery by listed area.
-- p_order may carry "delivery_area_id" for a delivery. The branch then comes
-- from that area's zone (any "branch_id" sent is ignored), the fee, minimum and
-- time come from that zone, and the map pin is optional. Without an area the
-- Phase 7 rules apply: the pin must fall inside a zone of "branch_id".
-- New error: 'area_unavailable' when the area is no longer delivered to.
-- -----------------------------------------------------------------------------

create or replace function public.place_order(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ref uuid := nullif(p_order ->> 'client_ref', '')::uuid;
  v_branch public.branches%rowtype;
  v_type public.order_type := (p_order ->> 'type')::public.order_type;
  v_existing record;
  v_line jsonb;
  v_item record;
  v_qty integer;
  v_option_ids uuid[];
  v_options jsonb;
  v_delta integer;
  v_unit integer;
  v_subtotal integer := 0;
  v_lines jsonb := '[]'::jsonb;
  v_group record;
  v_count integer;
  v_lat double precision;
  v_lng double precision;
  v_address jsonb;
  v_fee integer := 0;
  v_zone_id uuid;
  v_eta integer;
  v_order_id uuid;
  v_number bigint;
  v_i integer := 0;
  v_code text;
  v_promo jsonb;
  v_discount integer := 0;
  v_method public.payment_method;
  v_provider uuid;
  v_area_id uuid := nullif(p_order ->> 'delivery_area_id', '')::uuid;
  v_area_name text;
  v_min integer := 0;
  v_branch_id uuid := nullif(p_order ->> 'branch_id', '')::uuid;
begin
  if v_user is null then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  if v_ref is null then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;

  -- A retry of an order that already went through returns the same order.
  select id, order_number, payment_method into v_existing from public.orders
  where customer_id = v_user and client_ref = v_ref;
  if found then
    return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
                              'payment_method', v_existing.payment_method);
  end if;

  if v_type <> 'delivery' then
    v_area_id := null;
  end if;

  -- Delivery to a listed area: the area decides the branch.
  if v_area_id is not null then
    select a.name_en, z.id, z.branch_id, z.fee_fils, z.min_order_fils, z.eta_minutes
      into v_area_name, v_zone_id, v_branch_id, v_fee, v_min, v_eta
    from public.delivery_areas a
    join public.delivery_zones z on z.id = a.zone_id
    where a.id = v_area_id and a.is_active and z.is_active;
    if not found then
      raise exception 'area_unavailable' using errcode = 'P0001';
    end if;
  end if;

  select * into v_branch from public.branches where id = v_branch_id;
  if not found or not v_branch.is_active then
    raise exception 'branch_unavailable' using errcode = 'P0001';
  end if;
  if not v_branch.accepting_orders or not public.branch_is_open(v_branch.id) then
    raise exception 'branch_closed' using errcode = 'P0001';
  end if;
  if (v_type = 'delivery' and not v_branch.accepts_delivery)
     or (v_type = 'pickup' and not v_branch.accepts_pickup) then
    raise exception 'type_unavailable' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_order ->> 'customer_name', ''))) = 0
     or length(regexp_replace(coalesce(p_order ->> 'customer_phone', ''), '\D', '', 'g')) < 8 then
    raise exception 'contact_required' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array'
     or jsonb_array_length(p_order -> 'items') = 0
     or jsonb_array_length(p_order -> 'items') > 50 then
    raise exception 'cart_empty' using errcode = 'P0001';
  end if;

  for v_line in select * from jsonb_array_elements(p_order -> 'items') loop
    v_qty := coalesce((v_line ->> 'quantity')::integer, 0);
    if v_qty < 1 or v_qty > 50 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;

    select i.id, i.name_en, i.name_ar,
           coalesce(bmi.price_override_fils, i.price_fils) as price,
           coalesce(bmi.is_available, true) and i.is_active and c.is_active as ok
      into v_item
    from public.menu_items i
    join public.menu_categories c on c.id = i.category_id
    left join public.branch_menu_items bmi on bmi.item_id = i.id and bmi.branch_id = v_branch.id
    where i.id = (v_line ->> 'item_id')::uuid;
    if not found or not v_item.ok then
      raise exception 'item_unavailable' using errcode = 'P0001';
    end if;

    select coalesce(array_agg(distinct x::uuid), '{}') into v_option_ids
    from jsonb_array_elements_text(coalesce(v_line -> 'option_ids', '[]'::jsonb)) x;

    -- Every chosen option must be an active option of this item.
    if exists (
      select 1 from unnest(v_option_ids) oid
      where not exists (
        select 1 from public.modifier_options o
        join public.modifier_groups g on g.id = o.group_id
        where o.id = oid and o.is_active and g.item_id = v_item.id
      )
    ) then
      raise exception 'invalid_options' using errcode = 'P0001';
    end if;

    -- Each add-on group's min/max rule.
    for v_group in select g.id, g.min_select, g.max_select from public.modifier_groups g where g.item_id = v_item.id loop
      select count(*) into v_count from public.modifier_options o
      where o.group_id = v_group.id and o.id = any (v_option_ids);
      if v_count < v_group.min_select or v_count > v_group.max_select then
        raise exception 'invalid_options' using errcode = 'P0001';
      end if;
    end loop;

    select coalesce(sum(o.price_delta_fils), 0)::integer,
           coalesce(jsonb_agg(jsonb_build_object(
             'id', o.id, 'group_en', g.name_en, 'group_ar', g.name_ar,
             'name_en', o.name_en, 'name_ar', o.name_ar, 'price_delta_fils', o.price_delta_fils
           ) order by g.sort_order, o.sort_order), '[]'::jsonb)
      into v_delta, v_options
    from public.modifier_options o
    join public.modifier_groups g on g.id = o.group_id
    where o.id = any (v_option_ids);

    v_unit := v_item.price + v_delta;
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'item_id', v_item.id, 'name_en', v_item.name_en, 'name_ar', v_item.name_ar,
      'unit', v_unit, 'qty', v_qty, 'options', v_options,
      'notes', nullif(left(trim(coalesce(v_line ->> 'notes', '')), 200), '')
    );
  end loop;

  if v_type = 'delivery' then
    v_address := p_order -> 'address';
    v_lat := (v_address ->> 'latitude')::double precision;
    v_lng := (v_address ->> 'longitude')::double precision;
    if (v_area_id is null and (v_lat is null or v_lng is null))
       or (v_area_id is null and length(trim(coalesce(v_address ->> 'area', ''))) = 0)
       or length(trim(coalesce(v_address ->> 'block', ''))) = 0
       or length(trim(coalesce(v_address ->> 'street', ''))) = 0
       or length(trim(coalesce(v_address ->> 'building', ''))) = 0 then
      raise exception 'address_required' using errcode = 'P0001';
    end if;
    if v_lat is not null and (v_lat not between -90 and 90 or v_lng is null or v_lng not between -180 and 180) then
      raise exception 'address_required' using errcode = 'P0001';
    end if;

    if v_area_id is null then
      select z.id, z.fee_fils, z.min_order_fils, z.eta_minutes into v_zone_id, v_fee, v_min, v_eta
      from public.delivery_zones z
      where z.branch_id = v_branch.id and z.is_active
        and extensions.st_covers(z.area, extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326))
      order by z.fee_fils, z.eta_minutes
      limit 1;
      if not found then
        raise exception 'outside_zone' using errcode = 'P0001';
      end if;
    end if;
    if v_subtotal < v_min then
      raise exception 'below_minimum' using errcode = 'P0001';
    end if;
    v_address := jsonb_strip_nulls(jsonb_build_object(
      'area', case when v_area_id is not null then v_area_name else trim(v_address ->> 'area') end,
      'block', trim(v_address ->> 'block'),
      'street', trim(v_address ->> 'street'), 'avenue', nullif(trim(v_address ->> 'avenue'), ''),
      'building', trim(v_address ->> 'building'), 'floor', nullif(trim(v_address ->> 'floor'), ''),
      'apartment', nullif(trim(v_address ->> 'apartment'), ''),
      'notes', nullif(left(trim(coalesce(v_address ->> 'notes', '')), 300), ''),
      'latitude', v_lat, 'longitude', v_lng
    ));
  else
    v_address := null;
  end if;

  -- Promo code: checked again here, with the code locked so its use limits hold.
  v_code := nullif(upper(trim(coalesce(p_order ->> 'promo_code', ''))), '');
  if v_code is not null then
    perform 1 from public.promo_codes where code = v_code for update;
    v_promo := public.promo_quote(v_code, v_branch.id, v_subtotal, v_fee);
    v_discount := least((v_promo ->> 'discount_fils')::integer, v_subtotal + v_fee);
  end if;

  -- Payment: cash, or an active online gateway.
  v_method := coalesce(nullif(p_order -> 'payment' ->> 'method', ''), 'cash')::public.payment_method;
  if v_method = 'online' then
    select id into v_provider from public.payment_providers
    where id = nullif(p_order -> 'payment' ->> 'provider_id', '')::uuid and is_active;
    if not found then
      raise exception 'payment_unavailable' using errcode = 'P0001';
    end if;
  end if;

  insert into public.orders (
    client_ref, customer_id, branch_id, type, customer_name, customer_phone, address,
    delivery_zone_id, delivery_area_id, eta_minutes, subtotal_fils, delivery_fee_fils, discount_fils,
    total_fils, notes, payment_method, payment_provider_id, promo_code
  ) values (
    v_ref, v_user, v_branch.id, v_type, trim(p_order ->> 'customer_name'),
    trim(p_order ->> 'customer_phone'), v_address,
    v_zone_id, v_area_id, v_eta,
    v_subtotal, v_fee, v_discount, v_subtotal + v_fee - v_discount,
    nullif(left(trim(coalesce(p_order ->> 'notes', '')), 500), ''),
    v_method, v_provider, v_promo ->> 'code'
  ) returning id, order_number into v_order_id, v_number;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_i := v_i + 1;
    insert into public.order_items (
      order_id, item_id, name_en, name_ar, unit_price_fils, quantity, line_total_fils, options, notes, sort_order
    ) values (
      v_order_id, (v_line ->> 'item_id')::uuid, v_line ->> 'name_en', v_line ->> 'name_ar',
      (v_line ->> 'unit')::integer, (v_line ->> 'qty')::integer,
      (v_line ->> 'unit')::integer * (v_line ->> 'qty')::integer,
      v_line -> 'options', v_line ->> 'notes', v_i
    );
  end loop;

  if v_promo is not null then
    insert into public.promo_redemptions (promo_id, order_id, customer_id, discount_fils)
    values ((v_promo ->> 'promo_id')::uuid, v_order_id, v_user, v_discount);
  end if;

  -- Remember the contact details on the profile when it has none yet.
  update public.profiles set
    full_name = coalesce(nullif(full_name, ''), trim(p_order ->> 'customer_name')),
    phone = coalesce(nullif(phone, ''), trim(p_order ->> 'customer_phone'))
  where id = v_user;

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'payment_method', v_method,
                            'branch_id', v_branch.id);
end;
$$;

revoke execute on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
