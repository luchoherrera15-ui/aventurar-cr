
-- 0195: vigencia «desde el primer sello o bono del cliente» (pedido
-- del dueño, ago 2026). Un booleano en programa_lealtad: cuando está
-- encendido, la tarjeta no tiene fecha fija de inicio (vigente_desde
-- queda null — lo garantiza crear-actions) y la vigencia de cada
-- cliente arranca el día en que recibe su primer sello/bono. El motor
-- de canje no necesita cambios: sin vigente_desde el programa nunca
-- está «programado», y un cliente no puede canjear antes de su primer
-- sello por definición.
--
-- Sin políticas nuevas: es una columna más de una tabla que ya tiene
-- su RLS (0060/0136), con default para que la app móvil y las filas
-- viejas sigan leyéndose igual.

alter table public.programa_lealtad
  add column if not exists vigencia_desde_primer_sello boolean not null default false;
