-- 0252 · Los números de cada cliente de una tarjeta, en una sola consulta
--
-- ⚠️ NO ESTÁ CORRIDA. Se escribió el 2 oct 2026 para la lista de clientes
-- del panel de Foorkie y se pega a mano en el SQL Editor de Supabase. Es
-- aditiva e idempotente (`create or replace`): no toca ninguna tabla ni
-- ningún dato. Sin ella el código anda igual: lee el ledger de la tarjeta
-- por páginas y hace LA MISMA cuenta en el servidor
-- (`agregadosPorMiembro` en src/lib/plataforma/foorkie-panel.ts). Con
-- ella, la base agrupa y devuelve una fila por cliente.
--
-- ------------------------------------------------------------
-- VUELTA ATRÁS
-- ------------------------------------------------------------
--   drop function if exists public.lealtad_resumen_por_miembro(uuid);
--   notify pgrst, 'reload schema';
--
-- El código vuelve solo a leer el ledger por páginas (`cuentasDeLaTarjeta`
-- reconoce la función que falta: PGRST202 / 42883).
--
-- ------------------------------------------------------------
-- POR QUÉ
-- ------------------------------------------------------------
-- Pedido del dueño de Foorkie (2 oct 2026), mirando el panel de lealtad:
-- «poder ver por clientes: quién es el que más sellos lleva, quién ha
-- canjeado y cuántas veces». Para ordenar a TODOS los clientes de una
-- tarjeta por saldo, por canjes o por visitas hacen falta los números de
-- todos, y el saldo no se guarda en ningún lado: se DERIVA del ledger
-- (`transacciones_puntos`, 0060). Leerlo entero por PostgREST son páginas
-- de mil filas; agruparlo acá es una consulta.
--
-- ------------------------------------------------------------
-- QUÉ DEVUELVE — una fila por miembro activo o en pausa CON movimientos
-- ------------------------------------------------------------
--   saldo             sum(puntos): el saldo de siempre (0060)
--   acumulado         lo ganado en toda la historia: los 'ganado' que
--                     siguen en pie (una compra revertida no se ganó; un
--                     ajuste a mano o el vencimiento de los sellos, 0180,
--                     no le quitan lo ganado)
--   visitas           cuántas veces sumó (esos mismos 'ganado')
--   canjes            cuántas veces canjeó: los 'canjeado' que siguen en
--                     pie (revertir un canje lo anula, 0139)
--   ultimo_canje      el último de esos canjes
--   ultima_actividad  lo último que HIZO: sumar o canjear (revertido o
--                     no: vino igual). Un ajuste, una reversión o un
--                     vencimiento no son una visita del cliente.
--
-- «Sigue en pie» = ninguna fila lo revierte (`reversion_de`, 0125). El
-- índice único parcial `transacciones_puntos_reversion_unica` garantiza
-- una sola reversión por fila: el `left join` no duplica nada.
--
-- Los miembros sin movimientos no salen (el código los cuenta en cero) y
-- los dados de baja (`cancelada`) tampoco: no son clientes de la tarjeta.
--
-- ------------------------------------------------------------
-- SEGURIDAD
-- ------------------------------------------------------------
-- `security invoker` y SOLO la ejecuta el service_role: la API de Foorkie
-- corre con la llave de servicio (`createAdminClient`). anon y
-- authenticated no la ven, así que no abre ninguna lectura del ledger que
-- la RLS de la 0060 no diera ya.
--
-- No hace falta un índice nuevo: `miembros_programa_persona_idx`
-- (programa_id, …, 0138) encuentra a los miembros de la tarjeta,
-- `transacciones_puntos_miembro_idx` (miembro_id, created_at, 0060) su
-- ledger y `transacciones_puntos_reversion_unica` (reversion_de, 0125) las
-- reversiones.

create or replace function public.lealtad_resumen_por_miembro(p_programa_id uuid)
returns table (
  miembro_id uuid,
  saldo bigint,
  acumulado bigint,
  visitas integer,
  canjes integer,
  ultimo_canje timestamptz,
  ultima_actividad timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.miembro_id,
         coalesce(sum(t.puntos), 0)::bigint,
         coalesce(sum(t.puntos) filter (where t.tipo = 'ganado' and r.id is null), 0)::bigint,
         (count(*) filter (where t.tipo = 'ganado' and r.id is null))::integer,
         (count(*) filter (where t.tipo = 'canjeado' and r.id is null))::integer,
         max(t.created_at) filter (where t.tipo = 'canjeado' and r.id is null),
         max(t.created_at) filter (where t.tipo in ('ganado', 'canjeado'))
    from public.transacciones_puntos t
    join public.miembros m on m.id = t.miembro_id
    left join public.transacciones_puntos r on r.reversion_de = t.id
   where m.programa_id = p_programa_id
     and m.estado in ('activa', 'pausada')
   group by t.miembro_id
   order by t.miembro_id;
$$;

revoke all on function public.lealtad_resumen_por_miembro(uuid) from public;
revoke all on function public.lealtad_resumen_por_miembro(uuid) from anon, authenticated;
grant execute on function public.lealtad_resumen_por_miembro(uuid) to service_role;

comment on function public.lealtad_resumen_por_miembro(uuid) is
  'Los números de cada cliente de una tarjeta (0252): saldo, acumulado, visitas, canjes, '
  'último canje y última actividad, derivados del ledger. Solo service_role. La misma cuenta '
  'que agregadosPorMiembro en src/lib/plataforma/foorkie-panel.ts.';

notify pgrst, 'reload schema';
