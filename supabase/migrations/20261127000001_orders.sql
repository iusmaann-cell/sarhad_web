-- =============================================================================
-- Sarhad Phase 4: Website ordering
-- Customers place delivery or pickup orders, paid in cash for now. Prices,
-- availability, add-on rules, opening hours, delivery zone, fee and minimum
-- order are all checked again on the server by place_order(), so a tampered
-- cart can never change what is charged.
-- =============================================================================

create type public.order_type as enum ('delivery', 'pickup');
create type public.order_status as enum (
  'pending',          -- placed, waiting for the branch to accept
  'accepted',         -- branch accepted, kitchen will start
  'preparing',
  'ready',            -- ready for pickup or for the driver
  'out_for_delivery',
  'completed',        -- delivered or picked up
  'cancelled'
);
create type public.payment_method as enum ('cash');
create type public.payment_status as enum ('unpaid', 'paid', 'refunded');

-- Branches can pause online orders (busy kitchen) without hiding the branch.
alter table public.branches add column accepting_orders boolean not null default true;

-- -----------------------------------------------------------------------------
-- Opening hours check in SQL (same rules as isOpenAt() in @sarhad/core).
-- A range whose close is not after its open runs past midnight; 00:00-00:00
-- means open all day.
-- -----------------------------------------------------------------------------

create or replace function public.hours_minutes(p_time text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select split_part(p_time, ':', 1)::integer * 60 + split_part(p_time, ':', 2)::integer;
$$;

create or replace function public.branch_is_open(p_branch_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hours jsonb;
  v_tz text;
  v_local timestamp;
  v_days text[] := array['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_today text;
  v_yesterday text;
  v_minute integer;
  v_range jsonb;
  v_open integer;
  v_close integer;
begin
  select opening_hours, timezone into v_hours, v_tz from public.branches where id = p_branch_id;
  if v_hours is null then
    return false;
  end if;
  v_local := p_at at time zone coalesce(v_tz, 'Asia/Kuwait');
  v_today := v_days[extract(dow from v_local)::integer + 1];
  v_yesterday := v_days[((extract(dow from v_local)::integer + 6) % 7) + 1];
  v_minute := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;

  for v_range in select * from jsonb_array_elements(coalesce(v_hours -> v_today, '[]'::jsonb)) loop
    v_open := public.hours_minutes(v_range ->> 'open');
    v_close := public.hours_minutes(v_range ->> 'close');
    if (v_close > v_open and v_minute >= v_open and v_minute < v_close)
       or (v_close <= v_open and v_minute >= v_open) then
      return true;
    end if;
  end loop;

  for v_range in select * from jsonb_array_elements(coalesce(v_hours -> v_yesterday, '[]'::jsonb)) loop
    v_open := public.hours_minutes(v_range ->> 'open');
    v_close := public.hours_minutes(v_range ->> 'close');
    if v_close <= v_open and v_minute < v_close then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

grant execute on function public.branch_is_open(uuid, timestamptz) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Saved customer addresses (Kuwait style: area, block, street, building).
-- -----------------------------------------------------------------------------

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text check (label is null or length(label) <= 40),
  area text not null check (length(trim(area)) > 0),
  block text not null check (length(trim(block)) > 0),
  street text not null check (length(trim(street)) > 0),
  avenue text,
  building text not null check (length(trim(building)) > 0),
  floor text,
  apartment text,
  notes text check (notes is null or length(notes) <= 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_addresses_user_idx on public.customer_addresses (user_id, created_at desc);

create trigger customer_addresses_set_updated_at
before update on public.customer_addresses
for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;

create policy "Customers manage their addresses"
on public.customer_addresses for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Orders
-- -----------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001) unique,
  -- Set by the app to make placing an order safe to retry.
  client_ref uuid not null,
  customer_id uuid not null references auth.users (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  type public.order_type not null,
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null default 'cash',
  payment_status public.payment_status not null default 'unpaid',
  customer_name text not null check (length(trim(customer_name)) > 0),
  customer_phone text not null check (length(trim(customer_phone)) > 0),
  -- Snapshot of the delivery address at the time of the order.
  address jsonb,
  delivery_zone_id uuid references public.delivery_zones (id) on delete set null,
  eta_minutes integer,
  subtotal_fils integer not null check (subtotal_fils >= 0),
  delivery_fee_fils integer not null default 0 check (delivery_fee_fils >= 0),
  discount_fils integer not null default 0 check (discount_fils >= 0),
  total_fils integer not null check (total_fils >= 0),
  notes text check (notes is null or length(notes) <= 500),
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (customer_id, client_ref),
  check (type = 'pickup' or address is not null)
);

create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_branch_status_idx on public.orders (branch_id, status, created_at desc);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id uuid references public.menu_items (id) on delete set null,
  name_en text not null,
  name_ar text not null,
  -- Item price at the branch plus the chosen add-ons, for one unit.
  unit_price_fils integer not null check (unit_price_fils >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_fils integer not null check (line_total_fils >= 0),
  -- [{ id, group_en, group_ar, name_en, name_ar, price_delta_fils }]
  options jsonb not null default '[]'::jsonb,
  notes text check (notes is null or length(notes) <= 200),
  sort_order integer not null default 0
);

create index order_items_order_idx on public.order_items (order_id, sort_order);

-- Every status change, for the timeline on the order page.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_id uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_events (order_id, status, actor_id, note)
    values (new.id, new.status, auth.uid(), case when new.status = 'cancelled' then new.cancel_reason end);
  end if;
  return null;
end;
$$;

create trigger orders_log_status
after insert or update of status on public.orders
for each row execute function public.log_order_status();

revoke execute on function public.log_order_status() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security. Nobody writes orders directly: place_order() and the
-- status functions do it after their checks.
-- -----------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

create policy "Customers and branch staff see orders"
on public.orders for select to authenticated
using (customer_id = auth.uid() or public.can_access_branch(branch_id));

create policy "Order items follow their order"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.customer_id = auth.uid() or public.can_access_branch(o.branch_id))
));

