-- ============================================================
--  ROLLBACK PARCIAL de 0221 · restaurar la lectura de invitaciones
-- ============================================================
--
-- La 0221 revocó el SELECT anónimo sobre `invitaciones` para cortar la
-- enumeración, confiando en que el código ya leería por la función
-- `invitacion_por_slug`. Pero ese código todavía NO está desplegado:
-- el sitio en vivo (bookea.lat) corre la versión anterior, que lee la
-- tabla con la llave anónima. Resultado: `bookea.lat/i/{slug}` empezó a
-- dar 404 para todos los invitados reales.
--
-- Regla que faltó respetar: un cambio de RLS que EXIGE un cambio de
-- código se aplica DESPUÉS de desplegar el código, no antes. Acá se
-- restaura el acceso anónimo para que el sitio vuelva a funcionar de
-- inmediato.
--
-- La corrección de enumeración NO se pierde: la función
-- `invitacion_por_slug` (0221) queda creada y el código local ya la
-- usa. El `revoke` definitivo se vuelve a aplicar EN EL MISMO despliegue
-- del código nuevo (ver docs/seguridad-auditoria-2026-08-29.md). El
-- resto de 0221 (trigger de `destacado_orden`) no dependía de código y
-- se queda como está.

grant select on public.invitaciones to anon, authenticated;

drop policy if exists "Cualquiera ve las invitaciones activas" on public.invitaciones;
create policy "Cualquiera ve las invitaciones activas" on public.invitaciones
  for select to anon, authenticated
  using (estado = 'activa');

notify pgrst, 'reload schema';
