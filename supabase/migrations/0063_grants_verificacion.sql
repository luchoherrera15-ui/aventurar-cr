-- ============================================================
-- 0063 — Grants faltantes en verificacion_proveedores
--
-- La tabla se creó (0046) con RLS y sus políticas, pero sin GRANT de
-- privilegios de tabla para el rol `authenticated` — y en Postgres la
-- política RLS no sirve de nada si el rol ni siquiera puede tocar la
-- tabla: el insert del alta moría con "permission denied for table
-- verificacion_proveedores". Las políticas de 0046 (solo el dueño
-- inserta/ve la de su negocio) siguen mandando sobre las filas.
-- ============================================================

grant select, insert on table verificacion_proveedores to authenticated;
grant all on table verificacion_proveedores to service_role;
