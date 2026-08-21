
-- ─────────────────────────────────────────────────────────────────────
-- 0196: Geo-Push — las ubicaciones del negocio para el pase de Wallet.
--
-- El dueño registra puntos (lat/lng + mensaje) y el pase de Apple los
-- lleva en `locations`: el iPhone muestra el mensaje en la pantalla
-- bloqueada cuando el cliente pasa cerca (radio ~100 m, lo fija iOS,
-- no nosotros). Google Wallet NO tiene un equivalente igual y no se
-- inventa: `google.ts` no escribe ubicaciones, y la pantalla lo dice.
--
-- La tabla es POR NEGOCIO (rancho) y no por programa, a propósito: el
-- local queda donde queda sin importar cuántas tarjetas emita, y el
-- generador (`src/lib/wallet/generar.ts`) ya trabaja por rancho.
--
-- DOS TOPES, y no son el mismo:
--   · 10 por negocio — el límite de Apple por pase. Es un techo DURO y
--     lo remacha un trigger acá, porque un tope que solo vive en
--     TypeScript es decorativo.
--   · el del PAQUETE (planes.ts: prueba 1, starter 1, impulso 3,
--     ilimitado 10) — lo hace cumplir la server action
--     (`ubicaciones-actions.ts`), como todos los topes de plan.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists lealtad_ubicaciones (
  id        uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- Cómo la reconoce el dueño en su lista («Local de Escazú»).
  nombre   text not null check (char_length(nombre) between 1 and 80),

  -- Coordenadas del punto. Los CHECK son el rango válido del planeta:
  -- una latitud de 200 no es un dato, es un error de tipeo.
  latitud  numeric not null check (latitud >= -90 and latitud <= 90),
  longitud numeric not null check (longitud >= -180 and longitud <= 180),

  -- Lo que el iPhone pinta en la pantalla bloqueada (`relevantText`).
  -- 120 como el mensaje promocional (0183): más largo se corta en el
  -- teléfono y la promesa de «tu mensaje» dejaría de ser verdad.
  mensaje  text not null check (char_length(mensaje) between 1 and 120),

  created_at timestamptz not null default now()
);

comment on table lealtad_ubicaciones is
  'Geo-Push del pase de Apple: puntos (lat/lng) con mensaje que el iPhone muestra en pantalla bloqueada al pasar cerca (~100 m). Máx. 10 por negocio (límite de Apple, trigger); el tope por paquete lo exige la server action.';
comment on column lealtad_ubicaciones.mensaje is
  'El relevantText del pase: lo que se lee en la pantalla bloqueada. Tope 120, como el mensaje promocional (0183).';

create index if not exists lealtad_ubicaciones_rancho_idx
  on lealtad_ubicaciones (rancho_id);

-- ── El techo de Apple: 10 por negocio, remachado en la base ──────────
-- Un CHECK no puede contar filas, así que va por trigger. El `for
-- update` sobre la fila del rancho serializa dos inserts simultáneos
-- del mismo negocio: sin él, dos pestañas contando 9 a la vez meten 11.
create or replace function public.lealtad_ubicaciones_tope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.ranchos r where r.id = new.rancho_id for update;

  if (select count(*)
        from public.lealtad_ubicaciones u
       where u.rancho_id = new.rancho_id) >= 10 then
    raise exception 'Apple Wallet acepta 10 ubicaciones por pase como máximo.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- La 0083 revocó el EXECUTE por defecto; un trigger no lo necesita
-- para dispararse, pero se deja explícito que nadie la llama a mano.
revoke all on function public.lealtad_ubicaciones_tope() from public, anon, authenticated;

drop trigger if exists lealtad_ubicaciones_tope_trg on lealtad_ubicaciones;
create trigger lealtad_ubicaciones_tope_trg
  before insert on lealtad_ubicaciones
  for each row execute function public.lealtad_ubicaciones_tope();

-- ── RLS: del dueño y de nadie más ────────────────────────────────────
-- Lectura pública NO, ni siquiera select para anon: el pase se arma en
-- el SERVIDOR con la llave de servicio (generar.ts), así que ningún
-- cliente necesita leer esta tabla. Dueño del negocio (patrón 0127:
-- owner_id, no gestiona_rancho — registrar ubicaciones es identidad
-- del negocio, no operación de mostrador) o admin de la plataforma.

alter table lealtad_ubicaciones enable row level security;

drop policy if exists "El dueño ve sus ubicaciones" on lealtad_ubicaciones;
create policy "El dueño ve sus ubicaciones" on lealtad_ubicaciones
  for select using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño agrega ubicaciones" on lealtad_ubicaciones;
create policy "El dueño agrega ubicaciones" on lealtad_ubicaciones
  for insert with check (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño corrige sus ubicaciones" on lealtad_ubicaciones;
create policy "El dueño corrige sus ubicaciones" on lealtad_ubicaciones
  for update using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  ) with check (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists "El dueño elimina sus ubicaciones" on lealtad_ubicaciones;
create policy "El dueño elimina sus ubicaciones" on lealtad_ubicaciones
  for delete using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

-- Sin grants la RLS más perfecta da "permission denied" (lección 0119).
grant select, insert, update, delete on lealtad_ubicaciones to authenticated;
grant all on lealtad_ubicaciones to service_role;
