-- ============================================================
-- AVENTUREA CR — Storage para comprobantes de pago
-- Correr en el SQL Editor de Supabase, en una pestaña nueva y vacía.
-- ============================================================

-- Espacio de almacenamiento privado (no cualquiera puede listar los
-- archivos, solo subir uno nuevo o, si es del equipo, verlos).
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy "Cualquiera puede subir un comprobante"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'comprobantes');

create policy "El equipo puede ver los comprobantes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'comprobantes');
