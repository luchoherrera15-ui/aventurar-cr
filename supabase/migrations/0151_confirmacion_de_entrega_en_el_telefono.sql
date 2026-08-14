-- ============================================================
-- BOOKEA — La prueba real de que el pase SÍ llegó al teléfono (0151)
--
-- El dueño probó el flujo completo en vivo (dar un sello por el
-- mostrador) y preguntó algo que la plataforma no podía contestar: «la
-- plataforma reporta que se entregó, ¿pero hay forma de saber si de
-- verdad llegó al usuario?».
--
-- La respuesta honesta es que un HTTP 200 de Apple al mandar el aviso
-- push SOLO significa «Apple lo aceptó para entregarlo» — el protocolo
-- de Apple Wallet NO da un recibo de entrega. Es una cartero que dice
-- «tomé el sobre», no «el vecino lo abrió».
--
-- Pero SÍ hay una señal real: el teléfono, después de procesar el
-- aviso (o al abrir la app Wallet), vuelve a pedirnos el pase
-- actualizado — `GET /api/wallet/v1/passes/[passTypeId]/[serial]`. Que
-- ese pedido llegue es la prueba de que el aviso SÍ se procesó del
-- lado del teléfono. Hoy esa ruta sirve el pase y no deja rastro de
-- que pasó por ahí.
--
-- ------------------------------------------------------------
-- LA COLUMNA
-- ------------------------------------------------------------
-- `ultima_descarga_en` — cuándo un dispositivo pidió (y recibió) este
-- pase por última vez. La escribe la ruta del pase, después de servir
-- el .pkpass. Comparada con `actualizado_en` (cuándo cambió el
-- CONTENIDO), da la pregunta que hace falta:
--
--   ultima_descarga_en >= actualizado_en
--     → el teléfono YA pidió el pase después del último cambio:
--       entregado, confirmado.
--   ultima_descarga_en is null, o menor que actualizado_en
--     → el teléfono todavía no pasó a buscarlo. Puede ser que el aviso
--       está en camino, o que el teléfono no lo procesó — desde acá no
--       se puede distinguir cuál, pero al menos se sabe que TODAVÍA no
--       está confirmado, en vez de asumir que sí.
--
-- Aditiva e idempotente: no borra ni cambia ninguna fila.
-- ============================================================

do $pases0151$
begin
  if to_regclass('public.pases_wallet') is null then
    raise notice 'AVISO 0151: falta pases_wallet (0060). No se agrega la confirmación de entrega.';
    return;
  end if;

  alter table public.pases_wallet
    add column if not exists ultima_descarga_en timestamptz;

  execute $c$comment on column public.pases_wallet.ultima_descarga_en is
    'Cuando un dispositivo pidio y recibio este pase por ultima vez '
    '(GET /api/wallet/v1/passes/.../..., 0151). Comparada con '
    'actualizado_en: si esta es mayor o igual, el telefono confirmo el '
    'ultimo cambio. Si es null o menor, todavia no paso a buscarlo.'$c$;
end
$pases0151$;

-- Sin RLS nueva: la escribe el servidor con la llave de servicio (la
-- misma ruta que ya sirve el .pkpass, autenticada por el auth_token del
-- pase — nunca por sesión). Queda dentro del SELECT que `pases_wallet`
-- ya le da a `authenticated` sobre su propio pase (0060); el panel del
-- negocio la lee con la llave de servicio, igual que el resto del
-- módulo.
