-- =============================================================================
-- Sarhad Phase 3: Delivery zones
-- Each branch draws the areas it delivers to on a map. A zone has its own
-- delivery fee, minimum order and estimated delivery time. When a customer
-- drops a pin, find_delivery_zone() returns the zones that cover it, cheapest
-- first, so checkout (Phase 4) can pick the branch and the fee.
-- =============================================================================

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete cascade,
  name_en text not null check (length(trim(name_en)) > 0),
  name_ar text not null check (length(trim(name_ar)) > 0),
  -- WGS84 (longitude, latitude). Always stored as a valid MultiPolygon.
  area extensions.geometry(MultiPolygon, 4326) not null
    check (extensions.st_isvalid(area) and not extensions.st_isempty(area)),
  -- The same area as GeoJSON, for the map editors in the apps.
  area_geojson jsonb generated always as (extensions.st_asgeojson(area, 6)::jsonb) stored,
  fee_fils integer not null default 0 check (fee_fils >= 0),
  min_order_fils integer not null default 0 check (min_order_fils >= 0),
  eta_minutes integer not null default 45 check (eta_minutes between 5 and 240),
  color text not null default '#c2410c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index delivery_zones_branch_idx on public.delivery_zones (branch_id, sort_order);
create index delivery_zones_area_idx on public.delivery_zones using gist (area);

create trigger delivery_zones_set_updated_at
before update on public.delivery_zones
for each row execute function public.set_updated_at();

create trigger delivery_zones_audit
after insert or update or delete on public.delivery_zones
for each row execute function public.write_audit_log();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Customers see active zones. Staff of a branch also see its paused zones.
-- Branch managers (their branch) and admins (all branches) edit zones.
-- -----------------------------------------------------------------------------

alter table public.delivery_zones enable row level security;

create policy "Active zones are public"
on public.delivery_zones for select to anon, authenticated
using (is_active or public.can_access_branch(branch_id));

create policy "Managers add zones"
on public.delivery_zones for insert to authenticated
with check (public.can_manage_branch(branch_id));

create policy "Managers edit zones"
on public.delivery_zones for update to authenticated
using (public.can_manage_branch(branch_id))
with check (public.can_manage_branch(branch_id));

create policy "Managers delete zones"
on public.delivery_zones for delete to authenticated
using (public.can_manage_branch(branch_id));

-- -----------------------------------------------------------------------------
-- Turn GeoJSON from a map editor into a clean MultiPolygon.
-- Accepts a Polygon or MultiPolygon geometry (or a Feature wrapping one).
-- Self-crossing shapes are repaired; anything that is not an area is rejected.
-- -----------------------------------------------------------------------------

create or replace function public.zone_area_from_geojson(p_geojson jsonb)
returns extensions.geometry
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_geojson jsonb := p_geojson;
  v_geom extensions.geometry;
begin
  if v_geojson is null then
    raise exception 'Draw the delivery area on the map' using errcode = '22023';
  end if;
  if v_geojson ->> 'type' = 'Feature' then
    v_geojson := v_geojson -> 'geometry';
  end if;
  if coalesce(v_geojson ->> 'type', '') not in ('Polygon', 'MultiPolygon') then
    raise exception 'The delivery area must be a polygon' using errcode = '22023';
  end if;

  v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(v_geojson::text), 4326);
  v_geom := extensions.st_collectionextract(extensions.st_makevalid(v_geom), 3);
  v_geom := extensions.st_multi(v_geom);

  if v_geom is null or extensions.st_isempty(v_geom) or extensions.st_area(v_geom) = 0 then
    raise exception 'The delivery area is empty' using errcode = '22023';
  end if;
  if extensions.st_xmin(v_geom) < -180 or extensions.st_xmax(v_geom) > 180
     or extensions.st_ymin(v_geom) < -90 or extensions.st_ymax(v_geom) > 90 then
    raise exception 'The delivery area is outside the map' using errcode = '22023';
  end if;
  return v_geom;
end;
$$;

-- -----------------------------------------------------------------------------
-- Save a zone (insert when id is missing). Runs with the caller's rights, so
-- Row Level Security decides who may save it.
-- p_zone: { id?, branch_id, name_en, name_ar, area (GeoJSON), fee_fils,
--           min_order_fils, eta_minutes, color?, is_active?, sort_order? }
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
  return v_id;
end;
$$;

revoke execute on function public.save_delivery_zone(jsonb) from public, anon;
grant execute on function public.save_delivery_zone(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Which zones deliver to this point? Only active zones of active branches that
-- accept delivery. Cheapest fee first, then fastest. Public: customers call it
-- before signing in.
-- -----------------------------------------------------------------------------

create or replace function public.find_delivery_zone(p_lat double precision, p_lng double precision)
returns table (
  zone_id uuid,
  branch_id uuid,
  branch_slug text,
  branch_name_en text,
  branch_name_ar text,
  zone_name_en text,
  zone_name_ar text,
  fee_fils integer,
  min_order_fils integer,
  eta_minutes integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select z.id, b.id, b.slug, b.name_en, b.name_ar, z.name_en, z.name_ar,
         z.fee_fils, z.min_order_fils, z.eta_minutes
  from public.delivery_zones z
  join public.branches b on b.id = z.branch_id
  where p_lat between -90 and 90
    and p_lng between -180 and 180
    and z.is_active
    and b.is_active
    and b.accepts_delivery
    and extensions.st_covers(
      z.area,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)
    )
  order by z.fee_fils, z.eta_minutes, b.sort_order, z.sort_order;
$$;

grant execute on function public.find_delivery_zone(double precision, double precision) to anon, authenticated;
