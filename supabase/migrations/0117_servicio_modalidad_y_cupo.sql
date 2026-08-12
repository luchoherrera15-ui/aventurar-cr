-- ============================================================
-- BOOKEA — Modalidad y cupo declarado del servicio (0117)
--
-- Primera pieza del módulo CITAS / SERVICIOS (Tanda 1.1 de
-- docs/citas-roadmap.md). Hoy un servicio de citas es una fila de
-- `rancho_items` con `duracion_minutos` (0055) y `buffer_min` (0061):
-- sabe cuánto dura y cuánto hay que limpiar después, pero no sabe si
-- es un corte de pelo para UNA persona o una clase de yoga para 20.
--
-- Esta migración le agrega esa declaración. TRES columnas, todas
-- anulables y sin backfill.
--
-- ------------------------------------------------------------
-- POR QUÉ ESTO NO TOCA A LOS LUGARES PARA ALQUILAR
-- ------------------------------------------------------------
-- `rancho_items` es la MISMA tabla de tres verticales: los paquetes y
-- productos de Eventos (un rancho, una estación de fotos, un combo de
-- DJ), los servicios de Citas y el menú de Restaurantes. Así que hay
-- que decir con precisión por qué un negocio de Eventos no se entera
-- de que esta migración existió:
--
--   1. Las tres columnas son ANULABLES y SIN DEFAULT. Ninguna fila
--      existente se reescribe: `alter table ... add column` con
--      default null no toca los datos.
--
--   2. NULL SIGNIFICA "COMO HOY". No hay ninguna lectura nueva que
--      cambie de comportamiento cuando la columna está en null, porque
--      el único que las lee es el panel de Citas.
--
--   3. El formulario que las edita vive dentro del bloque `esCitas`
--      del panel de catálogo (`vertical === 'citas'`), el mismo que ya
--      decide si se pregunta la duración en minutos o las horas que
--      incluye el paquete. Un negocio de Eventos no ve los campos y
--      no los escribe.
--
--   4. NINGÚN motor las lee todavía. Ver el límite declarado abajo.
--
-- No se agregan políticas: `rancho_items` ya tiene su RLS desde la
-- 0035 ("Catálogo visible para todos" + "Dueño administra su
-- catálogo") y las columnas nuevas quedan cubiertas por las de la
-- tabla. Esta migración no crea, borra ni modifica ninguna política.
--
-- ------------------------------------------------------------
-- POR QUÉ LA "MODALIDAD" DE LA SPEC SE PARTE EN DOS
-- ------------------------------------------------------------
-- La especificación lista bajo un solo título "Modalidad":
--
--     Individual · Grupal · Por recurso · Online · Presencial · Híbrido
--
-- Son DOS preguntas distintas metidas en una lista, y mezclarlas en
-- una columna hace imposible expresar la mitad de los casos reales:
-- una clase de yoga por Zoom es grupal Y online, y con una sola
-- columna habría que elegir cuál de las dos cosas es.
--
--   `modalidad`       — LA FORMA DE LA CAPACIDAD. Cuánta gente entra
--                       en una sesión y qué la ocupa.
--   `lugar_servicio`  — DÓNDE SE PRESTA. Presencial, online o híbrido.
--
-- Las dos son ortogonales y se combinan libremente.
--
-- ------------------------------------------------------------
-- LOS CUATRO NÚMEROS DE CAPACIDAD QUE AHORA CONVIVEN
-- ------------------------------------------------------------
-- Se parecen y NO son lo mismo. Igual que en la 0109, se escribe la
-- diferencia acá para que nadie los mezcle después:
--
--   `min_por_reserva` /  (0050) UNIDADES DEL ÍTEM EN UN PEDIDO.
--   `max_por_reserva`    "mínimo 10 sillas, máximo 200". Es de
--                        Eventos. ESTA MIGRACIÓN NO LA TOCA.
--
--   `capacidad_dia`      (0050) CUÁNTAS VECES SE VENDE POR DÍA.
--                        "solo 3 estaciones de fotos por día".
--                        ESTA MIGRACIÓN NO LA TOCA.
--
--   `equipo_rancho.      (0076) PERSONAS QUE CABEN EN EL RECURSO.
--    capacidad`          Una mesa para 6. Es del recurso, no del
--                        servicio. ESTA MIGRACIÓN NO LA TOCA.
--
--   `equipo_rancho.      (0109) RESERVAS QUE CABEN A LA VEZ en el
--    cupo_simultaneo`    recurso. Dos sillas en la misma estación = 2.
--                        ESTA MIGRACIÓN NO LA TOCA.
--
--   `cupo_min_sesion` /  (acá) PERSONAS EN UNA SESIÓN DEL SERVICIO.
--   `cupo_max_sesion`    Yoga para 20, con mínimo 4 para que la clase
--                        se dé. Cuelga del SERVICIO, no del recurso.
--
-- Por eso el nombre lleva `_sesion` y no es un `capacidad` a secas:
-- el sufijo es el que evita que dentro de seis meses alguien lo
-- confunda con la capacidad del recurso.
--
-- ------------------------------------------------------------
-- LÍMITE DECLARADO — ESTO DECLARA, NO HACE CUMPLIR
-- ------------------------------------------------------------
-- `cupo_max_sesion` es un DATO del servicio. En esta migración NINGÚN
-- motor lo lee: ni `crear_cita_motor_pro` (0081), ni el trigger de
-- solapamiento, ni `src/lib/agenda/disponibilidad.ts`. Poner 20 en un
-- servicio de yoga hoy NO hace que entren 20 reservas a la misma hora
-- — el motor sigue tratando cada cita como exclusiva del recurso.
--
-- Eso es a propósito y no es un descuido. Hacerlo cumplir requiere la
-- OCURRENCIA de clase (varias reservas apuntando a la MISMA sesión,
-- con sus participantes), que es la Tanda 3 del roadmap y la deuda que
-- la 0109 ya había declarado. Sin ocurrencia, un número de capacidad
-- en el motor solo produce el bug que la 0109 describe: dos clases
-- distintas a la misma hora entrando en la misma sala.
--
-- El panel dice esto mismo en su ayuda, para que el dueño no crea que
-- ya activó algo que todavía no existe.
-- ============================================================

-- 1) Modalidad: la forma de la capacidad ---------------------------
alter table rancho_items add column if not exists modalidad text;

