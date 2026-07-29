-- ------------------------------------------------------------
-- 1. Las reseñas solo se pueden dejar DESPUÉS del evento.
--
-- Hasta ahora bastaba con que la reserva estuviera confirmada: se
-- podía calificar un evento que todavía no había pasado. La política
-- gana la condición de fecha (en hora de Costa Rica): la reseña se
-- habilita a partir del día siguiente al evento.
--
-- 2. El aviso de "ya podés calificar": el cron diario le escribe al
-- cliente el día después de su evento. `resena_solicitada` es la
-- bandera de una-sola-vez, mismo patrón que recordatorio_enviado.
--
-- 3. El rescate de findes: si un Lugar tiene libre un viernes, sábado
-- o domingo que está a 2-3 días, se le avisa al dueño para que pueda
-- poner un descuento y pelear esa fecha. `avisos_finde_libre` registra
-- a quién ya se le avisó de qué fecha, para no repetir el correo cada
-- día del cron.
--
-- Es seguro correr esta migración varias veces.
-- ------------------------------------------------------------

-- 1. La política de reseñas, ahora con fecha. (Mismo nombre que en
-- 0033: si quedaran las dos, la vieja seguiría dejando pasar.)
drop policy if exists "El cliente reseña su propia reserva confirmada" on resenas;
create policy "El cliente reseña su propia reserva confirmada" on resenas
  for insert to authenticated
  with check (
    cliente_id = auth.uid()
    and exists (
      select 1 from reservas r
      where r.id = reserva_id
        and r.cliente_id = auth.uid()
        and r.rancho_id = resenas.rancho_id
        and r.estado = 'confirmada'
        -- El evento ya pasó: se califica desde el día siguiente.
        and r.fecha < (now() at time zone 'America/Costa_Rica')::date
    )
  );

-- 2. La bandera del aviso post-evento.
alter table reservas add column if not exists resena_solicitada boolean not null default false;

-- Los eventos que pasaron hace más de un día ya no reciben el aviso
-- (el cron solo mira "ayer"), pero se marcan igual por prolijidad.
update reservas
set resena_solicitada = true
where estado = 'confirmada'
  and resena_solicitada = false
  and fecha < (now() at time zone 'America/Costa_Rica')::date - 1;

-- 3. El registro de findes avisados.
create table if not exists avisos_finde_libre (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references ranchos(id) on delete cascade,
  fecha date not null,
  created_at timestamptz not null default now(),
  unique (rancho_id, fecha)
);

-- Solo lo toca el cron con la llave de servicio (que desde 0052 nace
-- con permisos sobre las tablas nuevas). Sin acceso para anon ni
-- authenticated: RLS activada y sin políticas = nadie más entra.
alter table avisos_finde_libre enable row level security;

notify pgrst, 'reload schema';
