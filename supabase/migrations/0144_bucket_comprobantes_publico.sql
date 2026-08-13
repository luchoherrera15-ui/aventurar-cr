-- ============================================================
-- 0144 — El bucket `comprobantes` queda PÚBLICO (de verdad, en el repo)
--
-- QUÉ ARREGLA
-- La 0003 crea el bucket con `public = false` y ninguna migración lo
-- abre nunca. Producción funciona porque alguien lo cambió A MANO en el
-- dashboard de Supabase — o sea que el repo NO describe la base que
-- está corriendo. El día que la base se reconstruya desde estas
-- migraciones (entorno nuevo, staging, restauración), el bucket nace
-- privado y las imágenes que se sirven por URL pública dejan de
-- cargarse EN SILENCIO: no hay error de build, no hay excepción, solo
-- un cuadro roto.
--
-- Lo que vive ahí y se sirve público:
--   · el logo de la tarjeta de lealtad que se sube en /lealtad/nuevo
--     (`solicitudes_alta.pase_logo_url`) — y ese logo termina HORNEADO
--     dentro del .pkpass que el cliente guarda en el teléfono, así que
--     el generador lo baja con un `fetch` sin sesión;
--   · el comprobante de pago de las solicitudes de plan y de los
--     pedidos de invitaciones, que el panel muestra por su URL.
--
-- QUÉ NO HACE, Y ES A PROPÓSITO
-- No agrega una política de SELECT para `anon`. Un bucket público ya
-- sirve cada archivo por `/storage/v1/object/public/...` sin pasar por
-- RLS; agregar la política además habilitaría LISTAR el bucket con la
-- llave anónima, y acá adentro hay comprobantes de pago de gente real.
-- Que un archivo sea alcanzable con su link (uuid) no es lo mismo que
-- que se pueda enumerar la carpeta entera.
--
-- Es idempotente: se puede pegar dos veces sin cambiar nada la segunda.
-- ============================================================

-- El bucket queda público. El `insert ... on conflict do update` cubre
-- los dos casos de una sola vez: si la base es nueva y la 0003 ya lo
-- creó privado, lo abre; si el bucket no existiera (base a medio
-- reconstruir), lo crea ya público.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do update
  set public = true;

-- Las dos políticas de la 0003 se re-declaran acá con `drop policy if
-- exists` adelante, porque una base reconstruida desde el repo podría
-- tenerlas y una migrada a mano no: así el archivo se puede pegar sobre
-- cualquiera de las dos sin el error «policy already exists», que es lo
-- que corta el pegado a la mitad y deja el resto sin correr.
drop policy if exists "Cualquiera puede subir un comprobante" on storage.objects;
create policy "Cualquiera puede subir un comprobante"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'comprobantes');

drop policy if exists "El equipo puede ver los comprobantes" on storage.objects;
create policy "El equipo puede ver los comprobantes"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'comprobantes');
