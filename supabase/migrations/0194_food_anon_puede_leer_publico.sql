
-- ═══════════════════════════════════════════════════════════════════
-- FOOD.BOOKEA — el visitante anónimo podía leer NADA (0194)
--
-- Encontrado al verificar 0193 con la anon key real: TODA lectura
-- anónima contra food_businesses (y por extensión food_locations,
-- food_menu_categories, food_menu_items, food_franjas) fallaba con
-- `permission denied for function gestiona_negocio_food` —
-- incluso un `select *` sin ningún filtro. Es un error de la 0190
-- (no algo que haya causado la 0193): ya estaba roto en producción
-- desde que FOOD se desplegó esta noche.
--
-- LA CAUSA: cada una de esas tablas tiene DOS (o más) políticas SELECT
-- permisivas conviviendo — una pública ("Publico ve...") y una del
-- dueño que llama a gestiona_negocio_food(), función revocada de
-- `anon` a propósito (0190) porque solo el dueño/admin debía usarla.
-- Postgres arma el qual combinado como
-- `politica_publica OR politica_dueno(...)` y, para preparar ese qual,
-- comprueba el permiso EXECUTE de cada función que aparece en él —
-- ANTES de evaluar ninguna fila, sin importar que el corto-circuito de
-- OR nunca fuera a necesitar esa rama para un anónimo. Con `anon` sin
-- EXECUTE, la preparación del plan entero fallaba, así que ni siquiera
-- la mitad "pública" del OR llegaba a evaluarse.
--
-- LA CORRECCIÓN es mínima y segura: dar EXECUTE a `anon` sobre
-- gestiona_negocio_food(uuid). La función ya es segura para un
-- anónimo — es STABLE, SECURITY DEFINER, y su primera condición es
-- `auth.uid() is not null`, así que para cualquier llamada sin sesión
-- devuelve `false` de inmediato sin exponer nada. Darle EXECUTE a
-- `anon` no cambia QUÉ puede ver: solo permite que el planner arme el
-- qual combinado sin tropezar con el permiso de la función en sí.
--
-- No se toca ninguna política ni el esquema: es un solo GRANT.
--
-- Es seguro correr esta migración varias veces.
-- ═══════════════════════════════════════════════════════════════════

grant execute on function public.gestiona_negocio_food(uuid) to anon;

notify pgrst, 'reload schema';
