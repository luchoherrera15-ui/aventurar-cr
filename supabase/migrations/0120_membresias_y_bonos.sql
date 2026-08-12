
-- ============================================================
-- BOOKEA — Membresías y bonos de sesiones (0120)
--
-- Tanda 2 del módulo CITAS / SERVICIOS (docs/citas-roadmap.md). La
-- Tanda 1 definió el servicio; esta define CÓMO SE PAGA POR ADELANTADO:
-- el plan mensual del gimnasio y el bono de 10 masajes del spa.
--
-- ------------------------------------------------------------
-- POR QUÉ NO SE REUSA `paquetes_afiliacion` (0060)
-- ------------------------------------------------------------
-- Hay que decirlo fuerte porque se parecen y alguien va a querer
-- fusionarlas: la 0060 YA tiene `paquetes_afiliacion` (niveles con
-- nombre, beneficios y precio) y `miembros` (cliente + paquete +
-- estado activa/pausada/cancelada). Suena exactamente a esto.
--
-- No se reusan por una razón estructural, no estética:
--
--   `paquetes_afiliacion.programa_id` → `programa_lealtad`, y LEALTAD
--   ES UN ADD-ON OPCIONAL Y COBRABLE (`addons_negocio`, 0077). Un
--   gimnasio que no contrate el complemento de lealtad —o que lo dé
--   de baja— perdería el acceso a sus membresías, que son su forma de
--   cobrar. Colgar el cobro de un add-on es un acoplamiento que se
--   paga caro el día que alguien apaga el add-on.
--
-- Y hay una diferencia de fondo además de la estructural:
--
--   `paquetes_afiliacion`  NIVEL DE FIDELIDAD. Beneficios en texto,
--                          sin vencimiento, sin cupo de sesiones. No
--                          gobierna ninguna reserva. ESTA MIGRACIÓN
--                          NO LA TOCA NI LA REINTERPRETA.
--
--   `planes_membresia`     LO QUE EL CLIENTE COMPRA PARA USAR. Tiene
--   (acá)                  período, sesiones incluidas y vencimiento,
--                          y su saldo se gasta al atender.
--
-- Un negocio puede tener las dos: nivel Oro (lealtad) y plan Mensual
-- 12 sesiones (esto). No compiten.
--
-- ------------------------------------------------------------
-- UN SOLO MODELO PARA MEMBRESÍA Y BONO
-- ------------------------------------------------------------
-- La especificación los separa en dos capítulos (18 membresías, 19
-- bonos/paquetes), pero en la base son la misma cosa con distinto
-- `periodo`:
--
--   periodo 'mensual'  + sesiones 12   → "Premium, 12 al mes"
--   periodo 'mensual'  + sesiones null → "Ilimitada"
--   periodo 'unico'    + sesiones 10   → "Bono 10 masajes"
--
-- Meterlos en dos tablas obligaría a duplicar el saldo, el consumo y
-- la vigencia, y a que cada pantalla preguntara "¿de cuál de las dos
-- es este saldo?". El panel sí los presenta separados, que es donde la
-- distinción importa: se la ve el dueño, no la base.
--
-- ------------------------------------------------------------
-- EL SALDO ES DERIVADO, NO UN CONTADOR
-- ------------------------------------------------------------
-- `membresias` NO lleva una columna `sesiones_usadas`. El consumo vive
-- en `consumos_membresia`, una fila por uso, y el saldo se calcula
-- sumando. Mismo criterio que el CRM derivado de la 0109 (decisión
-- D-3).
--
-- Un contador se desincroniza el día que alguien cancela una cita y el
-- decremento no ocurre, y a partir de ahí nadie sabe cuál de los dos
-- números es el bueno. Con el libro, devolver una sesión es insertar
-- una fila negativa y el historial queda a la vista: el dueño puede
-- decirle al cliente exactamente en qué cita se le fue cada sesión.
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN NO HACE, A PROPÓSITO
-- ------------------------------------------------------------
-- NO consume sesiones sola al reservar. `crear_cita` no se toca acá.
-- El consumo se registra desde el panel cuando el cliente se atiende,
-- que es como trabaja hoy un salón: la persona llega y se le marca la
-- sesión.
--
-- Descontar en el momento de reservar exige decidir qué pasa con las
-- cancelaciones, los no-show y las clases con lista de espera — y eso
-- es justamente la Tanda 3 (clases) y la 2.4 (cancelación del
-- cliente). Atarlo antes de que existan esas reglas obliga a
-- rehacerlo. El panel lo dice en su ayuda para que el dueño no crea
-- que ya se descuenta solo.
--
-- Los lugares para alquilar no se enteran: son tablas nuevas y no se
-- toca ninguna existente. El panel vive detrás de `vertical ===
-- 'citas'`, igual que toda la Tanda 1.
-- ============================================================

