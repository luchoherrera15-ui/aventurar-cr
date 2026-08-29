-- ============================================================
--  MODERADORES DE LEALTAD (vendedores con referidos) — 29 ago 2026
-- ============================================================
--
-- El flujo que pidió el dueño: una persona se REGISTRA como usuario
-- normal, y desde /admin se le da el rol de «moderador». El moderador
-- reparte un código de 4 dígitos; cada negocio que se da de alta con su
-- código queda amarrado a él (solicitudes_lealtad.agente_id, 0219). El
-- moderador entra por /admin con su cuenta y ve SOLO su panel de
-- moderación: cuántos negocios inscribió y cuánto gana por mes
-- (comisión RECURRENTE: por cada negocio activo que trajo, gana su
-- comisión cada mes).

-- 1) Nuevo rol en perfiles.
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('admin', 'dueno_rancho', 'cliente', 'moderador'));

-- 2) El agente (0219) ahora se enlaza al USUARIO registrado que lo es, y
--    lleva su comisión mensual por negocio activo.
alter table public.agentes_lealtad
  add column if not exists usuario_id uuid
    references auth.users (id) on delete set null,
  add column if not exists comision_mensual numeric not null default 0
    check (comision_mensual >= 0);

comment on column public.agentes_lealtad.usuario_id is
  'La cuenta registrada que ES este moderador (perfiles.rol=moderador). Su panel se abre con esta sesión.';
comment on column public.agentes_lealtad.comision_mensual is
  'Comisión en colones por cada negocio activo que trajo, POR MES (ingreso recurrente).';

-- Un usuario no puede ser dos agentes.
create unique index if not exists agentes_lealtad_usuario_uidx
  on public.agentes_lealtad (usuario_id)
  where usuario_id is not null;

-- La tabla sigue con RLS encendida y SIN políticas: solo el service role
-- (las server actions del admin y del panel del moderador, que ya
-- verifican quién es quién) la toca. Ver 0219.

notify pgrst, 'reload schema';
