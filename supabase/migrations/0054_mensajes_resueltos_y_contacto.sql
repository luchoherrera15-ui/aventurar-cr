-- ------------------------------------------------------------
-- 1. Identidad en el chat: hoy, si alguien escribe una consulta
-- directa (sin reserva) y no puso su nombre en el perfil, el otro
-- lado ve "Cliente interesado" sin ninguna pista de quién es — porque
-- la política de `perfiles` ("Cada quien ve su propio perfil", 0008)
-- solo deja ver el perfil propio, y eso bloquea la búsqueda cruzada
-- aunque las dos personas ya estén chateando. La vista
-- `conversaciones_contacto` resuelve esto SIN tocar esa política:
-- para cada conversación en la que participás, expone el nombre (o el
-- correo, si no puso nombre) de la OTRA persona — nunca de alguien
-- con quien no compartís un hilo. Como toda vista de este proyecto
-- (disponibilidad_rancho, disponibilidad_items), corre con los
-- permisos de quien la crea, así que puede leer `perfiles` sin que
-- eso abra esa tabla a nadie más.
--
-- 2. "Dar por resuelto": un estado único por conversación (no por
-- persona) — si cualquiera de los dos la marca resuelta, se archiva
-- para ambos, y vuelve a "Activas" sola en cuanto llega un mensaje
-- nuevo de cualquier lado (nadie se queda con un hilo "cerrado" que en
-- realidad sigue vivo).
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

create or replace view conversaciones_contacto as
select
  c.id as conversacion_id,
  coalesce(nullif(trim(p.nombre), ''), p.email) as nombre_contacto
from conversaciones c
join perfiles p
  on p.id = case when c.cliente_id = auth.uid() then c.proveedor_id else c.cliente_id end
where c.cliente_id = auth.uid() or c.proveedor_id = auth.uid();

grant select on conversaciones_contacto to authenticated;

-- ------------------------------------------------------------

alter table conversaciones add column if not exists resuelta boolean not null default false;

-- Participantes pueden marcar/reabrir su conversación — pero SOLO esa
-- columna: sin esto, "marcarla resuelta" podría venir disfrazando un
-- cambio de a quién pertenece el hilo (reserva_id, cliente_id...).
-- Mismo patrón defensivo que rancho_bloquear_estado_no_admin (0008).
create or replace function public.conversacion_congelar_columnas()
returns trigger
language plpgsql
as $$
begin
  new.reserva_id := old.reserva_id;
  new.rancho_id := old.rancho_id;
  new.cliente_id := old.cliente_id;
  new.proveedor_id := old.proveedor_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists conversacion_congelar_antes_de_actualizar on conversaciones;
create trigger conversacion_congelar_antes_de_actualizar
  before update on conversaciones
  for each row execute function conversacion_congelar_columnas();

drop policy if exists "Participantes marcan su conversación resuelta" on conversaciones;
create policy "Participantes marcan su conversación resuelta" on conversaciones
  for update to authenticated
  using (cliente_id = auth.uid() or proveedor_id = auth.uid())
  with check (cliente_id = auth.uid() or proveedor_id = auth.uid());

grant update on conversaciones to authenticated;

-- Un mensaje nuevo reabre el hilo para los dos.
create or replace function public.conversacion_reabrir_al_escribir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversaciones set resuelta = false
  where id = new.conversacion_id and resuelta = true;
  return new;
end;
$$;

drop trigger if exists mensaje_reabre_conversacion on mensajes;
create trigger mensaje_reabre_conversacion
  after insert on mensajes
  for each row execute function conversacion_reabrir_al_escribir();

notify pgrst, 'reload schema';