-- ------------------------------------------------------------
-- 1. planes_membresia — lo que el negocio vende
-- ------------------------------------------------------------
create table if not exists planes_membresia (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,

  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  descripcion text check (descripcion is null or char_length(descripcion) <= 500),

  -- Colones. 0 es válido: un plan de cortesía existe.
  precio numeric not null default 0 check (precio >= 0 and precio <= 10000000),

  -- 'unico' = bono/paquete: se compra una vez y no se renueva.
  periodo text not null default 'mensual'
    check (periodo in ('unico', 'mensual', 'trimestral', 'semestral', 'anual')),

  -- null = ilimitado. Es la diferencia entre "Premium 12" e "Ilimitada".
  sesiones_incluidas integer
    check (sesiones_incluidas is null or sesiones_incluidas between 1 and 9999),

  -- Cuántos días vale desde que se compra. null = lo decide el período
  -- (mensual → 30 días) o no vence nunca si el período es 'unico'.
  vigencia_dias integer
    check (vigencia_dias is null or vigencia_dias between 1 and 3650),

  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists planes_membresia_rancho_idx
  on planes_membresia (rancho_id, orden);

-- ------------------------------------------------------------
-- 2. plan_servicios — qué servicios cubre el plan
-- ------------------------------------------------------------
-- SIN FILAS = CUBRE TODO. Es la misma convención que `servicios_recurso`
-- (0061), donde un servicio sin asignaciones lo puede dar cualquiera.
-- Repetir la convención evita que el dueño tenga que aprender dos.
create table if not exists plan_servicios (
  plan_id uuid not null references planes_membresia(id) on delete cascade,
  item_id uuid not null references rancho_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, item_id)
);

-- ------------------------------------------------------------
-- 3. membresias — lo que un cliente compró
-- ------------------------------------------------------------
create table if not exists membresias (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  plan_id uuid references planes_membresia(id) on delete set null,

  -- Misma identidad que `clientes_negocio` (0109): cuenta si la hay,
  -- si no correo o teléfono normalizados. Un salón vende bonos a
  -- gente que nunca abrió la app, y esa venta tiene que poder
  -- registrarse igual.
  cliente_id uuid references auth.users(id) on delete set null,
  correo text check (
    correo is null
    or (correo = btrim(lower(correo)) and position('@' in correo) > 1 and correo !~ '\s')
  ),
  telefono text check (telefono is null or telefono ~ '^[0-9]{8}$'),
  nombre text check (nombre is null or char_length(nombre) <= 120),

  estado text not null default 'activa'
    check (estado in ('activa', 'pausada', 'vencida', 'cancelada')),

  inicio date not null default current_date,
  -- null = no vence.
  fin date,

  -- SNAPSHOT del plan al momento de comprar, igual que `detalle_pedido`
  -- en reservas: si el dueño sube el precio o cambia las sesiones del
  -- plan, lo ya vendido no cambia bajo los pies del cliente.
  sesiones_totales integer
    check (sesiones_totales is null or sesiones_totales between 1 and 9999),
  precio_pagado numeric not null default 0
    check (precio_pagado >= 0 and precio_pagado <= 10000000),

  notas text check (notas is null or char_length(notas) <= 1000),
  created_at timestamptz not null default now(),

  constraint membresias_algun_id check (
    cliente_id is not null or correo is not null or telefono is not null
  ),
  constraint membresias_fin_posterior check (fin is null or fin >= inicio)
);

create index if not exists membresias_rancho_idx on membresias (rancho_id, estado);
create index if not exists membresias_cliente_idx on membresias (cliente_id)
  where cliente_id is not null;
create index if not exists membresias_correo_idx on membresias (rancho_id, correo)
  where correo is not null;
create index if not exists membresias_telefono_idx on membresias (rancho_id, telefono)
  where telefono is not null;

