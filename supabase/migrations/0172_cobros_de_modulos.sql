
-- ============================================================
-- BOOKEA — LO QUE DE VERDAD ENTRÓ POR LOS MÓDULOS (0172)
--
-- ------------------------------------------------------------
-- EL AGUJERO QUE ESTA MIGRACIÓN TAPA
-- ------------------------------------------------------------
-- Hasta hoy, NINGÚN camino de cobro del módulo de Lealtad guarda
-- cuánto entró. Ni uno:
--
--   · SINPE / transferencia → `solicitudes_lealtad` (0126 + 0128)
--     guarda el método, la captura y el paquete pedido. El MONTO no
--     está en ninguna columna: se ve en la imagen del comprobante y
--     en la cabeza de quien lo aprobó.
--   · Stripe → `suscripciones` (0143) guarda el espejo del estado
--     (plan, periodo, vigencia) pero no el importe de la factura.
--     El webhook tampoco atiende `invoice.paid`, así que la segunda
--     renovación en adelante no deja rastro ni en `eventos_stripe`.
--   · Complementos sueltos → `addons_negocio` (0077) guarda la
--     vigencia y una nota de texto libre. Nada más.
--
-- El precio vive en TypeScript (`src/lib/lealtad/planes.ts`), en
-- DÓLARES. Auditar con eso sería reconstruir la historia con el
-- catálogo de HOY: el día que suba un paquete, todos los meses
-- anteriores «recaudarían» más. Eso no es una auditoría, es una
-- estimación disfrazada de una.
--
-- El producto hermano ya lo había resuelto bien: los pedidos de
-- invitaciones guardan `monto_crc` (0075). Esta tabla le da a los
-- módulos lo mismo, con la vuelta de tuerca que Lealtad necesita —
-- dos monedas.
--
-- ------------------------------------------------------------
-- POR QUÉ UNA TABLA NUEVA Y NO UNA COLUMNA EN `solicitudes_lealtad`
-- ------------------------------------------------------------
-- Porque una solicitud es UN pedido y un plan se cobra TODOS LOS
-- MESES. Un `monto` en la solicitud registra el primer depósito y
-- deja las renovaciones sin lugar donde caer — que es justo lo que
-- una auditoría de ingresos recurrentes necesita ver.
--
-- Además hay plata que hoy no tiene fila en ningún lado: el SINPE
-- que llegó por WhatsApp y se activó a mano con el desplegable del
-- admin, sin solicitud. Un libro aparte, con una fila por COBRO,
-- acepta los tres orígenes sin torcer ninguna tabla existente.
--
-- ------------------------------------------------------------
-- QUÉ **NO** ES ESTA TABLA
-- ------------------------------------------------------------
-- No es el dinero de las RESERVAS. Ese vive en `cobros_plataforma`
-- (0106) y se audita en su propia pantalla. Acá va SOLO lo que los
-- negocios le pagan a Bookea por los módulos: paquetes de Lealtad y
-- complementos sueltos. Mezclarlos daría un total que no es de
-- nadie: uno es comisión sobre la venta de un tercero, el otro es
-- suscripción de software.
--
-- ------------------------------------------------------------
-- LA MONEDA NO SE CONVIERTE. NUNCA.
-- ------------------------------------------------------------
-- Los paquetes están tarifados en dólares y el SINPE se deposita en
-- colones al tipo de cambio del día que fija Bookea al confirmar. Esa
-- decisión está escrita desde el 2026-08-12 en `planes.ts`:
-- «inventar un tipo de cambio en el código sería cobrar mal».
--
-- Así que cada fila guarda EL MONTO QUE ENTRÓ Y SU MONEDA, y nada
-- más. `tipo_cambio` es informativo — queda anotado cuál se usó ese
-- día, para poder revisar un cobro puntual— pero la pantalla NO lo
-- usa para armar totales: los totales se muestran en dos columnas,
-- ₡ y $, sin sumarse jamás.
--
-- Una sola columna `monto` con la moneda al lado, en vez de
-- `monto_crc` + `monto_usd`: con dos columnas siempre existe la fila
-- que tiene las dos llenas, y entonces nadie sabe cuál se cobró.
--
-- ------------------------------------------------------------
-- LAS CORTESÍAS SON FILAS, NO SON INGRESO
-- ------------------------------------------------------------
-- Regalar un plan es un hecho que hay que poder auditar: cuánto se
-- está regalando importa tanto como cuánto se cobra. Pero no es
-- caja. Por eso la cortesía entra como fila con `es_cortesia = true`
-- y `monto = 0` —lo obliga un CHECK, no la buena voluntad de la
-- aplicación— y con `valor_lista_usd` guardando lo que ese paquete
-- cuesta en el catálogo del día en que se regaló.
--
-- El CHECK es el candado: aunque una pantalla futura se olvide de
-- filtrar las cortesías, sumarlas no mueve el total ni un colón.
--
-- OJO CON EL NOMBRE: `solicitudes_lealtad.regalia` (0130) NO es
-- esto. Ahí «regalía» es el premio de la tarjeta del cliente («el
-- sexto corte va gratis»). La cortesía comercial de Bookea es esta
-- columna y solo esta.
--
-- ------------------------------------------------------------
-- QUIÉN ESCRIBE: SOLO EL SERVIDOR, Y NADIE LEE
-- ------------------------------------------------------------
-- RLS encendida y CERO políticas, igual que `eventos_stripe` (0143)
-- y `registros_dispositivo` (0060): con RLS activa y sin política,
-- Postgres niega por defecto y la tabla no existe para el navegador
-- —ni para leer—. Es el ingreso de la plataforma: no es asunto del
-- dueño de un negocio cuánto paga el de al lado.
--
-- La escribe la llave de servicio desde /admin/modulos, y cada
-- server action verifica `requireAdmin()` por su cuenta (el layout
-- del panel no protege las actions: se invocan por su id desde
-- cualquier ruta).
--
-- ------------------------------------------------------------
-- LO QUE ESTA MIGRACIÓN NO PUEDE HACER
-- ------------------------------------------------------------
-- Rellenar el pasado. Los cobros ya recibidos no tienen su monto en
-- ninguna parte del sistema, así que ninguna migración los puede
-- inventar. La pantalla los lista en «cobros conocidos sin monto
-- registrado» con un formulario para anotarlos a mano, uno por uno,
-- leyendo el comprobante. Hasta que eso pase, el total del período
-- dice en pantalla cuántos cobros le faltan.
-- ============================================================

