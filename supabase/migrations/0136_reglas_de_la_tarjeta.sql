-- ============================================================
-- BOOKEA — Las reglas de una tarjeta (0136)
--
-- Cuándo vale una tarjeta y cuántas veces se puede usar. Son las
-- reglas que el asistente de creación ya pregunta y que hasta ahora no
-- tenían dónde guardarse.
--
-- ------------------------------------------------------------
-- ESTO VA EN COLUMNAS, NO EN jsonb
-- ------------------------------------------------------------
-- La 0135 puso la configuración del beneficio en un `jsonb` porque es
-- distinta en cada uno de los ocho tipos y solo la lee la pantalla que
-- la dibuja.
--
-- Estas son lo contrario: son IGUALES para los ocho, y las lee el
-- motor que decide si un canje procede. Una regla que autoriza o
-- rechaza no puede vivir en un campo de texto que nadie valida — el
-- día que alguien escriba `{"maxGlobal": "diez"}` el tope deja de
-- existir y nadie se entera hasta que se regalaron mil cupones.
--
-- Con CHECK, la base rechaza el disparate en el momento.
--
-- ------------------------------------------------------------
-- «PROGRAMADA» Y «VENCIDA» NO SE GUARDAN
-- ------------------------------------------------------------
-- Se DERIVAN de estas fechas (src/lib/lealtad/programas.ts). Guardarlas
-- como estado obligaría a un proceso que recorra la base cada
-- medianoche cambiando filas, y el día que ese proceso no corra una
-- promoción vencida seguiría figurando activa y el mostrador la
-- canjearía. Derivándolas, una tarjeta vence sola en el instante
-- exacto, sin que nada tenga que despertarse.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- ── Vigencia ────────────────────────────────────────────────────
-- `date` y no `timestamptz`: el negocio piensa en días («del 1 al 31
-- de setiembre»), no en instantes con zona horaria. Guardar un
-- timestamp obligaría a elegir una hora que nadie pidió, y en UTC el
-- día se corre seis horas — una promo del 1 arrancaría el 31 a las 6
-- de la tarde.
alter table programa_lealtad add column if not exists vigente_desde date;
alter table programa_lealtad add column if not exists vigente_hasta date;

-- Una tarjeta que vence antes de empezar nace muerta, y el dueño no
-- entendería por qué no se puede canjear.
alter table programa_lealtad drop constraint if exists programa_lealtad_vigencia_check;
alter table programa_lealtad add constraint programa_lealtad_vigencia_check
  check (vigente_desde is null or vigente_hasta is null or vigente_hasta >= vigente_desde);

-- ── Cuántas veces ───────────────────────────────────────────────
alter table programa_lealtad add column if not exists uso_unico boolean not null default false;
alter table programa_lealtad add column if not exists max_por_cliente integer;
alter table programa_lealtad add column if not exists max_global integer;

alter table programa_lealtad drop constraint if exists programa_lealtad_topes_check;
alter table programa_lealtad add constraint programa_lealtad_topes_check
  check (
    (max_por_cliente is null or max_por_cliente between 1 and 100000)
    and (max_global is null or max_global between 1 and 10000000)
  );

-- ── Cuándo ──────────────────────────────────────────────────────
-- Días de la semana permitidos, 0 = domingo. Array vacío = todos los
-- días, que es lo que hace falta para «de lunes a jueves» sin inventar
-- una tabla aparte para siete valores.
alter table programa_lealtad add column if not exists dias_permitidos smallint[] not null default '{}';

alter table programa_lealtad drop constraint if exists programa_lealtad_dias_check;
alter table programa_lealtad add constraint programa_lealtad_dias_check
  check (
    dias_permitidos <@ array[0,1,2,3,4,5,6]::smallint[]
    and array_length(dias_permitidos, 1) is null
    or array_length(dias_permitidos, 1) <= 7
  );

alter table programa_lealtad add column if not exists hora_desde time;
alter table programa_lealtad add column if not exists hora_hasta time;

comment on column programa_lealtad.vigente_desde is
  'Desde qué DÍA vale (0136). null = desde siempre. Los estados '
  '«programada» y «vencida» se derivan de estas fechas, no se '
  'guardan: ver src/lib/lealtad/programas.ts.';

comment on column programa_lealtad.dias_permitidos is
  'Días de la semana en que se puede canjear (0136). 0 = domingo. '
  'Array vacío = todos los días. Con hora_desde/hora_hasta cubre el '
  'caso «30% de descuento de lunes a jueves».';
