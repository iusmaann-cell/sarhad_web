-- Phase 7: online payments. A new enum value has to be committed before it
-- can be used, so it gets a migration of its own.
alter type public.payment_method add value if not exists 'online';