create table if not exists cobros_modulo (
  id uuid primary key default gen_random_uuid(),

  -- El negocio que pagó. `on delete set null` y no `cascade`: si el
  -- negocio se da de baja, la plata que entró NO desaparece del libro.
  rancho_id uuid references ranchos(id) on delete set null,
  cuenta_id uuid,

  -- El nombre CONGELADO al momento del cobro. Con `rancho_id` en null
  -- (negocio borrado) la fila seguiría diciendo de quién era.
  negocio_nombre text,

  -- Qué se cobró.
  producto text not null check (producto in ('plan_lealtad', 'complemento')),
  -- El id del catálogo (`src/lib/lealtad/planes.ts`). Sin CHECK contra
  -- la lista a propósito: acá se guarda lo que se COBRÓ, aunque ese
  -- paquete se retire del catálogo mañana. Un CHECK que se olvide de
  -- ampliar rechazaría el registro de un cobro que ya entró.
  plan text,
  -- El id del complemento (`addons_negocio.addon`), misma razón.
  addon text,

  -- Qué período cubre el cobro. 'unico' = pago suelto (un complemento
  -- de 3 meses, un cobro fuera de ciclo).
  periodo text not null default 'unico'
    check (periodo in ('mensual', 'anual', 'unico')),

  -- Por dónde entró. Es el corte que pidió el dueño.
  metodo text not null
    check (metodo in ('sinpe', 'transferencia', 'stripe', 'otro')),

  -- LO QUE ENTRÓ, en la moneda en que entró. No se convierte.
  monto  numeric(12, 2) not null check (monto >= 0),
  moneda text not null check (moneda in ('CRC', 'USD')),

  -- Informativo: con qué tipo de cambio se calculó el SINPE ese día
  -- (colones por dólar). Sirve para revisar un cobro puntual; NUNCA
  -- para armar un total mezclado.
  tipo_cambio numeric(10, 4) check (tipo_cambio is null or tipo_cambio > 0),

  -- Cortesía: se regaló. Ver el bloque de arriba.
  es_cortesia boolean not null default false,
  valor_lista_usd numeric(10, 2)
    check (valor_lista_usd is null or valor_lista_usd >= 0),

  -- CUÁNDO entró la plata (no cuándo se anotó acá: puede anotarse
  -- meses después, leyendo el comprobante).
  cobrado_en timestamptz not null default now(),

  -- De dónde salió, si salió de algún lado del sistema.
  solicitud_id           uuid,
  stripe_invoice_id      text,
  stripe_subscription_id text,

  notas text check (notas is null or char_length(notas) <= 300),

  registrado_por uuid references auth.users(id) on delete set null,
  registrado_en  timestamptz not null default now(),

  -- Anular, no borrar: un monto mal tecleado se corrige dejando el
  -- rastro de que estuvo mal. Borrar la fila esconde el error.
  anulado_en     timestamptz,
  anulado_por    uuid references auth.users(id) on delete set null,
  anulado_motivo text
    check (anulado_motivo is null or char_length(anulado_motivo) between 1 and 300),

  -- EL CANDADO DE LA CORTESÍA: regalado es ₡0, lo diga quien lo diga.
  constraint cobros_modulo_cortesia_check
    check (not es_cortesia or monto = 0),

  -- Un cobro de plan trae plan; uno de complemento trae complemento.
  -- Sin esto entra una fila que no se puede atribuir a ningún producto
  -- y el corte «paquetes vs. complementos» deja de cuadrar.
  constraint cobros_modulo_producto_check
    check (
      (producto = 'plan_lealtad' and plan is not null)
      or (producto = 'complemento' and addon is not null)
    ),

  -- Anular exige decir por qué. Una anulación sin motivo es un agujero
  -- en el libro que nadie puede explicar seis meses después.
  constraint cobros_modulo_anulado_check
    check (anulado_en is null or anulado_motivo is not null)
);

