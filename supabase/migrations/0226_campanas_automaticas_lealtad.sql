-- ============================================================
--  CAMPAÑAS AUTOMÁTICAS DE LEALTAD — 1 sep 2026
-- ============================================================
--
-- Pedido del dueño: «en marketing necesito marcar días para hacer
-- campañas automáticas, campañas de notificaciones a los usuarios».
--
-- El negocio marca un DÍA DE LA SEMANA («los miércoles»), escribe el
-- aviso una vez, y a partir de ahí sale solo todas las semanas. Es la
-- diferencia entre acordarse cada miércoles y no tener que acordarse.
--
-- ------------------------------------------------------------
-- POR QUÉ NO SE REUSA `campanas_negocio` (0094)
-- ------------------------------------------------------------
-- Aquella es una BITÁCORA de correos ya enviados a la lista de un
-- negocio de Citas: guarda asunto, cuerpo y conteos de un envío que ya
-- pasó. Esto es lo contrario — una REGLA que todavía no pasó y que se
-- repite. Meterlas en la misma tabla obligaría a que la mitad de las
-- columnas fueran nulas en cada fila y a que todo lector se pregunte
-- «¿esta fila es algo que ocurrió o algo que va a ocurrir?».
--
-- ------------------------------------------------------------
-- EL CUPO NO SE TOCA ACÁ, Y ES A PROPÓSITO
-- ------------------------------------------------------------
-- Los envíos siguen contra `notificaciones_promocionales` (0183) con el
-- tope por paquete (Prueba 1 · Starter 2 · Impulso 15 · Ilimitado sin
-- tope). Una campaña automática NO es un permiso para saltarse eso:
-- cuando el cupo del mes se acaba, el envío se salta y queda anotado
-- como salteado. Un cupo aparte para lo automático habría vaciado de
-- sentido el tope del paquete.

-- ------------------------------------------------------------
-- 1. La regla: qué se manda y qué día
-- ------------------------------------------------------------
create table if not exists public.campanas_lealtad (
  id uuid primary key default gen_random_uuid(),
  rancho_id uuid not null references public.ranchos (id) on delete cascade,
  -- A qué tarjeta le pertenece: el envío va a los pases de ESE programa.
  programa_id uuid not null references public.programa_lealtad (id) on delete cascade,

  -- 0 = domingo … 6 = sábado. Mismo criterio que `Date.getDay()` de JS,
  -- que es quien lo va a comparar: traducir entre dos numeraciones es
  -- exactamente el tipo de detalle que se equivoca una vez y manda la
  -- promo del miércoles un martes.
  dia_semana smallint not null check (dia_semana between 0 and 6),

  -- La hora de Costa Rica a la que sale (0–23). Sin minutos: el barrido
  -- corre cada hora en punto, así que prometer 17:30 sería prometer una
  -- precisión que no existe.
  hora smallint not null default 9 check (hora between 0 and 23),

  -- Lo que se ve EN LA GRILLA del panel («2×1», «5-7»). Corto porque
  -- entra en un cuadrito de calendario, no en una tarjeta.
  etiqueta text not null check (char_length(etiqueta) between 1 and 12),
  -- El aviso que le llega al cliente al teléfono. El tope es el mismo
  -- que ya exige `enviarNotificacionPromocional` para el reverso del
  -- pase de Apple, que tiene ancho fijo.
  mensaje text not null check (char_length(mensaje) between 3 and 180),

  -- Apagarla sin borrarla: el negocio prueba una semana, la pausa, la
  -- vuelve a prender. Borrar y reescribir el mensaje cada vez sería
  -- perder el texto que ya le funcionaba.
  activa boolean not null default true,

  creado_por uuid references auth.users (id) on delete set null,
  creado_en timestamptz not null default now()
);

comment on table public.campanas_lealtad is
  'Campañas de notificación que se repiten SEMANALMENTE por día de la semana. La regla, no el envío: los envíos van en campanas_lealtad_envios.';
