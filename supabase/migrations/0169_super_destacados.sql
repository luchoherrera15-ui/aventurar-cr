-- ============================================================
-- 0169 — Súper destacados: carrusel de hasta 10 negocios en la portada
--
-- El admin marca hasta 10 negocios publicados como "súper destacados"
-- (checkbox nuevo por negocio en /admin/ranchos) y esos son los que
-- rotan cada 4 segundos en el carrusel de arriba de la portada (`/`,
-- que renderiza el mismo componente que `/eventos` — ver el comentario
-- de src/app/page.tsx).
--
-- Es un mecanismo APARTE de `destacado_orden` (0044): ese reordena la
-- GRILLA normal del directorio (esos negocios salen de primeros, en su
-- propio orden). `super_destacado` no toca ese orden — solo decide
-- quién entra al carrusel de la franja de arriba. Un negocio puede
-- tener las dos cosas, ninguna, o solo una.
-- ============================================================

alter table ranchos add column if not exists super_destacado boolean not null default false;

create index if not exists ranchos_super_destacado_idx
  on ranchos (super_destacado)
  where super_destacado = true;

-- Las políticas RLS de `ranchos` no cambian (misma fila, misma regla de
-- "Todos ven los ranchos aprobados" de la 0008). Pero desde la 0140/0155
-- el SELECT de anon/authenticated sobre `ranchos` ya no es de tabla
-- completa: es columna por columna, con la lista de columnas que
-- existía en el momento en que esas dos migraciones corrieron. Una
-- columna agregada DESPUÉS (como esta) no queda incluida sola —hay que
-- concedérsela a mano, o la fila entera le sigue pasando la política
-- RLS pero esta columna en particular vendría vacía/con error.
grant select (super_destacado) on ranchos to anon, authenticated;

-- ------------------------------------------------------------
-- SIEMBRA INICIAL
--
-- Pedido: "por ahora, como no hay tantos publicados, dejá todos los
-- actuales en destacados para ver el funcionamiento".
--
-- Con DOS salvedades que se descubrieron revisando esto:
--
-- 1. NADA DE NEGOCIOS DEMO. En producción hay ~13 negocios de muestra
--    sembrados por scripts/seed-demo-*.mjs (slug `demo-…`,
--    `detalles->>'demo' = 'true'`, cuentas *.demo@bookea.lat). Son los
--    MÁS NUEVOS de la tabla, así que un `order by created_at desc
--    limit 10` a secas se los llevaba a todos: la portada de
--    www.bookea.lat abriría con diez negocios inventados de cara,
--    rotando cada 4 segundos. Se excluyen acá. (Y si algún día el admin
--    igual elige uno a mano, el carrusel ahora le pinta el chip "Demo",
--    igual que las tarjetas de la grilla.)
--
-- 2. UNA SOLA VEZ. La siembra corre solo si NADIE está marcado todavía.
--    Sin esa guarda, re-pegar este archivo —cosa que pasa: las
--    migraciones se pegan a mano— volvía a marcar los 10 más nuevos
--    encima de la selección del admin, resucitando los que él había
--    sacado y pasándose del tope de 10.
-- ------------------------------------------------------------
do $$
declare
  marcados integer;
begin
  if exists (select 1 from ranchos where super_destacado) then
    raise notice 'Ya hay súper destacados elegidos: no se siembra nada.';
    return;
  end if;

  update ranchos
  set super_destacado = true
  where id in (
    select id
    from ranchos
    where estado = 'aprobado'
      and coalesce(slug, '') not like 'demo-%'
      and coalesce(detalles->>'demo', '') <> 'true'
    order by created_at desc
    limit 10
  );

  get diagnostics marcados = row_count;
  raise notice 'Súper destacados sembrados: %. El resto se elige desde /admin/ranchos.', marcados;
end $$;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- CÓMO COMPROBARLO
--
--   select nombre, vertical, slug, super_destacado
--     from ranchos
--    where super_destacado
--    order by created_at desc;
--
-- No tiene que aparecer ningún slug que empiece con "demo-", y como
-- mucho tienen que salir 10 filas.
-- ------------------------------------------------------------