comment on table cobros_modulo is
  'Libro de lo que entra por los MÓDULOS (paquetes de Lealtad y complementos). Una fila por cobro, en la moneda en que entró. No confundir con cobros_plataforma (0106), que es la comisión de las reservas.';
comment on column cobros_modulo.monto is
  'Lo que ENTRÓ, en la moneda de `moneda`. Nunca convertido.';
comment on column cobros_modulo.tipo_cambio is
  'Informativo: colones por dólar usados ese día. No se usa para totalizar.';
comment on column cobros_modulo.es_cortesia is
  'true = se regaló. Obliga monto = 0 por CHECK. Nunca cuenta como ingreso.';
comment on column cobros_modulo.valor_lista_usd is
  'Lo que costaba en el catálogo el día que se regaló. Sirve para saber cuánto se está regalando.';

-- La FK a la solicitud, solo si esa tabla existe (0126). Guardada en un
-- DO como hace la 0143 con `cuentas`: en una base sin la 0126 esta
-- migración tiene que correr igual, no reventar.
do $$
begin
  if to_regclass('public.solicitudes_lealtad') is null then
    raise notice 'AVISO 0172: falta solicitudes_lealtad (0126). cobros_modulo.solicitud_id queda sin llave foranea.';
    return;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'cobros_modulo_solicitud_fk'
       and conrelid = 'public.cobros_modulo'::regclass
  ) then
    alter table cobros_modulo
      add constraint cobros_modulo_solicitud_fk
      foreign key (solicitud_id) references solicitudes_lealtad(id) on delete set null;
  end if;
end $$;

-- ------------------------------------------------------------
-- ÍNDICES — dos de ellos son candados de idempotencia
-- ------------------------------------------------------------
-- La factura de Stripe se registra UNA vez. El día que el webhook
-- empiece a atender `invoice.paid`, el reintento normal de Stripe
-- intentaría anotar el mismo cobro dos veces; el índice único lo
-- resuelve en el motor y no con un «¿ya existe?» que tiene ventana
-- (misma doctrina que la 0137 y la 0143).
create unique index if not exists cobros_modulo_stripe_invoice_unq
  on cobros_modulo (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- Un depósito por solicitud: dos veces el mismo SINPE es plata que no
-- entró. Los anulados quedan fuera del índice para poder recargar la
-- fila corregida después de anular la equivocada.
create unique index if not exists cobros_modulo_solicitud_unq
  on cobros_modulo (solicitud_id)
  where solicitud_id is not null and anulado_en is null;

create index if not exists cobros_modulo_cobrado_idx
  on cobros_modulo (cobrado_en desc);
create index if not exists cobros_modulo_rancho_idx
  on cobros_modulo (rancho_id);

-- ------------------------------------------------------------
-- RLS: encendida, sin políticas, sin grants a authenticated
-- ------------------------------------------------------------
alter table cobros_modulo enable row level security;

-- Si alguna vez existió un grant (rollback a medias), se revoca: el
-- objetivo es que la tabla no exista para el navegador.
revoke all on cobros_modulo from authenticated;
revoke all on cobros_modulo from anon;
grant all on cobros_modulo to service_role;
