-- ------------------------------------------------------------
-- "Eliminar chat" de la bandeja: los mensajes por diseño no se borran
-- (migración 0034), así que eliminar una conversación es ocultarla
-- SOLO para quien la elimina — el otro participante conserva todo su
-- historial. Si después llega un mensaje nuevo, el chat reaparece en
-- la bandeja (mismo comportamiento que archivar en WhatsApp/Airbnb),
-- para que nadie pierda una consulta o una reserva por haber limpiado.
-- ------------------------------------------------------------

create table if not exists conversacion_ocultas (
  conversacion_id uuid not null references conversaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  oculta_desde timestamptz not null default now(),
  primary key (conversacion_id, usuario_id)
);

alter table conversacion_ocultas enable row level security;

drop policy if exists "Cada quien ve sus chats ocultos" on conversacion_ocultas;
create policy "Cada quien ve sus chats ocultos" on conversacion_ocultas
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "Cada quien oculta sus propios chats" on conversacion_ocultas;
create policy "Cada quien oculta sus propios chats" on conversacion_ocultas
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from conversaciones c
      where c.id = conversacion_id
        and (c.cliente_id = auth.uid() or c.proveedor_id = auth.uid())
    )
  );

drop policy if exists "Cada quien re-oculta sus propios chats" on conversacion_ocultas;
create policy "Cada quien re-oculta sus propios chats" on conversacion_ocultas
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "Cada quien des-oculta sus propios chats" on conversacion_ocultas;
create policy "Cada quien des-oculta sus propios chats" on conversacion_ocultas
  for delete to authenticated
  using (usuario_id = auth.uid());

grant select, insert, update, delete on conversacion_ocultas to authenticated;

notify pgrst, 'reload schema';
