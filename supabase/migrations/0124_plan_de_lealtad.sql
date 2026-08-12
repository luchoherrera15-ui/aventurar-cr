
-- ============================================================
-- BOOKEA — El plan de la plataforma de lealtad (0124)
--
-- UNA columna en `ranchos`. Anulable: null = sin plan contratado, que
-- es como está hoy todo negocio existente.
--
-- ------------------------------------------------------------
-- POR QUÉ UNA COLUMNA Y NO UNA TABLA DE PLANES
-- ------------------------------------------------------------
-- Los planes son producto de BOOKEA, no configuración del negocio:
-- "Básico" incluye lo mismo para todos los clientes. Una tabla
-- `planes` con sus límites editables sugiere que cada negocio puede
-- tener su propia definición de Básico, que es justo lo que no
-- queremos — y abre la puerta a que alguien edite el límite de
-- miembros de un plan y se lo cambie a cien negocios sin querer.
--
-- La definición vive en `src/lib/lealtad/planes.ts`, donde se puede
-- leer, versionar y TESTEAR. La base solo guarda cuál le tocó a cada
-- quien.
--
-- ------------------------------------------------------------
-- CÓMO CONVIVE CON `addons_negocio`
-- ------------------------------------------------------------
-- Son dos cosas distintas y hay que no mezclarlas:
--
--   `plan_lealtad`      QUÉ CONTRATÓ. Define capacidades y límites de
--                       toda la plataforma de lealtad de una vez.
--
--   `addons_negocio`    EXCEPCIONES Y COMPLEMENTOS SUELTOS. Sigue
--                       gobernando `agenda_ia` y `asistente_ia`, que
--                       no son de lealtad; y sirve de REGALO puntual:
--                       darle el aviso por cercanía a un cliente de
--                       plan Básico sin subirle el plan.
--
-- O sea: la capacidad está si EL PLAN la trae O si hay un complemento
-- que la regale. Nunca al revés — un plan alto no se puede recortar
-- con un add-on, porque quitar no es lo que un complemento hace.
--
-- Esto deja al `pases_cercania` de la 0123 con un rol más chico del
-- que tenía, y a propósito: pasa de ser LA puerta a ser la llave de
-- excepción. Se conserva porque esa excepción se va a usar (pruebas,
-- cortesías, clientes en negociación).
--
-- ------------------------------------------------------------
-- LOS LÍMITES NO SE GUARDAN ACÁ
-- ------------------------------------------------------------
-- "Hasta 3.000 miembros" no es una columna: sale de la definición del
-- plan en TypeScript, y cuántos miembros tiene el negocio se cuenta de
-- `miembros`. Guardar el tope en la fila del negocio crearía un número
-- que hay que actualizar en cada cambio de plan y que se desincroniza
-- el día que alguien lo olvida.
-- ============================================================

alter table ranchos add column if not exists plan_lealtad text;

-- Básico → Estándar → Enterprise.
alter table ranchos drop constraint if exists ranchos_plan_lealtad_check;
alter table ranchos add constraint ranchos_plan_lealtad_check
  check (plan_lealtad is null
         or plan_lealtad in ('basico', 'estandar', 'enterprise'));

comment on column ranchos.plan_lealtad is
  'Plan contratado de la plataforma de lealtad (0124). null = ninguno. '
  'Qué incluye cada plan y su tope de miembros viven en '
  'src/lib/lealtad/planes.ts, no en la base: son producto de Bookea, '
  'iguales para todos, y así se pueden testear. addons_negocio sigue '
  'sirviendo para regalar una capacidad suelta sin subir de plan.';
