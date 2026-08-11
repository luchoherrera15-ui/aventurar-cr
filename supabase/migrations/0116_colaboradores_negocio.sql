-- ============================================================
-- BOOKEA — Colaboradores de un negocio (0116)
--
-- Hasta hoy un negocio tiene UN dueño: `ranchos.owner_id` es una sola
-- columna, y todo el acceso del panel se decide con
-- `owner_id = auth.uid() or is_admin()`. Para que dos personas
-- administren el mismo negocio solo había dos caminos, los dos malos:
-- transferir la propiedad (y que el otro la pierda) o hacer admin de
-- PLATAFORMA a alguien que solo tenía que manejar un rancho — o sea
-- darle finanzas, cuentas, precios y campañas de todo Bookea.
--
-- ── POR QUÉ ESTA MIGRACIÓN NO TOCA NI UNA POLÍTICA EXISTENTE ─────────
--
-- Hay 77 lugares en el esquema donde se compara `owner_id` con
-- `auth.uid()`. Reescribirlos para que además acepten colaboradores es
-- exactamente el tipo de cambio donde un `or` mal puesto abre los datos
-- de un negocio a otro, y donde el error no se ve hasta que ya pasó.
--
-- Postgres combina las políticas PERMISSIVE del mismo comando con OR.
-- Así que acá NO se modifica ninguna: se AGREGA una política nueva al
-- lado de cada una. Consecuencias:
--
--   · el acceso del dueño y del admin queda intacto, byte por byte;
--   · lo nuevo se revierte borrando lo nuevo, sin restaurar nada;
--   · cada política agregada es idéntica en forma, así que se auditan
--     todas leyendo una sola.
--
-- ── EL ALCANCE SE ESPEJA, NO SE INVENTA ──────────────────────────────
--
-- Cada política de colaborador cubre EXACTAMENTE los mismos comandos
-- que la del dueño en esa tabla. Si el dueño solo puede leer
-- `addons_negocio` (0077), el colaborador tampoco escribe. La lista se
-- sacó de `pg_policies`, no de memoria.
--
-- ── LO QUE UN COLABORADOR NO PUEDE ───────────────────────────────────
--
--   · Borrar el negocio, ni cambiarle el dueño.
--   · Agregar o quitar otros colaboradores — si pudiera, el permiso se
--     propagaría solo y el dueño perdería el control de quién entra.
--   · Ver `verificacion_proveedores`. Ahí están las CÉDULAS del dueño:
--     administrar un negocio no es motivo para ver el documento de
--     identidad de otra persona. Queda fuera a propósito.
--
-- Aditiva. Segura de volver a aplicar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. La tabla
-- ------------------------------------------------------------

create table if not exists public.rancho_colaboradores (
  rancho_id  uuid not null references public.ranchos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- Quién lo invitó. `set null` para que borrar una cuenta no borre el
  -- permiso de un tercero que sigue trabajando ahí.
  invitado_por uuid references auth.users(id) on delete set null,
  creado_en  timestamptz not null default now(),
  primary key (rancho_id, usuario_id)
);

create index if not exists rancho_colaboradores_usuario_idx
  on public.rancho_colaboradores (usuario_id);

alter table public.rancho_colaboradores enable row level security;

-- ------------------------------------------------------------
-- 2. Las dos preguntas
--
-- `es_colaborador_rancho` es SECURITY DEFINER a propósito: la usan las
-- políticas de OTRAS tablas, y si leyera `rancho_colaboradores`
-- sujetándose a la RLS de esa tabla, cada consulta entraría en su
-- propia política y Postgres cortaría por recursión infinita.
-- ------------------------------------------------------------