create policy "Order events follow their order"
on public.order_events for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.customer_id = auth.uid() or public.can_access_branch(o.branch_id))
));

revoke insert, update, delete on public.orders, public.order_items, public.order_events from anon, authenticated;

-- -----------------------------------------------------------------------------
-- place_order(p_order jsonb) -> { id, order_number }
-- p_order: { client_ref, branch_id, type: 'delivery'|'pickup',
--            customer_name, customer_phone, notes?,
--            address?: { area, block, street, avenue?, building, floor?,
--                        apartment?, notes?, latitude, longitude },
--            items: [{ item_id, quantity, option_ids: [uuid], notes? }] }
-- Errors use SQLSTATE P0001 with a short code as the message, e.g.
-- 'branch_closed', 'item_unavailable', 'outside_zone', 'below_minimum'.
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
  v_zone record;
  v_lat double precision;
  v_lng double precision;
  v_address jsonb;
  v_fee integer := 0;
  v_zone_id uuid;
  v_eta integer;
  v_order_id uuid;
  v_number bigint;
  v_i integer := 0;
begin
  if v_user is null then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  if v_ref is null then
    raise exception 'invalid_order' using errcode = 'P0001';
  end if;

  -- A retry of an order that already went through returns the same order.
  select id, order_number into v_existing from public.orders
  where customer_id = v_user and client_ref = v_ref;
  if found then
    return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number);
  end if;

  select * into v_branch from public.branches where id = (p_order ->> 'branch_id')::uuid;
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
    if v_lat is null or v_lng is null
       or length(trim(coalesce(v_address ->> 'area', ''))) = 0
       or length(trim(coalesce(v_address ->> 'block', ''))) = 0
       or length(trim(coalesce(v_address ->> 'street', ''))) = 0
       or length(trim(coalesce(v_address ->> 'building', ''))) = 0 then
      raise exception 'address_required' using errcode = 'P0001';
    end if;

    select z.id, z.fee_fils, z.min_order_fils, z.eta_minutes into v_zone
    from public.delivery_zones z
    where z.branch_id = v_branch.id and z.is_active
      and extensions.st_covers(z.area, extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326))
    order by z.fee_fils, z.eta_minutes
    limit 1;
    if not found then
      raise exception 'outside_zone' using errcode = 'P0001';
    end if;
    if v_subtotal < v_zone.min_order_fils then
      raise exception 'below_minimum' using errcode = 'P0001';
    end if;
    v_fee := v_zone.fee_fils;
    v_zone_id := v_zone.id;
    v_eta := v_zone.eta_minutes;
    v_address := jsonb_strip_nulls(jsonb_build_object(
      'area', trim(v_address ->> 'area'), 'block', trim(v_address ->> 'block'),
      'street', trim(v_address ->> 'street'), 'avenue', nullif(trim(v_address ->> 'avenue'), ''),
      'building', trim(v_address ->> 'building'), 'floor', nullif(trim(v_address ->> 'floor'), ''),
      'apartment', nullif(trim(v_address ->> 'apartment'), ''),
      'notes', nullif(left(trim(coalesce(v_address ->> 'notes', '')), 300), ''),
      'latitude', v_lat, 'longitude', v_lng
    ));
  else
    v_address := null;
  end if;

  insert into public.orders (
    client_ref, customer_id, branch_id, type, customer_name, customer_phone, address,
    delivery_zone_id, eta_minutes, subtotal_fils, delivery_fee_fils, total_fils, notes
  ) values (
    v_ref, v_user, v_branch.id, v_type, trim(p_order ->> 'customer_name'),
    trim(p_order ->> 'customer_phone'), v_address,
    v_zone_id, v_eta,
    v_subtotal, v_fee, v_subtotal + v_fee,
    nullif(left(trim(coalesce(p_order ->> 'notes', '')), 500), '')
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

  -- Remember the contact details on the profile when it has none yet.
  update public.profiles set
    full_name = coalesce(nullif(full_name, ''), trim(p_order ->> 'customer_name')),
    phone = coalesce(nullif(phone, ''), trim(p_order ->> 'customer_phone'))
  where id = v_user;

  return jsonb_build_object('id', v_order_id, 'order_number', v_number);
end;
$$;

revoke execute on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Customers may cancel their own order while the branch has not accepted it.
-- -----------------------------------------------------------------------------

create or replace function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = 'customer'
  where id = p_order_id and customer_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'cannot_cancel' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;
