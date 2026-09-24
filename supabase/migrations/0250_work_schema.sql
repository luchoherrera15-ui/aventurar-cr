-- ============================================================
-- 0250 — BOOKEA WORK entra a la base del marketplace
-- ============================================================
--
-- Consolida las 23 migraciones del proyecto Supabase propio de Bookea
-- Work (ref kcatxzuoaajxlmvczolk) dentro de un schema `work` en la base
-- del marketplace, para poder apagar ese proyecto y dejar de pagar su
-- add-on de cómputo Micro (~$10/mes).
--
-- POR QUÉ UN SCHEMA Y NO `public`: dos tablas de Work se llaman igual
-- que dos del marketplace y significan cosas distintas —
-- `invitaciones` (acá: invitaciones digitales, 36 columnas) y
-- `membresias` (acá: paquetes de sesiones de un rancho). Un schema
-- aparte esquiva el choque sin renombrar ni una tabla ni una consulta,
-- y deja `public` como estaba. Precedente en esta misma base:
-- `bookea_interno`.
--
-- CÓMO SE HIZO: el SQL de abajo es el de Work TAL CUAL se aplicó y se
-- verificó en su proyecto, con cuatro reescrituras y nada más — el
-- search_path hace el resto (en 3 724 líneas había UNA sola referencia
-- calificada a `public.`). Las reescrituras: el `set search_path` de
-- cada función pasa a `work, public`; `public.bitacora_auditoria` pasa
-- a `work.`; el `alter default privileges` apunta a `work`; y el
-- bucket `documentos` pasa a `work-documentos` (acá conviven 8 buckets
-- y el nombre a secas sería ambiguo).
--
-- NO TRAE DATOS. Las 2 organizaciones que vivían en Work eran una demo
-- y una prueba del dueño — confirmado antes de escribir esto. La base
-- arranca vacía.
-- ============================================================

create schema if not exists work;

-- PostgREST se conecta como anon/authenticated: sin USAGE en el schema
-- ni siquiera llega a evaluar RLS. El candado real lo siguen poniendo
-- los grants por tabla (que las migraciones de abajo revocan para anon)
-- y las políticas.
grant usage on schema work to anon, authenticated, service_role;

-- A partir de acá, cada `create table empleados` de las migraciones de
-- Work nace como `work.empleados`, y cada `references empleados(id)`
-- resuelve al mismo lugar. Las referencias a `auth.` y `storage.` van
-- calificadas en el original, así que siguen apuntando donde deben.
set search_path = work, public;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0001_nucleo_multi_tenant.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — Núcleo multi-tenant de MVP 1
-- Implementa docs/bookea-work/ARCHITECTURE_GATE.md §1, §2, §4.1-§4.2, §5
-- del repo aventurar-cr (documento fuente, no se duplica acá).
-- Correr una sola vez en el SQL Editor del proyecto de Supabase PROPIO
-- de Work — nunca el del marketplace.
--
-- Revisada por una auditoría adversarial (workflow de seguridad, ago
-- 2026) contra las tres cosas que pedía el dueño: escalada cross-
-- tenant vía los `security definer`, cobertura completa de RLS, y
-- fuga de columnas sensibles por grants de tabla completa. El hallazgo
-- más grave —`for insert, update, delete` en un solo `create policy`
-- es sintaxis inválida en Postgres y hubiera abortado el pegado
-- completo— está corregido en todo el archivo (cada verbo con su
-- propia política, porque además INSERT no admite USING y DELETE no
-- admite WITH CHECK).
-- ============================================================

create extension if not exists pgcrypto;

-- Supabase (tanto el proyecto hospedado como el bootstrap local de la
-- CLI) deja `alter default privileges ... grant all on tables to anon,
-- authenticated, service_role` puesto de fábrica en el esquema
-- `public` — CONFIRMADO corriendo esta migración contra un Postgres
-- real: cada `create table` de acá abajo nace con `anon`/`authenticated`
-- ya con INSERT/SELECT/UPDATE/DELETE/TRUNCATE de TABLA COMPLETA, antes
-- de que cualquier `grant` de este archivo corra. Sin este REVOKE
-- primero, cada "grant select (columnas seguras)" o "grant update
-- (columnas seguras)" de más abajo se queda pegado ENCIMA de ese
-- acceso total default, no lo reemplaza — Postgres acumula grants, así
-- que la restricción por columna quedaba completamente inerte (cédula,
-- salario, cuenta bancaria, todo seguía siendo select/update de tabla
-- completa igual). Esto aplica solo a `anon`/`authenticated`:
-- `service_role` sigue recibiendo `grant all` explícito en cada tabla,
-- así que no pierde nada.
alter default privileges in schema work revoke all on tables from anon, authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 1. IDENTIDAD Y ORGANIZACIÓN
-- ══════════════════════════════════════════════════════════════════

create table organizaciones (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  cedula_juridica   text not null unique,
  plan              text not null default 'prueba'
                      check (plan in ('prueba', 'activo', 'suspendido')),
  estado            text not null default 'activa'
                      check (estado in ('activa', 'inactiva')),
  creado_en         timestamptz not null default now()
);

create table membresias (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  usuario_id        uuid not null references auth.users(id) on delete cascade,
  rol               text not null
                      check (rol in ('propietario','admin_rrhh','gerente','empleado')),
  permisos          jsonb not null default '{}'::jsonb,
  estado            text not null default 'activa'
                      check (estado in ('activa','invitada','suspendida')),
  invitado_por      uuid references auth.users(id) on delete set null,
  creado_en         timestamptz not null default now(),
  unique (organizacion_id, usuario_id)
);

create index membresias_usuario_id_idx on membresias (usuario_id);

-- ══════════════════════════════════════════════════════════════════
-- 2. LOS DOS HELPERS `security definer` (Gate §2.1)
--    Solo se llaman desde políticas de OTRAS tablas. La política de
--    `membresias` sobre sí misma nunca los usa — corta el ciclo de
--    recursión antes de que exista.
-- ══════════════════════════════════════════════════════════════════

create or replace function gestiona_organizacion(p_org uuid)
returns boolean
language sql security definer stable
set search_path = work, public
as $$
  select exists (
    select 1 from membresias
    where organizacion_id = p_org
      and usuario_id = auth.uid()
      and rol in ('propietario', 'admin_rrhh')
      and estado = 'activa'
  );
$$;

create or replace function pertenece_a_organizacion(p_org uuid)
returns boolean
language sql security definer stable
set search_path = work, public
as $$
  select exists (
    select 1 from membresias
    where organizacion_id = p_org
      and usuario_id = auth.uid()
      and estado = 'activa'
  );
$$;

