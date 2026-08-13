
-- ─────────────────────────────────────────────────────────────────────
-- 0130: la solicitud de ALTA — el negocio NO existe hasta que Bookea
-- acepta.
--
-- El flujo viejo creaba el rancho primero y lo dejaba en hold (0129).
-- El definitivo es al revés: en /lealtad/nuevo la persona deja nombre
-- del negocio, tipo, paquete elegido y su depósito — todo en la
-- SOLICITUD. Si el admin acepta, ahí recién se crea el rancho (ya
-- aprobado para lealtad); si rechaza, no se crea nada.
--
-- Se reusa solicitudes_lealtad (0126): rancho_id pasa a ser nullable y
-- una fila sin rancho ES una solicitud de alta, con el nombre y el
-- tipo del negocio en columnas propias.
-- ─────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'solicitudes_lealtad'
       and column_name = 'negocio_nombre'
  ) then
    alter table solicitudes_lealtad alter column rancho_id drop not null;

    alter table solicitudes_lealtad add column negocio_nombre text
      check (negocio_nombre is null or char_length(trim(negocio_nombre)) between 1 and 80);

    -- 'otro' existe SOLO acá: el rancho real se crea con una vertical
    -- válida al aprobar, pero la respuesta original queda registrada.
    alter table solicitudes_lealtad add column negocio_vertical text
      check (
        negocio_vertical is null
        or negocio_vertical in ('citas', 'eventos', 'hospedajes', 'restaurantes', 'otro')
      );

    -- Cuando eligen «Otro», acá va SU respuesta en sus palabras
    -- («ferretería», «academia de baile»): el dato que un selector
    -- nunca captura y que al aprobar dice qué negocio es de verdad.
    alter table solicitudes_lealtad add column negocio_detalle text
      check (negocio_detalle is null or char_length(negocio_detalle) <= 80);

    -- Una fila es de UPGRADE (con rancho) o de ALTA (con nombre):
    -- nunca ninguna de las dos.
    alter table solicitudes_lealtad add constraint solicitudes_alta_coherente
      check (rancho_id is not null or negocio_nombre is not null);
  end if;
end $$;

comment on column solicitudes_lealtad.negocio_nombre is
  'Solo en solicitudes de ALTA (rancho_id null): el negocio que se creará si Bookea acepta.';
comment on column solicitudes_lealtad.negocio_vertical is
  'El tipo elegido en el alta, incluida la opción «otro» (el rancho se crea con una vertical válida).';
comment on column solicitudes_lealtad.negocio_detalle is
  'Si eligieron «otro»: qué negocio es, en sus palabras.';

-- El que pide un ALTA todavía no gestiona ningún rancho: política
-- propia. Sigue naciendo pendiente y a su propio nombre.
drop policy if exists "Pedir el alta de un negocio nuevo" on solicitudes_lealtad;
create policy "Pedir el alta de un negocio nuevo" on solicitudes_lealtad
  for insert with check (
    rancho_id is null
    and negocio_nombre is not null
    and solicitante_id = auth.uid()
    and estado = 'pendiente'
  );

-- Y tiene que poder VER su solicitud (para pintar "en revisión"):
-- la política de la 0126 solo cubría gestiona_rancho(rancho_id).
drop policy if exists "Ver las solicitudes del negocio" on solicitudes_lealtad;
create policy "Ver las solicitudes del negocio" on solicitudes_lealtad
  for select using (
    solicitante_id = auth.uid()
    or (rancho_id is not null and gestiona_rancho(rancho_id))
    or is_admin()
  );

-- Un alta pendiente por persona: el doble clic o el reintento no
-- duplican solicitudes ni correos (espejo del unique por rancho, 0126).
create unique index if not exists solicitudes_alta_pendiente_unq
  on solicitudes_lealtad (solicitante_id)
  where estado = 'pendiente' and rancho_id is null;
