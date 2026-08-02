-- ============================================================
-- BOOKEA — Cerrar la orden al entregar (0085)
--
-- La 0075 creó `pedidos_invitacion.invitacion_id` para atar el pedido
-- con la invitación que salió de él. Nadie la llenaba nunca: el equipo
-- movía el estado a "entregado" y ahí terminaba todo. La consecuencia
-- se ve en src/app/i/[slug]/imprimir/page.tsx, que para saber si el
-- cliente compró el paquete Plus tiene que buscar CUALQUIER pedido suyo
-- con ese paquete, porque por invitacion_id no encontraría nada.
--
-- Entregar es el único momento en que se sabe de verdad qué invitación
-- corresponde a qué pedido, así que es ahí donde se sella:
--
--   `invitacion_id`  — cuál se le entregó (ya existía, ahora se llena).
--   `entregado_en`   — cuándo se cerró la orden. Es lo que permite
--                      medir cuánto tardamos entre el pago y la entrega.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table pedidos_invitacion
  add column if not exists entregado_en timestamptz;

comment on column pedidos_invitacion.entregado_en is
  'Cuándo se cerró la orden entregándole la invitación al cliente. Null = todavía no se entregó.';
comment on column pedidos_invitacion.invitacion_id is
  'La invitación que salió de este pedido. La escribe la entrega desde el panel (0085); antes quedaba siempre en null.';

-- Para poder ir de una invitación a su pedido (y para que el gate del
-- PDF se pueda apretar cuando todos los pedidos vivos estén atados).
create index if not exists pedidos_invitacion_invitacion_idx
  on pedidos_invitacion (invitacion_id)
  where invitacion_id is not null;

notify pgrst, 'reload schema';