-- Mínimo privilegio explícito: sin esto, Postgres deja el EXECUTE por
-- default de PUBLIC (incluye `anon`). Hoy no es explotable (ambas
-- comparan contra `auth.uid()`, que es null para `anon`, y no hay
-- forma de distinguir "organización inexistente" de "existe pero sin
-- membresía" — no sirve de oráculo), pero documentarlo evita que se
-- vuelva un problema si el cuerpo de estas funciones cambia algún día.
revoke execute on function gestiona_organizacion(uuid), pertenece_a_organizacion(uuid) from public;
grant execute on function gestiona_organizacion(uuid), pertenece_a_organizacion(uuid) to authenticated;

-- ── RLS: organizaciones ──────────────────────────────────────────
alter table organizaciones enable row level security;

create policy "Miembros ven su organización" on organizaciones
  for select to authenticated
  using (pertenece_a_organizacion(id));

create policy "Quien gestiona la organización la edita" on organizaciones
  for update to authenticated
  using (gestiona_organizacion(id))
  with check (gestiona_organizacion(id));

-- Sin política de insert/delete para `authenticated`: el alta de una
-- organización nueva (fila de `organizaciones` + membresía inicial de
-- `propietario` en una sola transacción) la hace el servidor con
-- service_role — en ese instante todavía no existe ninguna membresía
-- activa que `pertenece_a_organizacion`/`gestiona_organizacion` puedan
-- verificar.

grant select on organizaciones to authenticated;
-- GRANT POR COLUMNA, no de tabla completa: la política de arriba solo
-- exige "gestiona esta fila", nunca restringe QUÉ columnas cambia. Sin
-- esto, un propietario cuya organización quedó `estado='inactiva'` o
-- `plan='suspendido'` por el backend de cobro podría reactivarse o
-- subir de plan solo con un UPDATE directo desde el cliente —
-- `plan`/`estado` los escribe exclusivamente el servidor, en el mismo
-- punto de código que procesa el pago/la suspensión.
grant update (nombre) on organizaciones to authenticated;
grant all on organizaciones to service_role;

-- ── RLS: membresias (Gate §2.1 — compara columnas a mano) ───────
alter table membresias enable row level security;

create policy "El usuario ve su propia membresía" on membresias
  for select to authenticated
  using (usuario_id = auth.uid());

-- Sin insert/update/delete para `authenticated`, ni siquiera sobre la
-- propia fila: invitar, cambiar rol o suspender es un privilegio de
-- `propietario`/`admin_rrhh` sobre OTRAS filas, y esta tabla es
-- justamente la que no puede resolver eso vía RLS sin recursión (por
-- qué: ver el comentario de arriba de los helpers). La gestión de
-- membresías corre en el servidor con service_role, después de
-- resolver el permiso en TypeScript (Gate §3.2/§3.3) contra la propia
-- fila del actor (esa sí visible por la política de arriba).

grant select on membresias to authenticated;
grant all on membresias to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 3. ESTRUCTURA ORGANIZATIVA
--    Patrón repetido de Gate §2.2 para toda tabla con organizacion_id
--    directo y sin columna sensible: select para cualquier miembro
--    activo, insert/update/delete solo para quien gestiona la org.
--    `organizacion_id` queda fuera del grant de UPDATE en las cuatro
--    (mismo motivo que en `empleados`, ver más abajo): sin eso,
--    alguien que gestiona dos organizaciones podría re-parentar una
--    sede/depto/puesto/centro de costo de una hacia la otra con un
--    UPDATE directo, sin tocar RLS.
-- ══════════════════════════════════════════════════════════════════

create table sedes (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  nombre            text not null,
  provincia         text check (provincia is null or provincia in (
                      'San José', 'Alajuela', 'Cartago', 'Heredia',
                      'Guanacaste', 'Puntarenas', 'Limón'
                    )),
  canton            text,
  activa            boolean not null default true
);
create index sedes_organizacion_id_idx on sedes (organizacion_id);

create table departamentos (
  id                    uuid primary key default gen_random_uuid(),
  organizacion_id       uuid not null references organizaciones(id) on delete cascade,
  nombre                text not null,
  departamento_padre_id uuid references departamentos(id) on delete set null,
  activo                boolean not null default true
);
create index departamentos_organizacion_id_idx on departamentos (organizacion_id);
create index departamentos_padre_id_idx on departamentos (departamento_padre_id);

create table puestos (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  departamento_id   uuid references departamentos(id) on delete set null,
  nombre            text not null,
  activo            boolean not null default true
);
create index puestos_organizacion_id_idx on puestos (organizacion_id);
create index puestos_departamento_id_idx on puestos (departamento_id);

create table centros_costo (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  codigo            text not null,
  nombre            text not null,
  activo            boolean not null default true,
  unique (organizacion_id, codigo)
);
create index centros_costo_organizacion_id_idx on centros_costo (organizacion_id);

do $$
declare
  t text;
begin
  foreach t in array array['sedes', 'departamentos', 'puestos', 'centros_costo']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "Miembros ven su organización" on %I for select to authenticated using (pertenece_a_organizacion(organizacion_id))',
      t
    );
    -- Tres políticas, una por verbo — nunca "for insert, update, delete"
    -- combinado: esa lista separada por comas no es válida en Postgres
    -- (CREATE POLICY solo acepta UN comando por FOR), y además INSERT
    -- no admite USING ni DELETE admite WITH CHECK.
    execute format(
      'create policy "Insertar en la organización" on %I for insert to authenticated with check (gestiona_organizacion(organizacion_id))',
      t
    );
    execute format(
      'create policy "Actualizar en la organización" on %I for update to authenticated using (gestiona_organizacion(organizacion_id)) with check (gestiona_organizacion(organizacion_id))',
      t
    );
    execute format(
      'create policy "Eliminar en la organización" on %I for delete to authenticated using (gestiona_organizacion(organizacion_id))',
      t
    );
    execute format('grant select, insert, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

-- UPDATE por columna, sin `organizacion_id` — re-parenting entre
-- tenants (ver comentario de la sección). Las cuatro tablas no
-- comparten columnas (cada una tiene las suyas), así que esto va
-- explícito por tabla en vez de dentro del loop genérico de arriba.
grant update (nombre, provincia, canton, activa) on sedes to authenticated;
grant update (nombre, departamento_padre_id, activo) on departamentos to authenticated;
grant update (departamento_id, nombre, activo) on puestos to authenticated;
grant update (codigo, nombre, activo) on centros_costo to authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 4. EMPLEADOS — el registro laboral (Gate §4.1 clasifica cada campo)
-- ══════════════════════════════════════════════════════════════════

create table empleados (
  id                    uuid primary key default gen_random_uuid(),
  organizacion_id       uuid not null references organizaciones(id) on delete cascade,
  usuario_id            uuid references auth.users(id) on delete set null,
  codigo_interno        text,
  -- Personal
  nombre                text not null,
  apellidos             text not null,
  cedula                text not null,
  fecha_nacimiento      date,
  nacionalidad          text,
  telefono              text,
  direccion             text,
  contacto_emergencia_nombre    text,
  contacto_emergencia_telefono  text,
  -- Laboral
  fecha_ingreso         date not null,
  puesto_id             uuid references puestos(id) on delete set null,
  departamento_id       uuid references departamentos(id) on delete set null,
  sede_id               uuid references sedes(id) on delete set null,
  supervisor_id         uuid references empleados(id) on delete set null,
  centro_costo_id       uuid references centros_costo(id) on delete set null,
  tipo_contrato         text check (tipo_contrato in ('indefinido','plazo_fijo','obra_determinada')),
  jornada               text check (jornada in ('diurna','nocturna','mixta')),
  estado                text not null default 'activo'
                          check (estado in ('activo','inactivo')),
  fecha_salida          date,
  -- Salarial (histórico real vive en empleados_historial_salario)
  salario_base          numeric check (salario_base is null or salario_base >= 0),
  periodicidad_pago     text check (periodicidad_pago in ('mensual','quincenal','semanal')),
  -- Bancario — nivel CRÍTICO (Gate §4.4): numero_cuenta se cifra en el
  -- servidor antes de escribir; nunca client-writable en texto plano.
  banco                 text,
  numero_cuenta         text,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  -- Un mismo número de cédula no puede repetirse dos veces dentro de
  -- la misma organización (typo en una carga manual, doble alta) —
  -- la cédula es el identificador natural de la persona (Ley 8968).
  unique (organizacion_id, cedula)
);

create index empleados_organizacion_id_idx on empleados (organizacion_id);
create index empleados_usuario_id_idx on empleados (usuario_id);
create index empleados_supervisor_id_idx on empleados (supervisor_id);
-- FKs de estructura organizativa: sin índice propio, un `on delete set
-- null` disparado al borrar una sede/depto/puesto/centro de costo hace
-- un seq scan completo de empleados para encontrar las filas a tocar.
create index empleados_puesto_id_idx on empleados (puesto_id);
create index empleados_departamento_id_idx on empleados (departamento_id);
create index empleados_sede_id_idx on empleados (sede_id);
create index empleados_centro_costo_id_idx on empleados (centro_costo_id);

-- Ningún FK por sí solo impide que un empleado de la organización A
-- quede apuntando a un puesto/departamento/sede/centro de
-- costo/supervisor que en realidad es de la organización B (si quien
-- gestiona A también conoce o gestiona B). RLS no lo bloquea: la
-- política de escritura de `empleados` solo valida la organización
-- DEL EMPLEADO, no la de los ids referenciados. Este trigger cierra
-- esa integridad referencial cruzada explícitamente.
create or replace function empleados_validar_estructura_misma_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if new.puesto_id is not null and not exists (
    select 1 from puestos where id = new.puesto_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El puesto no pertenece a la organización del empleado';
  end if;
  if new.departamento_id is not null and not exists (
    select 1 from departamentos where id = new.departamento_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El departamento no pertenece a la organización del empleado';
  end if;
  if new.sede_id is not null and not exists (
    select 1 from sedes where id = new.sede_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'La sede no pertenece a la organización del empleado';
  end if;
  if new.centro_costo_id is not null and not exists (
    select 1 from centros_costo where id = new.centro_costo_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El centro de costo no pertenece a la organización del empleado';
  end if;
  if new.supervisor_id is not null and not exists (
    select 1 from empleados where id = new.supervisor_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El supervisor no pertenece a la organización del empleado';
  end if;
  return new;
end;
$$;

create trigger empleados_validar_estructura
  before insert or update of puesto_id, departamento_id, sede_id, centro_costo_id, supervisor_id, organizacion_id
  on empleados
  for each row
  execute function empleados_validar_estructura_misma_organizacion();

create table empleados_historial_puesto (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references empleados(id) on delete cascade,
  puesto_id       uuid references puestos(id) on delete set null,
  departamento_id uuid references departamentos(id) on delete set null,
  desde           date not null,
  hasta           date check (hasta is null or hasta >= desde),
  motivo          text
);
create index empleados_historial_puesto_empleado_id_idx on empleados_historial_puesto (empleado_id);

create table empleados_historial_salario (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references empleados(id) on delete cascade,
  salario_base    numeric not null check (salario_base >= 0),
  desde           date not null,
  hasta           date check (hasta is null or hasta >= desde),
  motivo          text
);
create index empleados_historial_salario_empleado_id_idx on empleados_historial_salario (empleado_id);

-- ── RLS: empleados ────────────────────────────────────────────────
alter table empleados enable row level security;

create policy "Miembros ven su organización" on empleados
  for select to authenticated
  using (pertenece_a_organizacion(organizacion_id));

-- Excepción de Gate §2.3: el propio empleado ve su fila aunque no
-- tenga membresía de gestión (para el autoservicio futuro; MVP 1 no
-- construye esa pantalla, pero la política ya queda correcta).
create policy "El empleado ve su propia fila" on empleados
  for select to authenticated
  using (usuario_id = auth.uid());

create policy "Insertar en la organización" on empleados
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Actualizar en la organización" on empleados
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- Sin política de DELETE para `authenticated`, a propósito: `empleados`
-- ya tiene su propio ciclo de baja suave (`estado = 'inactivo'`), y un
-- hard-delete arrastra en cascada TODO el historial salarial, el
-- historial de puesto y los documentos de esa persona (contrato,
-- cédula escaneada) sin respaldo — datos que la legislación laboral/
-- CCSS de Costa Rica típicamente exige retener por años. El hard-
-- delete real, si algún día hace falta, es un flujo propio con
-- service_role, no un DELETE de botón suelto.

-- GRANT POR COLUMNA (Gate §4.2 — RLS filtra filas, no columnas):
-- `cedula` y `salario_base` (Restringido) y `banco`/`numero_cuenta`
-- (Crítico) quedan fuera del select por defecto. El servidor, tras
-- resolver el permiso en TypeScript, hace una consulta separada con
-- service_role para esas columnas — nunca se amplía este grant.
grant select (
  id, organizacion_id, usuario_id, codigo_interno,
  nombre, apellidos, fecha_nacimiento, nacionalidad, telefono, direccion,
  contacto_emergencia_nombre, contacto_emergencia_telefono,
  fecha_ingreso, puesto_id, departamento_id, sede_id, supervisor_id,
  centro_costo_id, tipo_contrato, jornada, estado, fecha_salida,
  periodicidad_pago, creado_en, actualizado_en
) on empleados to authenticated;

-- `banco`/`numero_cuenta` además quedan fuera del insert/update de
-- `authenticated` (Gate §4.4): esas dos columnas solo las escribe el
-- servidor con service_role, en el mismo punto de código que cifra
-- `numero_cuenta` antes de guardar — así un insert/update disparado
-- por error desde una acción "normal" (no la dedicada de cuenta
-- bancaria) falla por permiso en vez de guardar el dato en texto
-- plano. `cedula`/`salario_base` sí quedan en este grant: son
-- Restringidos por rol (ya cubierto por la política de arriba, que
-- solo deja escribir a quien gestiona la organización), no Críticos.
grant insert (
  organizacion_id, usuario_id, codigo_interno,
  nombre, apellidos, cedula, fecha_nacimiento, nacionalidad, telefono, direccion,
  contacto_emergencia_nombre, contacto_emergencia_telefono,
  fecha_ingreso, puesto_id, departamento_id, sede_id, supervisor_id,
  centro_costo_id, tipo_contrato, jornada, estado, fecha_salida,
  salario_base, periodicidad_pago
) on empleados to authenticated;

-- `organizacion_id` deliberadamente fuera del grant de UPDATE (a
-- diferencia del de INSERT, arriba, donde sí hace falta): sin esto,
-- quien gestiona la organización A podría re-parentar un empleado
-- hacia la organización B con un UPDATE directo, cruzando el límite de
-- tenant sin tocar RLS (mismo tipo de agujero que el A4 de
-- 0148_candados_de_la_auditoria.sql en el marketplace, con
-- `programa_lealtad.cuenta_id`). Mover un empleado de organización no
-- es un caso de MVP 1; si algún día hace falta, es un flujo propio con
-- service_role, no un UPDATE de columna suelta.
grant update (
  usuario_id, codigo_interno,
  nombre, apellidos, cedula, fecha_nacimiento, nacionalidad, telefono, direccion,
  contacto_emergencia_nombre, contacto_emergencia_telefono,
  fecha_ingreso, puesto_id, departamento_id, sede_id, supervisor_id,
  centro_costo_id, tipo_contrato, jornada, estado, fecha_salida,
  salario_base, periodicidad_pago, actualizado_en
) on empleados to authenticated;
grant all on empleados to service_role;

-- ── RLS: empleados_historial_puesto ──────────────────────────────
alter table empleados_historial_puesto enable row level security;

create policy "Miembros ven el historial de su organización" on empleados_historial_puesto
  for select to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and pertenece_a_organizacion(e.organizacion_id))
  );

create policy "Insertar historial de puesto" on empleados_historial_puesto
  for insert to authenticated
  with check (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

create policy "Actualizar historial de puesto" on empleados_historial_puesto
  for update to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  )
  with check (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

create policy "Eliminar historial de puesto" on empleados_historial_puesto
  for delete to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

grant select, insert, update, delete on empleados_historial_puesto to authenticated;
grant all on empleados_historial_puesto to service_role;

-- ── RLS: empleados_historial_salario (salario_base es Restringido) ──
alter table empleados_historial_salario enable row level security;

create policy "Miembros ven el historial de su organización" on empleados_historial_salario
  for select to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and pertenece_a_organizacion(e.organizacion_id))
  );

create policy "Insertar historial de salario" on empleados_historial_salario
  for insert to authenticated
  with check (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

create policy "Actualizar historial de salario" on empleados_historial_salario
  for update to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  )
  with check (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

create policy "Eliminar historial de salario" on empleados_historial_salario
  for delete to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and gestiona_organizacion(e.organizacion_id))
  );

-- Mismo mecanismo que empleados.salario_base: la fila la deja ver la
-- política de arriba, pero `salario_base` queda fuera del select por
-- defecto (Gate §4.1/§4.2). insert/update sí incluyen la columna —
-- ya está gateado por rol vía la política de gestión.
grant select (id, empleado_id, desde, hasta, motivo) on empleados_historial_salario to authenticated;
grant insert, update, delete on empleados_historial_salario to authenticated;
grant all on empleados_historial_salario to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 5. DOCUMENTOS BÁSICOS
-- ══════════════════════════════════════════════════════════════════

-- Extrae el uuid de organización del primer segmento de una ruta
-- {organizacion_id}/{empleado_id o "empresa"}/{uuid}-{nombre} (Gate
-- §2.4). Vive acá (no solo en 0002_storage_documentos.sql, que la
-- necesita para las políticas de storage.objects) porque el CHECK de
-- más abajo también la usa para atar `documentos.ruta_storage` a
-- `documentos.organizacion_id` — sin eso, la fila de metadata podía
-- decir "esta ruta es de mi organización" sin que nada obligara a que
-- la ruta en sí empezara con ese mismo uuid.
--
-- Nunca deja que una ruta malformada tumbe la política — una ruta que
-- no empieza con un uuid válido simplemente no matchea ninguna
-- organización real, así que el fallo es cerrado por diseño.
-- `invalid_text_representation` (no `others`) para que solo el cast a
-- uuid fallido quede atrapado; cualquier otro error real (timeout,
-- problema transitorio de catálogo) se sigue propagando en vez de
-- disfrazarse de "acceso denegado".
create or replace function documentos_organizacion_de_ruta(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create table documentos (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  empleado_id       uuid references empleados(id) on delete cascade,
  categoria         text not null check (categoria in
                      ('contrato','identificacion','certificacion','otro')),
  nombre_archivo    text not null,
  ruta_storage      text not null,
  tamano_bytes      integer,
  subido_por        uuid references auth.users(id) on delete set null,
  creado_en         timestamptz not null default now(),
  -- Sin esto, alguien que gestiona la organización X podía insertar una
  -- fila con organizacion_id=X (pasa la política) pero ruta_storage
  -- apuntando al prefijo real de otra organización Y — la fila falsa
  -- quedaría visible para cualquier miembro de X, y si algún día un
  -- flujo de servidor confía en `ruta_storage` de una fila ya
  -- "autorizada por organización" para firmar la URL con service_role,
  -- eso filtraría el documento real de Y. El primer segmento de la
  -- ruta SIEMPRE tiene que coincidir con la organización de la fila.
  constraint documentos_ruta_coincide_organizacion
    check (documentos_organizacion_de_ruta(ruta_storage) = organizacion_id)
);
create index documentos_organizacion_id_idx on documentos (organizacion_id);
create index documentos_empleado_id_idx on documentos (empleado_id) where empleado_id is not null;

-- Mismo motivo que el trigger de `empleados`: el `empleado_id` de un
-- documento tiene que ser un empleado de la MISMA organización que el
-- documento — si no, un gestor de X podría etiquetar un documento
-- propio con el empleado_id de otra organización que también conozca.
create or replace function documentos_validar_empleado_misma_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if new.empleado_id is not null and not exists (
    select 1 from empleados where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización del documento';
  end if;
  return new;
end;
$$;

create trigger documentos_validar_empleado
  before insert or update of empleado_id, organizacion_id
  on documentos
  for each row
  execute function documentos_validar_empleado_misma_organizacion();

alter table documentos enable row level security;

create policy "Miembros ven su organización" on documentos
  for select to authenticated
  using (pertenece_a_organizacion(organizacion_id));

create policy "Insertar en la organización" on documentos
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Actualizar en la organización" on documentos
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

create policy "Eliminar en la organización" on documentos
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

grant select, insert, delete on documentos to authenticated;
-- `organizacion_id` fuera del UPDATE (mismo motivo que en `empleados`
-- y en la estructura organizativa): re-parentar un documento hacia
-- otra organización con un UPDATE directo no debe ser posible.
grant update (empleado_id, categoria, nombre_archivo, ruta_storage, tamano_bytes) on documentos to authenticated;
grant all on documentos to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 6. CONFIGURACIÓN DE ORGANIZACIÓN
-- ══════════════════════════════════════════════════════════════════

create table configuracion_organizacion (
  organizacion_id   uuid primary key references organizaciones(id) on delete cascade,
  nombre_legal      text,
  provincia_fiscal  text check (provincia_fiscal is null or provincia_fiscal in (
                      'San José', 'Alajuela', 'Cartago', 'Heredia',
                      'Guanacaste', 'Puntarenas', 'Limón'
                    )),
  moneda            text not null default 'CRC',
  configuracion     jsonb not null default '{}'::jsonb
);

alter table configuracion_organizacion enable row level security;

create policy "Miembros ven su organización" on configuracion_organizacion
  for select to authenticated
  using (pertenece_a_organizacion(organizacion_id));

create policy "Insertar la configuración de la organización" on configuracion_organizacion
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Editar la configuración de la organización" on configuracion_organizacion
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

create policy "Eliminar la configuración de la organización" on configuracion_organizacion
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

grant select, insert, delete on configuracion_organizacion to authenticated;
-- `organizacion_id` es la PRIMARY KEY acá — nunca tiene sentido que
-- `authenticated` la actualice (equivaldría a reasignar toda la fila a
-- otra organización). Las columnas de contenido real sí son editables.
grant update (nombre_legal, provincia_fiscal, moneda, configuracion) on configuracion_organizacion to authenticated;
grant all on configuracion_organizacion to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 7. BITÁCORA DE AUDITORÍA (Gate §5.1, esquema confirmado sin cambios)
-- ══════════════════════════════════════════════════════════════════

create table bitacora_auditoria (
  id              bigint generated always as identity primary key,
  organizacion_id uuid not null references organizaciones(id),
  actor_id        uuid references auth.users(id) on delete set null,
  actor_rol       text,
  accion          text not null,
  entidad         text not null,
  entidad_id      uuid not null,
  campo           text,
  valor_antes     jsonb,
  valor_despues   jsonb,
  ip_hmac         text,
  user_agent      text,
  creado_en       timestamptz not null default now()
);
create index bitacora_auditoria_organizacion_id_idx on bitacora_auditoria (organizacion_id);
create index bitacora_auditoria_entidad_idx on bitacora_auditoria (entidad, entidad_id);

alter table bitacora_auditoria enable row level security;

create policy "Quien gestiona la organización lee su bitácora" on bitacora_auditoria
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- Sin política de insert/update/delete para `authenticated`: solo el
-- servidor (service_role, en la misma transacción que el cambio real)
-- escribe acá. Sin update ni delete para nadie — la bitácora no se
-- corrige (Gate §5.1).
--
-- `organizacion_id` a propósito SIN `on delete cascade` (es la única
-- tabla del archivo así): la bitácora es inmutable y de retención
-- indefinida (Gate §5.3, pendiente de política legal concreta), así
-- que borrar la organización padre NUNCA debe poder llevarse el
-- historial de auditoría por la puerta trasera de un cascade — mejor
-- que el DELETE de la organización falle mientras exista bitácora sin
-- una decisión de retención tomada, a perderla en silencio.

grant select on bitacora_auditoria to authenticated;
grant select, insert on bitacora_auditoria to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 8. `anon` NUNCA TIENE NADA — explícito, no solo implícito vía RLS
--    RLS ya deniega a cualquier rol sin política aplicable, así que
--    esto no cambia el comportamiento real hoy. Es defensa en
--    profundidad: si algún día el proyecto de Supabase tuviera un
--    `alter default privileges` de plataforma que le diera algo a
--    `anon` en el esquema `public`, este REVOKE explícito lo cierra
--    igual, sin depender de que nadie note el default.
-- ══════════════════════════════════════════════════════════════════
revoke all on
  organizaciones, membresias, sedes, departamentos, puestos, centros_costo,
  empleados, empleados_historial_puesto, empleados_historial_salario,
  documentos, configuracion_organizacion, bitacora_auditoria
from anon;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0002_storage_documentos.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — Storage del bucket `documentos`
-- Implementa docs/bookea-work/ARCHITECTURE_GATE.md §2.4 del repo
-- aventurar-cr. Requiere que 0001_nucleo_multi_tenant.sql ya haya
-- corrido (usa gestiona_organizacion/pertenece_a_organizacion, y
-- documentos_organizacion_de_ruta — esa función vive en 0001 porque el
-- CHECK de la tabla `documentos` también la necesita).
-- Correr en el SQL Editor del proyecto de Supabase propio de Work.
-- ============================================================

-- Privado, con techo de tamaño explícito (10 MB por archivo, Gate
-- §2.4). Nunca se sirve por URL pública — siempre createSignedUrl de
-- corta duración desde el servidor, igual que `verComprobante` del
-- marketplace.
insert into storage.buckets (id, name, public, file_size_limit)
values ('work-documentos', 'work-documentos', false, 10485760)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760;

-- La ruta obligatoria es {organizacion_id}/{empleado_id o "empresa"}/
-- {uuid}-{nombre} (Gate §2.4). Las tres políticas de abajo solo validan
-- el PRIMER segmento (la organización) contra `documentos_organizacion_de_ruta`
-- (definida en 0001) — es lo único que decide el límite de tenant, y
-- eso queda cerrado.
--
-- El SEGUNDO segmento (empleado_id, o el literal "empresa") NO se
-- valida acá contra la tabla `empleados` — decisión deliberada, no un
-- descuido: cruzaría storage.objects con una tabla de negocio en cada
-- INSERT/SELECT de archivo, y aunque alguien pudiera subir un objeto
-- con un empleado_id ajeno en ese segmento, el límite de tenant (quién
-- puede ver/borrar el archivo) sigue intacto — es, cuando mucho, un
-- archivo mal etiquetado dentro de SU PROPIA organización, no una fuga
-- cruzando organizaciones. Esa validación, si hace falta, es más barata
-- en la capa de servidor (donde ya se conoce el empleado_id real antes
-- de pedir la URL firmada de subida) que como una subconsulta en cada
-- política de RLS.
--
-- Tampoco hay política de UPDATE: cada subida usa un `{uuid}-{nombre}`
-- nuevo (ruta nueva, nunca un reemplazo in-place), así que no hace
-- falta — pero si algún día un flujo de "reemplazar este documento"
-- usa `upload(..., { upsert: true })` sobre una ruta ya existente,
-- Supabase Storage dispara un UPDATE real sobre `storage.objects` y
-- fallará con 403 para `authenticated` hasta agregar esa política acá
-- (mismo `gestiona_organizacion` que insert/delete).

create policy "work-documentos — Solo quien gestiona la organización sube documentos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'work-documentos'
    and gestiona_organizacion(documentos_organizacion_de_ruta(name))
  );

create policy "work-documentos — Miembros ven los documentos de su organización" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'work-documentos'
    and pertenece_a_organizacion(documentos_organizacion_de_ruta(name))
  );

create policy "work-documentos — Solo quien gestiona la organización borra documentos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'work-documentos'
    and gestiona_organizacion(documentos_organizacion_de_ruta(name))
  );

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0003_bitacora_inmutable.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0003: la bitácora es inmutable TAMBIÉN para
-- service_role
-- ============================================================
--
-- `auditoria.ts` promete que `bitacora_auditoria` "no tiene update ni
-- delete para NADIE (ni service_role)". La 0001 cumplía esa promesa
-- solo a medias: su primera línea revocó los default privileges de
-- `anon` y `authenticated`, pero NO los de `service_role` — y la
-- plataforma de Supabase trae `alter default privileges ... grant all
-- on tables to service_role` puesto de fábrica. Como Postgres ACUMULA
-- privilegios, el `grant select, insert ... to service_role` explícito
-- de la 0001 no acotaba nada: era un grant MÁS encima del `all` que la
-- tabla ya traía de nacimiento. Resultado: service_role conservaba
-- update y delete sobre la bitácora.
--
-- Esto lo cierra. La bitácora es EVIDENCIA — quién le cambió el
-- salario a quién, y qué había antes—; una llave de servicio filtrada
-- no debe poder reescribirla ni borrarla. El servidor solo necesita
-- insertar (y leerla para las pantallas de auditoría futuras): select
-- e insert quedan intactos, update y delete desaparecen.
--
-- Nota: `service_role` tiene BYPASSRLS, así que RLS nunca fue defensa
-- acá — el único candado real es el privilegio de tabla, y por eso
-- este revoke importa.

revoke update, delete on table work.bitacora_auditoria from service_role;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0004_invitaciones.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0004: Invitaciones (el ciclo real de acceso)
-- Cierra la brecha que ARCHITECTURE_GATE.md §1.1 dejó anotada como
-- pendiente: invitar a un correo que todavía no tiene cuenta. Hasta
-- hoy `membresias.usuario_id not null` obligaba a que la persona
-- invitada existiera ANTES de poder invitarla; esta tabla guarda la
-- invitación por CORREO, y la membresía nace recién cuando la persona
-- entra y la acepta. El flujo completo:
--
--   Administrador → invita un correo con un rol → la persona entra
--   con su código (bootstrap normal de sesión) → ve su invitación en
--   `/` → la acepta → se crea la membresía con ese rol → permisos →
--   acceso a módulos.
--
-- ── QUÉ QUEDA AUDITADO (Gate §5.2, lista cerrada y honesta) ────────
-- Estas tres acciones dejan fila en `bitacora_auditoria`, escritas por
-- el servidor (service_role) en el mismo punto de código que hace el
-- cambio real:
--
--   · `invitacion.creada`   — al invitar (equipo/actions.ts)
--   · `invitacion.revocada` — al revocar (equipo/actions.ts)
--   · `invitacion.aceptada` + `membresia.creada` — al aceptar
--     (src/app/actions.ts); son dos filas porque el Gate §5.2 ya
--     lista "Membresía invitada" como entidad auditada propia.
--
-- NO queda auditado (declarado, no omitido): el paso a `estado =
-- 'expirada'`. La expiración es un hecho del reloj (`expira_en`), no
-- una acción de nadie — el estado 'expirada' es contabilidad opcional
-- que el servidor puede marcar al encontrarse una invitación vencida;
-- la verdad de la vigencia SIEMPRE es `estado = 'pendiente' AND
-- expira_en > now()`, nunca el rótulo solo.
--
-- ── POR QUÉ LA ACEPTACIÓN VA CON service_role ──────────────────────
-- Aceptar hace DOS escrituras que tienen que pasar juntas: marcar la
-- invitación como aceptada e insertar la fila de `membresias`. Y
-- `membresias` NO tiene política de INSERT para `authenticated`
-- (decisión de la 0001: esa tabla no puede resolver "quién puede
-- escribirla" vía RLS sin recursión sobre sí misma) — así que crear
-- la membresía es, por diseño previo, trabajo del servidor. Esta
-- migración mantiene la aceptación fuera del alcance del cliente
-- también del lado de la invitación: `aceptada_por`/`aceptada_en` no
-- están en ningún grant de `authenticated`, y el CHECK de coherencia
-- de abajo exige `aceptada_en` para poder poner `estado = 'aceptada'`
-- — o sea, NINGÚN cliente puede fabricar una aceptación, ni siquiera
-- quien gestiona la organización. El servidor verifica que el correo
-- del JWT de quien acepta coincida con el correo invitado, y recién
-- ahí escribe ambas filas con la llave de servicio.
--
-- Correr con `supabase db push --linked` contra el proyecto de
-- Supabase PROPIO de Work (kcatxzuoaajxlmvczolk) — nunca el del
-- marketplace.
-- ============================================================

create table invitaciones (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  -- El correo se guarda SIEMPRE en minúsculas (el CHECK lo obliga, no
  -- solo lo pide): toda comparación posterior —la política del
  -- invitado, el `correoCoincide` del servidor— es contra minúsculas,
  -- y un correo con mayúsculas guardado por descuido sería una
  -- invitación imposible de aceptar.
  correo            text not null check (
                      correo = lower(correo)
                      and correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                      and char_length(correo) <= 254
                    ),
  -- El dominio de `membresias.rol` (0001) MENOS 'propietario': el
  -- propietario nace únicamente con la organización (empezar/
  -- actions.ts, Gate §1.1) — no existe "invitar a un propietario".
  rol               text not null check (rol in ('admin_rrhh', 'gerente', 'empleado')),
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente', 'aceptada', 'revocada', 'expirada')),
  -- Quién invitó. `default auth.uid()` + columna FUERA del grant de
  -- INSERT de `authenticated` (abajo): el cliente no puede ni
  -- escribirla ni falsearla — la llena Postgres con el usuario real
  -- del JWT. En un insert de service_role (que no se usa para crear
  -- invitaciones) quedaría null, y eso es correcto: null = "no la
  -- creó una sesión humana".
  creada_por        uuid references auth.users(id) on delete set null default auth.uid(),
  aceptada_por      uuid references auth.users(id) on delete set null,
  creada_en         timestamptz not null default now(),
  aceptada_en       timestamptz,
  revocada_en       timestamptz,
  expira_en         timestamptz not null default now() + interval '14 days',
  -- Coherencia del estado con sus marcas de tiempo. La de 'aceptada'
  -- es además un CANDADO (ver cabecera): como `aceptada_en` no está
  -- en el grant de UPDATE de `authenticated`, ningún cliente puede
  -- satisfacer este CHECK — poner 'aceptada' es imposible sin la
  -- llave de servicio. A propósito NO se exige `aceptada_por is not
  -- null` acá: ese FK es `on delete set null`, y borrar la cuenta de
  -- quien aceptó no debe reventar contra un CHECK años después.
  check (estado <> 'aceptada' or aceptada_en is not null),
  check (estado <> 'revocada' or revocada_en is not null)
);

-- Una sola invitación PENDIENTE por (organización, correo) — único
-- parcial: las aceptadas/revocadas/expiradas son historial y pueden
-- acumularse (re-invitar tras una revocada es el flujo normal).
create unique index invitaciones_pendiente_unica_idx
  on invitaciones (organizacion_id, correo)
  where estado = 'pendiente';

create index invitaciones_organizacion_id_idx on invitaciones (organizacion_id);
-- La consulta del invitado en `/` busca por correo entre las
-- pendientes — parcial porque el historial no le interesa a nadie por
-- correo.
create index invitaciones_correo_pendiente_idx
  on invitaciones (correo)
  where estado = 'pendiente';

-- ── RLS — en la MISMA migración que crea la tabla (Gate §1) ────────
alter table invitaciones enable row level security;

create policy "Gestión ve las invitaciones de su organización" on invitaciones
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- El INVITADO —que todavía NO es miembro, así que ningún helper de
-- membresía puede resolverlo— ve las invitaciones pendientes y no
-- expiradas dirigidas a SU correo. El correo del que pide sale de
-- `auth.jwt() ->> 'email'`: el MISMO JWT del request del que
-- `auth.uid()` (la vía de toda la 0001) lee su claim `sub` — es el
-- mecanismo hermano, no uno nuevo (el helper `auth.email()` de
-- Supabase está deprecado a favor de exactamente esta expresión).
-- `lower(...)` de ambos lados por defensa; si el JWT no trae correo,
-- el `coalesce('')` nunca matchea un `correo` válido (el CHECK de la
-- columna impide el string vacío): falla cerrado.
create policy "El invitado ve su invitación pendiente" on invitaciones
  for select to authenticated
  using (
    estado = 'pendiente'
    and expira_en > now()
    and correo = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "Gestión invita en su organización" on invitaciones
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

-- Solo sobre PENDIENTES: revocar (o marcar expirada) es lo único que
-- un cliente hace por UPDATE. El `using` con `estado = 'pendiente'`
-- también impide "resucitar" una revocada a pendiente por fuera del
-- flujo de re-invitar (que es un INSERT nuevo, con su bitácora).
create policy "Gestión resuelve invitaciones pendientes de su organización" on invitaciones
  for update to authenticated
  using (gestiona_organizacion(organizacion_id) and estado = 'pendiente')
  with check (gestiona_organizacion(organizacion_id));

-- Sin política de DELETE para `authenticated`, a propósito: revocar
-- es un cambio de estado, no un borrado — una invitación borrada es
-- una pregunta sin respuesta en la bitácora ("¿y esta invitación
-- aceptada de qué salió?"). El único DELETE real es la cascada al
-- borrar la organización.

-- ── GRANTS por columna (patrón de la 0001) ─────────────────────────
-- La 0001 ya revocó los default privileges de `anon`/`authenticated`
-- para toda tabla nueva del esquema, así que esta tabla nace sin nada
-- para ellos — el revoke explícito de abajo es cinturón y tirantes,
-- no el mecanismo (misma razón que la sección 8 de la 0001).
revoke all on invitaciones from anon, authenticated;

-- SELECT de tabla completa: acá no hay columna Restringida/Crítica
-- (Gate §4.1) — el correo del invitado es exactamente lo que quien
-- gestiona necesita ver, y el invitado solo alcanza su propia fila
-- vía la política de arriba.
grant select on invitaciones to authenticated;

-- INSERT solo de lo que el formulario decide: organización, correo y
-- rol. Todo lo demás lo llenan los defaults — `estado` nace
-- 'pendiente', `creada_por` nace `auth.uid()`, `expira_en` nace a 14
-- días. El cliente no puede fabricar una invitación ya aceptada, ni
-- firmada por otro, ni eterna.
grant insert (organizacion_id, correo, rol) on invitaciones to authenticated;

-- UPDATE solo de `estado` y `revocada_en`: lo que revocar necesita, y
-- nada más. `aceptada_por`/`aceptada_en` quedan fuera A PROPÓSITO —
-- son la mitad del candado de la aceptación (ver cabecera y el CHECK
-- de coherencia): sin poder escribir `aceptada_en`, ningún cliente
-- puede llegar a `estado = 'aceptada'`. `expira_en` y `correo`/`rol`
-- tampoco: una invitación no se edita, se revoca y se re-invita.
grant update (estado, revocada_en) on invitaciones to authenticated;

grant all on invitaciones to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0005_attendance_v1.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0005: AI ATTENDANCE V1 — fundación de asistencia
-- Implementa la fase de fundación del vertical Attendance: marcajes
-- como HECHOS INMUTABLES, el resultado del pipeline de lectura de
-- boletas (`documentos_extracciones`), y el ancla del período semanal
-- (`semanas_asistencia`). Attendance registra HECHOS — acá no hay ni
-- una columna de dinero: salario/CCSS/renta son Planilla, y Planilla
-- está pausada.
--
-- Requiere 0001 (helpers `gestiona_organizacion`/
-- `pertenece_a_organizacion`, tablas `empleados` y `documentos`) y
-- 0002 (bucket `documentos`, donde el ORIGINAL de cada boleta se sube
-- ANTES de llamar al modelo — ARCHITECTURE.md §6.1: el MTSS o la CCSS
-- pueden auditar respaldo de horas trabajadas, la foto no se descarta).
--
-- Correr con `supabase db push --linked` contra el proyecto de
-- Supabase PROPIO de Work (kcatxzuoaajxlmvczolk) — nunca el del
-- marketplace.
--
-- ── QUÉ QUEDA AUDITADO (Gate §5.2, lista cerrada y honesta) ────────
-- Estas acciones dejarán fila en `bitacora_auditoria`, escritas por el
-- servidor (service_role) en el mismo punto de código que hace el
-- cambio real. Las server actions / rutas que las ejecutan se
-- construyen en las etapas siguientes de Attendance V1 — esta
-- migración declara el contrato cerrado que ese código tiene que
-- cumplir:
--
--   · `marcaje.anulado`         — antes/después de las columnas de
--                                 anulación (la única mutación posible)
--   · `extraccion.confirmada`   — documento_id + cuántos marcajes se
--                                 crearon del lote (boleta → marcajes)
--   · `extraccion.descartada`   — cambio de estado, con motivo si lo hay
--   · `extraccion.corregida`    — campo por campo, antes/después (la
--                                 corrección también se acumula en
--                                 `documentos_extracciones.correcciones`,
--                                 ver el comentario de esa columna)
--   · `semana.consolidada` / `semana.reabierta` — cambio de estado
--
-- NO queda auditado (declarado, no omitido):
--   · La creación de un marcaje manual: la fila de `marcajes` ES el
--     registro del hecho (quién = `registrado_por`, cuándo =
--     `creado_en`, qué = el resto), y es inmutable — duplicarla en la
--     bitácora sería copiar la tabla entera fila por fila.
--   · Los estados intermedios del pipeline (`procesando` → `extraida`
--     → `requiere_revision`): son hechos de máquina, no acciones
--     humanas; quedan en `documentos_extracciones` con sus timestamps.
--   · La subida del archivo de la boleta: ya está cubierta por la
--     lista de la 0001 ("Documento subido / eliminado").
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 0. `documentos.categoria` aprende 'boleta_horario'
--    La boleta original se guarda como fila de `documentos` (y su
--    archivo en el bucket `documentos` de la 0002) ANTES de llamar al
--    modelo. Etiquetarla 'otro' escondería justamente la categoría
--    que la trazabilidad boleta → marcaje necesita poder filtrar.
-- ══════════════════════════════════════════════════════════════════

alter table documentos drop constraint documentos_categoria_check;
alter table documentos add constraint documentos_categoria_check
  check (categoria in ('contrato','identificacion','certificacion','boleta_horario','otro'));

-- ══════════════════════════════════════════════════════════════════
-- 1. MARCAJES — hechos inmutables de asistencia
--
--    EL MECANISMO DE INMUTABILIDAD, completo y en un solo lugar:
--
--    a) Sin política de DELETE para `authenticated`, y DELETE/TRUNCATE
--       revocados también de `service_role` (la lección de la 0003:
--       los default privileges de la plataforma le dan ALL a
--       service_role en cada tabla nueva, y RLS nunca lo frena porque
--       tiene BYPASSRLS — el único candado real es el privilegio de
--       tabla). Un marcaje no se borra NUNCA, ni con la llave de
--       servicio: "deshacer lote" (ARCHITECTURE.md §6.4) es anulación
--       masiva con motivo, no un DELETE.
--
--    b) El UPDATE de `authenticated` solo alcanza (`grant` por
--       columna) `anulado` y `anulado_motivo`. `service_role` conserva
--       UPDATE de tabla (lo necesita para anular lotes desde el
--       servidor), PERO:
--
--    c) el trigger `marcajes_solo_anulacion` corre para TODOS los
--       roles (los triggers no se saltan con BYPASSRLS) y solo deja
--       pasar UNA transición: anulado false → true, con motivo, sin
--       tocar ninguna columna del hecho en sí. Un marcaje ya anulado
--       queda congelado por completo — no se des-anula, no se le
--       cambia el motivo, no se "corrige" el momento. Corregir un
--       marcaje = anularlo y registrar uno nuevo; los dos quedan.
--       El trigger además pisa `anulado_en` con now() y `anulado_por`
--       con auth.uid() (si hay sesión), para que ni el cliente ni un
--       bug del servidor puedan fabricar una anulación firmada por
--       otro o fechada en otro momento.
--
--    d) `origen`, `documento_id` y `registrado_por` están FUERA del
--       grant de INSERT de `authenticated`: un marcaje creado desde el
--       cliente nace siempre `origen = 'manual'` (default), sin
--       documento, y firmado por el `auth.uid()` real (default de la
--       columna, patrón de `invitaciones.creada_por` en la 0004).
--       Solo el servidor (service_role), al confirmar una extracción,
--       escribe `origen = 'boleta'` + `documento_id` — así la
--       trazabilidad boleta → marcaje no puede fabricarse desde
--       afuera. Los CHECKs de coherencia de abajo hacen el par
--       origen/documento exhaustivo en ambas direcciones.
-- ══════════════════════════════════════════════════════════════════

