-- ============================================================
-- COMPLETAR LA 0138 EN clientes_negocio — se quedó a medias.
--
-- QUÉ PASÓ (diagnosticado en vivo, no es una hipótesis): el dueño
-- reportó un error real al intentar afiliarse por QR en su propio
-- negocio. Se reprodujo llamando a `alta_persona_por_qr` con un
-- contacto nuevo y la base devolvió:
--
--   column "clientes_negocio.persona_id" does not exist
--
-- La 0138 (2281 líneas) agrega esa columna en su sección 12, adentro
-- de un `do $s12$ ... end $s12$;` — y ese bloque específico nunca
-- quedó aplicado, aunque el resto de la 0138 sí (personas,
-- personas_negocio, consentimientos_persona, sesiones_persona, la
-- propia función `alta_persona_por_qr`, todo eso se probó en vivo y
-- funciona). Como un `do $$ ... $$` corre como una transacción
-- implícita, si UNA sola sentencia adentro fallaba, TODO el bloque se
-- revertía junto — incluida la columna, aunque esa parte en particular
-- no tuviera ningún motivo propio para fallar.
--
-- Esta migración repite EXACTAMENTE las mismas sentencias de la
-- sección 12 de la 0138, con guardas (`if not exists` / `drop ... if
-- exists`) para que sea segura de pegar sin importar qué parte haya
-- quedado a medias. No inventa nada nuevo.
-- ============================================================

do $s153$
begin
  if to_regclass('public.clientes_negocio') is null then
    raise notice '0153: clientes_negocio no existe (falta la 0109). No hay nada que completar.';
    return;
  end if;

  execute 'alter table public.clientes_negocio add column if not exists persona_id uuid references public.personas(id) on delete set null';
  execute 'alter table public.clientes_negocio add column if not exists origen text not null default ''crm''';
  execute 'alter table public.clientes_negocio drop constraint if exists clientes_negocio_origen_check';
  execute 'alter table public.clientes_negocio add constraint clientes_negocio_origen_check check (origen in (''crm'', ''qr_tarjeta'', ''lealtad'', ''reserva'', ''importacion''))';
  execute 'create index if not exists clientes_negocio_persona_idx on public.clientes_negocio (persona_id) where persona_id is not null';
  execute 'create unique index if not exists clientes_negocio_persona_unica_idx on public.clientes_negocio (rancho_id, persona_id) where persona_id is not null';
end;
$s153$;

-- El trigger de la 0138 (`clientes_negocio_persona`) sí se pudo haber
-- creado sin la columna —Postgres no valida referencias de un trigger
-- hasta que dispara—, y de haber sido así habría estado rompiendo
-- cualquier insert/update a `clientes_negocio` desde que se pegó la
-- 0138. Se repite acá también, sin costo si ya existía bien.
do $s153b$
begin
  if to_regclass('public.clientes_negocio') is null then return; end if;
  execute 'drop trigger if exists clientes_negocio_persona on public.clientes_negocio';
  execute 'create trigger clientes_negocio_persona before insert or update on public.clientes_negocio for each row execute function public.clientes_negocio_resolver_persona()';
end;
$s153b$;

-- El backfill de la 0138 (rellenar persona_id en filas que ya existían
-- antes de esta columna) tampoco pudo haber corrido — dependía de la
-- columna. Copiado TAL CUAL de la 0138 (línea 1341-1365), sin cambios:
-- es lógica ya pensada y no hay motivo para tocarla acá.
do $s153c$
declare
  r record;
  v_persona uuid;
begin
  if to_regclass('public.clientes_negocio') is null then return; end if;
  for r in select id, rancho_id, cliente_id, correo, telefono, nombre
             from public.clientes_negocio where persona_id is null
  loop
    v_persona := public.resolver_persona(
      p_cliente_id => r.cliente_id,
      p_correo     => r.correo,
      p_telefono   => r.telefono,
      p_nombre     => r.nombre,
      p_origen     => 'crm');

    if not exists (
      select 1 from public.clientes_negocio g
       where g.rancho_id = r.rancho_id and g.persona_id = v_persona
    ) then
      update public.clientes_negocio set persona_id = v_persona where id = r.id;
    end if;
  end loop;
end;
$s153c$;

notify pgrst, 'reload schema';
