-- Phase 7: payment gateways and promo codes.
--
-- Payments: cash stays the default. Admins add online gateways (MyFatoorah,
-- Tap, or the built-in test gateway) in the back office. Gateway keys live in
-- a table no app user can read; only the website server (service role) reads
-- them to talk to the gateway. Online orders stay hidden from the kitchen
-- until the payment is confirmed by the gateway.
--
-- Promotions: promo codes with percent, fixed or free-delivery discounts,
-- checked and applied on the server by place_order().

-- -----------------------------------------------------------------------------
-- Payment gateways
-- -----------------------------------------------------------------------------

create table public.payment_providers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('test', 'myfatoorah', 'tap')),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  is_active boolean not null default false,
  -- false: the gateway's sandbox (test cards); true: real payments.
  is_live boolean not null default false,
  -- Last 4 characters of the saved key, so admins can tell which key is set.
  key_hint text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payment_providers_set_updated_at
before update on public.payment_providers
for each row execute function public.set_updated_at();

alter table public.payment_providers enable row level security;

create policy "Everyone sees active payment options"
on public.payment_providers for select to anon, authenticated
using (is_active or public.is_admin());

create policy "Admins manage payment options"
on public.payment_providers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create table public.payment_provider_secrets (
  provider_id uuid primary key references public.payment_providers (id) on delete cascade,
  api_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.payment_provider_secrets enable row level security;
-- No policies: app users can never read or write keys directly.
revoke all on public.payment_provider_secrets from anon, authenticated;

create or replace function public.set_payment_provider_key(p_provider_id uuid, p_api_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(trim(coalesce(p_api_key, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_providers where id = p_provider_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_key is null then
    delete from public.payment_provider_secrets where provider_id = p_provider_id;
    update public.payment_providers set key_hint = null where id = p_provider_id;
  else
    insert into public.payment_provider_secrets (provider_id, api_key) values (p_provider_id, v_key)
    on conflict (provider_id) do update set api_key = excluded.api_key, updated_at = now();
    update public.payment_providers set key_hint = right(v_key, 4) where id = p_provider_id;
  end if;
end;
$$;

revoke execute on function public.set_payment_provider_key(uuid, text) from public, anon;
grant execute on function public.set_payment_provider_key(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Orders: which gateway, and payment attempts
-- -----------------------------------------------------------------------------

alter table public.orders
  add column payment_provider_id uuid references public.payment_providers (id) on delete set null,
  add column promo_code text;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider_id uuid references public.payment_providers (id) on delete set null,
  provider_kind text not null,
  -- The gateway's id for this payment (invoice / charge id).
  provider_ref text,
  amount_fils integer not null check (amount_fils >= 0),
  currency text not null default 'KWD',
  status text not null default 'initiated'
    check (status in ('initiated', 'paid', 'failed', 'cancelled')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payments_order_idx on public.payments (order_id, created_at desc);
create unique index payments_provider_ref_idx on public.payments (provider_kind, provider_ref)
  where provider_ref is not null;

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

create policy "Payments follow their order"
on public.payments for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (o.customer_id = auth.uid() or public.can_access_branch(o.branch_id))
));

revoke insert, update, delete on public.payments from anon, authenticated;

-- Called by the website server (service role) after it has confirmed the
-- result with the gateway itself. Never trust a redirect's query string.
create or replace function public.record_payment_result(
  p_payment_id uuid,
  p_status text,
  p_provider_ref text default null,
  p_raw jsonb default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
begin
  if p_status not in ('initiated', 'paid', 'failed', 'cancelled') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  -- A confirmed payment never goes back.
  if v_payment.status = 'paid' then
    return 'paid';
  end if;
  update public.payments set
    status = p_status,
    provider_ref = coalesce(p_provider_ref, provider_ref),
    raw = raw || coalesce(p_raw, '{}'::jsonb),
    paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p_payment_id;
  if p_status = 'paid' then
    update public.orders set payment_status = 'paid' where id = v_payment.order_id;
  end if;
  return p_status;
end;
$$;

revoke execute on function public.record_payment_result(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_payment_result(uuid, text, text, jsonb) to service_role;

-- Online orders not paid within 30 minutes are cancelled, so they do not
-- block anything. Called by the order board and the payment pages.
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = 'payment_timeout'
  where payment_method = 'online' and payment_status = 'unpaid' and status = 'pending'
    and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_unpaid_orders() from public, anon;
grant execute on function public.expire_unpaid_orders() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Promo codes
-- -----------------------------------------------------------------------------

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,20}$'),
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  kind text not null check (kind in ('percent', 'fixed', 'free_delivery')),
  -- percent: 1-100; fixed: fils; free_delivery: unused.
  value integer not null default 0 check (value >= 0),
  min_subtotal_fils integer not null default 0 check (min_subtotal_fils >= 0),
  max_discount_fils integer check (max_discount_fils is null or max_discount_fils > 0),
  -- null: every branch.
  branch_id uuid references public.branches (id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  max_uses_per_customer integer default 1 check (max_uses_per_customer is null or max_uses_per_customer > 0),
  first_order_only boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'percent' or value between 1 and 100),
  check (kind <> 'fixed' or value > 0),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger promo_codes_set_updated_at
before update on public.promo_codes
for each row execute function public.set_updated_at();

alter table public.promo_codes enable row level security;

-- Customers never list codes: they check one at a time with promo_quote().
create policy "Staff see promo codes"
on public.promo_codes for select to authenticated
using (public.is_staff());

create policy "Admins and branch managers manage promo codes"
on public.promo_codes for all to authenticated
using (public.is_admin() or (branch_id is not null and public.can_manage_branch(branch_id)))
with check (public.is_admin() or (branch_id is not null and public.can_manage_branch(branch_id)));

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  discount_fils integer not null check (discount_fils >= 0),
  created_at timestamptz not null default now()
);

create index promo_redemptions_promo_idx on public.promo_redemptions (promo_id, customer_id);

alter table public.promo_redemptions enable row level security;

create policy "Staff see redemptions of their branches"
on public.promo_redemptions for select to authenticated
using (exists (
  select 1 from public.orders o where o.id = order_id and public.can_access_branch(o.branch_id)
));

revoke insert, update, delete on public.promo_redemptions from anon, authenticated;

-- How many times a code has been used (cancelled orders do not count).
create or replace function public.promo_uses(p_promo_id uuid, p_customer_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.promo_redemptions r
  join public.orders o on o.id = r.order_id
  where r.promo_id = p_promo_id and o.status <> 'cancelled'
    and (p_customer_id is null or r.customer_id = p_customer_id);
$$;

revoke execute on function public.promo_uses(uuid, uuid) from public, anon;
grant execute on function public.promo_uses(uuid, uuid) to authenticated;

-- promo_quote(code, branch, subtotal, delivery fee) -> { promo_id, code, name_en,
-- name_ar, kind, discount_fils }. Errors (P0001): promo_invalid, promo_expired,
-- promo_min_order, promo_used_up, promo_already_used, promo_first_order,
-- promo_delivery_only.
create or replace function public.promo_quote(
  p_code text,
  p_branch_id uuid,
  p_subtotal_fils integer,
  p_delivery_fee_fils integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_promo public.promo_codes;
  v_discount integer;
begin
  if v_user is null then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  select * into v_promo from public.promo_codes
  where code = upper(trim(coalesce(p_code, '')));
  if not found or not v_promo.is_active
     or (v_promo.branch_id is not null and v_promo.branch_id <> p_branch_id)
     or (v_promo.starts_at is not null and v_promo.starts_at > now()) then
    raise exception 'promo_invalid' using errcode = 'P0001';
  end if;
  if v_promo.ends_at is not null and v_promo.ends_at <= now() then
    raise exception 'promo_expired' using errcode = 'P0001';
  end if;
  if p_subtotal_fils < v_promo.min_subtotal_fils then
    raise exception 'promo_min_order' using errcode = 'P0001';
  end if;
  if v_promo.max_uses is not null and public.promo_uses(v_promo.id) >= v_promo.max_uses then
    raise exception 'promo_used_up' using errcode = 'P0001';
  end if;
  if v_promo.max_uses_per_customer is not null
     and public.promo_uses(v_promo.id, v_user) >= v_promo.max_uses_per_customer then
    raise exception 'promo_already_used' using errcode = 'P0001';
  end if;
  if v_promo.first_order_only and exists (
    select 1 from public.orders where customer_id = v_user and status <> 'cancelled'
  ) then
    raise exception 'promo_first_order' using errcode = 'P0001';
  end if;

  v_discount := case v_promo.kind
    when 'percent' then (p_subtotal_fils * v_promo.value) / 100
    when 'fixed' then least(v_promo.value, p_subtotal_fils)
    else coalesce(p_delivery_fee_fils, 0)
  end;
  if v_promo.kind = 'free_delivery' and coalesce(p_delivery_fee_fils, 0) = 0 then
    raise exception 'promo_delivery_only' using errcode = 'P0001';
  end if;
  if v_promo.max_discount_fils is not null then
    v_discount := least(v_discount, v_promo.max_discount_fils);
  end if;

  return jsonb_build_object(
    'promo_id', v_promo.id, 'code', v_promo.code, 'name_en', v_promo.name_en,
    'name_ar', v_promo.name_ar, 'kind', v_promo.kind, 'discount_fils', greatest(v_discount, 0)
  );
end;
$$;

revoke execute on function public.promo_quote(text, uuid, integer, integer) from public, anon;
grant execute on function public.promo_quote(text, uuid, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Staff cannot start an online order before it is paid; unpaid online orders
-- are not counted as open.
-- -----------------------------------------------------------------------------

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_reason text default null
)
returns public.order_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.can_access_branch(v_order.branch_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  -- Online orders reach the kitchen only once the payment is confirmed.
  if p_status <> 'cancelled' and v_order.payment_method = 'online' and v_order.payment_status <> 'paid' then
    raise exception 'awaiting_payment' using errcode = 'P0001';
  end if;

  if p_status = 'cancelled' then
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    update public.orders
    set status = 'cancelled', cancelled_at = now(), cancel_reason = left(v_reason, 300)
    where id = p_order_id;
    return 'cancelled';
  end if;

  if p_status is distinct from public.order_next_status(v_order.type, v_order.status) then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  update public.orders
  set status = p_status,
      accepted_at = case when p_status = 'accepted' then now() else accepted_at end,
      ready_at = case when p_status = 'ready' then now() else ready_at end,
      completed_at = case when p_status = 'completed' then now() else completed_at end,
      -- Cash is collected when the order is handed over.
      payment_status = case when p_status = 'completed' and payment_method = 'cash'
                            then 'paid'::public.payment_status else payment_status end
  where id = p_order_id;
  return p_status;
end;
$$;

revoke execute on function public.update_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.update_order_status(uuid, public.order_status, text) to authenticated;

create or replace function public.order_stats(p_branch_id uuid default null)
returns table (orders_today integer, open_orders integer, sales_today_fils bigint, cancelled_today integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where o.created_at >= d.start)::integer,
    count(*) filter (where o.status not in ('completed', 'cancelled')
                     and (o.payment_method = 'cash' or o.payment_status = 'paid'))::integer,
    coalesce(sum(o.total_fils) filter (where o.created_at >= d.start and o.status = 'completed'), 0)::bigint,
    count(*) filter (where o.created_at >= d.start and o.status = 'cancelled')::integer
  from public.orders o
  cross join lateral (
    select (date_trunc('day', now() at time zone 'Asia/Kuwait') at time zone 'Asia/Kuwait') as start
  ) d
  where public.can_access_branch(o.branch_id)
    and (p_branch_id is null or o.branch_id = p_branch_id)
    and (o.created_at >= d.start or o.status not in ('completed', 'cancelled'));
$$;

revoke execute on function public.order_stats(uuid) from public, anon;
grant execute on function public.order_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- place_order(p_order jsonb) -> { id, order_number }
-- p_order: { client_ref, branch_id, type: 'delivery'|'pickup',
--            customer_name, customer_phone, notes?,
--            address?: { area, block, street, avenue?, building, floor?,
--                        apartment?, notes?, latitude, longitude },
--            items: [{ item_id, quantity, option_ids: [uuid], notes? }],
--            promo_code?, payment?: { method: 'cash'|'online', provider_id? } }
-- Phase 7 adds promo codes and online payment to the Phase 4 version.
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
  v_code text;
  v_promo jsonb;
  v_discount integer := 0;
  v_method public.payment_method;
  v_provider uuid;
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
    delivery_zone_id, eta_minutes, subtotal_fils, delivery_fee_fils, discount_fils, total_fils, notes,
    payment_method, payment_provider_id, promo_code
  ) values (
    v_ref, v_user, v_branch.id, v_type, trim(p_order ->> 'customer_name'),
    trim(p_order ->> 'customer_phone'), v_address,
    v_zone_id, v_eta,
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

  return jsonb_build_object('id', v_order_id, 'order_number', v_number, 'payment_method', v_method);
end;
$$;

revoke execute on function public.place_order(jsonb) from public, anon;
grant execute on function public.place_order(jsonb) to authenticated;