create table marcajes (
  id                uuid primary key default gen_random_uuid(),
  -- SIN `on delete cascade`, igual que `bitacora_auditoria` en la
  -- 0001 (y a diferencia del resto de tablas de dominio): los
  -- marcajes son evidencia laboral de retención larga — borrar la
  -- organización o hacer un hard-delete de un empleado NUNCA debe
  -- poder llevarse la asistencia por la puerta trasera de un cascade.
  -- Mejor que ese DELETE falle mientras no exista una decisión de
  -- retención tomada.
  organizacion_id   uuid not null references organizaciones(id),
  empleado_id       uuid not null references empleados(id),
  tipo              text not null check (tipo in ('entrada','salida','pausa_inicio','pausa_fin')),
  momento           timestamptz not null,
  origen            text not null default 'manual' check (origen in ('manual','boleta')),
  -- Quién registró el hecho. Default `auth.uid()` + columna fuera del
  -- grant de INSERT de `authenticated`: la llena Postgres con el
  -- usuario real del JWT, el cliente no puede ni escribirla ni
  -- falsearla. En inserts de service_role (confirmación de boleta) el
  -- servidor la escribe explícitamente con quien confirmó.
  registrado_por    uuid references auth.users(id) on delete set null default auth.uid(),
  -- La trazabilidad boleta → marcaje. Sin `on delete` (RESTRICT):
  -- mientras existan marcajes derivados de una boleta, la boleta es
  -- respaldo documental (ARCHITECTURE.md §6.1) y su fila de
  -- `documentos` no se puede borrar.
  documento_id      uuid references documentos(id),
  nota              text,
  anulado           boolean not null default false,
  anulado_por       uuid references auth.users(id) on delete set null,
  anulado_en        timestamptz,
  anulado_motivo    text,
  creado_en         timestamptz not null default now(),
  -- Coherencia origen/documento, exhaustiva porque `origen` solo
  -- tiene dos valores: boleta exige documento, manual lo prohíbe.
  constraint marcajes_boleta_con_documento
    check (origen <> 'boleta' or documento_id is not null),
  constraint marcajes_manual_sin_documento
    check (origen <> 'manual' or documento_id is null),
  -- Coherencia de la anulación (el trigger la garantiza en UPDATE;
  -- estos CHECKs cierran también el INSERT directo de service_role).
  -- `anulado_por` a propósito sin exigencia de not null: su FK es
  -- `on delete set null` y borrar la cuenta de quien anuló no debe
  -- reventar contra un CHECK años después (patrón de la 0004).
  constraint marcajes_anulacion_completa
    check (not anulado or (anulado_en is not null and anulado_motivo is not null)),
  constraint marcajes_no_anulado_limpio
    check (anulado or (anulado_por is null and anulado_en is null and anulado_motivo is null))
);

-- El mismo hecho no se registra dos veces: único parcial sobre los no
-- anulados. Es la red del servidor contra la doble confirmación de la
-- misma boleta (además del hash de `documentos_extracciones`) y contra
-- el doble clic de un registro manual. Los anulados quedan fuera: la
-- corrección legítima es "anular y volver a registrar", y el
-- reemplazo puede caer en el mismo (empleado, tipo, momento).
create unique index marcajes_hecho_unico_idx
  on marcajes (empleado_id, tipo, momento)
  where not anulado;

create index marcajes_organizacion_momento_idx on marcajes (organizacion_id, momento);
create index marcajes_empleado_momento_idx on marcajes (empleado_id, momento);
create index marcajes_documento_id_idx on marcajes (documento_id) where documento_id is not null;

-- Mismo cierre de integridad cruzada que `empleados_validar_estructura`
-- en la 0001: ningún FK impide por sí solo que un marcaje de la
-- organización A apunte a un empleado o a un documento de la B (si
-- quien gestiona A también gestiona B). security definer porque las
-- subconsultas tienen que ver las filas reales, no las filtradas por
-- el RLS de quien dispara el trigger.
create or replace function marcajes_validar_misma_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from empleados where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización del marcaje';
  end if;
  if new.documento_id is not null and not exists (
    select 1 from documentos where id = new.documento_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El documento no pertenece a la organización del marcaje';
  end if;
  return new;
end;
$$;

create trigger marcajes_validar_organizacion
  before insert on marcajes
  for each row
  execute function marcajes_validar_misma_organizacion();

-- El candado (c) de la cabecera de la sección: la ÚNICA mutación que
-- existe sobre un marcaje es anularlo, para cualquier rol.
create or replace function marcajes_solo_anulacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if old.anulado then
    raise exception 'Un marcaje anulado está congelado: no se des-anula ni se modifica';
  end if;
  if not new.anulado then
    raise exception 'El único UPDATE permitido sobre un marcaje es anularlo';
  end if;
  if new.organizacion_id is distinct from old.organizacion_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.tipo            is distinct from old.tipo
     or new.momento         is distinct from old.momento
     or new.origen          is distinct from old.origen
     or new.registrado_por  is distinct from old.registrado_por
     or new.documento_id    is distinct from old.documento_id
     or new.nota            is distinct from old.nota
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'El hecho registrado no se modifica: para corregir, anular y registrar uno nuevo';
  end if;
  if new.anulado_motivo is null or btrim(new.anulado_motivo) = '' then
    raise exception 'Anular un marcaje exige un motivo';
  end if;
  -- Ni el cliente ni el servidor fechan ni firman la anulación a mano:
  -- el reloj es de la base y el actor es el del JWT si hay sesión
  -- (en service_role auth.uid() es null y vale lo que puso el server).
  new.anulado_en := now();
  new.anulado_por := coalesce(auth.uid(), new.anulado_por);
  return new;
end;
$$;

create trigger marcajes_anulacion
  before update on marcajes
  for each row
  execute function marcajes_solo_anulacion();

-- ── RLS: marcajes — en la MISMA migración (Gate §1) ────────────────
alter table marcajes enable row level security;

create policy "Gestión ve los marcajes de su organización" on marcajes
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- El empleado (si tiene usuario) ve SUS marcajes — no los de sus
-- compañeros. Mismo patrón de subconsulta sobre `empleados` que las
-- políticas de historial de la 0001; la subconsulta corre bajo el RLS
-- del que pide, y su propia fila la ve por "El empleado ve su propia
-- fila" (0001, Gate §2.3).
create policy "El empleado ve sus propios marcajes" on marcajes
  for select to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and e.usuario_id = auth.uid())
  );

create policy "Gestión registra marcajes en su organización" on marcajes
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Gestión anula marcajes de su organización" on marcajes
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- Sin política de DELETE para `authenticated` — y sin DELETE para
-- nadie, ver el revoke a service_role al final de la sección.

-- ── Grants por columna (patrón 0001/0004) ──────────────────────────
-- Cinturón y tirantes sobre el default-privileges revoke de la 0001:
revoke all on marcajes from anon, authenticated;

-- Sin columna Restringida/Crítica (Gate §4.1): la hora a la que
-- alguien entró a trabajar es dato operativo (Interno), visible
-- completo para quien la política ya deja ver la fila.
grant select on marcajes to authenticated;

-- INSERT solo del hecho que el formulario decide: empleado, tipo,
-- momento, nota (+ la organización de la fila). `origen` nace
-- 'manual', `registrado_por` nace `auth.uid()`, `anulado` nace false,
-- `creado_en` nace now() — todo por default, nada falsificable.
grant insert (organizacion_id, empleado_id, tipo, momento, nota) on marcajes to authenticated;

-- UPDATE solo de la anulación — el mecanismo (b) de la cabecera.
grant update (anulado, anulado_motivo) on marcajes to authenticated;

-- service_role: todo MENOS delete/truncate (mecanismo (a)). El grant
-- explícito documenta lo que sí conserva; el revoke pisa el ALL que
-- los default privileges de la plataforma ya le habían dado.
grant select, insert, update on marcajes to service_role;
revoke delete, truncate on marcajes from service_role;

-- ══════════════════════════════════════════════════════════════════
-- 2. DOCUMENTOS_EXTRACCIONES — el resultado del pipeline por documento
--
--    El flujo (ARCHITECTURE.md §6, ya decidido): el original se sube
--    al bucket `documentos` ANTES de llamar al modelo; una ruta HTTP
--    dedicada (no server action, por el límite de payload) crea la
--    fila en 'procesando' y la resuelve a 'extraida' /
--    'requiere_revision' / 'fallida'; la salida trae AVISOS en
--    lenguaje natural, nunca un confidence score; la revisión humana
--    es obligatoria antes de confirmar; confirmar crea los marcajes
--    (origen 'boleta', documento_id de esta boleta) en la misma
--    operación de servidor.
--
--    TODA escritura es del servidor (service_role): crear la fila,
--    guardar la extracción, corregir, confirmar y descartar pasan por
--    rutas/actions que además escriben bitácora y (al confirmar)
--    marcajes — nada de eso puede ser un UPDATE suelto del cliente.
--    `authenticated` solo LEE (gestión de la org). Sin DELETE para
--    nadie: descartar es un estado, no un borrado; el único DELETE
--    real es la cascada si se borra el documento padre (y esa cascada
--    a su vez queda bloqueada por el FK RESTRICT de `marcajes` cuando
--    la extracción ya se confirmó — la evidencia se sostiene sola).
-- ══════════════════════════════════════════════════════════════════

create table documentos_extracciones (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  documento_id      uuid not null references documentos(id) on delete cascade,
  estado            text not null default 'procesando' check (estado in
                      ('procesando','extraida','requiere_revision','confirmada','descartada','fallida')),
  -- Qué dijo el modelo que es el documento ('boleta_horario',
  -- 'desconocido', ...) — texto libre del contrato de
  -- src/lib/asistencia/tipos.ts, no un CHECK: el catálogo de tipos
  -- detectables va a crecer con el prompt, no con migraciones.
  tipo_detectado    text,
  -- El match de identificación (src/lib/asistencia/matching.ts).
  -- null = sin identificar todavía, ambiguo, o sin candidatos — el
  -- detalle vive en `extraccion`/`avisos`; la regla de oro es que un
  -- match ambiguo NUNCA se adivina: queda null + 'requiere_revision'.
  empleado_id       uuid references empleados(id) on delete set null,
  -- La salida normalizada del proveedor (ExtraccionNormalizada de
  -- src/lib/asistencia/tipos.ts). null mientras 'procesando' o si
  -- terminó 'fallida' antes de producir nada.
  extraccion        jsonb,
  -- Lista de strings — los avisos del modelo y los calculados por el
  -- servidor, juntos. NUNCA un confidence score (ARCHITECTURE.md §6.3).
  avisos            jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(avisos) = 'array'),
  -- sha-256 (hex, minúsculas) del archivo ORIGINAL, calculado por el
  -- servidor antes de llamar al modelo. El índice por organización
  -- deja detectar "esta boleta ya se subió" y avisarlo — detectar, no
  -- bloquear: re-subir una boleta corregida a mano es legítimo, y el
  -- único parcial de `marcajes` ya frena el daño real (marcajes
  -- duplicados) si alguien confirma dos veces lo mismo.
  hash_archivo      text not null check (hash_archivo ~ '^[0-9a-f]{64}$'),
  -- Historial de correcciones humanas (ARCHITECTURE.md §6.6): el
  -- servidor APPENDEA {campo, antes, despues, por, en} en cada
  -- corrección — nunca reescribe entradas viejas — y deja el espejo
  -- campo por campo en `bitacora_auditoria` (`extraccion.corregida`,
  -- lista de la cabecera). Se elige jsonb y no una tabla hija porque
  -- el Gate no define tablas de Attendance (está fuera de su alcance
  -- de MVP 1) y la bitácora ya da la vista transversal auditable; el
  -- jsonb mantiene el historial completo pegado a su extracción.
  correcciones      jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(correcciones) = 'array'),
  confirmada_por    uuid references auth.users(id) on delete set null,
  confirmada_en     timestamptz,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  -- Mismo criterio que invitaciones (0004): el estado terminal exige
  -- su marca de tiempo; el actor no se exige not null por su FK
  -- `on delete set null`.
  constraint extracciones_confirmada_completa
    check (estado <> 'confirmada' or confirmada_en is not null),
  constraint extracciones_no_confirmada_limpia
    check (estado = 'confirmada' or (confirmada_por is null and confirmada_en is null))
);

-- Sin unique sobre documento_id: re-procesar una boleta que quedó
-- 'fallida' o 'descartada' crea una fila NUEVA — la vieja es
-- historial honesto del intento, no se recicla.
create index extracciones_documento_id_idx on documentos_extracciones (documento_id);
create index extracciones_organizacion_id_idx on documentos_extracciones (organizacion_id);
create index extracciones_organizacion_hash_idx on documentos_extracciones (organizacion_id, hash_archivo);
create index extracciones_empleado_id_idx on documentos_extracciones (empleado_id) where empleado_id is not null;

