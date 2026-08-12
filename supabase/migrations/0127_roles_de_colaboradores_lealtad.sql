
-- ─────────────────────────────────────────────────────────────────────
-- 0127: roles y permisos de lealtad para los colaboradores.
--
-- Hasta hoy `rancho_colaboradores` era binaria: la fila existe o no, y
-- existir era poder TODO. Con la operación de lealtad (dar sellos,
-- canjear, revertir) el dueño necesita un checklist: quién puede qué.
--
--   · rol 'administrador' → opera todo el módulo de lealtad.
--   · rol 'empleado'      → solo lo que el checklist le marque.
--
-- El checklist vive en `permisos_lealtad` (jsonb) con llaves booleanas:
--   acreditar  — dar sellos y puntos (escáner y botón manual)
--   canjear    — canjear premios y marcarlos en el POS
--   revertir   — revertir movimientos y suspender membresías
--   auditoria  — ver la pestaña Auditoría (quién hizo qué y cuándo)
--
-- La ENFORCEMENT vive en las server actions (los RPC de la 0125 solo
-- aceptan service_role y reciben al actor como dato de auditoría); esta
-- migración da el DATO y la política para editarlo.
-- ─────────────────────────────────────────────────────────────────────

-- Columnas y backfill en UN bloque condicionado a que la columna no
-- exista todavía: re-pegar este archivo meses después NO re-ejecuta el
-- backfill (que ascendería a administrador a todos los empleados con
-- checklist recortado — la revisión adversaria lo señaló).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'rancho_colaboradores'
       and column_name = 'rol'
  ) then
    alter table rancho_colaboradores
      add column rol text not null default 'empleado'
        check (rol in ('administrador', 'empleado'));

    -- Los empleados nuevos nacen pudiendo operar el mostrador
    -- (acreditar y canjear) pero sin revertir ni ver auditoría: eso lo
    -- abre el dueño.
    alter table rancho_colaboradores
      add column permisos_lealtad jsonb not null
        default '{"acreditar": true, "canjear": true}'::jsonb;

    -- Los colaboradores que YA existían fueron invitados bajo el texto
    -- "va a poder hacer lo mismo que vos": conservan ese alcance como
    -- administradores. Los que se inviten desde ahora nacen empleados.
    update rancho_colaboradores set rol = 'administrador';
  end if;
end $$;

comment on column rancho_colaboradores.rol is
  'administrador = opera todo el módulo de lealtad; empleado = solo lo que permisos_lealtad marque.';
comment on column rancho_colaboradores.permisos_lealtad is
  'Checklist del empleado: {acreditar, canjear, revertir, auditoria} booleanos. Lo edita el dueño.';

-- La 0116 no tenía UPDATE a propósito ("se quita y se vuelve a
-- invitar"); con roles editables eso ya no alcanza. Ajusta el dueño del
-- negocio o el admin de la plataforma — el colaborador no se sube solo.
drop policy if exists "El dueño ajusta el rol" on rancho_colaboradores;
create policy "El dueño ajusta el rol" on rancho_colaboradores
  for update using (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  ) with check (
    exists (select 1 from ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or is_admin()
  );

-- Grant SOLO de las dos columnas nuevas: la política de arriba dice
-- quién, esto dice qué — nadie reasigna un colaborador de negocio por
-- UPDATE aunque la política se lo permitiera.
grant update (rol, permisos_lealtad) on rancho_colaboradores to authenticated;

-- La lista del equipo ahora trae el rol y el checklist. El tipo de
-- retorno cambia, así que hay que soltar la función anterior (0116).
--
-- Y el gate se ENDURECE: antes bastaba gestiona_rancho (cualquier
-- colaborador), pero con roles la lista trae el correo, el rol y el
-- checklist de cada compañero — eso es del dueño, igual que la
-- pantalla de Equipo que lo muestra. Un empleado ya no puede llamarla
-- desde la consola para leer los permisos del resto.
drop function if exists public.colaboradores_del_rancho(uuid);

create function public.colaboradores_del_rancho(p_rancho uuid)
returns table (
  usuario_id uuid,
  email text,
  nombre text,
  creado_en timestamptz,
  rol text,
  permisos_lealtad jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
       select 1 from public.ranchos r
        where r.id = p_rancho and r.owner_id = auth.uid()
     )
     and not exists (
       select 1 from public.perfiles p
        where p.id = auth.uid() and p.rol = 'admin'
     ) then
    raise exception 'colaboradores_del_rancho: solo el dueño ve el equipo.'
      using errcode = '42501';
  end if;

  return query
    select c.usuario_id,
           coalesce(u.email, '—')::text,
           coalesce(p.nombre, '')::text,
           c.creado_en,
           c.rol,
           c.permisos_lealtad
      from public.rancho_colaboradores c
      left join auth.users u on u.id = c.usuario_id
      left join public.perfiles p on p.id = c.usuario_id
     where c.rancho_id = p_rancho
     order by c.creado_en;
end;
$$;

-- La 0083 revocó el EXECUTE por defecto: sin estas dos líneas la
-- función nueva no la puede llamar nadie.
revoke all on function public.colaboradores_del_rancho(uuid) from public, anon;
grant execute on function public.colaboradores_del_rancho(uuid) to authenticated, service_role;