comment on column public.campanas_lealtad.dia_semana is
  '0=domingo … 6=sábado, igual que Date.getDay() en JS.';
comment on column public.campanas_lealtad.hora is
  'Hora de Costa Rica (0-23) a la que sale. Sin minutos: el barrido es horario.';

-- Un negocio no repite el mismo día dos veces con la misma tarjeta: dos
-- avisos el mismo miércoles a la misma gente es spam, y además haría
-- imposible dibujar la grilla (¿cuál de los dos se pinta?).
create unique index if not exists campanas_lealtad_dia_uidx
  on public.campanas_lealtad (programa_id, dia_semana);

-- La consulta del barrido: «¿qué campañas activas salen hoy a esta hora?».
create index if not exists campanas_lealtad_barrido_idx
  on public.campanas_lealtad (dia_semana, hora)
  where activa;

create index if not exists campanas_lealtad_rancho_idx
  on public.campanas_lealtad (rancho_id);

-- ------------------------------------------------------------
-- 2. Qué pasó cada vez que le tocó salir
-- ------------------------------------------------------------
--
-- ⚠️ ESTA TABLA ES EL SEGURO CONTRA EL ENVÍO DOBLE.
--
-- La PK es (campana_id, dia): el barrido INSERTA PRIMERO y solo manda si
-- el insert entró. Si el cron corre dos veces —GitHub Actions reintenta,
-- alguien lo dispara a mano, dos regiones a la vez— el segundo choca
-- contra la PK y no manda nada. Un contador o un `ultimo_envio` que se
-- lee y después se escribe deja pasar los dos: entre la lectura y la
-- escritura está el envío entero, que son segundos reales.
create table if not exists public.campanas_lealtad_envios (
  campana_id uuid not null references public.campanas_lealtad (id) on delete cascade,
  -- El DÍA de Costa Rica al que corresponde el envío, no el instante.
  dia date not null,
  -- 'enviado' | 'sin_cupo' | 'error'. Se anotan los tres: una campaña
  -- que no salió por falta de cupo tiene que poder explicarse en el
  -- panel, y «no hay fila» no distingue «no le tocaba» de «falló».
  estado text not null check (estado in ('enviado', 'sin_cupo', 'error')),
  detalle text,
  creado_en timestamptz not null default now(),
  primary key (campana_id, dia)
);

comment on table public.campanas_lealtad_envios is
  'Un renglón por campaña y día. La PK (campana_id, dia) es lo que impide el envío doble: se inserta ANTES de mandar.';

create index if not exists campanas_lealtad_envios_dia_idx
  on public.campanas_lealtad_envios (dia desc);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------
alter table public.campanas_lealtad enable row level security;
alter table public.campanas_lealtad_envios enable row level security;

-- El dueño LEE las suyas. Escribir va por server action con la llave de
-- servicio (que ya verifica tenencia con `accesoDeNegocio`): así el
-- CHECK del cupo y el de la tenencia viven en un solo lugar y no hay
-- dos reglas que se puedan separar.
drop policy if exists "El dueño ve sus campañas de lealtad" on public.campanas_lealtad;
create policy "El dueño ve sus campañas de lealtad" on public.campanas_lealtad
  for select to authenticated
  using (
    is_admin()
    or rancho_id in (select id from public.ranchos where owner_id = auth.uid())
  );

drop policy if exists "El dueño ve los envíos de sus campañas" on public.campanas_lealtad_envios;
create policy "El dueño ve los envíos de sus campañas" on public.campanas_lealtad_envios
  for select to authenticated
  using (
    is_admin()
    or campana_id in (
      select c.id
      from public.campanas_lealtad c
      join public.ranchos r on r.id = c.rancho_id
      where r.owner_id = auth.uid()
    )
  );

grant select on public.campanas_lealtad to authenticated;
grant select on public.campanas_lealtad_envios to authenticated;
grant all on public.campanas_lealtad to service_role;
grant all on public.campanas_lealtad_envios to service_role;

notify pgrst, 'reload schema';