-- Integridad cruzada, mismo motivo y patrón que en `marcajes`.
create or replace function extracciones_validar_misma_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from documentos where id = new.documento_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El documento no pertenece a la organización de la extracción';
  end if;
  if new.empleado_id is not null and not exists (
    select 1 from empleados where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización de la extracción';
  end if;
  return new;
end;
$$;

create trigger extracciones_validar_organizacion
  before insert or update of documento_id, empleado_id, organizacion_id
  on documentos_extracciones
  for each row
  execute function extracciones_validar_misma_organizacion();

-- ── RLS: documentos_extracciones ───────────────────────────────────
alter table documentos_extracciones enable row level security;

create policy "Gestión ve las extracciones de su organización" on documentos_extracciones
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- Sin políticas de INSERT/UPDATE/DELETE para `authenticated`: toda
-- escritura es del servidor (ver cabecera de la sección).

-- ── Grants ─────────────────────────────────────────────────────────
revoke all on documentos_extracciones from anon, authenticated;
grant select on documentos_extracciones to authenticated;
grant select, insert, update on documentos_extracciones to service_role;
-- Descartar es estado, no borrado — para nadie (el DELETE que queda
-- es la cascada del documento padre, que corre como mecanismo interno
-- del FK, no como privilegio de un rol).
revoke delete, truncate on documentos_extracciones from service_role;

-- ══════════════════════════════════════════════════════════════════
-- 3. SEMANAS_ASISTENCIA — el ancla del período semanal
--
--    La consolidación NO copia horas: la pre-planilla se DERIVA de
--    los marcajes al leer, siempre. Esta tabla existe únicamente para
--    anclar el período (qué semana es) y su estado (abierta /
--    consolidada, quién y cuándo la consolidó) — sin ella no habría
--    dónde registrar ese cierre. Si un marcaje se anula o se agrega
--    después de consolidar, la derivación cambia y el estado
--    'consolidada' es la señal de revisar, no una foto congelada de
--    números. Las "ausencias" de la pre-planilla son un DATO DERIVADO
--    (días esperables sin marcajes, calculados al leer) y la UI los
--    rotula así — no existe tabla de ausencias/vacaciones/feriados en
--    esta V1 (roadmap pausado a propósito).
-- ══════════════════════════════════════════════════════════════════

create table semanas_asistencia (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  -- Siempre lunes (isodow 1) — el período es la semana ISO completa.
  fecha_inicio      date not null check (extract(isodow from fecha_inicio) = 1),
  -- Generada: no puede contradecir a fecha_inicio ni escribirse mal.
  fecha_fin         date not null generated always as (fecha_inicio + 6) stored,
  estado            text not null default 'abierta'
                      check (estado in ('abierta','consolidada')),
  consolidada_por   uuid references auth.users(id) on delete set null,
  consolidada_en    timestamptz,
  creado_en         timestamptz not null default now(),
  unique (organizacion_id, fecha_inicio),
  constraint semanas_consolidada_completa
    check (estado <> 'consolidada' or consolidada_en is not null),
  constraint semanas_abierta_limpia
    check (estado = 'consolidada' or (consolidada_por is null and consolidada_en is null))
);

-- Reloj y firma del cierre: mismos motivos que la anulación de
-- marcajes. Consolidar sella con now() + auth.uid(); reabrir limpia.
create or replace function semanas_sellar_consolidacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if new.estado = 'consolidada' and old.estado = 'abierta' then
    new.consolidada_en := now();
    new.consolidada_por := coalesce(auth.uid(), new.consolidada_por);
  elsif new.estado = 'abierta' and old.estado = 'consolidada' then
    new.consolidada_en := null;
    new.consolidada_por := null;
  end if;
  return new;
end;
$$;

create trigger semanas_consolidacion
  before update on semanas_asistencia
  for each row
  execute function semanas_sellar_consolidacion();

-- ── RLS: semanas_asistencia ────────────────────────────────────────
alter table semanas_asistencia enable row level security;

create policy "Gestión ve las semanas de su organización" on semanas_asistencia
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

create policy "Gestión abre semanas en su organización" on semanas_asistencia
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Gestión consolida o reabre semanas de su organización" on semanas_asistencia
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- Sin DELETE para `authenticated`: una semana abierta de más no
-- estorba (no copia datos) y una consolidada es historial.

-- ── Grants ─────────────────────────────────────────────────────────
revoke all on semanas_asistencia from anon, authenticated;
grant select on semanas_asistencia to authenticated;
grant insert (organizacion_id, fecha_inicio) on semanas_asistencia to authenticated;
-- Solo el estado: las marcas de consolidación las pone el trigger.
grant update (estado) on semanas_asistencia to authenticated;
grant all on semanas_asistencia to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0006_empleados_pendientes.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0006 — EL EMPLEADO PENDIENTE: perfiles que abre el Asistente IA
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA QUE RESUELVE
-- Se escanea la boleta de una persona que todavía no está en el
-- sistema. Hasta hoy eso terminaba en 'requiere_revision' con
-- `empleado_id` null y ahí se quedaba: alguien tenía que ir a
-- Colaboradores, crear la ficha a mano con los 18 campos, volver y
-- reasignar. Con treinta boletas de una empresa que recién entra,
-- eso son treinta altas manuales ANTES de poder ver un solo dato —
-- y es exactamente el momento en que un cliente decide que el
-- sistema no le sirve.
--
-- LA DECISIÓN
-- El sistema abre el perfil solo, con lo poco que la boleta dice
-- (el nombre, y la cédula si aparece), y lo deja en 'pendiente'.
-- La boleta se puede seguir procesando; el perfil incompleto queda
-- como una TAREA VISIBLE en la campana, no como un dato escondido.
--
-- 'pendiente' NO es 'activo'. Todo lo que hoy filtra por
-- `estado = 'activo'` —headcount, planilla, reportes— sigue
-- excluyéndolo sin tocar una línea. Es a propósito: un perfil que
-- nadie confirmó todavía no puede sumar a la nómina de nadie.
--
-- POR QUÉ CÉDULA Y FECHA DE INGRESO SE VUELVEN OPCIONALES
-- Una boleta de horario casi nunca trae la cédula, y no trae NUNCA
-- la fecha de ingreso. Las alternativas eran inventar un valor de
-- relleno —una cédula falsa se cuela en un reporte y ahí ya nadie
-- la distingue de una real— o permitir el null. Se permite el null,
-- pero SOLO mientras el perfil esté pendiente: el CHECK hace que
-- sea imposible activar a alguien sin esos dos datos. La regla de
-- negocio queda en la base, no en la confianza de que el formulario
-- se acuerde de validarla.
-- ══════════════════════════════════════════════════════════════════

-- ── El tercer estado ──────────────────────────────────────────────
alter table empleados drop constraint if exists empleados_estado_check;

alter table empleados
  add constraint empleados_estado_check
  check (estado in ('activo', 'inactivo', 'pendiente'));

-- ── De dónde salió esta ficha ─────────────────────────────────────
-- Sin esto, dentro de seis meses nadie puede distinguir una ficha a
-- medio llenar por una persona apurada de una que abrió la IA sola.
-- La ficha lo dice en pantalla, y el día que haya que auditar "qué
-- creó el modelo", es una consulta y no una arqueología.
alter table empleados
  add column if not exists origen text not null default 'manual'
    check (origen in ('manual', 'boleta_ia'));

comment on column empleados.origen is
  'manual = lo creó una persona desde Colaboradores. boleta_ia = lo abrió el Asistente IA al leer una boleta de alguien que no estaba en el sistema (queda estado = pendiente hasta que un humano complete la ficha).';

-- ── Cédula y fecha de ingreso: opcionales solo si está pendiente ──
alter table empleados alter column cedula drop not null;
alter table empleados alter column fecha_ingreso drop not null;

-- Las filas que ya existen tienen los dos datos, así que el CHECK
-- entra sin validar nada hacia atrás.
alter table empleados
  add constraint empleados_datos_minimos_si_no_pendiente
  check (
    estado = 'pendiente'
    or (cedula is not null and fecha_ingreso is not null)
  );

comment on constraint empleados_datos_minimos_si_no_pendiente on empleados is
  'Un empleado activo o inactivo SIEMPRE tiene cédula y fecha de ingreso. Solo un perfil pendiente —el que abre el Asistente IA leyendo una boleta— puede existir sin ellos, y no puede salir de pendiente hasta que los tenga.';

-- El unique (organizacion_id, cedula) de la 0001 sigue igual: en
-- Postgres los null no chocan entre sí, así que varios pendientes
-- sin cédula conviven, y en cuanto uno recibe la suya vuelve a
-- competir por la unicidad como cualquier otro. Justo lo que
-- queremos: el choque tiene que saltar al ACTIVAR, que es cuando
-- alguien está afirmando que esta persona es esta persona.

-- ── Que dos boletas de la misma persona no abran dos perfiles ─────
-- El matching ya evita el caso normal (los pendientes entran en la
-- lista de candidatos, así que la segunda boleta encuentra al perfil
-- que abrió la primera). Este índice es el cinturón para el caso de
-- carrera: dos boletas subiéndose a la vez, ninguna de las dos ve
-- todavía al perfil que la otra está creando. Solo aplica a los
-- pendientes creados por la IA — dos empleados reales pueden
-- llamarse igual, y eso no es problema de nadie.
create unique index if not exists empleados_pendiente_ia_nombre_idx
  on empleados (
    organizacion_id,
    -- `translate`, `lower` y `regexp_replace` son las tres inmutables,
    -- que es lo que un índice exige. Se evita a propósito depender de
    -- la extensión `unaccent`: su función NO es inmutable (el
    -- diccionario se puede recargar) y no entra en un índice sin
    -- envolverla — más pieza móvil de la que esto amerita.
    lower(
      regexp_replace(
        translate(nombre || ' ' || apellidos,
                  'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
        '\s+', ' ', 'g')
    )
  )
  where estado = 'pendiente' and origen = 'boleta_ia';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0010_horarios_asistencia.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0010: HORARIOS V1 (módulo Asistencia + Horarios)
--
-- ESCRITA, NO APLICADA. El código que la usa DEGRADA con aviso
-- neutro si estas tablas no existen todavía: `/org/[orgId]/horarios`
-- muestra la realidad de hoy (la jornada de la ficha de cada persona)
-- y la columna «Tardanza» de Asistencia dice «sin horario» en vez de
-- inventar un número. Nada se rompe si esta migración no se corre.
--
-- ── POR QUÉ HACE FALTA UNA TABLA NUEVA ─────────────────────────────
-- Hasta la 0005, lo único que el sistema sabe del horario de una
-- persona es `empleados.jornada` ('diurna' | 'nocturna' | 'mixta').
-- Eso alcanza para DURACIONES —cuántas horas ordinarias tiene su
-- jornada diaria (Arts. 135/136/138 del Código de Trabajo, ya
-- codificados en src/lib/asistencia/horario.ts)— pero no dice NADA
-- sobre a qué hora le toca entrar. Y sin hora esperada de entrada,
-- «tardanza» no es un dato derivable: es una suposición.
--
-- El módulo de Asistencia pide una columna de tardanza «contra su
-- jornada». Se puede hacer de dos maneras:
--   a) inventar una hora de entrada por tipo de jornada (p. ej.
--      "diurna = 8:00") y comparar contra eso. Sería un dato falso
--      presentado como real: una panadería abre a las 4 a.m.;
--   b) registrar el horario de verdad y comparar contra él, y
--      mientras no exista decir «sin horario asignado».
-- Esta migración es el camino (b). Attendance sigue registrando
-- HECHOS: el horario es el patrón de referencia contra el que se
-- comparan, no un hecho nuevo ni un cálculo de dinero.
--
-- ── QUÉ NO ES ESTA MIGRACIÓN ───────────────────────────────────────
-- No es planilla: acá no hay ni una columna de colones, recargos ni
-- deducciones. No es ausencias ni vacaciones ni feriados (siguen
-- pausados en el roadmap): un día fuera del horario se rotula
-- «descanso según su horario», nunca «vacaciones».
--
-- // PENDIENTE compliance: la reclasificación automática de jornada
-- // mixta a nocturna al cruzar 3.5 h de trabajo nocturno (Art. 138)
-- // sigue sin implementarse, igual que en la 0005. `horarios.jornada`
-- // es la jornada DECLARADA del horario, no una clasificación
-- // derivada de sus horas.
-- //
-- // A propósito NO hay un CHECK que ate la duración del turno al tope
-- // de su jornada declarada (8/6/7 h, Arts. 135/136/138): existen
-- // esquemas reales de 12 h y la línea entre "jornada acumulativa
-- // legítima" y "jornada ilegal" depende de acuerdos y de la
-- // actividad, no de una fórmula que podamos escribir con fuente.
-- // Lo que sí hace el servidor (horarios/actions.ts) es RECHAZAR un
-- // turno de más de 12 h —el tope combinado del Art. 140, que sí es
-- // una línea dura— y AVISAR, sin bloquear, cuando el turno supera la
-- // jornada ordinaria de su tipo.
-- // PENDIENTE compliance: los regímenes especiales (Art. 143,
-- // menores, trabajo doméstico) tienen topes propios y esta tabla no
-- // los distingue — la ficha del empleado todavía no registra
-- // régimen.
-- ============================================================

-- ══════════════════════════════════════════════════════════════════
-- 1. HORARIOS — la plantilla: a qué hora entra y sale un turno
--
--    Es CONFIGURACIÓN, no un hecho: se corrige en su lugar (a
--    diferencia de `marcajes`, que son inmutables). Por eso sí tiene
--    UPDATE — pero NO tiene DELETE para nadie: un horario que ya se
--    usó es la referencia contra la que se juzgaron tardanzas
--    pasadas, y borrarlo reescribiría en silencio esa lectura. Se
--    retira con `activo = false`, igual que sedes/puestos en la 0001.
-- ══════════════════════════════════════════════════════════════════

create table horarios (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  nombre            text not null check (btrim(nombre) <> ''),
  -- La jornada DECLARADA de este horario (ver PENDIENTE de arriba).
  -- Mismo vocabulario que `empleados.jornada` a propósito: son la
  -- misma idea legal y no deben poder divergir en dos catálogos.
  jornada           text not null check (jornada in ('diurna','nocturna','mixta')),
  -- Hora local de Costa Rica (UTC-6 fijo, sin horario de verano). Se
  -- guarda `time` sin zona porque un horario NO es un instante: "entra
  -- a las 6:00" es cierto todos los días del año, y un timestamptz
  -- ataría la plantilla a una fecha que no tiene.
  hora_entrada      time not null,
  hora_salida       time not null,
  -- Un turno que cruza la medianoche es legítimo (nocturna 22:00 →
  -- 06:00): salida < entrada se interpreta como "del día siguiente",
  -- exactamente igual que en analizarTurno() de horario.ts. Lo único
  -- prohibido es un turno de duración cero.
  constraint horarios_duracion_real check (hora_entrada <> hora_salida),
  -- Días de la semana en que aplica, en ISO (1 = lunes … 7 = domingo),
  -- el mismo criterio que `semanas_asistencia.fecha_inicio` (isodow).
  -- El trigger de abajo lo deja ordenado y sin repetidos: el CHECK no
  -- puede hacerlo solo (una subconsulta no se permite en un CHECK).
  -- `cardinality` y no `array_length`: sobre un arreglo vacío
  -- array_length devuelve NULL y un CHECK que evalúa NULL PASA — el
  -- horario sin días se colaría y reventaría después contra el
  -- not-null del trigger, con un mensaje que no explica nada.
  dias              smallint[] not null
                      check (cardinality(dias) between 1 and 7)
                      check (dias <@ array[1,2,3,4,5,6,7]::smallint[]),
  -- Minutos de gracia antes de que una entrada cuente como tardanza.
  -- Cero es un valor legítimo y es el default: la tolerancia es una
  -- política de la empresa, no una constante que inventemos nosotros.
  tolerancia_minutos   smallint not null default 0
                      check (tolerancia_minutos between 0 and 120),
  -- Pausa NO trabajada prevista (almuerzo). Se descuenta de las horas
  -- ESPERADAS del día; las horas reales salen de los marcajes de
  -- pausa, no de acá — este número nunca reemplaza a un hecho.
  descanso_minutos     smallint not null default 0
                      check (descanso_minutos between 0 and 480),
  activo            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  -- Dos horarios con el mismo nombre en la misma empresa hacen
  -- imposible elegir bien en un desplegable.
  unique (organizacion_id, nombre)
);

create index horarios_organizacion_id_idx on horarios (organizacion_id);

-- Forma canónica de `dias`: ordenado y sin repetidos. Así
-- `dias = '{1,2,3}'` y `'{3,1,1,2}'` no son dos filas distintas que
-- significan lo mismo, y el código que lee puede confiar en el orden.
create or replace function horarios_normalizar_dias()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  new.dias := (select array_agg(distinct d order by d) from unnest(new.dias) as d);
  return new;
end;
$$;

create trigger horarios_dias_canonicos
  before insert or update of dias on horarios
  for each row
  execute function horarios_normalizar_dias();

-- ── RLS: horarios — en la MISMA migración (Gate §1) ────────────────
alter table horarios enable row level security;

-- SELECT a nivel de miembro, no de gestión (a diferencia de
-- `marcajes` en la 0005): un horario no tiene ningún dato sensible
-- (Gate §4.1) —es a qué hora abre el turno, no cuánto gana nadie— y
-- sin esto la política de `horarios_asignacion` que deja al empleado
-- ver la SUYA le mostraría un id sin poder decirle a qué hora entra.
create policy "El miembro ve los horarios de su organización" on horarios
  for select to authenticated
  using (pertenece_a_organizacion(organizacion_id));

create policy "Gestión crea horarios en su organización" on horarios
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Gestión edita los horarios de su organización" on horarios
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- Sin política de DELETE, a propósito — ver la cabecera de la sección.

revoke all on horarios from anon, authenticated;
grant select on horarios to authenticated;
grant insert (organizacion_id, nombre, jornada, hora_entrada, hora_salida,
              dias, tolerancia_minutos, descanso_minutos)
  on horarios to authenticated;
grant update (nombre, jornada, hora_entrada, hora_salida, dias,
              tolerancia_minutos, descanso_minutos, activo, actualizado_en)
  on horarios to authenticated;
grant select, insert, update on horarios to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 2. HORARIOS_ASIGNACION — quién sigue qué horario, y desde cuándo
--
--    Se asigna a UNA PERSONA o a UN DEPARTAMENTO, nunca a los dos en
--    la misma fila (el CHECK lo hace exhaustivo). La resolución la
--    hace código puro (src/lib/asistencia/horarios.ts) con una regla
--    de una línea: gana lo más específico (persona sobre
--    departamento) y, dentro de lo mismo, la vigencia más reciente
--    que ya empezó.
--
--    ── POR QUÉ NO HAY EXCLUSION CONSTRAINT DE SOLAPES ─────────────
--    Lo correcto en Postgres sería `exclude using gist (empleado_id
--    with =, daterange(desde, hasta) with &&)`, que exige la
--    extensión `btree_gist`. Se decidió NO agregar una extensión en
--    una migración que además no se puede probar acá:
--      · el índice único parcial de abajo ya impide el caso real
--        (dos asignaciones al mismo destino empezando el mismo día);
--      · la resolución en TypeScript es determinista aunque haya
--        solape (gana la más reciente que ya empezó), así que nunca
--        hay una respuesta ambigua en pantalla;
--      · y la pantalla de Horarios DETECTA los solapes y los muestra
--        como aviso en vez de esconderlos.
--    // PENDIENTE: si el solape resulta un problema real en uso,
--    // agregar btree_gist + exclusion constraint en su propia
--    // migración, con backfill que cierre las vigencias abiertas.
-- ══════════════════════════════════════════════════════════════════

create table horarios_asignacion (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  -- Sin `on delete` (RESTRICT): mientras un horario esté asignado no
  -- se puede desaparecer. (La tabla `horarios` tampoco tiene DELETE
  -- para nadie — esto es el cinturón del tirante.)
  horario_id        uuid not null references horarios(id),
  empleado_id       uuid references empleados(id) on delete cascade,
  departamento_id   uuid references departamentos(id) on delete cascade,
  desde             date not null,
  -- null = vigente sin fecha de cierre. Cerrar una asignación (poner
  -- `hasta`) es la forma correcta de dar de baja un horario: el
  -- pasado sigue leyéndose contra el horario que de verdad regía.
  hasta             date,
  nota              text,
  creado_por        uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en         timestamptz not null default now(),
  constraint asignacion_un_solo_destino
    check ((empleado_id is null) <> (departamento_id is null)),
  constraint asignacion_rango_coherente
    check (hasta is null or hasta >= desde)
);

create index asignacion_organizacion_id_idx on horarios_asignacion (organizacion_id);
create index asignacion_horario_id_idx on horarios_asignacion (horario_id);
create index asignacion_empleado_idx on horarios_asignacion (empleado_id, desde)
  where empleado_id is not null;
create index asignacion_departamento_idx on horarios_asignacion (departamento_id, desde)
  where departamento_id is not null;

-- El caso de solape que sí se puede frenar sin extensiones: dos
-- asignaciones al mismo destino que arrancan el mismo día (el doble
-- clic, o dos personas asignando a la vez) — ahí no hay forma de
-- decidir cuál gana, así que no se permite.
create unique index asignacion_empleado_desde_unico_idx
  on horarios_asignacion (empleado_id, desde) where empleado_id is not null;
create unique index asignacion_departamento_desde_unico_idx
  on horarios_asignacion (departamento_id, desde) where departamento_id is not null;

