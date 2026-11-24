-- Phase 6: order operations for branch staff.
-- Staff move orders through their statuses, cancel with a reason, mark cash
-- as collected and pause online orders for their branch. Every write goes
-- through a function that checks the caller works at the order's branch.

-- -----------------------------------------------------------------------------
-- Status rules (the same as nextStatuses() in @sarhad/core)
-- -----------------------------------------------------------------------------

create or replace function public.order_next_status(p_type public.order_type, p_status public.order_status)
returns public.order_status
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'pending' then 'accepted'::public.order_status
    when 'accepted' then 'preparing'::public.order_status
    when 'preparing' then 'ready'::public.order_status
    when 'ready' then case when p_type = 'delivery' then 'out_for_delivery'::public.order_status
                           else 'completed'::public.order_status end
    when 'out_for_delivery' then 'completed'::public.order_status
    else null
  end;
$$;

grant execute on function public.order_next_status(public.order_type, public.order_status) to authenticated;

-- -----------------------------------------------------------------------------
-- Move an order on, or cancel it. Errors (P0001): not_found, invalid_status,
-- reason_required.
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

-- -----------------------------------------------------------------------------
-- Pause or resume online orders for a branch (any staff of that branch).
-- -----------------------------------------------------------------------------

create or replace function public.set_accepting_orders(p_branch_id uuid, p_accepting boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_access_branch(p_branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.branches set accepting_orders = p_accepting where id = p_branch_id;
  return p_accepting;
end;
$$;

revoke execute on function public.set_accepting_orders(uuid, boolean) from public, anon;
grant execute on function public.set_accepting_orders(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Today's numbers for the dashboard, in the branch's own day (Kuwait time).
-- RLS-equivalent: only branches the caller can access are counted.
-- -----------------------------------------------------------------------------

create or replace function public.order_stats(p_branch_id uuid default null)
returns table (orders_today integer, open_orders integer, sales_today_fils bigint, cancelled_today integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where o.created_at >= d.start)::integer,
    count(*) filter (where o.status not in ('completed', 'cancelled'))::integer,
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
