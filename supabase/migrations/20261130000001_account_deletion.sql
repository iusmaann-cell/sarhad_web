-- Phase 8: customers can delete their account (required by the App Store and
-- Google Play). Past orders stay for the restaurant's records, without the
-- customer's name, phone or exact address.

alter table public.orders alter column customer_id drop not null;
alter table public.orders drop constraint orders_customer_id_fkey;
alter table public.orders add constraint orders_customer_id_fkey
  foreign key (customer_id) references auth.users (id) on delete set null;

-- Promo code use counts stay correct after an account is deleted.
alter table public.promo_redemptions alter column customer_id drop not null;
alter table public.promo_redemptions drop constraint promo_redemptions_customer_id_fkey;
alter table public.promo_redemptions add constraint promo_redemptions_customer_id_fkey
  foreign key (customer_id) references auth.users (id) on delete set null;

-- Errors (P0001): sign_in_required, staff_account (staff are removed by an
-- admin instead), open_orders (wait until current orders are finished).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sign_in_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.staff_roles where user_id = v_user) then
    raise exception 'staff_account' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.orders
    where customer_id = v_user and status not in ('completed', 'cancelled')
      and not (payment_method = 'online' and payment_status = 'unpaid')
  ) then
    raise exception 'open_orders' using errcode = 'P0001';
  end if;

  -- Unpaid online orders are simply cancelled.
  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = 'customer'
  where customer_id = v_user and status = 'pending'
    and payment_method = 'online' and payment_status = 'unpaid';

  -- Keep the orders, drop the personal details (the area stays for reports).
  update public.orders set
    customer_name = 'Deleted customer',
    customer_phone = '-',
    notes = null,
    address = case when address is null then null
                   else jsonb_strip_nulls(jsonb_build_object('area', address ->> 'area')) end
  where customer_id = v_user;

  -- Profile, saved addresses and sessions go with the user.
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