-- Integridad cruzada entre organizaciones — mismo patrón y mismo
-- motivo que `marcajes_validar_misma_organizacion` en la 0005: ningún
-- FK impide por sí solo que una asignación de la organización A
-- apunte a un empleado, departamento u horario de la B.
create or replace function asignacion_validar_misma_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from horarios
    where id = new.horario_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El horario no pertenece a la organización de la asignación';
  end if;
  if new.empleado_id is not null and not exists (
    select 1 from empleados
    where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización de la asignación';
  end if;
  if new.departamento_id is not null and not exists (
    select 1 from departamentos
    where id = new.departamento_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El departamento no pertenece a la organización de la asignación';
  end if;
  return new;
end;
$$;

create trigger asignacion_validar_organizacion
  before insert or update of horario_id, empleado_id, departamento_id, organizacion_id
  on horarios_asignacion
  for each row
  execute function asignacion_validar_misma_organizacion();

-- El destino y el arranque de una vigencia NO se editan: cambiarlos
-- reescribe cómo se leyó el pasado (una tardanza de hace tres semanas
-- pasaría a ser puntualidad sin que nadie se entere). Se cierra la
-- vigencia con `hasta` y se crea una nueva. Lo único mutable es el
-- cierre y la nota.
create or replace function asignacion_solo_cierre()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if new.organizacion_id is distinct from old.organizacion_id
     or new.horario_id      is distinct from old.horario_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.departamento_id is distinct from old.departamento_id
     or new.desde           is distinct from old.desde
     or new.creado_por      is distinct from old.creado_por
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'De una asignación vigente solo se cambia su cierre (hasta) o su nota: para cambiar de horario, cerrá esta y creá una nueva';
  end if;
  return new;
end;
$$;

create trigger asignacion_cierre
  before update on horarios_asignacion
  for each row
  execute function asignacion_solo_cierre();

-- ── RLS: horarios_asignacion ───────────────────────────────────────
alter table horarios_asignacion enable row level security;

create policy "Gestión ve las asignaciones de su organización" on horarios_asignacion
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- El empleado ve la suya — no la de sus compañeros. Mismo patrón de
-- subconsulta sobre `empleados` que "El empleado ve sus propios
-- marcajes" (0005).
create policy "El empleado ve su propia asignación" on horarios_asignacion
  for select to authenticated
  using (
    empleado_id is not null
    and exists (select 1 from empleados e
                where e.id = empleado_id and e.usuario_id = auth.uid())
  );

create policy "Gestión asigna horarios en su organización" on horarios_asignacion
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Gestión cierra asignaciones de su organización" on horarios_asignacion
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- DELETE solo de lo que TODAVÍA NO EMPEZÓ: una asignación futura mal
-- creada se borra sin consecuencias; una que ya rigió es la
-- referencia contra la que se leyó la asistencia de esos días y solo
-- se cierra. La condición va en la política (no en un CHECK) porque
-- depende del día en que se ejecuta el borrado.
create policy "Gestión borra asignaciones que aún no empezaron" on horarios_asignacion
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id) and desde > current_date);

revoke all on horarios_asignacion from anon, authenticated;
grant select on horarios_asignacion to authenticated;
-- `creado_por` queda FUERA del insert: lo llena el default
-- `auth.uid()` con el usuario real del JWT (patrón de `marcajes` en
-- la 0005 y de `invitaciones.creada_por` en la 0004).
grant insert (organizacion_id, horario_id, empleado_id, departamento_id, desde, hasta, nota)
  on horarios_asignacion to authenticated;
grant update (hasta, nota) on horarios_asignacion to authenticated;
grant delete on horarios_asignacion to authenticated;
grant select, insert, update, delete on horarios_asignacion to service_role;

-- ══════════════════════════════════════════════════════════════════
-- 3. QUÉ QUEDA AUDITADO (sigue la lista cerrada de la 0005, §5.2)
--
--   · `horario.creado` / `horario.editado` — campo por campo
--   · `horario.retirado` / `horario.reactivado` — cambio de `activo`
--   · `horario.asignado` — a quién (empleado o departamento) y desde
--   · `horario.asignacion_cerrada` — con qué fecha de cierre
--   · `horario.asignacion_borrada` — solo puede ser una futura
--
-- NO queda auditado, declarado y no omitido: la LECTURA de un
-- horario. No es dato sensible (Gate §4.1) y auditar cada lectura de
-- "a qué hora entra el turno" llenaría la bitácora de ruido que
-- taparía justo lo que sí importa.
-- ══════════════════════════════════════════════════════════════════

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0020_expedientes_vencimiento.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0020: EXPEDIENTES — vigencia de los documentos
--
-- Numerada 0020 y no 0010 a propósito: otro módulo (Horarios) tomó el
-- 0010 al mismo tiempo, y dos archivos con el MISMO número de versión
-- rompen `supabase db push` — la CLI usa el prefijo como versión, no
-- el nombre completo, así que el sufijo distinto no alcanza. Este
-- módulo se corre desde 0020 para dejar aire a los demás.
--
-- No crea ninguna tabla: `documentos` y su bucket privado ya existen
-- desde 0001/0002. Lo único que le faltaba al expediente para poder
-- decir algo más que "acá hay un archivo" es CUÁNDO DEJA DE SERVIR.
--
-- ── POR QUÉ UNA COLUMNA Y NO UNA TABLA DE "ESTADO" ─────────────────
-- La tentación era `documentos.estado` con ('completo','pendiente',
-- 'por_vencer','vencido'). Sería un estado que hay que MANTENER: un
-- documento que vence el 3 de setiembre pasa a "vencido" el 4 sin que
-- nadie toque nada, así que un `estado` guardado necesitaría un cron
-- que lo actualice, y entre corrida y corrida la tabla mentiría.
--
-- Acá se guarda el HECHO (la fecha en que vence) y el estado se
-- DERIVA al leer, contra el día de hoy en Costa Rica — el mismo
-- criterio de la 0005 con la pre-planilla, que deriva las horas de los
-- marcajes en vez de congelarlas. Un hecho no caduca; un estado
-- calculado y guardado, sí.
--
-- ── `notas` ────────────────────────────────────────────────────────
-- Texto libre corto del expediente ("firmado por ambas partes",
-- "copia, el original está en el archivo físico"). No es un campo de
-- datos sensibles por diseño y la UI lo dice; quien escriba una cédula
-- ahí lo hace igual que si la escribiera en el nombre del archivo.
--
-- ── CLASIFICACIÓN (Gate §4.1) ──────────────────────────────────────
-- `fecha_vencimiento` y `notas` son INTERNO: operativos, sin dato
-- personal obligatorio. Van dentro del `grant select` normal de
-- `documentos` (que no está recortado por columna — lo Restringido
-- según §4.1 es el ARCHIVO de categoría 'identificacion', y eso se
-- protege donde se protege de verdad: la URL firmada de corta
-- duración que emite el servidor, nunca una URL pública).
--
-- ── QUÉ QUEDA AUDITADO ─────────────────────────────────────────────
-- Lo mismo que ya declaraba la 0001 (Gate §5.2): "Documento subido /
-- eliminado", con referencia al archivo y NUNCA su contenido. Esta
-- migración no agrega acciones auditadas: editar la fecha de
-- vencimiento de un documento se registra como
-- `documento.vigencia.editada` por la server action que lo hace —
-- declarado acá para que la lista siga siendo cerrada y no "todo lo
-- que se nos ocurra".
--
-- Correr con `supabase db push --linked` contra el proyecto de
-- Supabase PROPIO de Work (kcatxzuoaajxlmvczolk).
-- ============================================================

alter table documentos add column if not exists fecha_vencimiento date;
alter table documentos add column if not exists notas text;

-- El índice sirve a la única consulta que de verdad barre por fecha:
-- "qué vence pronto en ESTA organización". Parcial, porque la enorme
-- mayoría de los documentos (y todas las boletas de horario) no
-- vencen nunca y no tienen por qué ocupar lugar en el índice.
create index if not exists documentos_vencimiento_idx
  on documentos (organizacion_id, fecha_vencimiento)
  where fecha_vencimiento is not null;

-- El grant de UPDATE de `documentos` es POR COLUMNA desde la 0001
-- (`organizacion_id` deliberadamente afuera: re-parentar un documento
-- hacia otra organización no debe ser posible ni con un UPDATE
-- directo). Las dos columnas nuevas se suman a esa lista; el grant
-- previo no se revoca ni se reemplaza, se acumula.
grant update (fecha_vencimiento, notas) on documentos to authenticated;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0021_jornadas_declaradas.sql
-- ════════════════════════════════════════════════════════════

-- ============================================================
-- BOOKEA WORK — 0021: JORNADAS DECLARADAS
-- El segundo tipo de HECHO de asistencia: horas YA TOTALIZADAS por
-- día que un documento declara, sin marcajes de entrada y salida.
--
-- ── POR QUÉ UNA TABLA NUEVA Y NO MÁS FILAS EN `marcajes` ──────────
-- Las boletas reales del cliente (Multiservicios Aldama para centros
-- de FEMSA) NO son tarjetas de marcaje: son planillas semanales donde
-- cada fila es un empleado y cada día trae horas ya sumadas por el
-- supervisor, clasificadas en ORDINARIAS / EXTRAS / DOBLES. El
-- documento no dice a qué hora entró nadie. La única hora de reloj
-- que aparece es el horario NOMINAL del turno impreso en el
-- formulario ("HORA DE ENTRADA: 6:00 a. m."), que no cambia por día
-- ni por persona.
--
-- Meterlas en `marcajes` obligaría a inventar un `momento` — que es
-- exactamente la mentira que este sistema no comete. Un marcaje
-- responde "¿a qué hora ocurrió?"; una jornada declarada responde
-- "¿cuántas horas de cada tipo declaró el documento ese día?". Son
-- dos preguntas distintas y por eso son dos tablas distintas. La
-- pre-planilla las suma por separado y muestra de dónde salió cada
-- hora — nunca las mezcla en un total mudo.
--
-- ── LO QUE ORDINARIAS / EXTRAS / DOBLES SIGNIFICAN ACÁ ────────────
-- Son ETIQUETAS TRANSCRITAS DEL DOCUMENTO, no una clasificación de
-- Bookea. Quien decidió que esas dos horas son "extras" fue el
-- supervisor que llenó la planilla. Marco legal verificado en
-- docs/bookea-work/COSTA_RICA_COMPLIANCE.md (ago 2026):
--   · Jornada ordinaria por tipo — Arts. 135/136/138 (diurna 8/48,
--     nocturna 6/36, mixta 7/42).
--   · Jornada extraordinaria y su recargo del 50% — Art. 139; tope
--     combinado de 12 h diarias — Art. 140. El recargo lo calcula
--     Planilla, que está pausada: acá no hay ni una columna de dinero.
--   · // PENDIENTE compliance: el pago DOBLE del día de descanso
--     semanal (Art. 152) y del feriado trabajado (Art. 149 → 152)
--     está verificado, pero NO está confirmado que la columna "D" de
--     estas planillas corresponda a esos supuestos: el papel no trae
--     leyenda que lo diga y la casilla "DOMI/FERI" funde domingo y
--     feriado en una sola celda. Hasta que el dueño lo confirme con
--     una boleta que tenga domingo trabajado, `horas_dobles` es
--     exclusivamente lo que el documento declara, sin mapeo legal.
--     Por eso se guarda también `etiqueta_documento`: el rótulo
--     literal de la columna, que es el único registro de que domingo
--     y feriado venían fundidos.
--
-- ── MISMA DISCIPLINA QUE `marcajes` (0005) ────────────────────────
-- Inmutable: se registra y, a lo sumo, se ANULA con motivo. Sin
-- DELETE para nadie —tampoco para service_role—, UPDATE limitado por
-- grant de columna y cerrado por trigger, `origen`/`documento_id`/
-- `registrado_por` fuera del grant del cliente para que la
-- trazabilidad documento → hecho no se pueda fabricar desde afuera.
--
-- ── QUÉ QUEDA AUDITADO ────────────────────────────────────────────
--   · `jornada_declarada.anulada` — la única mutación posible.
--   · `extraccion.confirmada` ya cubre el alta del lote (documento_id
--     + cuántas jornadas se crearon), igual que con los marcajes.
-- No queda auditada el alta individual: la fila ES el registro del
-- hecho (quién = `registrado_por`, cuándo = `creado_en`) y es
-- inmutable — mismo criterio que la 0005.
--
-- Requiere 0001 (helpers y tablas base) y 0005 (el pipeline de
-- extracciones que la alimenta). Correr con `supabase db push
-- --linked` contra el proyecto de Supabase PROPIO de Work.
-- ============================================================

create table jornadas_declaradas (
  id                uuid primary key default gen_random_uuid(),
  -- SIN `on delete cascade`, igual que `marcajes`: es evidencia
  -- laboral de retención larga.
  organizacion_id   uuid not null references organizaciones(id),
  empleado_id       uuid not null references empleados(id),
  -- El día al que el documento le atribuye estas horas. Se DERIVA del
  -- período declarado ("SEMANA DEL 03 08 AL 09 08 2026") más la
  -- posición de la columna; si el documento no trae año, la fecha no
  -- se puede derivar y la extracción no se confirma hasta que un
  -- humano la complete. Nunca se adivina.
  fecha             date not null,
  -- Horas, no minutos: el papel escribe "8", "3.5", "48". numeric
  -- para que 3.5 + 3.5 sea 7 exacto y no 6.999999 de punto flotante.
  -- NULL = el documento no lo dice (celda vacía o "--"); 0 = el
  -- documento dice cero (no trabajó). No son lo mismo.
  horas_ordinarias  numeric(5,2) check (horas_ordinarias >= 0 and horas_ordinarias <= 24),
  horas_extra       numeric(5,2) check (horas_extra >= 0 and horas_extra <= 24),
  horas_dobles      numeric(5,2) check (horas_dobles >= 0 and horas_dobles <= 24),
  -- El rótulo LITERAL de la columna del formulario ("LUNES",
  -- "DOMI/FERI"). Ver la nota de compliance de la cabecera.
  etiqueta_documento text,
  -- El turno declarado en el encabezado del bloque ("TURNO 1",
  -- "TURNO / TRES ( 3 )"), literal. Contexto, no cálculo.
  turno             text,
  origen            text not null default 'manual' check (origen in ('manual','documento')),
  registrado_por    uuid references auth.users(id) on delete set null default auth.uid(),
  -- Trazabilidad documento → hecho. Sin `on delete` (RESTRICT):
  -- mientras existan jornadas derivadas de un documento, ese
  -- documento es respaldo y su fila no se puede borrar.
  documento_id      uuid references documentos(id),
  nota              text,
  anulado           boolean not null default false,
  anulado_por       uuid references auth.users(id) on delete set null,
  anulado_en        timestamptz,
  anulado_motivo    text,
  creado_en         timestamptz not null default now(),
  -- Una fila sin ninguna hora no registra ningún hecho.
  constraint jornadas_con_alguna_hora
    check (horas_ordinarias is not null or horas_extra is not null or horas_dobles is not null),
  -- Tope físico: un día tiene 24 horas. El tope LEGAL de 12 h del
  -- Art. 140 NO se restringe acá a propósito — Attendance registra el
  -- hecho que el documento declara, incluso cuando ese hecho es
  -- irregular; el exceso viaja como aviso a la revisión humana.
  constraint jornadas_dia_de_24_horas
    check (coalesce(horas_ordinarias,0) + coalesce(horas_extra,0) + coalesce(horas_dobles,0) <= 24),
  constraint jornadas_documento_con_origen
    check (origen <> 'documento' or documento_id is not null),
  constraint jornadas_manual_sin_documento
    check (origen <> 'manual' or documento_id is null),
  constraint jornadas_anulacion_completa
    check (not anulado or (anulado_en is not null and anulado_motivo is not null)),
  constraint jornadas_no_anulada_limpia
    check (anulado or (anulado_por is null and anulado_en is null and anulado_motivo is null))
);

-- El mismo día de la misma persona no se declara dos veces: único
-- parcial sobre las no anuladas. Es la red contra la doble
-- confirmación de la misma planilla y contra subir dos veces el mismo
-- documento. Corregir es anular y volver a registrar, y el reemplazo
-- puede caer en el mismo (empleado, fecha) porque el anulado sale del
-- índice.
create unique index jornadas_declaradas_dia_unico_idx
  on jornadas_declaradas (empleado_id, fecha)
  where not anulado;

create index jornadas_declaradas_organizacion_fecha_idx
  on jornadas_declaradas (organizacion_id, fecha);
create index jornadas_declaradas_empleado_fecha_idx
  on jornadas_declaradas (empleado_id, fecha);
create index jornadas_declaradas_documento_id_idx
  on jornadas_declaradas (documento_id) where documento_id is not null;

-- Integridad cruzada: ningún FK impide por sí solo que una jornada de
-- la organización A apunte a un empleado o documento de la B.
-- security definer para que las subconsultas vean las filas reales.
create or replace function jornadas_declaradas_validar_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from empleados where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización de la jornada declarada';
  end if;
  if new.documento_id is not null and not exists (
    select 1 from documentos where id = new.documento_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El documento no pertenece a la organización de la jornada declarada';
  end if;
  return new;
end;
$$;

create trigger jornadas_declaradas_validar_org
  before insert on jornadas_declaradas
  for each row
  execute function jornadas_declaradas_validar_organizacion();

-- La ÚNICA mutación que existe sobre una jornada declarada es
-- anularla — para cualquier rol, incluida la llave de servicio (los
-- triggers no se saltan con BYPASSRLS).
create or replace function jornadas_declaradas_solo_anulacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if old.anulado then
    raise exception 'Una jornada declarada anulada está congelada: no se des-anula ni se modifica';
  end if;
  if not new.anulado then
    raise exception 'El único UPDATE permitido sobre una jornada declarada es anularla';
  end if;
  if new.organizacion_id    is distinct from old.organizacion_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.fecha           is distinct from old.fecha
     or new.horas_ordinarias is distinct from old.horas_ordinarias
     or new.horas_extra     is distinct from old.horas_extra
     or new.horas_dobles    is distinct from old.horas_dobles
     or new.etiqueta_documento is distinct from old.etiqueta_documento
     or new.turno           is distinct from old.turno
     or new.origen          is distinct from old.origen
     or new.registrado_por  is distinct from old.registrado_por
     or new.documento_id    is distinct from old.documento_id
     or new.nota            is distinct from old.nota
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'El hecho registrado no se modifica: para corregir, anular y registrar uno nuevo';
  end if;
  if new.anulado_motivo is null or btrim(new.anulado_motivo) = '' then
    raise exception 'Anular una jornada declarada exige un motivo';
  end if;
  new.anulado_en := now();
  new.anulado_por := coalesce(auth.uid(), new.anulado_por);
  return new;
end;
$$;

create trigger jornadas_declaradas_anulacion
  before update on jornadas_declaradas
  for each row
  execute function jornadas_declaradas_solo_anulacion();

-- ── RLS: jornadas_declaradas — en la MISMA migración (Gate §1) ─────
alter table jornadas_declaradas enable row level security;

create policy "Gestión ve las jornadas declaradas de su organización" on jornadas_declaradas
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

-- El empleado (si tiene usuario) ve LAS SUYAS — no las de sus
-- compañeros. Mismo patrón que `marcajes` en la 0005.
create policy "El empleado ve sus propias jornadas declaradas" on jornadas_declaradas
  for select to authenticated
  using (
    exists (select 1 from empleados e
            where e.id = empleado_id and e.usuario_id = auth.uid())
  );

create policy "Gestión registra jornadas declaradas en su organización" on jornadas_declaradas
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Gestión anula jornadas declaradas de su organización" on jornadas_declaradas
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));

-- Sin política de DELETE para `authenticated` — y sin DELETE para
-- nadie, ver el revoke a service_role de abajo.

-- ── Grants por columna (patrón 0001/0004/0005) ─────────────────────
revoke all on jornadas_declaradas from anon, authenticated;

-- Sin columna Restringida/Crítica (Gate §4.1): cuántas horas declaró
-- una boleta es dato operativo, visible completo para quien la
-- política ya deja ver la fila.
grant select on jornadas_declaradas to authenticated;

-- INSERT solo del hecho que el formulario decide. `origen` nace
-- 'manual', `registrado_por` nace auth.uid(), `anulado` nace false,
-- `creado_en` nace now() — todo por default, nada falsificable. La
-- trazabilidad ('documento' + documento_id) solo la escribe el
-- servidor al confirmar una extracción.
grant insert (organizacion_id, empleado_id, fecha, horas_ordinarias, horas_extra,
              horas_dobles, etiqueta_documento, turno, nota)
  on jornadas_declaradas to authenticated;

-- UPDATE solo de la anulación; el trigger sella fecha y actor.
grant update (anulado, anulado_motivo) on jornadas_declaradas to authenticated;

