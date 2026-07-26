-- ============================================================
-- AVENTUREA CR — Permite leer los holds temporales (sin datos
-- personales todavía) para que Supabase pueda devolver el ID
-- justo después de crearlos.
-- ============================================================

drop policy if exists "Cualquiera ve los holds temporales" on reservas;

create policy "Cualquiera ve los holds temporales"
  on reservas for select
  to anon, authenticated
  using (estado = 'temporal');