-- ------------------------------------------------------------
-- 4. consumos_membresia — el libro del saldo
-- ------------------------------------------------------------
create table if not exists consumos_membresia (
  id uuid primary key default gen_random_uuid(),
  membresia_id uuid not null references membresias(id) on delete cascade,

  -- La cita que gastó la sesión, si vino de una. Se pone en null y no
  -- se borra la fila cuando la reserva desaparece: el libro es
  -- histórico y no debe perder movimientos.
  reserva_id uuid references reservas(id) on delete set null,

  -- NEGATIVO = devolución. Cancelar una cita no borra el consumo:
  -- agrega su contrario, y el historial queda completo.
  cantidad integer not null default 1
    check (cantidad between -100 and 100 and cantidad <> 0),

  motivo text check (motivo is null or char_length(motivo) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists consumos_membresia_idx
  on consumos_membresia (membresia_id, created_at);

-- Una reserva no puede gastar dos veces la misma membresía. Parcial
-- porque los consumos manuales no traen reserva y no deben chocar
-- entre sí, y porque las devoluciones son negativas y sí van aparte.
create unique index if not exists consumos_membresia_reserva_idx
  on consumos_membresia (membresia_id, reserva_id)
  where reserva_id is not null and cantidad > 0;

-- ------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------
alter table planes_membresia enable row level security;
alter table plan_servicios enable row level security;
alter table membresias enable row level security;
alter table consumos_membresia enable row level security;

-- Los PLANES son vitrina: el cliente tiene que poder ver qué se vende
-- antes de comprar, sin sesión. Los precios ya son públicos.
drop policy if exists "Los planes activos son públicos" on planes_membresia;
create policy "Los planes activos son públicos" on planes_membresia
  for select to anon, authenticated using (true);

drop policy if exists "Quien administra el negocio maneja sus planes" on planes_membresia;
create policy "Quien administra el negocio maneja sus planes" on planes_membresia
  for all to authenticated
  using (gestiona_rancho(rancho_id))
  with check (gestiona_rancho(rancho_id));

drop policy if exists "Los servicios de un plan son públicos" on plan_servicios;
create policy "Los servicios de un plan son públicos" on plan_servicios
  for select to anon, authenticated using (true);

drop policy if exists "Quien administra el negocio arma sus planes" on plan_servicios;
create policy "Quien administra el negocio arma sus planes" on plan_servicios
  for all to authenticated
  using (exists (
    select 1 from planes_membresia p
    where p.id = plan_id and gestiona_rancho(p.rancho_id)
  ))
  with check (exists (
    select 1 from planes_membresia p
    where p.id = plan_id and gestiona_rancho(p.rancho_id)
  ));

-- Las MEMBRESÍAS no son públicas: dicen quién le compró qué a quién.
-- Las ve quien administra el negocio, y el cliente la suya.
drop policy if exists "El negocio y el dueño de la membresía la ven" on membresias;
create policy "El negocio y el dueño de la membresía la ven" on membresias
  for select to authenticated
  using (gestiona_rancho(rancho_id) or cliente_id = auth.uid());

-- ESCRITURA solo del negocio: la membresía es una VENTA. Si el cliente
-- pudiera escribirla se regalaría sesiones, igual que se regalaría
-- complementos si pudiera escribir `addons_negocio` (0077).
drop policy if exists "Solo el negocio vende membresías" on membresias;
create policy "Solo el negocio vende membresías" on membresias
  for all to authenticated
  using (gestiona_rancho(rancho_id))
  with check (gestiona_rancho(rancho_id));

drop policy if exists "El negocio y el cliente ven el consumo" on consumos_membresia;
create policy "El negocio y el cliente ven el consumo" on consumos_membresia
  for select to authenticated
  using (exists (
    select 1 from membresias m
    where m.id = membresia_id
      and (gestiona_rancho(m.rancho_id) or m.cliente_id = auth.uid())
  ));

drop policy if exists "Solo el negocio gasta el saldo" on consumos_membresia;
create policy "Solo el negocio gasta el saldo" on consumos_membresia
  for all to authenticated
  using (exists (
    select 1 from membresias m where m.id = membresia_id and gestiona_rancho(m.rancho_id)
  ))
  with check (exists (
    select 1 from membresias m where m.id = membresia_id and gestiona_rancho(m.rancho_id)
  ));

-- ------------------------------------------------------------
-- 6. GRANTS
-- ------------------------------------------------------------
-- Sin esto PostgREST responde "permission denied" a todo el mundo con
-- las políticas de arriba perfectamente escritas al lado: crear la
-- tabla por SQL no otorga el permiso de fondo y la RLS no lo
-- reemplaza. Se olvidó en la 0119 y la tabla nació inservible.
--
-- `anon` solo lee los planes y sus servicios, que son vitrina. Las
-- membresías y el consumo no le llegan ni para leer.
grant select on planes_membresia to anon;
grant select, insert, update, delete on planes_membresia to authenticated;
grant all on planes_membresia to service_role;

grant select on plan_servicios to anon;
grant select, insert, update, delete on plan_servicios to authenticated;
grant all on plan_servicios to service_role;

grant select, insert, update, delete on membresias to authenticated;
grant all on membresias to service_role;

grant select, insert, update, delete on consumos_membresia to authenticated;
grant all on consumos_membresia to service_role;

-- ------------------------------------------------------------
-- 7. Documentación en la propia base
-- ------------------------------------------------------------
comment on table planes_membresia is
  'Lo que el negocio vende por adelantado (0120): plan con período y '
  'sesiones, o bono si periodo = unico. NO es paquetes_afiliacion (0060), '
  'que son niveles de fidelidad colgados del add-on de lealtad y no '
  'gobiernan ninguna reserva.';

comment on column planes_membresia.sesiones_incluidas is
  'null = ilimitado. Es lo que separa "Premium 12" de "Ilimitada".';

comment on table plan_servicios is
  'Qué servicios cubre el plan (0120). SIN FILAS = CUBRE TODOS, misma '
  'convención que servicios_recurso (0061).';

comment on table membresias is
  'La compra de un cliente (0120). sesiones_totales y precio_pagado son '
  'SNAPSHOT del plan al comprar: cambiar el plan no altera lo ya vendido. '
  'No lleva contador de usadas — el saldo se deriva de consumos_membresia.';

comment on table consumos_membresia is
  'El libro del saldo (0120). Una fila por movimiento; cantidad NEGATIVA '
  'es una devolución. El saldo se calcula sumando, nunca con un contador, '
  'para que no exista un segundo número que pueda desincronizarse. '
  'LÍMITE DECLARADO: crear_cita no escribe acá — el consumo se registra '
  'desde el panel al atender. El automático llega con las clases.';
