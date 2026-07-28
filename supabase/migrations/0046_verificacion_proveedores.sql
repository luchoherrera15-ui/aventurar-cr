-- ============================================================
-- 0046 — Verificación de proveedores (redes sociales + cédula)
--
-- Medida de seguridad: al publicar un negocio, el proveedor tiene que
-- dejar un link de sus redes (o sitio web) y una foto de su cédula
-- por ambos lados. El admin lo revisa junto con la solicitud antes de
-- aprobarla — así se filtran cuentas fantasma o empresas de mentira.
--
-- Va en una tabla aparte (no en `ranchos`) a propósito: `ranchos` se
-- lee con `select *` en varias páginas públicas del directorio, y una
-- foto de cédula no puede ni asomarse por ahí aunque el archivo en sí
-- esté en un bucket privado.
-- ============================================================

create table if not exists verificacion_proveedores (
  rancho_id uuid primary key references ranchos(id) on delete cascade,
  red_social_url text not null,
  cedula_frente_url text not null,
  cedula_dorso_url text not null,
  creado_en timestamptz not null default now()
);

alter table verificacion_proveedores enable row level security;

drop policy if exists "El dueño registra la verificación de su negocio" on verificacion_proveedores;
create policy "El dueño registra la verificación de su negocio"
  on verificacion_proveedores for insert
  to authenticated
  with check (
    exists (select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid())
  );

drop policy if exists "El dueño o el admin ven la verificación" on verificacion_proveedores;
create policy "El dueño o el admin ven la verificación"
  on verificacion_proveedores for select
  to authenticated
  using (
    is_admin()
    or exists (select 1 from ranchos r where r.id = rancho_id and r.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Storage: bucket privado para las fotos de cédula.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('verificacion-proveedores', 'verificacion-proveedores', false)
on conflict (id) do nothing;

drop policy if exists "Cuentas con sesión suben su cédula" on storage.objects;
create policy "Cuentas con sesión suben su cédula"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'verificacion-proveedores');

create or replace function public.puede_ver_verificacion(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1
    from verificacion_proveedores v
    join ranchos r on r.id = v.rancho_id
    where (v.cedula_frente_url = path or v.cedula_dorso_url = path)
      and r.owner_id = auth.uid()
  );
$$;

grant execute on function public.puede_ver_verificacion(text) to authenticated;

drop policy if exists "El dueño o el admin ven la cédula" on storage.objects;
create policy "El dueño o el admin ven la cédula"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'verificacion-proveedores' and puede_ver_verificacion(name));
