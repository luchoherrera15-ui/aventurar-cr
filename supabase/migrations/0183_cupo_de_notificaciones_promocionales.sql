
-- ============================================================
-- BOOKEA — el cupo de notificaciones promocionales, contado de
-- verdad (0183)
--
-- Hasta hoy enviarNotificacionPromocional (marketing-actions.ts) manda
-- el mensaje promocional a Apple/Google SIN NINGÚN LÍMITE, igual para
-- los cuatro paquetes. Esta tabla es el registro de cada envío real,
-- para poder contestar "¿cuántos van este mes?" antes de mandar el
-- siguiente.
--
-- ------------------------------------------------------------
-- POR QUÉ rancho_id Y NO programa_id
-- ------------------------------------------------------------
-- `clientesActivos` de este mismo catálogo ya vivió este error:
-- contado por programa_id, cada tarjeta nueva regalaba un cupo entero
-- (ver el comentario de cabecera de LimitesPlan.clientesActivos en
-- src/lib/lealtad/planes.ts, y src/lib/lealtad/cupo.ts). Un negocio de
-- Impulso con 5 tarjetas mandaría 5×20=100 mensajes si se contara por
-- programa_id, no 20. El cupo es del NEGOCIO: todas sus tarjetas
-- comparten el mismo cupo mensual, y por eso la única columna que
-- cuenta es rancho_id.
--
-- `programa_id` se guarda igual, pero SOLO como trazabilidad (qué
-- tarjeta disparó el envío) — ninguna consulta de cupo la agrupa por
-- ahí. `on delete set null`: archivar o borrar la tarjeta no borra el
-- historial de cupo gastado del negocio.
--
-- ------------------------------------------------------------
-- QUIÉN ESCRIBE ACÁ
-- ------------------------------------------------------------
-- Un solo camino: enviarNotificacionPromocional (marketing-actions.ts),
-- que corre con createAdminClient() (service_role, bypassa RLS). No hay
-- política de insert para `authenticated` a propósito: un negocio que
-- pudiera insertar acá directo se regalaría cupo a sí mismo escribiendo
-- filas con enviado_en en el pasado.
--
-- PENDIENTE DE PEGAR — el dueño la aplica a mano en el SQL Editor.
-- ============================================================

create table if not exists notificaciones_promocionales (
  id uuid primary key default gen_random_uuid(),

  -- POR NEGOCIO, no por tarjeta — ver la cabecera.
  rancho_id uuid not null references ranchos(id) on delete cascade,

  -- Solo trazabilidad. NUNCA se agrupa por acá.
  programa_id uuid references programa_lealtad(id) on delete set null,

  enviado_en timestamptz not null default now()
);

comment on table notificaciones_promocionales is
  'Un envío real de notificación promocional (enviarNotificacionPromocional). El cupo se cuenta por rancho_id, nunca por programa_id — ver cabecera de la migración 0183.';
comment on column notificaciones_promocionales.programa_id is
  'Trazabilidad de qué tarjeta disparó el envío. NO se usa para contar el cupo — el cupo es del negocio (rancho_id).';

-- La pregunta que se hace en cada envío: "¿cuántos van este mes
-- calendario?" — rancho_id igualdad + enviado_en en rango.
create index if not exists notificaciones_promocionales_rancho_mes_idx
  on notificaciones_promocionales (rancho_id, enviado_en desc);

alter table notificaciones_promocionales enable row level security;

drop policy if exists "Ver el cupo gastado del propio negocio" on notificaciones_promocionales;
create policy "Ver el cupo gastado del propio negocio" on notificaciones_promocionales
  for select to authenticated
  using (gestiona_rancho(rancho_id) or is_admin());

-- A propósito NO hay política de insert/update/delete para
-- `authenticated`: ver la nota de cabecera. El service_role no necesita
-- política (bypassa RLS), pero igual se le da el grant explícito por
-- consistencia con el resto del módulo.

grant select on notificaciones_promocionales to authenticated;
grant all on notificaciones_promocionales to service_role;

-- ------------------------------------------------------------
-- RESERVAR UN ENVÍO, DE VERDAD ATÓMICO
-- ------------------------------------------------------------
-- Contar en una consulta y recién insertar después de mandar el mensaje
-- (que tarda segundos reales: Apple + un Google por miembro) deja una
-- ventana abierta: dos pedidos casi simultáneos —dos pestañas, dos
-- personas del equipo— pueden pasar el chequeo de cupo los dos, porque
-- ninguno terminó de anotarse todavía. `pg_advisory_xact_lock` serializa
-- los intentos del MISMO negocio (otros negocios no se esperan entre
-- sí) durante la transacción, así que el segundo intento ve el conteo
-- ya actualizado por el primero antes de decidir.
--
-- Se reserva la fila ANTES de mandar el mensaje, no después: si el
-- envío falla (Apple/Google caídos), quien llama borra esa fila
-- (`liberarCupoNotificacion`) para no cobrarle cupo a un mensaje que
-- nunca llegó a ningún lado — mismo criterio que ya tenía el código
-- viejo, solo que ahora el chequeo+reserva es una sola operación
-- indivisible en vez de dos separadas por el envío entero.
create or replace function notificacion_promocional_reservar(
  p_rancho_id uuid,
  p_programa_id uuid,
  p_limite int,
  p_desde timestamptz
)
returns table (reservado boolean, id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usados int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_rancho_id::text));

  select count(*) into v_usados
    from public.notificaciones_promocionales n
   where n.rancho_id = p_rancho_id
     and n.enviado_en >= p_desde;

  if v_usados >= p_limite then
    return query select false, null::uuid;
    return;
  end if;

  insert into public.notificaciones_promocionales (rancho_id, programa_id)
  values (p_rancho_id, p_programa_id)
  returning notificaciones_promocionales.id into v_id;

  return query select true, v_id;
end;
$$;

-- Mismo criterio que la tabla: SOLO service_role. `authenticated` no
-- tiene ninguna razón para reservar cupo directo — siempre pasa por
-- `enviarNotificacionPromocional`, que ya corre con la llave de
-- servicio.
revoke all on function notificacion_promocional_reservar(uuid, uuid, int, timestamptz) from public, anon, authenticated;
grant execute on function notificacion_promocional_reservar(uuid, uuid, int, timestamptz) to service_role;