alter table rancho_items drop constraint if exists rancho_items_modalidad_check;
alter table rancho_items add constraint rancho_items_modalidad_check
  check (modalidad is null or modalidad in ('individual', 'grupal', 'recurso'));

comment on column rancho_items.modalidad is
  'Forma de la capacidad del servicio (0117): individual = 1 cliente por '
  'sesión; grupal = varios clientes en la misma sesión (usa cupo_*_sesion); '
  'recurso = la reserva ocupa un recurso por un bloque (cancha, sala). '
  'null = sin declarar; se comporta como individual. Solo lo usa Citas.';

-- 2) Lugar: dónde se presta ----------------------------------------
alter table rancho_items add column if not exists lugar_servicio text;

alter table rancho_items drop constraint if exists rancho_items_lugar_servicio_check;
alter table rancho_items add constraint rancho_items_lugar_servicio_check
  check (lugar_servicio is null
         or lugar_servicio in ('presencial', 'online', 'hibrido'));

comment on column rancho_items.lugar_servicio is
  'Dónde se presta el servicio (0117): presencial, online o hibrido. '
  'Ortogonal a modalidad — una clase grupal puede ser online. '
  'null = sin declarar; se comporta como presencial. Solo lo usa Citas.';

-- 3) Cupo de personas por sesión -----------------------------------
alter table rancho_items add column if not exists cupo_min_sesion integer;
alter table rancho_items add column if not exists cupo_max_sesion integer;

-- Un solo constraint para las dos columnas: así el caso "mínimo mayor
-- que el máximo" queda imposible en la base, no solo en TypeScript.
-- El tope de 999 es el mismo orden de magnitud que el resto del
-- esquema (cantidad en reserva_items va hasta 999).
alter table rancho_items drop constraint if exists rancho_items_cupo_sesion_check;
alter table rancho_items add constraint rancho_items_cupo_sesion_check
  check (
    (cupo_min_sesion is null or cupo_min_sesion between 1 and 999)
    and (cupo_max_sesion is null or cupo_max_sesion between 1 and 999)
    and (
      cupo_min_sesion is null
      or cupo_max_sesion is null
      or cupo_max_sesion >= cupo_min_sesion
    )
  );

comment on column rancho_items.cupo_min_sesion is
  'Personas mínimas para que la sesión se realice (0117). Yoga que no '
  'se abre con menos de 4. null = sin mínimo. NO es min_por_reserva '
  '(unidades de un pedido de Eventos). Ningún motor lo lee todavía.';

comment on column rancho_items.cupo_max_sesion is
  'Personas máximas en UNA sesión del servicio (0117). Yoga para 20. '
  'NO es equipo_rancho.capacidad (personas que caben en el recurso) ni '
  'cupo_simultaneo (reservas a la vez). LÍMITE DECLARADO: ningún motor '
  'lo hace cumplir todavía; eso llega con la ocurrencia de clase.';