-- service_role: todo MENOS delete/truncate. El revoke pisa el ALL que
-- los default privileges de la plataforma ya le habían dado (la
-- lección de la 0003).
grant select, insert, update on jornadas_declaradas to service_role;
revoke delete, truncate on jornadas_declaradas from service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0022_tarifa_hora.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0022 — TARIFA POR HORA: un segundo modo de pago, junto al salario
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA QUE RESUELVE
-- `periodicidad_pago` solo admitía mensual/quincenal/semanal — los
-- tres son un SALARIO periódico fijo (`salario_base`). No hay forma
-- de registrar a alguien que cobra por hora trabajada, que es un modo
-- de pago real y distinto (el monto depende de las horas del período,
-- no es un monto fijo cada quincena).
--
-- LA DECISIÓN
-- 'por_hora' se suma como un cuarto valor de `periodicidad_pago`, y
-- `tarifa_hora` guarda el monto por hora — el mismo rol que
-- `salario_base` cumple para los otros tres modos. No se crea una
-- dimensión "tipo_pago" aparte: `periodicidad_pago` ya es "cómo se
-- denomina esta paga", y 'por_hora' es una denominación más.
--
-- MISMA SENSIBILIDAD QUE EL SALARIO (Gate §4.1)
-- `tarifa_hora` es un monto de dinero por persona: Restringido, igual
-- que `salario_base`. Sale del `grant select` base y entra a
-- insert/update — mismo tratamiento exacto, para que quien no puede
-- ver el salario tampoco vea la tarifa por hora.
--
-- EL HISTORIAL SIGUE SIENDO UNA SOLA LÍNEA DE TIEMPO
-- `empleados_historial_salario` ya es "los tramos de cuánto se le
-- pagaba a esta persona, desde cuándo". Un tramo puede tener salario O
-- tarifa por hora (según el modo vigente en ese tramo) — no se crea
-- una segunda tabla de historial, porque "qué le pagábamos en marzo"
-- tiene que responderse con una sola línea de tiempo por persona, no
-- dos que hay que cruzar a mano.
-- ══════════════════════════════════════════════════════════════════

-- ── El cuarto modo de pago ────────────────────────────────────────
alter table empleados drop constraint if exists empleados_periodicidad_pago_check;

alter table empleados
  add constraint empleados_periodicidad_pago_check
  check (periodicidad_pago in ('mensual', 'quincenal', 'semanal', 'por_hora'));

-- ── La tarifa en sí ───────────────────────────────────────────────
alter table empleados
  add column tarifa_hora numeric check (tarifa_hora is null or tarifa_hora >= 0);

comment on column empleados.tarifa_hora is
  'Monto por hora trabajada, solo relevante cuando periodicidad_pago = ''por_hora''. Restringido (Gate §4.1): mismo tratamiento que salario_base, fuera del grant select base.';

-- Mismo grant por columna que salario_base (migración 0001): entra a
-- insert/update de authenticated (gateado por la política de RLS, que
-- ya exige gestionar_organizacion), pero NUNCA al select base.
grant insert (tarifa_hora) on empleados to authenticated;
grant update (tarifa_hora) on empleados to authenticated;

-- ── El historial admite el tramo por hora ────────────────────────
alter table empleados_historial_salario
  add column tarifa_hora numeric check (tarifa_hora is null or tarifa_hora >= 0);

comment on column empleados_historial_salario.tarifa_hora is
  'La tarifa por hora vigente en este tramo, cuando el modo de pago de ese momento era ''por_hora''. Mismo tramo que salario_base — un empleado no tiene dos historiales de pago.';

-- `salario_base` era `not null`: correcto cuando el único monto
-- posible era un salario. Ahora un tramo puede traer salario O
-- tarifa (nunca ninguno de los dos, y en teoría podría cambiar de
-- modo y traer los dos en tramos separados) — se relaja el `not null`
-- y se exige en su lugar que al menos uno de los dos esté presente.
alter table empleados_historial_salario alter column salario_base drop not null;

alter table empleados_historial_salario
  add constraint empleados_historial_salario_algun_monto
  check (salario_base is not null or tarifa_hora is not null);

comment on constraint empleados_historial_salario_algun_monto on empleados_historial_salario is
  'Un tramo del historial de pago siempre trae salario_base O tarifa_hora — nunca un tramo vacío que no diga cuánto se le pagaba a la persona en ese período.';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0023_ccss_config.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0023 — CONFIGURACIÓN DE CCSS: la primera tabla que toca Payroll
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA QUE RESUELVE
-- La tabla de pago (asistencia/semana/estimado-pago) rebajaba horas ×
-- tarifa sin ningún rebajo — un ESTIMADO, nunca una planilla real,
-- porque no había de dónde sacar el porcentaje de CCSS. Esta tabla es
-- de dónde sale.
--
-- SOLO CCSS SE REBAJA A LA PERSONA
-- El INS (Riesgos del Trabajo) en Costa Rica NO es un rebajo al
-- colaborador: es 100% costo patronal, un porcentaje sobre la
-- PLANILLA TOTAL según el riesgo de la actividad de la empresa (no un
-- monto fijo por persona). `tasa_ins` vive acá como referencia del
-- costo patronal, pero ninguna consulta la resta del salario de nadie
-- — ver `src/lib/planilla/pago.ts`.
--
-- VERSIONADO, NUNCA UN NÚMERO FIJO
-- El propio `COSTA_RICA_COMPLIANCE.md` insiste en que ningún
-- porcentaje legal se hardcodea sin poder corregirse — la CCSS ya
-- ajustó estas tasas para 2026 y puede volver a hacerlo. Por eso una
-- fila = una VIGENCIA (`vigente_desde`), igual que el patrón que este
-- producto ya usa para feriados y BMC: se agrega una fila nueva, nunca
-- se actualiza una vigencia pasada.
--
-- INTERNO, NO RESTRINGIDO
-- El porcentaje en sí no es un dato personal de nadie — es la misma
-- tasa para toda la organización, pública y verificable (CCSS, INS).
-- Clasifica Interno (Gate §4): visible a cualquier miembro activo. El
-- MONTO DE REBAJO calculado por persona sí hereda la restricción de
-- `tarifa_hora` porque de ahí sale — eso se resuelve en `pago.ts`, no
-- acá.
--
-- SEED: 10.83% obrera / 26.83% patronal, vigente desde 2026-01-01 —
-- ajuste de IVM confirmado (La Nación, BLP Legal, AG Legal, ago 2026).
-- `tasa_ins` queda sin cargar: cada empresa lo obtiene de su propia
-- clasificación de riesgo con el INS, no hay un valor único correcto
-- para todas.
-- ══════════════════════════════════════════════════════════════════

create table config_ccss (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null references organizaciones(id) on delete cascade,
  porcentaje_obrero  numeric not null check (porcentaje_obrero >= 0 and porcentaje_obrero <= 100),
  porcentaje_patrono numeric not null check (porcentaje_patrono >= 0 and porcentaje_patrono <= 100),
  tasa_ins           numeric check (tasa_ins is null or (tasa_ins >= 0 and tasa_ins <= 100)),
  vigente_desde      date not null,
  creado_por         uuid references auth.users(id) on delete set null,
  creado_en          timestamptz not null default now(),
  unique (organizacion_id, vigente_desde)
);

comment on table config_ccss is
  'Una fila = una vigencia de tasas. porcentaje_obrero es lo único que se rebaja al colaborador (pago.ts); porcentaje_patrono y tasa_ins son referenciales, costo de la organización, nunca restados de nadie.';
comment on column config_ccss.tasa_ins is
  'Riesgos del Trabajo del INS: 100% costo patronal, nunca un rebajo al colaborador. Cada empresa lo llena según su propia clasificación de riesgo con el INS — null hasta que lo hagan.';

alter table config_ccss enable row level security;

create policy "Miembros ven su organización" on config_ccss
  for select to authenticated
  using (pertenece_a_organizacion(organizacion_id));

create policy "Insertar una vigencia de CCSS" on config_ccss
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));

create policy "Eliminar una vigencia de CCSS" on config_ccss
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

-- Sin política de UPDATE a propósito: una vigencia no se corrige, se
-- reemplaza con una fila nueva — es la misma disciplina que feriados y
-- BMC, para que "qué tasa regía el 15 de marzo" siga siendo una
-- pregunta respondible después de que la tasa cambie.
grant select, insert, delete on config_ccss to authenticated;
grant all on config_ccss to service_role;

-- ── Seed: una vigencia de arranque para cada organización existente ─
-- Fuente: ajuste de IVM 2026 (La Nación, BLP Legal, AG Legal — agosto
-- 2026). No reemplaza la revisión de un contador costarricense antes
-- de producción, por eso queda EDITABLE desde
-- configuracion/planilla — no es un valor final.
insert into config_ccss (organizacion_id, porcentaje_obrero, porcentaje_patrono, vigente_desde)
select id, 10.83, 26.83, date '2026-01-01'
from organizaciones
on conflict (organizacion_id, vigente_desde) do nothing;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0024_pivote_planillas_facturacion.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0024 — EL PIVOTE (25 ago 2026): tarifas por tipo de hora,
--  eventos del colaborador y configuración de facturación
-- ══════════════════════════════════════════════════════════════════
--
-- EL PRODUCTO SE REENFOCA (decisión del dueño, 25 ago 2026): Work
-- queda en cinco secciones — Asistente IA, Planillas semanales,
-- Colaboradores, Facturación y su configuración. El motor de escaneo
-- (0005/0021) no se toca; esta migración agrega lo que el nuevo
-- recorte necesita y nada más.
--
-- ── A) CUATRO TARIFAS MANUALES EN LA FICHA ────────────────────────
-- La 0022 agregó UNA tarifa_hora. El dueño paga distinto según el
-- tipo de hora: diurna, mixta, nocturna y extra — cuatro montos que
-- se llenan A MANO en la ficha. La hora DOBLE no tiene monto propio
-- por decisión explícita: se paga al doble de la hora del turno de
-- esa persona (2×), calculado, no configurado.
--
-- Misma sensibilidad que salario_base y tarifa_hora (Gate §4.1):
-- Restringido — entra a insert/update de authenticated (gateado por
-- RLS de gestión) pero NUNCA al select base.
--
-- ── B) LA JORNADA DEL BLOQUE EN CADA JORNADA DECLARADA ────────────
-- Para pagar "ordinarias" hay que saber DE QUÉ TIPO eran: 8 horas
-- ordinarias de un turno nocturno se pagan con la tarifa nocturna.
-- El documento lo dice — el horario nominal del turno impreso en el
-- encabezado deriva la jornada (jornadaDeHorarioNominal, el único
-- método que el benchmark validó; el sombreado de la casilla NO es
-- confiable). Hasta hoy esa derivación se usaba solo para abrir
-- fichas; ahora se guarda EN el hecho, porque el pago de esa fila
-- depende de ella y la ficha puede cambiar de jornada después.
-- null = no se pudo derivar (sin horario legible en el encabezado);
-- el pago de esas horas queda en "no se pudo calcular", nunca en
-- una tarifa adivinada.
--
-- ── C) EVENTOS DEL COLABORADOR ────────────────────────────────────
-- Vacaciones, amonestaciones, incapacidades y permisos — el control
-- administrativo que el dueño pidió dentro de la ficha. Registro
-- manual, sin cálculo de saldos todavía.
--
-- ── D) CONFIGURACIÓN DE FACTURACIÓN ───────────────────────────────
-- El OTRO precio de la misma hora: lo que la empresa le COBRA a su
-- cliente (el centro donde pone la gente), aparte de lo que le paga
-- al colaborador. Tarifa por tipo de hora, con override por puesto
-- (montacarguista y alisto se cobran distinto). puesto_id null = la
-- tarifa general de la organización; la resolución es
-- puesto-específico primero, general después, y sin fila NO hay
-- tarifa (nunca un cero inventado).
--
-- Requiere 0001 (helpers), 0021 (jornadas_declaradas), 0022
-- (patrón de grants de tarifa) y 0023 (config_ccss). Correr con
-- `supabase db push` contra el proyecto PROPIO de Work.
-- ══════════════════════════════════════════════════════════════════

-- ── A) Tarifas por tipo de hora ───────────────────────────────────
alter table empleados
  add column tarifa_hora_diurna   numeric check (tarifa_hora_diurna   is null or tarifa_hora_diurna   >= 0),
  add column tarifa_hora_mixta    numeric check (tarifa_hora_mixta    is null or tarifa_hora_mixta    >= 0),
  add column tarifa_hora_nocturna numeric check (tarifa_hora_nocturna is null or tarifa_hora_nocturna >= 0),
  add column tarifa_hora_extra    numeric check (tarifa_hora_extra    is null or tarifa_hora_extra    >= 0);

comment on column empleados.tarifa_hora_diurna is
  'Monto por hora ordinaria en jornada diurna. Restringido (Gate §4.1): mismo tratamiento que salario_base, fuera del grant select base. Se llena a mano.';
comment on column empleados.tarifa_hora_mixta is
  'Monto por hora ordinaria en jornada mixta. Restringido; manual.';
comment on column empleados.tarifa_hora_nocturna is
  'Monto por hora ordinaria en jornada nocturna. Restringido; manual.';
comment on column empleados.tarifa_hora_extra is
  'Monto por hora extra (ya con el recargo incluido en el monto que se digita). Restringido; manual. La hora doble NO tiene tarifa propia: se paga 2× la tarifa de la jornada del turno.';

grant insert (tarifa_hora_diurna, tarifa_hora_mixta, tarifa_hora_nocturna, tarifa_hora_extra)
  on empleados to authenticated;
grant update (tarifa_hora_diurna, tarifa_hora_mixta, tarifa_hora_nocturna, tarifa_hora_extra)
  on empleados to authenticated;

-- ── B) La jornada del bloque, en el hecho ─────────────────────────
alter table jornadas_declaradas
  add column jornada text check (jornada is null or jornada in ('diurna', 'nocturna', 'mixta'));

comment on column jornadas_declaradas.jornada is
  'La jornada del BLOQUE del turno del que salió esta fila, derivada del horario nominal impreso en el formulario (jornadaDeHorarioNominal). De acá sale qué tarifa paga las ordinarias y las dobles. null = no derivable; ese pago queda en "no se pudo calcular".';

-- El grant de insert por columna de la 0021 no la incluye — se suma
-- para que el alta manual también pueda declararla.
grant insert (jornada) on jornadas_declaradas to authenticated;

-- El candado de inmutabilidad (0021) congela columna por columna:
-- la nueva entra a la lista o quedaría editable por fuera del alta.
create or replace function jornadas_declaradas_solo_anulacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if old.anulado then
    raise exception 'Una jornada declarada anulada está congelada: no se des-anula ni se modifica';
  end if;
  if not new.anulado then
    raise exception 'El único UPDATE permitido sobre una jornada declarada es anularla';
  end if;
  if new.organizacion_id    is distinct from old.organizacion_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.fecha           is distinct from old.fecha
     or new.horas_ordinarias is distinct from old.horas_ordinarias
     or new.horas_extra     is distinct from old.horas_extra
     or new.horas_dobles    is distinct from old.horas_dobles
     or new.etiqueta_documento is distinct from old.etiqueta_documento
     or new.turno           is distinct from old.turno
     or new.jornada         is distinct from old.jornada
     or new.origen          is distinct from old.origen
     or new.registrado_por  is distinct from old.registrado_por
     or new.documento_id    is distinct from old.documento_id
     or new.nota            is distinct from old.nota
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'El hecho registrado no se modifica: para corregir, anular y registrar uno nuevo';
  end if;
  if new.anulado_motivo is null or btrim(new.anulado_motivo) = '' then
    raise exception 'Anular una jornada declarada exige un motivo';
  end if;
  new.anulado_en := now();
  new.anulado_por := coalesce(auth.uid(), new.anulado_por);
  return new;
end;
$$;

-- ── C) Eventos del colaborador ────────────────────────────────────
create table colaborador_eventos (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  empleado_id     uuid not null references empleados(id) on delete cascade,
  tipo            text not null check (tipo in ('vacaciones', 'amonestacion', 'incapacidad', 'permiso', 'otro')),
  fecha_inicio    date not null,
  fecha_fin       date check (fecha_fin is null or fecha_fin >= fecha_inicio),
  nota            text,
  creado_por      uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now()
);

comment on table colaborador_eventos is
  'Control administrativo de la ficha: vacaciones, amonestaciones, incapacidades y permisos. Registro manual (0024); sin cálculo de saldos todavía.';

create index colaborador_eventos_empleado_idx
  on colaborador_eventos (empleado_id, fecha_inicio desc);
create index colaborador_eventos_organizacion_idx
  on colaborador_eventos (organizacion_id);

-- Integridad cruzada, mismo patrón que la 0021: ningún FK impide por
-- sí solo que un evento de la organización A apunte a un empleado de
-- la B.
create or replace function colaborador_eventos_validar_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from empleados where id = new.empleado_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El empleado no pertenece a la organización del evento';
  end if;
  return new;
end;
$$;

create trigger colaborador_eventos_validar_org
  before insert or update on colaborador_eventos
  for each row
  execute function colaborador_eventos_validar_organizacion();

alter table colaborador_eventos enable row level security;

-- Solo gestión: una amonestación es dato disciplinario — un gerente o
-- el propio empleado no la lista por acá (una vista de autoservicio,
-- si algún día existe, será su propia política).
create policy "Gestión ve los eventos de su organización" on colaborador_eventos
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));
create policy "Gestión registra eventos" on colaborador_eventos
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión corrige eventos" on colaborador_eventos
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión elimina eventos" on colaborador_eventos
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

revoke all on colaborador_eventos from anon, authenticated;
grant select on colaborador_eventos to authenticated;
grant insert (organizacion_id, empleado_id, tipo, fecha_inicio, fecha_fin, nota)
  on colaborador_eventos to authenticated;
grant update (tipo, fecha_inicio, fecha_fin, nota) on colaborador_eventos to authenticated;
grant delete on colaborador_eventos to authenticated;
grant all on colaborador_eventos to service_role;

-- ── D) Configuración de facturación ───────────────────────────────
create table config_facturacion (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  -- null = tarifa GENERAL de la organización; con puesto = override.
  puesto_id       uuid references puestos(id) on delete cascade,
  tipo_hora       text not null check (tipo_hora in ('diurna', 'mixta', 'nocturna', 'extra', 'doble')),
  tarifa          numeric not null check (tarifa >= 0),
  creado_por      uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table config_facturacion is
  'Lo que la organización le COBRA a su cliente por cada tipo de hora — el otro precio de la misma hora, aparte de la tarifa de pago de la ficha. puesto_id null = tarifa general; con puesto, override. Resolución: puesto primero, general después, sin fila = sin tarifa (nunca cero).';

-- Una tarifa por (org, tipo) general y una por (org, puesto, tipo).
-- Dos índices parciales y no un unique con nulls: dos filas
-- generales del mismo tipo serían dos precios para la misma hora.
create unique index config_facturacion_general_unica
  on config_facturacion (organizacion_id, tipo_hora) where puesto_id is null;
create unique index config_facturacion_puesto_unica
  on config_facturacion (organizacion_id, puesto_id, tipo_hora) where puesto_id is not null;

create or replace function config_facturacion_validar_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if new.puesto_id is not null and not exists (
    select 1 from puestos where id = new.puesto_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El puesto no pertenece a la organización de la tarifa';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger config_facturacion_validar_org
  before insert or update on config_facturacion
  for each row
  execute function config_facturacion_validar_organizacion();

alter table config_facturacion enable row level security;

-- Cuánto se le cobra al cliente es dato comercial de la empresa:
-- gestión, no todo miembro.
create policy "Gestión ve las tarifas de facturación" on config_facturacion
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));
create policy "Gestión crea tarifas de facturación" on config_facturacion
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión edita tarifas de facturación" on config_facturacion
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión elimina tarifas de facturación" on config_facturacion
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

revoke all on config_facturacion from anon, authenticated;
grant select on config_facturacion to authenticated;
grant insert (organizacion_id, puesto_id, tipo_hora, tarifa) on config_facturacion to authenticated;
grant update (tarifa) on config_facturacion to authenticated;
grant delete on config_facturacion to authenticated;
grant all on config_facturacion to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0025_limpieza_boletas_descartadas.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0025 — LIMPIEZA DE BOLETAS DESCARTADAS: la puerta controlada
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (dueño, 25 ago 2026): después de una tanda de pruebas,
-- la pantalla de Boletas queda llena de filas «Descartada» que ya no
-- dicen nada, y no había forma de dejarla en cero — la 0005 le revocó
-- DELETE sobre `documentos_extracciones` hasta a service_role.
--
-- LA DECISIÓN: NO se re-otorga el DELETE general (ese candado existe
-- para que ningún código pueda borrar evidencia por accidente). En su
-- lugar, UNA función security definer con reglas fijas:
--
--   · Borra las extracciones en estado 'descartada' de la
--     organización — y solo esas. Una descartada es pipeline muerto:
--     nunca acreditó una hora, no respalda nada.
--   · Borra el documento (la fila y deja la ruta para que el servidor
--     borre el archivo de Storage) SOLO cuando ya nada lo referencia:
--     ni un marcaje, ni una jornada declarada —anulada o no—, ni una
--     extracción viva. Un papel del que salieron horas es respaldo
--     laboral aunque esas horas estén anuladas: su fila se RETIENE
--     (invisible en la pantalla, que lista extracciones).
--
-- Solo service_role puede ejecutarla: el servidor la llama después de
-- `exigirGestion`, igual que el resto del pipeline.
-- ══════════════════════════════════════════════════════════════════

create or replace function eliminar_boletas_descartadas(p_organizacion uuid)
returns jsonb
language plpgsql
security definer
set search_path = work, public
as $$
declare
  v_docs uuid[];
  v_rutas text[];
  v_extracciones int;
  v_documentos int;
