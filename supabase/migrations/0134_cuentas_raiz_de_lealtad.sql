-- ============================================================
-- BOOKEA — `cuentas`: la raíz propia de Lealtad (0134)
--
-- Lealtad deja de colgar de `ranchos` y pasa a colgar de una entidad
-- propia: `cuentas`. Un negocio puede tener Lealtad SIN existir en el
-- marketplace, y un rancho del marketplace puede tener Lealtad sin que
-- las dos cosas sean la misma fila.
--
-- ------------------------------------------------------------
-- POR QUÉ `cuentas` Y NO `lealtad_cuentas`
-- ------------------------------------------------------------
-- Porque mañana cuelgan de acá también Citas, Hospedajes y la ficha de
-- marketplace. Hoy `ranchos` hace DOS trabajos mezclados —ser el
-- negocio y ser la ficha pública— y esta tabla es el primer paso para
-- separarlos. Llamarla `lealtad_cuentas` obligaría a renombrarla el día
-- que entre el segundo producto.
--
-- Esta migración NO mueve ranchos, citas ni hospedajes: siguen
-- exactamente como están. Solo nace la raíz y Lealtad se para sobre
-- ella.
--
-- ------------------------------------------------------------
-- LA REGLA QUE NO SE NEGOCIA: LOS PASES EMITIDOS NO SE TOCAN
-- ------------------------------------------------------------
-- `miembros`, `pases_wallet`, `transacciones_puntos`, `recompensas` y
-- `canjes` cuelgan de `programa_lealtad.id`, y ESE id NO CAMBIA acá.
--
-- El `serial_number` de un pase es su identidad dentro del teléfono:
-- si cambiara, el iPhone agregaría una tarjeta NUEVA en vez de
-- refrescar la que el cliente ya tiene, y el saldo viejo quedaría
-- huérfano en una tarjeta que nadie vuelve a mirar. Por eso esta
-- migración solo agrega un padre; no reemplaza identidades.
--
-- ------------------------------------------------------------
-- EXPANDIR AHORA, CONTRAER DESPUÉS
-- ------------------------------------------------------------
-- `programa_lealtad.rancho_id` SE CONSERVA y sigue poblado. El código
-- que hoy filtra por rancho_id sigue funcionando sin cambios mientras
-- se migra pantalla por pantalla. Recién cuando nada lo lea se podrá
-- quitar, en otra migración.
--
-- Correrla dos veces es seguro.
-- ============================================================


