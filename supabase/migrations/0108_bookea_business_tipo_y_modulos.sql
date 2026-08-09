-- ============================================================
-- BOOKEA BUSINESS — Fase 1: tipo de negocio y módulos (0108)
--
-- El panel del dueño hoy se decide por `vertical`: si es 'citas' se
-- muestran cuatro cosas, si no, otras cuatro. Eso alcanzó para dos
-- verticales, pero no para que la MISMA infraestructura atienda a una
-- barbería y a un estudio de pilates: uno necesita agenda por
-- profesional y el otro clases, membresías y check-in.
--
-- La solución NO es una vertical nueva ni un clon del sistema. Son dos
-- ejes independientes:
--
--   `vertical`      — el MARKETPLACE: en qué directorio te encuentra el
--                     cliente (eventos, citas, hospedajes, restaurantes).
--                     NO SE TOCA en esta migración.
--
--   `tipo_negocio`  — la OPERACIÓN: qué administra el dueño. Un gimnasio
--                     se publica en el directorio de Citas (se reserva
--                     por hora) pero administra con módulos de fitness.
--
-- Dos piezas, las dos ADITIVAS (la app móvil no se entera):
--
--  1. `ranchos.tipo_negocio` — ANULABLE a propósito. En null se DERIVA
--     de (vertical, categoria) en el código, así que ningún negocio
--     existente necesita que se le escriba nada: una barbería con
--     categoria='barberia' ya se comporta como tipo 'barberia' sin que
--     nadie corra un update. Se llena solo cuando el dueño lo cambia a
--     mano (o cuando el tipo no se puede adivinar de la categoría, que
--     es justo el caso del gimnasio publicado en 'otros').
--
--  2. `modulos_negocio` — qué módulos tiene encendidos cada negocio.
--     Guarda SOLO LAS DIFERENCIAS contra el default de su tipo: sin
--     filas, el negocio se comporta exactamente como su tipo manda. Eso
--     mantiene la tabla chica y hace que cambiar un default en el código
--     alcance a todos los negocios que no opinaron.
--
--     A DIFERENCIA de `addons_negocio` (0077), acá el DUEÑO SÍ ESCRIBE:
--     un módulo no es algo que se cobre, es cómo el dueño organiza su
--     panel — apagar "Clases" no le regala nada a nadie. Lo cobrable
--     sigue viviendo en `addons_negocio`, y el motor de módulos exige
--     las dos cosas para las pantallas de pago (módulo encendido Y
--     add-on vigente).
--
-- Nada se borra y nada se reescribe. Es seguro correr esta migración
-- varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El tipo de negocio (operativo, no de marketplace)
-- ------------------------------------------------------------

alter table ranchos add column if not exists tipo_negocio text;

-- La lista incluye los tipos de las verticales que ya existen
-- (eventos_*, hospedaje, restaurante) para que TODO negocio pueda
-- tener uno y el motor de módulos trate a todos igual, sin casos
-- especiales.
alter table ranchos drop constraint if exists ranchos_tipo_negocio_check;
alter table ranchos add constraint ranchos_tipo_negocio_check
  check (
    tipo_negocio is null
    or tipo_negocio in (
      -- Servicios con cita (belleza y bienestar)
      'barberia', 'salon_belleza', 'unas', 'spa', 'masajes',
      -- Salud y profesionales independientes
      'consultorio', 'profesional',
      -- Fitness y estudios
      'gimnasio', 'crossfit', 'pilates', 'yoga', 'academia', 'entrenador',
      -- Las verticales que ya existían
      'eventos_lugar', 'eventos_proveedor', 'hospedaje', 'restaurante',
      'otro'
    )
  );

comment on column ranchos.tipo_negocio is
  'Tipo OPERATIVO del negocio: decide módulos y panel. null = se deriva '
  'de (vertical, categoria) en el código. No confundir con `vertical`, '
  'que es el directorio público donde aparece.';

-- El panel dinámico y los reportes del admin filtran por tipo.
create index if not exists ranchos_tipo_negocio_idx
  on ranchos (tipo_negocio)
  where tipo_negocio is not null;

-- ------------------------------------------------------------
-- 2. Los módulos encendidos/apagados de cada negocio
-- ------------------------------------------------------------

create table if not exists modulos_negocio (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  -- El slug del módulo. La lista viva está en src/lib/business/modulos.ts;
  -- acá se admiten TAMBIÉN los que todavía no tienen pantalla (fases 3 a
  -- 6) para no necesitar una migración por cada uno. Un id que el código
  -- no conozca simplemente se ignora al resolver.
  modulo text not null check (modulo in (
    -- Core
    'agenda', 'clientes', 'servicios', 'equipo', 'recursos',
    'pagos', 'reportes',
    -- Fitness / studios
    'membresias', 'clases', 'paquetes', 'checkin',
    -- Crecimiento
    'marketing',
    -- Todavía sin pantalla (admitidos para no volver a migrar)
    'facturacion', 'sitio_web', 'sucursales'
    -- OJO: acá NO van 'lealtad' ni 'asistente_ia'. Esos son COMPLEMENTOS
    -- DE PAGO y ya viven en `addons_negocio` (0077/0090), que además es
    -- solo-servidor. Tenerlos también como módulo sería el mismo dato en
    -- dos tablas con dos reglas de escritura distintas.
  )),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una sola opinión por módulo y negocio: la fila ES la diferencia
  -- contra el default de su tipo.
  unique (rancho_id, modulo)
);

create index if not exists modulos_negocio_rancho_idx
  on modulos_negocio (rancho_id);

alter table modulos_negocio enable row level security;

-- El dueño (y un admin que entra a ayudarlo) lee y escribe los módulos
-- de SUS negocios y de ningún otro. El `rancho_id` nunca se cree del
-- navegador: la política lo ata a `ranchos.owner_id` del lado de la base.
drop policy if exists "El dueño administra sus módulos" on modulos_negocio;
create policy "El dueño administra sus módulos" on modulos_negocio
  for all to authenticated
  using (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  )
  with check (
    is_admin()
    or rancho_id in (select id from ranchos where owner_id = auth.uid())
  );

grant select, insert, update, delete on modulos_negocio to authenticated;
grant all on modulos_negocio to service_role;

comment on table modulos_negocio is
  'Diferencias contra los módulos por defecto del tipo_negocio. Sin '
  'filas = el negocio usa exactamente el default de su tipo.';

notify pgrst, 'reload schema';