begin
  -- Documentos de boleta cuyas extracciones están TODAS descartadas y
  -- que ningún hecho referencia: candidatos a irse con su archivo.
  select coalesce(array_agg(d.id), '{}') into v_docs
  from documentos d
  where d.organizacion_id = p_organizacion
    and d.categoria = 'boleta_horario'
    and exists (
      select 1 from documentos_extracciones e
      where e.documento_id = d.id and e.estado = 'descartada')
    and not exists (
      select 1 from documentos_extracciones e
      where e.documento_id = d.id and e.estado <> 'descartada')
    and not exists (select 1 from marcajes m where m.documento_id = d.id)
    and not exists (select 1 from jornadas_declaradas j where j.documento_id = d.id);

  select coalesce(array_agg(ruta_storage), '{}') into v_rutas
  from documentos where id = any(v_docs);

  -- Las extracciones descartadas se van TODAS (también las de un
  -- documento retenido): son lo que la pantalla lista.
  delete from documentos_extracciones
  where organizacion_id = p_organizacion and estado = 'descartada';
  get diagnostics v_extracciones = row_count;

  delete from documentos where id = any(v_docs);
  get diagnostics v_documentos = row_count;

  return jsonb_build_object(
    'extracciones', v_extracciones,
    'documentos', v_documentos,
    'rutas', to_jsonb(v_rutas)
  );
end;
$$;

comment on function eliminar_boletas_descartadas(uuid) is
  'La única puerta de borrado de boletas: extracciones descartadas de la organización + documentos huérfanos (sin marcajes, sin jornadas, sin extracciones vivas). Devuelve las rutas de Storage para que el servidor borre los archivos. Solo service_role.';

revoke execute on function eliminar_boletas_descartadas(uuid) from public;
revoke execute on function eliminar_boletas_descartadas(uuid) from anon;
revoke execute on function eliminar_boletas_descartadas(uuid) from authenticated;
grant execute on function eliminar_boletas_descartadas(uuid) to service_role;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0026_matching_de_puesto.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0026 — EL PUESTO DEL PAPEL, EMPAREJADO CONTRA LO GUARDADO
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (dueño, 26 ago 2026): el encabezado de la boleta YA
-- trae "PUESTO: LAVADOR DE TARIMAS" (transcrito literal desde la
-- 0005, `ContextoPlanilla.puesto`), pero nada lo cruzaba contra los
-- puestos que la organización guarda — ni contra sus tarifas de
-- facturación (0024). Cargar la tarifa de "Lavador de tarimas" no
-- servía de nada si ningún empleado tenía ESE puesto asignado en su
-- ficha, y el texto del papel rara vez calza letra por letra
-- ("TRIMAS" por "TARIMAS": la fotocopia, el OCR, el que llenó a mano).
--
-- LA DECISIÓN: emparejar por SIMILITUD (Levenshtein — ver
-- matching-puesto.ts, mismo criterio de "identificado / ambiguo /
-- sin_candidatos" que ya usa `matching.ts` para personas, NUNCA
-- adivinar), y RECORDAR cada emparejamiento que un humano confirma —
-- "que la IA asocie" es, acá, un diccionario que se enseña solo con
-- el uso, no una llamada de más al modelo por cada boleta.
--
-- TRES PIEZAS:
--
--   A) `documentos_extracciones.puesto_id` — el resultado de la
--      identificación, mismo patrón exacto que la columna
--      `empleado_id` que ya tiene esa tabla desde la 0006: server-only,
--      null hasta que se resuelve solo o a mano.
--
--   B) `puesto_alias` — el diccionario que aprende: una fila por
--      cada texto crudo que un humano YA asoció a un puesto. La
--      próxima boleta con ese mismo texto (normalizado) se resuelve
--      sola, sin volver a preguntar.
--
--   C) `jornadas_declaradas.puesto_id` — el HECHO, no la ficha: el
--      puesto de ESTE turno, para que Facturación cobre la tarifa
--      correcta aunque la misma persona trabaje puestos distintos
--      semana a semana. Mismo patrón exacto que la columna `jornada`
--      de la 0024 (server-only, cae a `empleados.puesto_id` cuando es
--      null — la resolución vive en TypeScript, no acá).
--
-- Requiere 0001 (puestos), 0005/0006 (documentos_extracciones), 0021
-- (jornadas_declaradas) y 0024 (config_facturacion, cuyo `puesto_id`
-- es justo lo que este emparejamiento por fin alimenta solo). Correr
-- con `supabase db push` o por la Management API, como el resto.
-- ══════════════════════════════════════════════════════════════════

-- ── A) El resultado en la extracción ──────────────────────────────
alter table documentos_extracciones
  add column puesto_id uuid references puestos(id) on delete set null;

comment on column documentos_extracciones.puesto_id is
  'El puesto del encabezado (ContextoPlanilla.puesto), YA EMPAREJADO contra los puestos guardados — server-only, mismo patrón que empleado_id. null hasta que se identifica solo o a mano en Revisiones.';

create index documentos_extracciones_puesto_id_idx
  on documentos_extracciones (puesto_id) where puesto_id is not null;

-- Mismo grant que empleado_id: solo el servidor lo escribe.
grant update (puesto_id) on documentos_extracciones to service_role;

-- ── B) El diccionario que aprende ─────────────────────────────────
create table puesto_alias (
  id                 uuid primary key default gen_random_uuid(),
  organizacion_id    uuid not null references organizaciones(id) on delete cascade,
  puesto_id          uuid not null references puestos(id) on delete cascade,
  -- Normalizado (minúsculas, sin tildes, espacios colapsados — mismo
  -- criterio que matching.ts) para que "Lavador de Trimas" y
  -- "lavador  de trimas" sean el mismo alias.
  texto_normalizado  text not null,
  creado_por         uuid references auth.users(id) on delete set null default auth.uid(),
  creado_en          timestamptz not null default now(),
  unique (organizacion_id, texto_normalizado)
);

comment on table puesto_alias is
  'El texto crudo del encabezado de una boleta, YA asociado a un puesto por un humano. Un alias por (organización, texto normalizado) — el mismo texto siempre resuelve al mismo puesto, y no hay dos aprendizajes contradictorios para la misma frase.';

create index puesto_alias_puesto_id_idx on puesto_alias (puesto_id);

create or replace function puesto_alias_validar_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from puestos where id = new.puesto_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El puesto no pertenece a la organización del alias';
  end if;
  return new;
end;
$$;

create trigger puesto_alias_validar_org
  before insert on puesto_alias
  for each row
  execute function puesto_alias_validar_organizacion();

alter table puesto_alias enable row level security;

create policy "Gestión ve los alias de puesto de su organización" on puesto_alias
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));
create policy "Gestión registra alias de puesto" on puesto_alias
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión elimina alias de puesto" on puesto_alias
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));
-- Sin UPDATE a propósito: un alias mal aprendido se borra y se
-- vuelve a crear — no se "corrige" (mismo espíritu que las vigencias
-- de CCSS, aunque acá no hay razón de auditoría legal, solo simpleza:
-- reasociar es un alta, no una edición).

revoke all on puesto_alias from anon, authenticated;
grant select on puesto_alias to authenticated;
grant insert (organizacion_id, puesto_id, texto_normalizado) on puesto_alias to authenticated;
grant delete on puesto_alias to authenticated;
grant all on puesto_alias to service_role;

-- ── C) El hecho: el puesto de ESTE turno ──────────────────────────
alter table jornadas_declaradas
  add column puesto_id uuid references puestos(id) on delete set null;

comment on column jornadas_declaradas.puesto_id is
  'El puesto de ESTE turno (0026), resuelto del encabezado del documento — no de la ficha. Facturación lo usa para cobrar la tarifa de ESE puesto aunque la persona trabaje puestos distintos semana a semana; null cae a empleados.puesto_id en TypeScript, igual que "jornada" cae a la de la ficha.';

grant insert (puesto_id) on jornadas_declaradas to authenticated;

-- El candado de inmutabilidad (0021, ya tocado por la 0024) aprende
-- la tercera columna nueva.
create or replace function jornadas_declaradas_solo_anulacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if old.anulado then
    raise exception 'Una jornada declarada anulada está congelada: no se des-anula ni se modifica';
  end if;
  if not new.anulado then
    raise exception 'El único UPDATE permitido sobre una jornada declarada es anularla';
  end if;
  if new.organizacion_id    is distinct from old.organizacion_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.fecha           is distinct from old.fecha
     or new.horas_ordinarias is distinct from old.horas_ordinarias
     or new.horas_extra     is distinct from old.horas_extra
     or new.horas_dobles    is distinct from old.horas_dobles
     or new.etiqueta_documento is distinct from old.etiqueta_documento
     or new.turno           is distinct from old.turno
     or new.jornada         is distinct from old.jornada
     or new.puesto_id       is distinct from old.puesto_id
     or new.origen          is distinct from old.origen
     or new.registrado_por  is distinct from old.registrado_por
     or new.documento_id    is distinct from old.documento_id
     or new.nota            is distinct from old.nota
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'El hecho registrado no se modifica: para corregir, anular y registrar uno nuevo';
  end if;
  if new.anulado_motivo is null or btrim(new.anulado_motivo) = '' then
    raise exception 'Anular una jornada declarada exige un motivo';
  end if;
  new.anulado_en := now();
  new.anulado_por := coalesce(auth.uid(), new.anulado_por);
  return new;
end;
$$;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0027_repetida_persistida.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0027 — LA REPETIDA, PERSISTIDA (no solo el aviso del momento)
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (dueño, 26 ago 2026, viendo la lista de Boletas llena
-- de filas repetidas): `detectarBoletaRepetida()` (servidor.ts) ya
-- avisaba de una boleta repetida, pero el resultado solo vivía en la
-- respuesta HTTP del momento de subir — la pantalla de "Boletas" no
-- tenía de dónde leer "esta fila es una de las repetidas" para
-- mostrarlo después, sin ir a abrir cada una en Revisiones.
--
-- DOS DUPLICADOS, DOS TRATOS (sin tocar esto, ver boletas/leer/
-- route.ts):
--   · Mismo ARCHIVO, byte a byte (mismo hash): a partir de esta
--     migración se RECHAZA antes de guardar nada — una corrección
--     real es SIEMPRE otro archivo (otro hash), así que bloquear acá
--     nunca choca con una corrección legítima. Nunca llega a esta
--     tabla.
--   · Mismo PERÍODO y las mismas PERSONAS, archivo distinto: sigue
--     siendo un aviso para que un humano decida (dos lecturas del
--     mismo papel pueden ser, o dos papeles legítimos que se
--     solapan) — esto es lo que esta columna persiste, para que la
--     lista de Boletas lo muestre y ofrezca "No subir" sin abrir la
--     revisión.
--
-- Mismo patrón que `empleado_id`/`puesto_id` (0006/0026): server-only,
-- lo escribe boletas/leer/route.ts con el resultado ya calculado.
-- ══════════════════════════════════════════════════════════════════

alter table documentos_extracciones
  add column repetida boolean not null default false;

comment on column documentos_extracciones.repetida is
  'true si detectarBoletaRepetida() (servidor.ts) encontró el mismo período con las mismas personas ya declaradas o en otra boleta pendiente. El duplicado por ARCHIVO IDÉNTICO no llega hasta acá: se rechaza antes de guardar nada. Server-only, mismo patrón que empleado_id/puesto_id.';

-- Mismo grant que empleado_id/puesto_id: solo el servidor lo escribe
-- (la tabla ya tiene `grant select/insert/update ... to service_role`
-- de la 0005 — esto es documentación explícita, no un permiso nuevo).
grant update (repetida) on documentos_extracciones to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0028_tandas_de_boletas.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0028 — TANDAS DE BOLETAS: cada subida agrupada en su pestaña
-- ══════════════════════════════════════════════════════════════════
--
-- EL PEDIDO (dueño, 26 ago 2026): "cada vez que se termine una tanda
-- de subidas se agrupen todas en un TAB, con fecha desde-hasta según
-- las boletas ingresadas". Y además: poder MOVER una boleta suelta a
-- una tanda, y que con una tanda abierta las subidas nuevas caigan en
-- ella (por si faltaron boletas).
--
-- LA TANDA ES UN GRUPO, NO UN DATO DEL PAPEL: no guarda etiqueta ni
-- fechas propias — el rótulo "Boletas 18 ago – 24 ago" se DERIVA en
-- cada lectura del período que sus boletas declaran (min/max), así
-- mover una boleta de tanda corrige el rótulo solo, sin un campo
-- desincronizado que alguien tenga que editar.
--
-- Para derivar ese rótulo barato (sin releer el JSON completo de cada
-- extracción), el período ya calculado en el pipeline se PERSISTE en
-- dos columnas date — el mismo dato que la detección de repetidas ya
-- computa por boleta y hasta hoy tiraba.
--
-- Server-only todo: la tanda la crea el servidor al arrancar un lote
-- (o la elige, si hay una abierta), y mover una boleta es una action
-- con exigirGestion — mismo patrón que empleado_id/puesto_id/repetida.
-- ══════════════════════════════════════════════════════════════════

create table tandas_boletas (
  id               uuid primary key default gen_random_uuid(),
  organizacion_id  uuid not null references organizaciones(id) on delete cascade,
  creado_por       uuid references auth.users(id) on delete set null,
  creado_en        timestamptz not null default now()
);

comment on table tandas_boletas is
  'Un lote de subida de boletas (0028): el grupo que la pantalla de Boletas pinta como pestaña. Sin etiqueta propia a propósito — el rótulo se deriva del período min/max de sus boletas en cada lectura.';

create index tandas_boletas_organizacion_idx on tandas_boletas (organizacion_id, creado_en desc);

alter table tandas_boletas enable row level security;

create policy "Gestión ve las tandas de su organización" on tandas_boletas
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));

revoke all on tandas_boletas from anon, authenticated;
grant select on tandas_boletas to authenticated;
grant all on tandas_boletas to service_role;

-- ── La membresía de cada boleta en su tanda + su período ──────────
alter table documentos_extracciones
  add column tanda_id uuid references tandas_boletas(id) on delete set null,
  add column periodo_inicio date,
  add column periodo_fin date;

comment on column documentos_extracciones.tanda_id is
  'La tanda de subida (0028) a la que pertenece esta boleta — null = suelta. La asigna el servidor al subir, o una action al moverla.';
comment on column documentos_extracciones.periodo_inicio is
  'El inicio del período que el papel declara, ya con año resuelto — el mismo valor que la detección de repetidas calcula. null = el papel no lo dice.';
comment on column documentos_extracciones.periodo_fin is
  'El fin del período declarado. null = el papel no lo dice.';

create index documentos_extracciones_tanda_id_idx
  on documentos_extracciones (tanda_id) where tanda_id is not null;

grant update (tanda_id, periodo_inicio, periodo_fin) on documentos_extracciones to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0029_backfill_tandas.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0029 — BACKFILL: agrupar en tandas lo subido ANTES de la 0028
-- ══════════════════════════════════════════════════════════════════
--
-- La 0028 agrupa hacia adelante: cada lote nuevo abre su tanda. Pero
-- el dueño (26 ago 2026, viendo la lista): "sigo sin ver todos esos
-- que subí en un tab agrupado" — lo ya subido quedó suelto y ninguna
-- pantalla lo iba a agrupar jamás.
--
-- CÓMO SE RECONSTRUYE LA TANDA QUE NUNCA EXISTIÓ: por cercanía de la
-- hora de subida. Dos boletas subidas con 45 minutos o menos entre sí
-- pertenecen a la misma sesión de trabajo; un hueco mayor corta y
-- abre grupo nuevo. Es el mismo criterio que una persona usaría
-- mirando la columna "Subida" — y el corte de 45 min aguanta el caso
-- real de un lote grande con la IA tardando en el medio.
--
-- La tanda reconstruida queda con `creado_por` NULL (nadie la creó a
-- mano) y `creado_en` = la primera subida del grupo — así se
-- distingue para siempre de una tanda nacida en la pantalla, y el
-- rótulo de respaldo ("Tanda del …") muestra la fecha real del lote.
--
-- Corre para TODAS las organizaciones (el criterio es igual de válido
-- en cualquiera) y es idempotente: solo toca `tanda_id is null`, así
-- que re-correrla sin sueltas nuevas no hace nada.
-- ══════════════════════════════════════════════════════════════════

do $$
declare
  g record;
  t uuid;
begin
  for g in
    with ordenadas as (
      select id, organizacion_id, creado_en,
             lag(creado_en) over (partition by organizacion_id order by creado_en) as anterior
      from documentos_extracciones
      where tanda_id is null
    ), con_corte as (
      select id, organizacion_id, creado_en,
             case
               when anterior is null or creado_en - anterior > interval '45 minutes' then 1
               else 0
             end as corte
      from ordenadas
    ), grupos as (
      select id, organizacion_id, creado_en,
             sum(corte) over (partition by organizacion_id order by creado_en) as grupo
      from con_corte
    )
    select organizacion_id, grupo, array_agg(id) as ids, min(creado_en) as inicio
    from grupos
    group by organizacion_id, grupo
    order by organizacion_id, grupo
  loop
    insert into tandas_boletas (organizacion_id, creado_por, creado_en)
      values (g.organizacion_id, null, g.inicio)
      returning id into t;
    update documentos_extracciones set tanda_id = t where id = any(g.ids);
  end loop;
end $$;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0030_eliminar_boletas_seleccionadas.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0030 — ELIMINAR BOLETAS SELECCIONADAS: la segunda puerta controlada
-- ══════════════════════════════════════════════════════════════════
--
-- EL PEDIDO (dueño, 26 ago 2026): casillas en la lista de Boletas y
-- "ELIMINAR y que se eliminen POR COMPLETO". La 0025 ya abrió una
-- puerta de borrado, pero solo para el barrido de TODAS las
-- descartadas; esta es la versión por selección: las filas que el
-- dueño marcó, y solo esas.
--
-- MISMAS REGLAS DE PROTECCIÓN QUE LA 0025 (no se negocian acá):
--
--   · Una CONFIRMADA no se toca: de ella salieron horas que Planillas
--     y Facturación ya cuentan. Se omite y se reporta cuántas — para
--     borrarla primero hay que deshacer su confirmación (Revisiones),
--     que anula sus hechos con motivo y trazabilidad.
--   · El documento (la fila y su archivo) se va SOLO cuando ya nada
--     lo referencia: ni un marcaje, ni una jornada declarada —anulada
--     o no—, ni otra extracción viva. Un papel del que salieron horas
--     es respaldo laboral: se retiene aunque su extracción se borre.
--   · Una tanda que queda vacía se va con sus boletas: una pestaña
--     sin contenido no informa nada.
--
-- Solo service_role la ejecuta, tras exigirGestion en la action.
-- ══════════════════════════════════════════════════════════════════

create or replace function eliminar_boletas_seleccionadas(
  p_organizacion uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = work, public
as $$
declare
  v_borrables uuid[];
  v_confirmadas int;
  v_docs uuid[];
  v_rutas text[];
  v_extracciones int;
  v_documentos int;
  v_tandas int;
begin
  -- Solo extracciones de ESTA organización, dentro de lo pedido, y
  -- nunca confirmadas. Ids ajenos o inexistentes simplemente no calzan.
  select coalesce(array_agg(id), '{}') into v_borrables
  from documentos_extracciones
  where organizacion_id = p_organizacion
    and id = any(p_ids)
    and estado <> 'confirmada';

  select count(*) into v_confirmadas
  from documentos_extracciones
  where organizacion_id = p_organizacion
    and id = any(p_ids)
    and estado = 'confirmada';

  -- Documentos candidatos a irse: los de las extracciones borrables
  -- cuyo papel no respalda ningún hecho ni ninguna otra extracción.
  select coalesce(array_agg(distinct d.id), '{}') into v_docs
  from documentos d
  join documentos_extracciones e on e.documento_id = d.id
  where e.id = any(v_borrables)
    and not exists (
      select 1 from documentos_extracciones o
      where o.documento_id = d.id and o.id <> all(v_borrables))
    and not exists (select 1 from marcajes m where m.documento_id = d.id)
    and not exists (select 1 from jornadas_declaradas j where j.documento_id = d.id);

  select coalesce(array_agg(ruta_storage), '{}') into v_rutas
  from documentos where id = any(v_docs);

  delete from documentos_extracciones where id = any(v_borrables);
  get diagnostics v_extracciones = row_count;

  delete from documentos where id = any(v_docs);
  get diagnostics v_documentos = row_count;

  delete from tandas_boletas t
  where t.organizacion_id = p_organizacion
    and not exists (
      select 1 from documentos_extracciones e where e.tanda_id = t.id);
  get diagnostics v_tandas = row_count;

  return jsonb_build_object(
    'extracciones', v_extracciones,
    'confirmadas_omitidas', v_confirmadas,
    'documentos', v_documentos,
    'tandas_vaciadas', v_tandas,
    'rutas', to_jsonb(v_rutas)
  );
end;
$$;

comment on function eliminar_boletas_seleccionadas(uuid, uuid[]) is
  'Borrado POR SELECCIÓN de boletas (0030): extracciones marcadas (nunca confirmadas) + documentos huérfanos + tandas que quedaron vacías. Devuelve rutas de Storage para que el servidor retire los archivos. Solo service_role.';

revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from public;
revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from anon;
revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from authenticated;
grant execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) to service_role;


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0031_tandas_resumen_y_borrado_seguro.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0031 — RESUMEN DE TANDAS + DOS CANDADOS QUE FALTABAN EN LA 0030
-- ══════════════════════════════════════════════════════════════════
--
-- Sale de la revisión adversaria del 26 ago 2026 sobre la 0030 y la
-- pantalla de Boletas. Tres cosas, todas defectos verificados:
--
-- A) EL RESUMEN POR TANDA (vista). La pantalla derivaba el rótulo
--    "Boletas 18 ago – 24 ago" y el contador de cada pestaña a partir
--    de las 100 boletas que la página trae. Dos consecuencias reales:
--    dentro de una tanda abierta las OTRAS pestañas se quedaban sin
--    filas a mano y caían al rótulo de respaldo, y una tanda grande
--    mostraba un rango y un conteo encogidos. El agregado tiene que
--    salir de la BASE, sobre TODAS las filas de la tanda — no de la
--    ventana que la pantalla alcanzó a leer.
--
--    `security_invoker = true`: la vista corre con los permisos de
--    quien consulta, así que la RLS de `tandas_boletas` y de
--    `documentos_extracciones` sigue mandando — una vista con los
--    permisos del dueño sería un agujero entre organizaciones.
--
-- B) EL DELETE QUE NO RE-VERIFICABA EL ESTADO. La 0030 elegía qué
--    borrar con `estado <> 'confirmada'` pero el DELETE filtraba solo
--    por id. En READ COMMITTED, una confirmación que commitea entre
--    el SELECT y el DELETE queda visible al DELETE y su fila se borra
--    igual: una boleta CONFIRMADA borrada, con sus horas ya contadas
--    en Planillas y su registro fuente desaparecido. El arreglo es el
--    patrón que la 0025 sí usaba: repetir la condición en el propio
--    WHERE del DELETE, para que EvalPlanQual la re-evalúe.
--
-- C) EL BARRIDO DE TANDAS VACÍAS. Borraba TODA tanda vacía de la
--    organización, y `crearTandaDeBoletas` crea la tanda ANTES del
--    primer archivo: una eliminación de otra pestaña, en esa ventana,
--    mataba la tanda de una subida en curso — y si pegaba entre la
--    verificación y el INSERT, dejaba un documento con su archivo y
--    sin extracción, invisible e imborrable para siempre. Ahora solo
--    se barren tandas que (1) quedaron vacías POR ESTE borrado y
--    (2) tienen más de una hora — una subida en curso nunca califica.
-- ══════════════════════════════════════════════════════════════════

