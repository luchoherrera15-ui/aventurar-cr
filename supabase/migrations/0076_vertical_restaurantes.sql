-- ============================================================
-- BOOKEA — La vertical de Restaurantes (0076)
--
-- Cuarta vertical del directorio, junto a eventos, citas y
-- hospedajes. Un restaurante tiene:
--   * perfil con su menú (rancho_items, la tabla que nació para eso),
--   * reserva de mesa con hora (el motor de agenda de citas, donde
--     una mesa es un recurso `equipo_rancho.tipo = 'espacio'`),
--   * pedido para recoger (pickup), que se coordina por el chat.
--
-- Lo único que la agenda no sabía hacer con mesas es cuidar el
-- tamaño del grupo: para eso llega `equipo_rancho.capacidad`.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

-- 1) La vertical nueva -------------------------------------------------
alter table ranchos drop constraint if exists ranchos_vertical_check;
alter table ranchos add constraint ranchos_vertical_check
  check (vertical in ('eventos', 'citas', 'hospedajes', 'restaurantes'));

-- 2) Sus categorías ----------------------------------------------------
alter table ranchos drop constraint if exists ranchos_categoria_check;
alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    -- Eventos
    'lugares', 'alimentacion', 'animacion',
    'organizacion', 'decoracion', 'otros',
    -- Citas ('otros' es compartida)
    'belleza', 'barberia', 'unas', 'spa', 'consultorio',
    -- Hospedajes
    'casa', 'villa', 'hotel', 'cabana', 'apartamento', 'experiencia',
    -- Restaurantes
    'soda', 'restaurante', 'cafeteria', 'marisqueria',
    'pizzeria', 'bar', 'panaderia', 'heladeria'
  ));

-- 3) Los gastos del panel admin también se separan por sección ---------
alter table gastos drop constraint if exists gastos_vertical_check;
alter table gastos add constraint gastos_vertical_check
  check (vertical is null or vertical in
    ('eventos', 'citas', 'hospedajes', 'restaurantes'));

-- 4) Mesas: un recurso con capacidad -----------------------------------
-- `equipo_rancho.tipo = 'espacio'` ya existía desde la 0061 (la agenda
-- PRO lo dejó previsto); lo que faltaba era saber para cuánta gente
-- sirve cada mesa, para no sentar a 8 personas en una de 2.
alter table equipo_rancho
  add column if not exists capacidad int;

alter table equipo_rancho drop constraint if exists equipo_rancho_capacidad_check;
alter table equipo_rancho add constraint equipo_rancho_capacidad_check
  check (capacidad is null or (capacidad >= 1 and capacidad <= 100));

-- 5) Cómo atiende el restaurante ---------------------------------------
-- Se guarda en `ranchos.detalles` (jsonb) para no inflar la tabla:
--   detalles.horario_restaurante  → mismo formato que horario_citas
--   detalles.acepta_pickup        → bool
--   detalles.acepta_reserva_mesa  → bool
--   detalles.rango_precio         → 1 | 2 | 3  (₡ / ₡₡ / ₡₡₡)
-- No hace falta migración para eso; queda documentado acá.

comment on column equipo_rancho.capacidad is
  'Para mesas (tipo = espacio): cuántas personas caben. NULL en personas del equipo.';
