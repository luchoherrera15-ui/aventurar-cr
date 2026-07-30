-- ============================================================
-- BOOKEA — Categorías de la vertical de Citas (0058)
--
-- El formulario de alta acepta las categorías de citas (belleza,
-- barbería, uñas, spa, consultorio) desde la 0055, pero el check de
-- ranchos.categoria seguía con la lista de eventos: ningún negocio
-- de citas podía guardarse. Este es el arreglo.
--
-- Es seguro correr esta migración varias veces.
-- ============================================================

alter table ranchos drop constraint if exists ranchos_categoria_check;
alter table ranchos add constraint ranchos_categoria_check
  check (categoria in (
    -- Eventos
    'lugares', 'alimentacion', 'animacion',
    'organizacion', 'decoracion', 'otros',
    -- Citas ('otros' es compartida)
    'belleza', 'barberia', 'unas', 'spa', 'consultorio'
  ));

-- El negocio demo sembrado con 'otros' por culpa del check pasa a su
-- categoría real. Inofensivo si no existe.
update ranchos set categoria = 'unas' where slug = 'stephnails' and vertical = 'citas';
