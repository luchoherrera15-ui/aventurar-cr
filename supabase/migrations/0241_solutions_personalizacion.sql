-- ════════════════════════════════════════════════════════════════════
--  PEDIDOS COMO EN UNA APP DE REPARTO — armar el plato antes de pedirlo
-- ════════════════════════════════════════════════════════════════════
--
-- Pedido del dueño (9 sep 2026): «que la gente pueda ordenar tipo Uber
-- Eats: personalizar la hamburguesa, qué ingredientes tiene para poder
-- quitárselos, y que quien pide pueda agregar notas».
--
-- ── POR QUÉ UNA COLUMNA jsonb Y NO DOS TABLAS ───────────────────────
-- Los ingredientes y los extras de un plato NO se consultan por su
-- cuenta: no se filtra por ellos, no se ordenan, no se cuentan. Se leen
-- SIEMPRE junto al plato y se escriben SIEMPRE junto al plato. Dos
-- tablas hijas obligarían a un join en cada carga del menú (la consulta
-- más caliente del producto) y a dos borrados en cascada, a cambio de
-- una integridad que acá no compra nada: el propio plato es el dueño de
-- su lista.
--
-- La forma que se guarda, saneada en el servidor por
-- `personalizacionDe` (src/lib/solutions/personalizacion.ts):
--
--   {
--     "ingredientes": [{ "id": "i1", "nombre": "Cebolla" }],
--     "extras":       [{ "id": "e1", "nombre": "Queso", "precio": 800 }]
--   }
--
-- Los ingredientes son los que el cliente PUEDE QUITAR (van marcados de
-- entrada); los extras son los que puede AGREGAR, con su precio, que se
-- suma al del plato.
--
-- El default `{}` hace que los 150 platos que ya existen sigan
-- funcionando exactamente igual: sin listas, el plato se agrega al
-- carrito de un toque, como hasta hoy.

alter table public.solutions_menu_items
  add column if not exists personalizacion jsonb not null default '{}'::jsonb;

comment on column public.solutions_menu_items.personalizacion is
  'Ingredientes que el cliente puede quitar y extras que puede agregar '
  '(0241). Lo sanea personalizacion.ts; se lee y se escribe siempre con '
  'el plato.';

-- Sin cambios de RLS: la columna viaja con la fila del plato, que ya
-- tiene sus políticas desde la 0230 (lectura pública del menú publicado,
-- escritura solo del dueño y sus colaboradores).
