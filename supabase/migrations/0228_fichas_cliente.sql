-- ============================================================
--  FICHAS DE CLIENTE: la memoria del CRM — 1 sep 2026
-- ============================================================
--
-- Primera pieza de la transformación de Bookea en un CRM operativo.
--
-- ------------------------------------------------------------
-- QUÉ RESUELVE
-- ------------------------------------------------------------
-- El CRM de clientes se DERIVA de las reservas (decisión D-3 de
-- docs/bookea-business-architecture.md): la ficha se calcula con
-- `agruparClientes()` y no vive en ninguna tabla. Eso está bien para
-- los números —visitas, gasto, no-shows salen solos y nunca se
-- desincronizan— pero deja al negocio sin memoria PROPIA: no hay
-- dónde anotar «alérgica al amoníaco», «prefiere a Karla» o marcarlo
-- VIP. Un CRM sin notas es una lista de asistencia.
--
-- Esta tabla guarda EXACTAMENTE lo que no se puede derivar: lo que el
-- negocio sabe del cliente y el sistema no. Nada más — los números
-- siguen derivándose, porque una copia guardada de «total de visitas»
-- miente a la primera cancelación.
--
-- ------------------------------------------------------------
-- LA LLAVE ES LA MISMA DEL CRM DERIVADO
-- ------------------------------------------------------------
-- `clave` es la llave de identidad que ya calcula `claveCliente()`
-- (src/lib/crm-citas.ts): `cuenta:<id>` → `correo:<mail>` →
-- `tel:<8 dígitos>` → `nombre:<nombre>`, en ese orden de confianza.
--
-- Se usa esa y no un uuid nuevo porque la ficha tiene que ENCONTRARSE
-- desde una reserva sin tabla de cruce: la reserva deriva su clave y
-- con ella cae acá. El costo conocido: si el cliente cambia de correo,
-- la clave cambia y las notas quedan en la ficha vieja — el mismo
-- costo que ya tiene todo el CRM derivado, no uno nuevo.
--
-- ------------------------------------------------------------
-- QUÉ NO HACE, A PROPÓSITO
-- ------------------------------------------------------------
-- NO toca lealtad. La relación cliente↔lealtad se LEE cruzando el
-- contacto contra `personas_negocio` del mismo negocio, en el
-- servidor, al abrir la ficha. Escribir acá un `persona_id` sería
-- duplicar una identidad que ya tiene dueño (0138) — y los usuarios de
-- lealtad no se tocan.

create table if not exists public.fichas_cliente (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references public.ranchos (id) on delete cascade,
  -- La llave derivada del CRM (`claveCliente()`), p. ej. `correo:ana@x.com`.
  clave text not null check (char_length(clave) between 3 and 200),
  -- Lo que el negocio anota. 2000 alcanza para una ficha de verdad y
  -- corta el abuso de guardar novelas en una columna de texto.
  notas text not null default '' check (char_length(notas) <= 2000),
  -- Etiquetas libres («vip», «no confirma», «color 7.1»). Texto y no un
  -- catálogo: cada negocio etiqueta con su propio vocabulario, y un
  -- catálogo global sería el vocabulario de nadie.
  etiquetas text[] not null default '{}' check (array_length(etiquetas, 1) is null or array_length(etiquetas, 1) <= 12),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

comment on table public.fichas_cliente is
  'Lo que el negocio sabe de un cliente y el sistema no puede derivar: notas y etiquetas. Los números (visitas, gasto) se siguen derivando de reservas — ver crm-citas.ts.';

-- Una ficha por cliente por negocio: la escritura es un upsert.
create unique index if not exists fichas_cliente_uidx
  on public.fichas_cliente (rancho_id, clave);

alter table public.fichas_cliente enable row level security;

-- El dueño LEE las suyas; escribir va por server action con la llave de
-- servicio, que ya pasó por `verificarAccesoRancho`. Mismo reparto que
-- campanas_negocio (0094): una sola puerta de escritura, auditable.
drop policy if exists "El dueño ve sus fichas de cliente" on public.fichas_cliente;
create policy "El dueño ve sus fichas de cliente" on public.fichas_cliente
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from public.ranchos where owner_id = auth.uid())
  );

grant select on public.fichas_cliente to authenticated;
grant all on public.fichas_cliente to service_role;

notify pgrst, 'reload schema';
