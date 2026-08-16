-- ============================================================
-- WALLET V2 — cierre de RLS: `programa_lealtad` otorga INSERT/UPDATE
-- de TABLA COMPLETA a `authenticated` (dueño/colaborador vía
-- `gestiona_cuenta`/`es_colaborador_rancho`) — confirmado en el
-- inventario de Fase 2A. Eso significa que, sin este trigger, un
-- dueño podría escribir `diseno_version` o `cuenta_id_confirmada`
-- directo por la API REST, saltándose la lógica que las mantiene
-- (el trigger de versión, y el backfill de cuenta). Ninguna de las
-- dos expone datos de otro negocio — el riesgo es de INTEGRIDAD del
-- propio dato, no de fuga — pero "para cada columna nueva, revocar
-- escritura pública cuando no corresponda" es la regla explícita de
-- esta fase, y estas dos son de gestión exclusiva del sistema.
--
-- Mismo patrón que ya usa este archivo para `estado`/`plan_lealtad`
-- en otras migraciones (0148): un trigger que revierte el cambio si
-- quien lo hizo no es admin ni service_role, en vez de un CHECK
-- (que no puede distinguir quién ejecuta).
-- ============================================================

-- Las columnas en sí (decisiones-tablas.md §3 y §2 del inventario de
-- Fase 2A) — se crean acá, en el mismo archivo que las protege, para
-- que este archivo sea autosuficiente.
alter table programa_lealtad
  add column if not exists diseno_version integer not null default 1,
  add column if not exists cuenta_id_confirmada boolean not null default false;

comment on column programa_lealtad.diseno_version is
  'Wallet V2 — se incrementa solo (trigger), cada vez que cambia una '
  'columna pase_*. Permite a la sincronización distinguir "cambió el '
  'saldo" de "cambió el diseño" sin ambigüedad.';
comment on column programa_lealtad.cuenta_id_confirmada is
  'Wallet V2 — true cuando el backfill de cuenta_id (0157) confirmó '
  'esta fila con una relación inequívoca. Temporal: se retira en una '
  'migración de limpieza una vez cerrada la transición a cuenta_id '
  'NOT NULL (ver plan-migraciones.md).';

-- Todo lo que YA tiene cuenta_id (por el backfill de 0157, por el
-- backfill original de 0134, o por alta_cuenta_lealtad de acá en
-- adelante) queda marcado como confirmado en el mismo paso que crea
-- la columna — no hace falta una migración aparte para esto.
update programa_lealtad set cuenta_id_confirmada = true where cuenta_id is not null;

create or replace function public.programa_lealtad_proteger_columnas_sistema()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fase 2C, hallazgo con sesiones JWT reales (no de lectura de
  -- código): la versión original de este trigger era `before update
  -- of ...` únicamente — un INSERT directo por REST podía fijar
  -- diseno_version/cuenta_id_confirmada a cualquier valor desde el
  -- alta, porque el RLS de INSERT en programa_lealtad solo exige ser
  -- dueño del rancho, no restringe estas dos columnas. Se cubre acá
  -- también el caso INSERT, sin `old` disponible: se fuerza al default
  -- real de la columna en vez de comparar contra una fila anterior.
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and not public.is_admin() then
      new.diseno_version := 1;
      new.cuenta_id_confirmada := false;
    end if;
    return new;
  end if;

  if new.diseno_version is distinct from old.diseno_version
     or new.cuenta_id_confirmada is distinct from old.cuenta_id_confirmada then
    if auth.role() <> 'service_role' and not public.is_admin() then
      new.diseno_version := old.diseno_version;
      new.cuenta_id_confirmada := old.cuenta_id_confirmada;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists programa_lealtad_proteger_columnas_sistema_trg on programa_lealtad;
create trigger programa_lealtad_proteger_columnas_sistema_trg
  before insert or update of diseno_version, cuenta_id_confirmada on programa_lealtad
  for each row
  execute function public.programa_lealtad_proteger_columnas_sistema();

comment on trigger programa_lealtad_proteger_columnas_sistema_trg on programa_lealtad is
  'Wallet V2 — diseno_version y cuenta_id_confirmada son de gestión '
  'exclusiva del sistema (trigger de versión / backfill). Un dueño '
  'autenticado no puede pisarlas por la API REST, ni por INSERT ni '
  'por UPDATE, aunque la tabla tenga acceso de tabla completa para '
  'authenticated.';
