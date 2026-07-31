-- ============================================================
-- BOOKEA — Pedidos de invitaciones digitales (0075)
--
-- El cliente elige un paquete en /invitaciones, llena los datos de su
-- fiesta y paga (SINPE, transferencia o tarjeta). Cada pedido guarda
-- todo lo que el equipo necesita para diseñar la invitación.
--
-- Flujo del estado:
--   pendiente_pago → en_revision (subió comprobante) → pagado
--   → en_diseno → entregado
--
-- RLS: cada quien ve y crea SOLO sus pedidos. El panel admin los lee
-- con la service key, como el resto del back office.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

create table if not exists pedidos_invitacion (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references auth.users(id) on delete cascade,

  -- Qué compró
  paquete text not null,
  precio_usd numeric(8, 2),
  precio_crc integer,

  -- Los datos de la fiesta (lo que el diseñador necesita)
  tipo_evento text not null,
  nombre_evento text not null,
  anfitriones text,
  fecha_evento date not null,
  hora text,
  lugar_nombre text,
  lugar_direccion text,
  maps_url text,
  tematica text,
  colores text,
  cantidad_invitados int,
  fecha_limite_confirmacion date,
  mensaje text,
  idioma text not null default 'es',

  -- Con quién hablamos
  contacto_nombre text not null,
  contacto_whatsapp text,
  contacto_correo text not null,

  -- Cómo pagó
  metodo_pago text check (metodo_pago is null or metodo_pago in ('stripe', 'sinpe', 'transferencia')),
  referencia_pago text,
  comprobante_url text,
  estado text not null default 'pendiente_pago'
    check (estado in ('pendiente_pago', 'en_revision', 'pagado', 'en_diseno', 'entregado', 'cancelado')),

  -- La invitación que salió de este pedido (se llena al entregar)
  invitacion_id uuid references invitaciones(id) on delete set null,

  created_at timestamptz not null default now()
);

create index if not exists pedidos_invitacion_cliente_idx
  on pedidos_invitacion (cliente_id, created_at desc);
create index if not exists pedidos_invitacion_estado_idx
  on pedidos_invitacion (estado, created_at desc);

alter table pedidos_invitacion enable row level security;

-- Cada cliente ve solo lo suyo.
drop policy if exists "El cliente ve sus pedidos" on pedidos_invitacion;
create policy "El cliente ve sus pedidos" on pedidos_invitacion
  for select to authenticated
  using (cliente_id = auth.uid());

-- Y solo puede crear pedidos a su propio nombre.
drop policy if exists "El cliente crea sus pedidos" on pedidos_invitacion;
create policy "El cliente crea sus pedidos" on pedidos_invitacion
  for insert to authenticated
  with check (cliente_id = auth.uid());

-- Puede adjuntar su comprobante mientras el pedido siga abierto; una
-- vez pagado o entregado, solo el equipo (service key) lo toca.
drop policy if exists "El cliente adjunta su comprobante" on pedidos_invitacion;
create policy "El cliente adjunta su comprobante" on pedidos_invitacion
  for update to authenticated
  using (cliente_id = auth.uid() and estado in ('pendiente_pago', 'en_revision'))
  with check (cliente_id = auth.uid() and estado in ('pendiente_pago', 'en_revision'));

grant select, insert, update on pedidos_invitacion to authenticated;
