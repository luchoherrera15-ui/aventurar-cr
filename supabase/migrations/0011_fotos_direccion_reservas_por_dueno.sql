-- ============================================================
-- AVENTUREA CR — Hace el marketplace funcional de verdad para
-- cada dueño: foto principal, dirección exacta, precios propios
-- por rancho, y reservas que cada dueño puede ver y aprobar.
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Foto principal, dirección exacta y precios propios en ranchos
-- ------------------------------------------------------------

alter table ranchos add column if not exists foto_url text;
alter table ranchos add column if not exists direccion_exacta text;
alter table ranchos add column if not exists deposito_reserva numeric not null default 25000;
alter table ranchos add column if not exists tarifa_diciembre_por_persona numeric;

-- ------------------------------------------------------------
-- 2. Precios y servicios pasan a ser por rancho, no globales
-- ------------------------------------------------------------

alter table precio_tiers add column if not exists rancho_id uuid references ranchos(id) on delete cascade;
alter table servicios_adicionales add column if not exists rancho_id uuid references ranchos(id) on delete cascade;

update precio_tiers
set rancho_id = (select id from ranchos where nombre = 'Aventurea CR — Rancho de Eventos' limit 1)
where rancho_id is null;

update servicios_adicionales
set rancho_id = (select id from ranchos where nombre = 'Aventurea CR — Rancho de Eventos' limit 1)
where rancho_id is null;

-- El depósito y la tarifa de diciembre que ya tenías configurados pasan
-- de la vieja tabla "configuracion_rancho" a la fila de tu propio rancho.
update ranchos
set
  deposito_reserva = coalesce((select deposito_reserva from configuracion_rancho limit 1), deposito_reserva),
  tarifa_diciembre_por_persona = (select tarifa_diciembre_por_persona from configuracion_rancho limit 1)
where nombre = 'Aventurea CR — Rancho de Eventos';

grant select, insert, update, delete on precio_tiers to anon, authenticated;
grant select, insert, update, delete on servicios_adicionales to anon, authenticated;

drop policy if exists "El equipo administra los precios" on precio_tiers;
create policy "El equipo administra los precios" on precio_tiers
  for all to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()))
  with check (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

drop policy if exists "El equipo administra los servicios" on servicios_adicionales;
create policy "El equipo administra los servicios" on servicios_adicionales
  for all to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()))
  with check (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- 2b. Ojo: los índices que evitan doble reserva de una fecha eran
-- globales (por fecha nada más). Con varios ranchos, cada uno
-- necesita su propia disponibilidad — si no, un rancho en Alajuela
-- bloquearía por error una fecha para un rancho en Limón.
-- ------------------------------------------------------------

drop index if exists unique_confirmed_date;
create unique index unique_confirmed_date
  on reservas (rancho_id, fecha)
  where estado = 'confirmada';

drop index if exists unique_temporal_date;
create unique index unique_temporal_date
  on reservas (rancho_id, fecha)
  where estado = 'temporal';

-- ------------------------------------------------------------
-- 3. La disponibilidad pública ahora indica de qué rancho es
-- ------------------------------------------------------------

create or replace view disponibilidad_rancho as
  select fecha, estado, rancho_id
  from reservas
  where estado in ('pendiente', 'confirmada')
     or (estado = 'temporal' and expira_en > now());

grant select on disponibilidad_rancho to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Cada dueño ve y aprueba las reservas de su propio rancho
-- ------------------------------------------------------------

drop policy if exists "El equipo ve todas las reservas" on reservas;
create policy "El equipo ve todas las reservas" on reservas
  for select to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

drop policy if exists "El equipo edita las reservas" on reservas;
create policy "El equipo edita las reservas" on reservas
  for update to authenticated
  using (is_admin() or rancho_id in (select id from ranchos where owner_id = auth.uid()));

-- ------------------------------------------------------------
-- 4b. Ojo: antes CUALQUIER cuenta con sesión podía ver el comprobante
-- de pago de CUALQUIER reserva (con solo saber la ruta del archivo).
-- Ahora solo lo ve el admin o el dueño del rancho de esa reserva.
-- ------------------------------------------------------------

create or replace function public.puede_ver_comprobante(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1
    from reservas r
    join ranchos ra on ra.id = r.rancho_id
    where r.deposito_comprobante_url = path
      and ra.owner_id = auth.uid()
  );
$$;

grant execute on function public.puede_ver_comprobante(text) to authenticated;

drop policy if exists "El equipo puede ver los comprobantes" on storage.objects;
create policy "El equipo puede ver los comprobantes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'comprobantes' and puede_ver_comprobante(name));

-- ------------------------------------------------------------
-- 5. Storage para las fotos principales de cada rancho
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('ranchos-fotos', 'ranchos-fotos', true)
on conflict (id) do nothing;

drop policy if exists "Cualquiera ve las fotos de ranchos" on storage.objects;
create policy "Cualquiera ve las fotos de ranchos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'ranchos-fotos');

drop policy if exists "Cuentas con sesión suben fotos de ranchos" on storage.objects;
create policy "Cuentas con sesión suben fotos de ranchos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ranchos-fotos');

drop policy if exists "Cuentas con sesión reemplazan fotos de ranchos" on storage.objects;
create policy "Cuentas con sesión reemplazan fotos de ranchos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ranchos-fotos');

drop policy if exists "Cuentas con sesión borran fotos de ranchos" on storage.objects;
create policy "Cuentas con sesión borran fotos de ranchos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ranchos-fotos');
