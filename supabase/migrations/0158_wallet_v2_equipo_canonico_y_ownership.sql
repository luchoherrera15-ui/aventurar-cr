-- ============================================================
-- WALLET V2 — Migración A (parte 3): cuentas_equipo como canon +
-- validación de ownership consistente entre rancho_id y cuenta_id
--
-- ------------------------------------------------------------
-- 1. EQUIVALENCIA DE ROLES: rancho_colaboradores → cuentas_equipo
-- ------------------------------------------------------------
-- Tabla de equivalencia (documentada también en
-- docs/wallet-v2/migracion-legacy.md):
--
-- | Rol legacy (rancho_colaboradores.rol) | Rol en cuenta (cuentas_equipo.rol) | Permisos de Lealtad |
-- |---|---|---|
-- | administrador | colaborador | {acreditar,canjear,revertir,auditoria}: true los 4 — es lo que "opera todo el módulo" ya significa hoy |
-- | empleado       | colaborador | Copiado TAL CUAL de permisos_lealtad — nunca ampliado |
--
-- Ningún rol legacy se traduce a cuentas_equipo.rol = 'administrador'.
-- Ese rol en `cuentas_equipo` habilita `gestiona_cuenta()` — manejar la
-- CUENTA entera (plan, equipo, billing) —, un alcance que ningún
-- colaborador de `rancho_colaboradores` tuvo nunca. Traducirlo así
-- sería la escalada de privilegios que esta migración tiene prohibido
-- producir. Los dos roles legacy conocidos tienen equivalencia segura
-- (ambos a 'colaborador', diferenciados solo por el checklist) — no
-- hay ningún valor de `rol` fuera de {administrador, empleado} posible
-- hoy (lo exige el CHECK de 0127), así que no queda ningún caso sin
-- traducción definida.
--
-- SOLO se migra un colaborador cuando existe una relación VERIFICADA
-- rancho→cuenta (join real contra `cuentas.rancho_id`, no una
-- suposición). Si el rancho de ese colaborador todavía no tiene cuenta
-- (backfill pendiente, ver 0157 y `wallet_v2_backfill_pendientes`),
-- el colaborador simplemente no se migra en esta corrida — se migrará
-- solo cuando el rancho tenga cuenta, porque esta migración es segura
-- de correr de nuevo.
--
-- IDEMPOTENTE: `on conflict (cuenta_id, usuario_id) do nothing` — si
-- el usuario ya está en `cuentas_equipo` (por ejemplo como
-- 'propietario', sembrado por `alta_cuenta_lealtad`), esta migración
-- NUNCA lo sobrescribe ni lo duplica. Correrla dos veces no cambia
-- nada la segunda vez.
-- ------------------------------------------------------------

insert into cuentas_equipo (cuenta_id, usuario_id, rol, permisos)
select
  c.id,
  rc.usuario_id,
  'colaborador',
  case
    when rc.rol = 'administrador' then
      '{"acreditar": true, "canjear": true, "revertir": true, "auditoria": true}'::jsonb
    else
      coalesce(rc.permisos_lealtad, '{}'::jsonb)
  end
from rancho_colaboradores rc
join cuentas c on c.rancho_id = rc.rancho_id
where rc.rol in ('administrador', 'empleado')  -- defensivo: los únicos valores que el CHECK de 0127 permite
on conflict (cuenta_id, usuario_id) do nothing;

-- ------------------------------------------------------------
-- 2. Vista de fallback pendiente — colaboradores de rancho cuyo
--    negocio TODAVÍA no tiene cuenta, y por eso no pudieron migrarse
--    en el paso 1. El código de aplicación (equipo-canonico.ts) sigue
--    resolviendo estos casos contra `rancho_colaboradores` y LOGUEA
--    cada vez que lo hace — este es el universo que ese log mide.
-- ------------------------------------------------------------
create or replace view public.wallet_v2_equipo_fallback_pendiente as
select rc.rancho_id, rc.usuario_id, rc.rol
from rancho_colaboradores rc
where not exists (select 1 from cuentas c where c.rancho_id = rc.rancho_id);

revoke all on public.wallet_v2_equipo_fallback_pendiente from public, anon, authenticated;
grant select on public.wallet_v2_equipo_fallback_pendiente to service_role;

comment on view public.wallet_v2_equipo_fallback_pendiente is
  'Wallet V2 — colaboradores que el código todavía resuelve vía '
  'rancho_colaboradores (fallback) porque su rancho no tiene cuenta. '
  'Condición objetiva de retiro del fallback: 0 filas acá Y 30 días '
  'consecutivos sin logs de fallback en producción (ver equipo-canonico.ts).';


-- ------------------------------------------------------------
-- 3. Validación de ownership consistente entre rancho_id y cuenta_id
-- ------------------------------------------------------------
-- La Fase 2A pidió una prueba/validación de que, cuando un programa
-- tiene los dos padres a la vez, no representen dos dueños distintos.
-- Se implementa como CHECK real (no solo test de aplicación) vía
-- trigger — un `check` declarativo no puede hacer un join contra
-- `ranchos`/`cuentas`, así que la única forma de hacerlo cumplir en la
-- base (y no solo en un test que alguien podría no correr) es un
-- trigger que lo verifica en cada INSERT/UPDATE relevante.
create or replace function public.programa_lealtad_verificar_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_rancho uuid;
  v_owner_cuenta uuid;
begin
  if new.rancho_id is null or new.cuenta_id is null then
    return new;
  end if;

  select owner_id into v_owner_rancho from ranchos where id = new.rancho_id;
  select owner_id into v_owner_cuenta from cuentas where id = new.cuenta_id;

  if v_owner_rancho is not null and v_owner_cuenta is not null and v_owner_rancho <> v_owner_cuenta then
    raise exception
      'programa_lealtad: rancho_id (dueño %) y cuenta_id (dueño %) no coinciden — dos padres con dueños distintos',
      v_owner_rancho, v_owner_cuenta
      using errcode = '23514'; -- check_violation
  end if;

  return new;
end;
$$;

drop trigger if exists programa_lealtad_ownership_trg on programa_lealtad;
create trigger programa_lealtad_ownership_trg
  before insert or update of rancho_id, cuenta_id on programa_lealtad
  for each row
  execute function public.programa_lealtad_verificar_ownership();

comment on trigger programa_lealtad_ownership_trg on programa_lealtad is
  'Wallet V2 — bloquea que un programa quede con rancho_id y cuenta_id '
  'de dueños distintos. Fase 2A §5 de decisiones-tablas.md.';
