-- ============================================================
-- BOOKEA — Eliminar el demo de Citas (Steph Nails Studio)
--
-- Este demo (sembrado el 2026-07-29, ver memoria "datos-demo-
-- steph-nails") NO se creó con un script commiteado como el de
-- Eventos (seed-demo.sql) — se sembró directo en producción, así
-- que este script de limpieza va por nombre/slug/correo en vez de
-- por una marca `detalles.demo`.
--
-- Los negocios REALES de esta cuenta son: Rancho Las Torres, Rancho
-- Don Luis y PuraMatcha Bar — ninguno de los dos pasos de abajo los
-- toca (van por slug 'stephnails' y por correo *.demo@bookea.lat).
--
-- Corré esto en el SQL Editor de Supabase, PASO 1 primero y revisá
-- el conteo antes de seguir con el PASO 2.
-- ============================================================

-- PASO 1 — El negocio y todo lo que cuelga de él (equipo, reservas,
-- reseñas, giftcards, items del catálogo...) por los "on delete
-- cascade" de sus claves foráneas hacia ranchos.id.
delete from ranchos where slug = 'stephnails';

select count(*) as debe_ser_cero from ranchos where slug = 'stephnails';

-- PASO 2 — Las cuentas demo (dueña + 4 clientas). Borrar de
-- auth.users cascadea a perfiles y a todo lo que esas cuentas hayan
-- dejado (favoritos, reseñas, conversaciones...) por las mismas
-- claves foráneas. Si preferís no correr SQL contra el esquema
-- auth, podés borrar estas 5 cuentas a mano desde el Dashboard de
-- Supabase → Authentication → Users, buscando "demo@bookea.lat".
delete from auth.users where email like '%.demo@bookea.lat';

select count(*) as debe_ser_cero from auth.users where email like '%.demo@bookea.lat';