-- ── A) El resumen que la pantalla necesita ────────────────────────
create or replace view tandas_boletas_resumen
with (security_invoker = true)
as
select
  t.id,
  t.organizacion_id,
  t.creado_en,
  count(e.id)              as cantidad,
  min(e.periodo_inicio)    as periodo_desde,
  max(e.periodo_fin)       as periodo_hasta,
  min(e.creado_en)         as subida_desde,
  max(e.creado_en)         as subida_hasta
from tandas_boletas t
left join documentos_extracciones e on e.tanda_id = t.id
group by t.id, t.organizacion_id, t.creado_en;

comment on view tandas_boletas_resumen is
  'El rótulo y el contador de cada tanda (0031), agregados sobre TODAS sus boletas — no sobre la ventana que la pantalla alcanza a leer. security_invoker: la RLS de las tablas de abajo sigue mandando.';

grant select on tandas_boletas_resumen to authenticated, service_role;

-- ── B) y C) El borrado, con los dos candados ──────────────────────
create or replace function eliminar_boletas_seleccionadas(
  p_organizacion uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = work, public
as $$
declare
  v_borrables uuid[];
  v_confirmadas int;
  v_tandas_tocadas uuid[];
  v_docs uuid[];
  v_rutas text[];
  v_extracciones int;
  v_documentos int;
  v_tandas int;
begin
  select coalesce(array_agg(id), '{}') into v_borrables
  from documentos_extracciones
  where organizacion_id = p_organizacion
    and id = any(p_ids)
    and estado <> 'confirmada';

  select count(*) into v_confirmadas
  from documentos_extracciones
  where organizacion_id = p_organizacion
    and id = any(p_ids)
    and estado = 'confirmada';

  -- Las tandas que ESTE borrado puede vaciar — las únicas que el
  -- barrido del final tiene derecho a tocar.
  select coalesce(array_agg(distinct tanda_id), '{}') into v_tandas_tocadas
  from documentos_extracciones
  where id = any(v_borrables) and tanda_id is not null;

  select coalesce(array_agg(distinct d.id), '{}') into v_docs
  from documentos d
  join documentos_extracciones e on e.documento_id = d.id
  where e.id = any(v_borrables)
    and not exists (
      select 1 from documentos_extracciones o
      where o.documento_id = d.id and o.id <> all(v_borrables))
    and not exists (select 1 from marcajes m where m.documento_id = d.id)
    and not exists (select 1 from jornadas_declaradas j where j.documento_id = d.id);

  select coalesce(array_agg(ruta_storage), '{}') into v_rutas
  from documentos where id = any(v_docs);

  -- (B) Las tres condiciones REPETIDAS acá: si una confirmación
  -- commiteó mientras tanto, EvalPlanQual re-evalúa este WHERE sobre
  -- la versión nueva y la fila ya no califica.
  delete from documentos_extracciones
  where id = any(v_borrables)
    and organizacion_id = p_organizacion
    and estado <> 'confirmada';
  get diagnostics v_extracciones = row_count;

  delete from documentos
  where id = any(v_docs)
    and organizacion_id = p_organizacion;
  get diagnostics v_documentos = row_count;

  -- (C) Solo las tandas que este borrado vació, y solo si ya no son
  -- recién nacidas: una subida en curso crea su tanda vacía y tarda
  -- lo que tarde el archivo — jamás debe barrerse.
  delete from tandas_boletas t
  where t.id = any(v_tandas_tocadas)
    and t.organizacion_id = p_organizacion
    and t.creado_en < now() - interval '1 hour'
    and not exists (
      select 1 from documentos_extracciones e where e.tanda_id = t.id);
  get diagnostics v_tandas = row_count;

  return jsonb_build_object(
    'extracciones', v_extracciones,
    'confirmadas_omitidas', v_confirmadas,
    'documentos', v_documentos,
    'tandas_vaciadas', v_tandas,
    'rutas', to_jsonb(v_rutas)
  );
end;
$$;

revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from public;
revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from anon;
revoke execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) from authenticated;
grant execute on function eliminar_boletas_seleccionadas(uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0032_salarios_por_puesto.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0032 — EL SALARIO DEJA DE SER DE LA PERSONA Y PASA A SER DEL PUESTO
-- ══════════════════════════════════════════════════════════════════
--
-- EL CAMBIO (dueño, 27 ago 2026): «no será por persona, definiremos
-- salarios por puestos». Hasta hoy el pago salía de cuatro columnas
-- en la ficha de cada quien (0024: tarifa_hora_diurna/mixta/nocturna/
-- extra), así que dar un aumento a los operarios era editar N fichas
-- —y una ficha olvidada pagaba distinto sin que nadie lo notara—.
-- Ahora la tarifa vive UNA vez, en el puesto.
--
-- ── DOS MODALIDADES, PORQUE EL NEGOCIO TIENE DOS ───────────────────
-- `por_hora`: operarios, montacarguistas. Cuatro montos, uno por tipo
--   de hora. Igual que la 0024, la hora DOBLE no tiene monto propio:
--   se paga 2× la tarifa de la jornada del bloque (esa regla vive en
--   pago-tipos.ts y no cambia).
-- `por_dia`: choferes y ayudantes de ruta. Un solo monto: el día
--   trabajado. Sus boletas no traen horas sino días marcados, así que
--   una tarifa por hora ahí no significaría nada.
--
-- ── LO QUE NO SE BORRA ─────────────────────────────────────────────
-- Las cuatro columnas de `empleados` QUEDAN. Borrarlas sería tirar el
-- historial de con qué se pagó antes, y una migración de datos que
-- sale mal en una planilla no se deshace. El código nuevo lee el
-- puesto; la ficha queda como respaldo explícito y documentado para
-- quien todavía no tenga puesto asignado.
--
-- ── QUIÉN LO VE ────────────────────────────────────────────────────
-- Solo gestión (propietario / admin_rrhh) — el MISMO conjunto que
-- `puedeVerSalario` autoriza sin override, así que un gerente no ve
-- estos montos por sesión. La planilla los lee con la llave de
-- servicio, igual que ya hace con las tarifas de la ficha.
-- ══════════════════════════════════════════════════════════════════

alter table puestos
  add column modalidad_pago text not null default 'por_hora'
    check (modalidad_pago in ('por_hora', 'por_dia'));

comment on column puestos.modalidad_pago is
  'Cómo se le paga a quien ocupa este puesto (0032): por_hora = cuatro tarifas por tipo de hora (operarios, montacarguistas); por_dia = un monto por día trabajado (choferes y ayudantes de ruta, cuyas boletas traen días y no horas).';

create table salarios_puesto (
  id                uuid primary key default gen_random_uuid(),
  organizacion_id   uuid not null references organizaciones(id) on delete cascade,
  puesto_id         uuid not null references puestos(id) on delete cascade,
  -- Los cuatro tipos de hora de la 0024 + 'dia' para las rutas. Sin
  -- 'doble' a propósito: la hora doble se paga 2× la de su jornada.
  concepto          text not null check (concepto in ('diurna', 'mixta', 'nocturna', 'extra', 'dia')),
  monto             numeric not null check (monto >= 0),
  actualizado_en    timestamptz not null default now(),
  actualizado_por   uuid references auth.users(id) on delete set null default auth.uid(),
  unique (organizacion_id, puesto_id, concepto)
);

comment on table salarios_puesto is
  'Cuánto se le PAGA a quien ocupa cada puesto (0032) — no confundir con config_facturacion (0024), que es cuánto se le COBRA al cliente. Un monto por concepto: los cuatro tipos de hora, o "dia" para los puestos de ruta.';

create index salarios_puesto_puesto_id_idx on salarios_puesto (puesto_id);

-- El puesto tiene que ser de la MISMA organización que el salario:
-- mismo trigger que ya protege a config_facturacion (0024) y a
-- puesto_alias (0026).
create or replace function salarios_puesto_validar_organizacion()
returns trigger
language plpgsql
security definer
set search_path = work, public
as $$
begin
  if not exists (
    select 1 from puestos where id = new.puesto_id and organizacion_id = new.organizacion_id
  ) then
    raise exception 'El puesto no pertenece a la organización del salario';
  end if;
  return new;
end;
$$;

create trigger salarios_puesto_validar_org
  before insert or update of puesto_id, organizacion_id on salarios_puesto
  for each row
  execute function salarios_puesto_validar_organizacion();

alter table salarios_puesto enable row level security;

create policy "Gestión ve los salarios por puesto" on salarios_puesto
  for select to authenticated
  using (gestiona_organizacion(organizacion_id));
create policy "Gestión define salarios por puesto" on salarios_puesto
  for insert to authenticated
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión corrige salarios por puesto" on salarios_puesto
  for update to authenticated
  using (gestiona_organizacion(organizacion_id))
  with check (gestiona_organizacion(organizacion_id));
create policy "Gestión elimina salarios por puesto" on salarios_puesto
  for delete to authenticated
  using (gestiona_organizacion(organizacion_id));

revoke all on salarios_puesto from anon, authenticated;
grant select on salarios_puesto to authenticated;
grant insert (organizacion_id, puesto_id, concepto, monto) on salarios_puesto to authenticated;
grant update (monto) on salarios_puesto to authenticated;
grant delete on salarios_puesto to authenticated;
grant all on salarios_puesto to service_role;

-- La modalidad la maneja gestión desde la pantalla de Puestos.
grant update (modalidad_pago) on puestos to authenticated;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0033_causa_de_fallo.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0033 — POR QUÉ FALLÓ UNA BOLETA (y no solo "falló")
-- ══════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA (dueño, 27 ago 2026): «¿pero cómo sabemos que falló?».
-- Tenía razón — no se sabía. El pipeline YA distingue el motivo
-- (`proveedor-gemini.ts` clasifica auth / rate_limit / api y conoce el
-- status HTTP, y lo escribe en el log estructurado `ia_boletas_uso`),
-- pero en la boleta se guardaba únicamente el texto genérico «El
-- análisis falló del lado de la IA — reintentar». O sea: la
-- información existía y se tiraba, y para saber que Gemini había
-- devuelto un 503 había que ir a los logs del servidor.
--
-- Estas cuatro columnas guardan lo que ya se sabía, para que la
-- pantalla pueda decir «Gemini estaba sobrecargado (503), reintentá»
-- en vez de un genérico — que es la diferencia entre «el servidor de
-- Google se cayó un minuto» y «este papel no se puede leer», dos
-- problemas con dos soluciones distintas.
--
-- Server-only, mismo patrón que empleado_id / puesto_id / repetida:
-- las escribe el pipeline, nadie más.
-- ══════════════════════════════════════════════════════════════════

alter table documentos_extracciones
  add column fallo_causa      text,
  add column fallo_status     integer,
  add column fallo_proveedor  text,
  add column fallo_en         timestamptz;

comment on column documentos_extracciones.fallo_causa is
  'Por qué falló el análisis, clasificado: auth (llave rechazada), rate_limit (429), api (el proveedor devolvió error — ver fallo_status), red (no se pudo contactar), modelo (declinó o truncó la salida). null = no falló.';
comment on column documentos_extracciones.fallo_status is
  'El status HTTP que devolvió el proveedor, cuando lo hubo. 503 = sobrecargado (transitorio, reintentar sirve); 429 = límite de uso; 401/403 = llave.';
comment on column documentos_extracciones.fallo_proveedor is
  'Qué proveedor falló: gemini o anthropic.';
comment on column documentos_extracciones.fallo_en is
  'Cuándo falló — para distinguir un fallo viejo de uno recién reintentado.';

grant update (fallo_causa, fallo_status, fallo_proveedor, fallo_en)
  on documentos_extracciones to service_role;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0034_recargas_de_ruta.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0034 — RECARGAS DE RUTA: el día extra que convive con el normal
-- ══════════════════════════════════════════════════════════════════
--
-- EL NEGOCIO (dueño, 27 ago 2026): las rutas se pagan POR DÍA, y una
-- "RECARGA" significa pagar UN DÍA MÁS. La recarga llega en su propia
-- hoja ("AYUDANTES RECARGAS", "CHOFERES RECARGAS"), con la misma
-- persona y muchas veces EL MISMO DÍA CALENDARIO que su hoja normal —
-- Andrey Morales trabajó el jueves Y ese mismo jueves tiene una
-- recarga: se le pagan dos días.
--
-- EL CHOQUE: el índice único de la 0021 (`empleado_id, fecha` donde no
-- anulado) existe para que el mismo papel confirmado dos veces no
-- duplique horas. Pero una recarga NO es un duplicado — es un hecho
-- distinto del mismo día. Sin esta migración, confirmar la hoja de
-- recargas después de la normal rebotaría contra el candado.
--
-- LA SOLUCIÓN: el hecho declara si es recarga, y el candado pasa a
-- ser único por (empleado, fecha, recarga): un día normal Y una
-- recarga conviven; DOS normales del mismo día se siguen bloqueando,
-- y DOS recargas del mismo día también (pagar dos recargas idénticas
-- el mismo día sí sería el mismo papel dos veces).
-- ══════════════════════════════════════════════════════════════════

alter table jornadas_declaradas
  add column recarga boolean not null default false;

comment on column jornadas_declaradas.recarga is
  'true = este hecho viene de una hoja de RECARGAS de ruta (0034): el día extra que se paga aparte del día normal. Convive con la jornada normal de la misma fecha — por eso entra al índice único.';

grant insert (recarga) on jornadas_declaradas to authenticated;

-- El candado aprende la dimensión nueva.
drop index if exists jornadas_declaradas_dia_unico_idx;
create unique index jornadas_declaradas_dia_unico_idx
  on jornadas_declaradas (empleado_id, fecha, recarga)
  where not anulado;

-- La inmutabilidad (0021, ya tocada por 0024 y 0026) congela también
-- la columna nueva: una recarga no se "convierte" en día normal — se
-- anula y se registra el hecho correcto.
create or replace function jornadas_declaradas_solo_anulacion()
returns trigger
language plpgsql
set search_path = work, public
as $$
begin
  if old.anulado then
    raise exception 'Una jornada declarada anulada está congelada: no se des-anula ni se modifica';
  end if;
  if not new.anulado then
    raise exception 'El único UPDATE permitido sobre una jornada declarada es anularla';
  end if;
  if new.organizacion_id    is distinct from old.organizacion_id
     or new.empleado_id     is distinct from old.empleado_id
     or new.fecha           is distinct from old.fecha
     or new.horas_ordinarias is distinct from old.horas_ordinarias
     or new.horas_extra     is distinct from old.horas_extra
     or new.horas_dobles    is distinct from old.horas_dobles
     or new.etiqueta_documento is distinct from old.etiqueta_documento
     or new.turno           is distinct from old.turno
     or new.jornada         is distinct from old.jornada
     or new.puesto_id       is distinct from old.puesto_id
     or new.recarga         is distinct from old.recarga
     or new.origen          is distinct from old.origen
     or new.registrado_por  is distinct from old.registrado_por
     or new.documento_id    is distinct from old.documento_id
     or new.nota            is distinct from old.nota
     or new.creado_en       is distinct from old.creado_en then
    raise exception 'El hecho registrado no se modifica: para corregir, anular y registrar uno nuevo';
  end if;
  if new.anulado_motivo is null or btrim(new.anulado_motivo) = '' then
    raise exception 'Anular una jornada declarada exige un motivo';
  end if;
  new.anulado_en := now();
  new.anulado_por := coalesce(auth.uid(), new.anulado_por);
  return new;
end;
$$;

notify pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- ORIGEN: 0035_cobro_por_dia.sql
-- ════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
--  0035 — COBRO POR DÍA: la facturación de rutas también es por día
-- ══════════════════════════════════════════════════════════════════
--
-- EL NEGOCIO (dueño, 28 ago 2026): a la empresa cliente también se le
-- COBRA por día trabajado en los puestos de ruta — igual que se les
-- PAGA a choferes y ayudantes (0032). La tabla de tarifas de cobro
-- (0024) solo conocía tipos de HORA; se le suma el concepto 'dia'.
--
-- La tarifa por día vive como una fila más de `config_facturacion`
-- con tipo_hora = 'dia', general o por puesto — misma mecánica de
-- override que ya rige para las horas. Qué grupos se cobran por día
-- lo decide la MODALIDAD del puesto (puestos.modalidad_pago, 0032):
-- el mismo interruptor que decide cómo se paga decide cómo se cobra,
-- y no puede haber un puesto que pague por día y cobre por hora por
-- accidente.
-- ══════════════════════════════════════════════════════════════════

alter table config_facturacion
  drop constraint if exists config_facturacion_tipo_hora_check;

alter table config_facturacion
  add constraint config_facturacion_tipo_hora_check
  check (tipo_hora in ('diurna', 'mixta', 'nocturna', 'extra', 'doble', 'dia'));

comment on column config_facturacion.tipo_hora is
  'El concepto que esta tarifa cobra: uno de los cinco tipos de hora (0024), o ''dia'' (0035) para los puestos de ruta que se facturan por día trabajado.';

notify pgrst, 'reload schema';


-- ============================================================
-- CIERRE — search_path fijo en cada función de `work`
-- ============================================================
--
-- El cuerpo de una función plpgsql/sql resuelve sus nombres en tiempo
-- de EJECUCIÓN, no de creación: sin esto, una función de Work llamada
-- desde una política buscaría `empleados` en el search_path de quien
-- consulta (`public`) y fallaría. Las políticas, los defaults y los
-- checks no necesitan el arreglo — Postgres les guarda el OID ya
-- resuelto. Se hace en bloque para no depender de que cada función
-- traiga su propio `set`.
do $cierre$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'work'
  loop
    execute format('alter function %s set search_path = work, public, pg_temp', f.firma);
  end loop;
end
$cierre$;

-- ============================================================
-- VERIFICACIÓN — que la migración falle acá y no en producción
-- ============================================================
do $verificar$
declare
  n_tablas int;
  n_rls    int;
  n_pol    int;
  n_bucket int;
begin
  select count(*) into n_tablas
    from pg_tables where schemaname = 'work';
  select count(*) into n_rls
    from pg_tables where schemaname = 'work' and rowsecurity;
  select count(*) into n_pol
    from pg_policies where schemaname = 'work';
  select count(*) into n_bucket
    from storage.buckets where id = 'work-documentos';

  if n_tablas <> 25 then
    raise exception 'Se esperaban 25 tablas en work, hay %', n_tablas;
  end if;
  if n_rls <> n_tablas then
    raise exception 'Hay % tablas en work sin RLS', n_tablas - n_rls;
  end if;
  if n_pol = 0 then
    raise exception 'work quedó sin políticas RLS';
  end if;
  if n_bucket <> 1 then
    raise exception 'Falta el bucket work-documentos';
  end if;

  raise notice 'work: % tablas, todas con RLS, % políticas, bucket ok', n_tablas, n_pol;
end
$verificar$;

notify pgrst, 'reload schema';