create or replace function public.es_colaborador_rancho(p_rancho uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_rancho is not null
     and auth.uid() is not null
     and exists (
       select 1 from public.rancho_colaboradores c
        where c.rancho_id = p_rancho and c.usuario_id = auth.uid()
     );
$$;

revoke all on function public.es_colaborador_rancho(uuid) from public, anon;
grant execute on function public.es_colaborador_rancho(uuid) to authenticated, service_role;

/**
 * La pregunta completa, para el código de la aplicación: ¿esta persona
 * administra este negocio, por la vía que sea?
 */
create or replace function public.gestiona_rancho(p_rancho uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_rancho is not null
     and auth.uid() is not null
     and (
       exists (select 1 from public.ranchos r
                where r.id = p_rancho and r.owner_id = auth.uid())
       or public.es_colaborador_rancho(p_rancho)
       or exists (select 1 from public.perfiles p
                   where p.id = auth.uid() and p.rol = 'admin')
     );
$$;

revoke all on function public.gestiona_rancho(uuid) from public, anon;
grant execute on function public.gestiona_rancho(uuid) to authenticated, service_role;

-- Igual que la anterior pero con actor explícito, para `service_role`,
-- donde `auth.uid()` es NULL. Mismo criterio que
-- `media_puede_administrar_como` (0112).
create or replace function public.gestiona_rancho_como(p_actor uuid, p_rancho uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_actor is not null
     and p_rancho is not null
     and (
       exists (select 1 from public.ranchos r
                where r.id = p_rancho and r.owner_id = p_actor)
       or exists (select 1 from public.rancho_colaboradores c
                   where c.rancho_id = p_rancho and c.usuario_id = p_actor)
       or exists (select 1 from public.perfiles p
                   where p.id = p_actor and p.rol = 'admin')
     );
$$;

revoke all on function public.gestiona_rancho_como(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gestiona_rancho_como(uuid, uuid) to service_role;

-- ------------------------------------------------------------
-- 3. RLS de la propia tabla de colaboradores
--
-- OJO: estas políticas NO llaman a `es_colaborador_rancho`. Leen
-- `rancho_colaboradores` desde una política SOBRE `rancho_colaboradores`,
-- y eso sí recursaría. Se comparan las columnas directamente.
-- ------------------------------------------------------------

-- Ve la lista: el dueño del negocio, el propio colaborador (para saber
-- a qué tiene acceso) y el admin.
drop policy if exists "Ver los colaboradores del negocio" on public.rancho_colaboradores;
create policy "Ver los colaboradores del negocio" on public.rancho_colaboradores
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or exists (select 1 from public.ranchos r
                where r.id = rancho_id and r.owner_id = auth.uid())
    or public.is_admin()
  );

-- Invita: SOLO el dueño (o el admin). Un colaborador no puede sumar a
-- otro — si pudiera, el permiso se propagaría solo.
drop policy if exists "Solo el dueño invita colaboradores" on public.rancho_colaboradores;
create policy "Solo el dueño invita colaboradores" on public.rancho_colaboradores
  for insert to authenticated
  with check (
    exists (select 1 from public.ranchos r
             where r.id = rancho_id and r.owner_id = auth.uid())
    or public.is_admin()
  );

-- Quita: el dueño, el admin, o el propio colaborador renunciando.
drop policy if exists "Quitar un colaborador" on public.rancho_colaboradores;
create policy "Quitar un colaborador" on public.rancho_colaboradores
  for delete to authenticated
  using (
    usuario_id = auth.uid()
    or exists (select 1 from public.ranchos r
                where r.id = rancho_id and r.owner_id = auth.uid())
    or public.is_admin()
  );

-- No hay política de UPDATE: la fila no tiene nada que actualizar. Un
-- cambio de permisos se hace quitando y volviendo a invitar.

grant select, insert, delete on public.rancho_colaboradores to authenticated;
grant all on public.rancho_colaboradores to service_role;

-- ------------------------------------------------------------
-- 4. Las políticas aditivas, tabla por tabla
--
-- Todas dicen lo mismo: "además del dueño, también quien colabora en
-- ese negocio". El alcance de comandos ESPEJA el de la política del
-- dueño en cada tabla — sacado de `pg_policies`, no de memoria.
--
-- Se usa un bucle para el grupo que comparte forma exacta (una columna
-- `rancho_id` y permiso total). La lista está escrita literal acá
-- abajo, así que se audita leyéndola; no hay tabla que entre sin
-- aparecer en este archivo.
-- ------------------------------------------------------------

do $$
declare
  t text;
  -- FOR ALL sobre `rancho_id`: el dueño tiene permiso total en estas.
  tablas_todo text[] := array[
    'rancho_items',            -- catálogo
    'equipo_rancho',           -- personal
    'agendas_externas',
    'bloqueos_agenda',
    'codigos_descuento',
    'conocimiento_negocio',
    'gastos_rancho',           -- ⚠️ finanzas del negocio. Ver el informe.
    'modulos_negocio',
    'precio_tiers',
    'promociones_dia',
    'servicios_adicionales'
  ];
begin
  foreach t in array tablas_todo loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Un colaborador gestiona ' || t, t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.es_colaborador_rancho(rancho_id)) '
      || 'with check (public.es_colaborador_rancho(rancho_id))',
      'Un colaborador gestiona ' || t, t
    );
  end loop;
end $$;

-- ---- Los que NO comparten forma, uno por uno ----

-- `ranchos`: leer y editar. NO insertar (un colaborador no crea
-- negocios) y NO borrar (eso es del dueño y del admin).
drop policy if exists "Un colaborador ve el negocio" on public.ranchos;
create policy "Un colaborador ve el negocio" on public.ranchos
  for select to authenticated
  using (public.es_colaborador_rancho(id));

drop policy if exists "Un colaborador edita el negocio" on public.ranchos;
create policy "Un colaborador edita el negocio" on public.ranchos
  for update to authenticated
  using (public.es_colaborador_rancho(id))
  with check (public.es_colaborador_rancho(id));

-- ── EL AGUJERO QUE ESTA POLÍTICA ABRE, Y CÓMO SE TAPA ───────────────
--
-- El WITH CHECK de arriba evalúa `es_colaborador_rancho(id)` sobre la
-- fila NUEVA. Cambiar `owner_id` no cambia el `id`, así que quien
-- colabora sigue colaborando después del UPDATE y la comprobación pasa.
-- Resultado: un colaborador podía ponerse a sí mismo de dueño y
-- quedarse con el negocio. Lo encontró la batería local — el test C2.
--
-- RLS no puede arreglarlo: un WITH CHECK ve la fila nueva y no tiene
-- forma de compararla con la vieja. Para eso hace falta un trigger, que
-- sí recibe OLD y NEW.
--
-- Se protege la columna, no la operación: el dueño saliente y el admin
-- siguen pudiendo transferir igual que antes, y `service_role`
-- (donde `auth.uid()` es NULL) tampoco se ve afectado.

create or replace function public.ranchos_proteger_dueno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
    -- `auth.uid()` nulo = `service_role` o un job del servidor: pasa.
    if auth.uid() is not null
       and old.owner_id is distinct from auth.uid()
       and not exists (
         select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'admin'
       ) then
      raise exception
        'Solo el dueño o un administrador pueden transferir el negocio.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ranchos_proteger_dueno on public.ranchos;
create trigger ranchos_proteger_dueno
  before update of owner_id, id on public.ranchos
  for each row
  execute function public.ranchos_proteger_dueno();

revoke all on function public.ranchos_proteger_dueno() from public, anon, authenticated;

-- `reservas`: ver, crear y modificar. Sin borrar, igual que el dueño.
drop policy if exists "Un colaborador ve las reservas" on public.reservas;
create policy "Un colaborador ve las reservas" on public.reservas
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador crea reservas" on public.reservas;
create policy "Un colaborador crea reservas" on public.reservas
  for insert to authenticated
  with check (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador modifica reservas" on public.reservas;
create policy "Un colaborador modifica reservas" on public.reservas
  for update to authenticated
  using (public.es_colaborador_rancho(rancho_id))
  with check (public.es_colaborador_rancho(rancho_id));

-- `lista_espera`: ver y quitar, igual que el dueño.
drop policy if exists "Un colaborador ve la lista de espera" on public.lista_espera;
create policy "Un colaborador ve la lista de espera" on public.lista_espera
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador quita de la lista de espera" on public.lista_espera;
create policy "Un colaborador quita de la lista de espera" on public.lista_espera
  for delete to authenticated
  using (public.es_colaborador_rancho(rancho_id));

-- `calendario_tokens`: ver y crear el feed .ics.
drop policy if exists "Un colaborador ve el token de calendario" on public.calendario_tokens;
create policy "Un colaborador ve el token de calendario" on public.calendario_tokens
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador crea el token de calendario" on public.calendario_tokens;
create policy "Un colaborador crea el token de calendario" on public.calendario_tokens
  for insert to authenticated
  with check (public.es_colaborador_rancho(rancho_id));

-- Solo lectura, espejando al dueño.
drop policy if exists "Un colaborador ve los addons" on public.addons_negocio;
create policy "Un colaborador ve los addons" on public.addons_negocio
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador ve las giftcards" on public.giftcards;
create policy "Un colaborador ve las giftcards" on public.giftcards
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

drop policy if exists "Un colaborador ve las importaciones" on public.importaciones_agenda;
create policy "Un colaborador ve las importaciones" on public.importaciones_agenda
  for select to authenticated
  using (public.es_colaborador_rancho(rancho_id));

-- Los dos que cuelgan de un miembro del equipo y no del negocio.
drop policy if exists "Un colaborador gestiona horarios_recurso" on public.horarios_recurso;
create policy "Un colaborador gestiona horarios_recurso" on public.horarios_recurso
  for all to authenticated
  using (exists (select 1 from public.equipo_rancho e
                  where e.id = miembro_id and public.es_colaborador_rancho(e.rancho_id)))
  with check (exists (select 1 from public.equipo_rancho e
                       where e.id = miembro_id and public.es_colaborador_rancho(e.rancho_id)));

drop policy if exists "Un colaborador gestiona servicios_recurso" on public.servicios_recurso;
create policy "Un colaborador gestiona servicios_recurso" on public.servicios_recurso
  for all to authenticated
  using (exists (select 1 from public.equipo_rancho e
                  where e.id = miembro_id and public.es_colaborador_rancho(e.rancho_id)))
  with check (exists (select 1 from public.equipo_rancho e
                       where e.id = miembro_id and public.es_colaborador_rancho(e.rancho_id)));

-- `verificacion_proveedores` NO lleva política de colaborador. Es
-- deliberado: ahí están las cédulas del dueño.

-- ------------------------------------------------------------
-- 5. La media también sigue esta regla
--
-- `media_puede_administrar_como` (0112) decide quién puede subir y
-- confirmar archivos. Sin esto, un colaborador podría entrar al panel y
-- editar el catálogo pero no cambiarle la foto a un producto.
--
-- Se reemplaza SOLO la rama de las tres entidades que cuelgan de un
-- rancho. Álbumes, invitaciones y verificaciones quedan igual.
-- ------------------------------------------------------------

create or replace function public.media_puede_administrar_como(
  p_actor       uuid,
  p_entity_type text,
  p_entity_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_actor is not null
    and p_entity_id is not null
    and (
      exists (
        select 1 from public.perfiles p
         where p.id = p_actor and p.rol = 'admin'
      )
      or case p_entity_type

        when 'rancho' then public.gestiona_rancho_como(p_actor, p_entity_id)

        when 'rancho_item' then exists (
          select 1
            from public.rancho_items i
           where i.id = p_entity_id
             and public.gestiona_rancho_como(p_actor, i.rancho_id)
        )

        when 'equipo' then exists (
          select 1
            from public.equipo_rancho e
           where e.id = p_entity_id
             and public.gestiona_rancho_como(p_actor, e.rancho_id)
        )

        when 'album' then exists (
          select 1 from public.albumes a
           where a.id = p_entity_id
             and a.cliente_id is not null
             and a.cliente_id = p_actor
        )

        when 'invitacion' then exists (
          select 1 from public.invitaciones v
           where v.id = p_entity_id
             and v.cliente_id is not null
             and v.cliente_id = p_actor
        )

        when 'comprobante' then exists (
          select 1
            from public.reservas s
           where s.id = p_entity_id
             and public.gestiona_rancho_como(p_actor, s.rancho_id)
        )

        -- La verificación sigue siendo SOLO del dueño: son sus cédulas.
        when 'verificacion' then exists (
          select 1
            from public.verificacion_proveedores vp
            join public.ranchos r on r.id = vp.rancho_id
           where vp.rancho_id = p_entity_id and r.owner_id = p_actor
        )

        else false
      end
    );
$$;

revoke all on function public.media_puede_administrar_como(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.media_puede_administrar_como(uuid, text, uuid) to service_role;

-- ------------------------------------------------------------
-- 6. Invitar por correo
--
-- El panel no puede leer `auth.users` para traducir un correo a un id,
-- y no debería poder. Esta función lo hace con permisos elevados pero
-- comprobando ANTES que quien llama sea el dueño de ESE negocio.
--
-- Devuelve códigos en vez de levantar excepciones para los casos
-- normales —"no existe esa cuenta", "ya estaba"—, que no son errores
-- del programa sino respuestas para la pantalla.
--
-- ⚠️ Deja saber si un correo tiene cuenta en Bookea. Es un dato que se
--    filtra, acotado a: alguien con sesión, dueño de un negocio real, y
--    solo sobre correos que escriba a mano. Se acepta a cambio de poder
--    invitar por correo en vez de pedirle a la gente que se pase uuids.
-- ------------------------------------------------------------

-- `create or replace` no puede cambiar el tipo de retorno de una
-- función existente. Se suelta primero para que este archivo se pueda
-- volver a aplicar aunque una versión anterior haya quedado instalada.
drop function if exists public.agregar_colaborador(uuid, text);

create function public.agregar_colaborador(
  p_rancho uuid,
  p_email  text
)
-- El parámetro de salida se llama `id_usuario` y NO `usuario_id`: ese
-- segundo nombre es TAMBIÉN una columna de `rancho_colaboradores`, y en
-- el `on conflict (rancho_id, usuario_id)` de abajo Postgres no sabe si
-- se refiere a la columna o al parámetro — falla con "column reference
-- is ambiguous". Es el mismo tropiezo que ya había dado
-- `usos_restantes` en la 0113.
returns table (codigo text, id_usuario uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_usuario uuid;
  v_dueno   uuid;
begin
  if p_rancho is null or v_email = '' then
    raise exception 'agregar_colaborador: parámetros inválidos.' using errcode = '22023';
  end if;

  select r.owner_id into v_dueno from public.ranchos r where r.id = p_rancho;
  if v_dueno is null then
    raise exception 'agregar_colaborador: el negocio no existe.' using errcode = '22023';
  end if;

  -- Solo el dueño o un admin. Un colaborador NO puede invitar.
  if v_dueno <> auth.uid()
     and not exists (select 1 from public.perfiles p
                      where p.id = auth.uid() and p.rol = 'admin') then
    raise exception 'agregar_colaborador: solo el dueño invita.' using errcode = '42501';
  end if;

  select u.id into v_usuario from auth.users u where lower(u.email) = v_email;
  if v_usuario is null then
    return query select 'sin_cuenta'::text, null::uuid;
    return;
  end if;

  if v_usuario = v_dueno then
    return query select 'ya_es_dueno'::text, v_usuario;
    return;
  end if;

  insert into public.rancho_colaboradores (rancho_id, usuario_id, invitado_por)
  values (p_rancho, v_usuario, auth.uid())
  on conflict (rancho_id, usuario_id) do nothing;

  if not found then
    return query select 'ya_estaba'::text, v_usuario;
    return;
  end if;

  return query select 'agregado'::text, v_usuario;
end;
$$;

revoke all on function public.agregar_colaborador(uuid, text) from public, anon;
grant execute on function public.agregar_colaborador(uuid, text) to authenticated, service_role;

/**
 * La lista para la pantalla, con el correo ya resuelto.
 *
 * `rancho_colaboradores` guarda ids; el panel necesita mostrar correos,
 * y `auth.users` no se puede leer desde el cliente.
 */
create or replace function public.colaboradores_del_rancho(p_rancho uuid)
returns table (usuario_id uuid, email text, nombre text, creado_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.gestiona_rancho(p_rancho) then
    raise exception 'colaboradores_del_rancho: no administrás ese negocio.'
      using errcode = '42501';
  end if;

  return query
    select c.usuario_id,
           coalesce(u.email, '—')::text,
           coalesce(p.nombre, '')::text,
           c.creado_en
      from public.rancho_colaboradores c
      left join auth.users u on u.id = c.usuario_id
      left join public.perfiles p on p.id = c.usuario_id
     where c.rancho_id = p_rancho
     order by c.creado_en;
end;
$$;

revoke all on function public.colaboradores_del_rancho(uuid) from public, anon;
grant execute on function public.colaboradores_del_rancho(uuid) to authenticated, service_role;

comment on table public.rancho_colaboradores is
  'Quién más puede administrar un negocio, además del dueño. Un colaborador '
  'NO puede invitar a otros ni ver verificacion_proveedores (las cédulas del '
  'dueño). Las políticas que le dan acceso son ADITIVAS: no modifican ninguna '
  'política existente del dueño.';

notify pgrst, 'reload schema';
