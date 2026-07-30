-- ============================================================
-- 0064 — Los precios por rango también se ven CON sesión iniciada
--
-- El bug: "Todos ven los precios" (precio_tiers) y "Todos ven los
-- servicios" (servicios_adicionales) eran políticas SOLO para anon
-- (0001). Un cliente con sesión iniciada (rol authenticated) que no
-- fuera el dueño no matcheaba ninguna política de select y recibía
-- cero filas → el calendario de reservas mostraba "Cotización
-- personalizada" en vez del precio por cantidad de personas, y los
-- servicios adicionales desaparecían. En incógnito (anon) sí
-- funcionaba — por eso costaba verlo.
--
-- promociones_dia ya lo hacía bien (anon, authenticated) desde 0013;
-- acá se igualan las otras dos. Es seguro correrla varias veces.
-- ============================================================

drop policy if exists "Todos ven los precios" on precio_tiers;
create policy "Todos ven los precios" on precio_tiers
  for select to anon, authenticated
  using (true);

drop policy if exists "Todos ven los servicios" on servicios_adicionales;
create policy "Todos ven los servicios" on servicios_adicionales
  for select to anon, authenticated
  using (true);