-- ------------------------------------------------------------
-- 1. cuentas — el negocio, sin depender del marketplace
-- ------------------------------------------------------------
create table if not exists cuentas (
  id uuid primary key default gen_random_uuid(),

  nombre text not null check (char_length(trim(nombre)) between 1 and 80),

  -- La dirección pública de sus tarjetas: /tarjeta/{slug}. Propia y no
  -- prestada de `ranchos`: una cuenta sin rancho también necesita una.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),

  -- El dueño. Se REUTILIZA la identidad de Bookea: nunca se crea un
  -- usuario paralelo para Lealtad.
  owner_id uuid not null references auth.users(id) on delete cascade,

  -- El plan del módulo (catálogo en src/lib/lealtad/planes.ts).
  plan text check (
    plan is null
    or plan in ('prueba', 'esencial', 'crece', 'pro', 'empresa',
                'gratis', 'basico', 'estandar', 'enterprise')
  ),
  plan_periodo text not null default 'mes' check (plan_periodo in ('mes', 'anio')),

  -- Hasta cuándo dura la prueba. null = no está en prueba.
  prueba_hasta timestamptz,

  estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'morosa', 'cancelada')),

  logo_url text,

  -- ── LA COSTURA ────────────────────────────────────────────────
  -- null  = Lealtad sola, sin marketplace.
  -- valor = la misma empresa que ese rancho.
  --
  -- Es NULLABLE y `on delete set null` a propósito: borrar la ficha de
  -- marketplace no puede llevarse por delante el programa de lealtad y
  -- los pases de sus clientes. La cuenta sobrevive, desenlazada.
  --
  -- Y es UNIQUE: dos cuentas apuntando al mismo rancho serían dos
  -- programas de lealtad para el mismo local, con el cliente sin saber
  -- cuál es el suyo.
  rancho_id uuid unique references ranchos(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists cuentas_owner_idx on cuentas(owner_id);

comment on table cuentas is
  'La raíz del negocio en Bookea (0134). Hoy la usa Lealtad; mañana '
  'cuelgan de acá Citas, Hospedajes y la ficha de marketplace. '
  '`rancho_id` es la costura opcional con el marketplace: null = el '
  'negocio existe solo en Lealtad.';


-- ------------------------------------------------------------
-- 2. cuentas_equipo — los asientos, que el plan limita
-- ------------------------------------------------------------
-- Equipo PROPIO y no `rancho_colaboradores` porque los asientos son
-- del plan de Lealtad (3 en Esencial, 6 en Crece, 15 en Pro) y una
-- cuenta puede no tener rancho del cual sacar colaboradores.
--
-- Lo que NO se duplica es la PERSONA: `usuario_id` apunta a la misma
-- identidad de siempre. Acá solo se guarda qué puede hacer en ESTA
-- cuenta.
create table if not exists cuentas_equipo (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references cuentas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,

  rol text not null default 'colaborador'
    check (rol in ('propietario', 'administrador', 'colaborador')),

  -- Checklist fino, con la misma forma que `permisos_lealtad` (0127):
  -- {acreditar, canjear, revertir, auditoria}. El rol define el
  -- default; esto lo afina por persona.
  permisos jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  -- Una persona, un asiento por cuenta. Sin esto, invitar dos veces al
  -- mismo correo consumiría dos asientos del plan.
  unique (cuenta_id, usuario_id)
);

create index if not exists cuentas_equipo_usuario_idx on cuentas_equipo(usuario_id);


-- ------------------------------------------------------------
-- 3. Helpers de acceso (SECURITY DEFINER)
-- ------------------------------------------------------------
-- Van como función y no como subconsulta dentro de cada política por
-- una razón concreta: la política de `cuentas_equipo` necesita
-- consultar `cuentas_equipo`, y eso dispara recursión infinita de RLS.
-- `security definer` corre con los permisos del dueño de la función y
-- SALTA la RLS, cortando el ciclo.
create or replace function public.gestiona_cuenta(p_cuenta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cuentas c
    where c.id = p_cuenta
      and (c.owner_id = auth.uid() or public.is_admin())
  )
  or exists (
    select 1 from cuentas_equipo e
    where e.cuenta_id = p_cuenta
      and e.usuario_id = auth.uid()
      and e.rol in ('propietario', 'administrador')
  );
$$;

/** Cualquiera del equipo, incluido el colaborador de mostrador. */
create or replace function public.pertenece_a_cuenta(p_cuenta uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cuentas c
    where c.id = p_cuenta
      and (c.owner_id = auth.uid() or public.is_admin())
  )
  or exists (
    select 1 from cuentas_equipo e
    where e.cuenta_id = p_cuenta and e.usuario_id = auth.uid()
  );
$$;

grant execute on function public.gestiona_cuenta(uuid) to authenticated;
grant execute on function public.pertenece_a_cuenta(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
alter table cuentas enable row level security;
alter table cuentas_equipo enable row level security;

-- La cuenta la LEE quien la integra. NO es pública: el nombre y el
-- logo que ve un cliente salen de la página de la tarjeta, que expone
-- solo lo suyo — no hace falta abrir la fila entera al mundo.
drop policy if exists "El equipo ve su cuenta" on cuentas;
create policy "El equipo ve su cuenta" on cuentas
  for select to authenticated
  using (public.pertenece_a_cuenta(id));

-- Crear: cualquiera puede abrir la SUYA, firmando con su propio id.
-- Sin el `with check`, alguien podría crear cuentas a nombre de otro.
drop policy if exists "Cada quien abre su cuenta" on cuentas;
create policy "Cada quien abre su cuenta" on cuentas
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "El dueño administra su cuenta" on cuentas;
create policy "El dueño administra su cuenta" on cuentas
  for update to authenticated
  using (public.gestiona_cuenta(id))
  with check (public.gestiona_cuenta(id));

-- Borrar: SOLO el dueño real o un admin de plataforma. Un
-- administrador invitado no puede borrar la cuenta que lo invitó.
drop policy if exists "Solo el dueño borra la cuenta" on cuentas;
create policy "Solo el dueño borra la cuenta" on cuentas
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "El equipo se ve entre sí" on cuentas_equipo;
create policy "El equipo se ve entre sí" on cuentas_equipo
  for select to authenticated
  using (public.pertenece_a_cuenta(cuenta_id));

drop policy if exists "Quien gestiona arma el equipo" on cuentas_equipo;
create policy "Quien gestiona arma el equipo" on cuentas_equipo
  for all to authenticated
  using (public.gestiona_cuenta(cuenta_id))
  with check (public.gestiona_cuenta(cuenta_id));

grant select, insert, update, delete on cuentas to authenticated;
grant select, insert, update, delete on cuentas_equipo to authenticated;


-- ------------------------------------------------------------
-- 5. programa_lealtad cuelga de la cuenta
-- ------------------------------------------------------------
alter table programa_lealtad add column if not exists cuenta_id uuid references cuentas(id) on delete cascade;
create index if not exists programa_lealtad_cuenta_idx on programa_lealtad(cuenta_id);

-- El `unique(rancho_id)` de la 0060 permitía UN programa por negocio.
-- El catálogo nuevo vende varios (2 en Esencial, 6 en Crece, 15 en
-- Pro), así que se libera. El tope real lo hace cumplir el servidor
-- contra el plan — no una restricción que dice "uno" para todos.
alter table programa_lealtad drop constraint if exists programa_lealtad_rancho_id_key;


-- ------------------------------------------------------------
-- 6. Backfill: cada programa que ya existe estrena su cuenta
-- ------------------------------------------------------------
-- Una cuenta por rancho que HOY tiene programa, enlazada a ese rancho
-- y copiando lo que ya se sabe de él. Así el dueño no ve dos negocios
-- ni tiene que cargar su nombre y su logo otra vez: entra a Lealtad y
-- está su negocio de siempre.
--
-- `on conflict do nothing` + el `where not exists`: correr esto dos
-- veces no duplica nada.
insert into cuentas (nombre, slug, owner_id, plan, rancho_id, created_at)
select
  r.nombre,
  -- El slug del rancho si está libre; si no, uno derivado del id, que
  -- no puede chocar. El slug es UNIQUE y un choque abortaría el
  -- backfill entero.
  coalesce(r.slug, 'cuenta-' || replace(r.id::text, '-', '')),
  r.owner_id,
  r.plan_lealtad,
  r.id,
  now()
from ranchos r
where exists (select 1 from programa_lealtad p where p.rancho_id = r.id)
  and not exists (select 1 from cuentas c where c.rancho_id = r.id)
on conflict do nothing;

-- Y cada programa apunta a la cuenta de su rancho.
update programa_lealtad p
set cuenta_id = c.id
from cuentas c
where c.rancho_id = p.rancho_id
  and p.cuenta_id is null;

-- El dueño ocupa su asiento explícitamente. Tenerlo en la tabla —y no
-- solo como `owner_id`— hace que contar asientos contra el tope del
-- plan sea UNA consulta, sin sumar "el dueño más los invitados" en
-- cada pantalla y arriesgarse a que una lo olvide.
insert into cuentas_equipo (cuenta_id, usuario_id, rol)
select c.id, c.owner_id, 'propietario'
from cuentas c
on conflict (cuenta_id, usuario_id) do nothing;

comment on column programa_lealtad.cuenta_id is
  'La cuenta dueña del programa (0134). `rancho_id` se conserva '
  'poblado mientras se migra el código pantalla por pantalla; cuando '
  'nada lo lea se quita en otra migración.';
