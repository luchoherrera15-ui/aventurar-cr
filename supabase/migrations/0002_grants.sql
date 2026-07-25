-- ============================================================
-- AVENTUREA CR — Permisos base de las tablas (faltaban)
-- Correr en el SQL Editor de Supabase, después del 0001_init_schema.sql
-- ============================================================

-- Al crear tablas por SQL (en vez de por la interfaz de Supabase), hay que
-- otorgar el permiso base de lectura/escritura por separado. Esto NO
-- reemplaza la seguridad (RLS) que ya configuramos — sigue siendo esa la
-- que de verdad decide qué fila puede ver o tocar cada quien. Esto solo
-- habilita que el permiso "de fondo" exista para que RLS pueda aplicarse.

grant select, insert, update, delete on reservas to anon, authenticated;
grant select, insert, update, delete on precio_tiers to anon, authenticated;
grant select, insert, update, delete on servicios_adicionales to anon, authenticated;
grant select, insert, update, delete on configuracion_rancho to anon, authenticated;
grant select, insert, update, delete on propiedades to anon, authenticated;
grant select, insert, update, delete on bloqueos to anon, authenticated;
