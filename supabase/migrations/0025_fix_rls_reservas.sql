-- ============================================================
-- AVENTUREA CR — Reparación de permisos de la tabla `reservas`
--
-- Error que resuelve: "new row violates row-level security
-- policy for table reservas" al elegir una fecha en el calendario.
--
-- Esa reserva se crea en dos pasos: primero un "hold" temporal de
-- 10 minutos (estado='temporal') apenas se toca el día, y recién
-- al final se completa a 'pendiente'. La política original del
-- proyecto (2001_init_schema.sql) solo dejaba insertar filas con
-- estado='pendiente' — el estado 'temporal' no existía todavía.
-- Si en tu proyecto de Supabase esa ampliación (de las migraciones
-- 0004/0005) nunca llegó a correr, cualquier intento de reservar
-- choca con la política vieja y sale este error.
--
-- Este script vuelve a dejar la política en el estado correcto,
-- sin importar cuál tenías puesta antes. Es seguro correrlo las
-- veces que haga falta.
-- ============================================================

grant select, insert, update, delete on reservas to anon, authenticated;

drop policy if exists "Cualquiera crea una reserva pendiente" on reservas;
drop policy if exists "Cualquiera crea una reserva o un hold temporal" on reservas;
create policy "Cualquiera crea una reserva o un hold temporal"
  on reservas for insert
  to anon, authenticated
  with check (estado in ('pendiente', 'temporal'));

drop policy if exists "Cualquiera completa su propio hold temporal" on reservas;
create policy "Cualquiera completa su propio hold temporal"
  on reservas for update
  to anon, authenticated
  using (estado = 'temporal')
  with check (estado in ('temporal', 'pendiente'));

drop policy if exists "Cualquiera borra un hold temporal ya vencido" on reservas;
create policy "Cualquiera borra un hold temporal ya vencido"
  on reservas for delete
  to anon, authenticated
  using (estado = 'temporal' and expira_en < now());

notify pgrst, 'reload schema';
