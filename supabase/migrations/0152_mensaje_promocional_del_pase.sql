-- ============================================================
-- BOOKEA — Notificaciones de marketing en el pase (0152)
--
-- El dueño lo pidió con un ejemplo concreto: "MIÉRCOLES MATCHAS 2X1" —
-- un aviso que le llegue al cliente, no un dato que tenga que ir a
-- buscar. La pestaña Marketing (panel) ya tiene el botón de PROBAR el
-- aviso (0151); esto es lo que hace falta para ENVIAR uno de verdad.
--
-- ------------------------------------------------------------
-- POR QUÉ UNA COLUMNA, Y NO UNA TABLA DE ENVÍOS
-- ------------------------------------------------------------
-- El pase de Apple se REGENERA ENTERO cada vez que el teléfono lo pide
-- (generar.ts, tarjetaDesdeFila) — no se "agrega" un mensaje arriba de
-- lo anterior, se arma el pass.json de cero a partir de la fila de
-- `programa_lealtad`. Por eso el mensaje ACTIVO tiene que vivir en una
-- columna de esa misma fila: es lo que `construirPassJson` (tarjeta.ts)
-- necesita leer para poner el campo con `changeMessage` que hace
-- aparecer el aviso en la pantalla bloqueada del cliente.
--
-- Google Wallet es distinto: tiene su propio mecanismo nativo
-- (`loyaltyObject.addMessage`, en google.ts) que NO necesita leer nada
-- de acá — el mensaje se manda una vez y Google lo guarda de su lado.
-- La columna igual sirve para que el panel muestre "el último mensaje
-- que mandaste fue...".
--
-- Un historial completo de envíos (quién lo vio, cuándo) es la tabla
-- que este archivo NO crea: no hay todavía ningún lector para eso, y
-- construirla ahora sería la misma trampa que ya se evitó con la ayuda
-- de diseño (0149) — no se arma lo que nadie va a leer.
--
-- Aditiva e idempotente.
-- ============================================================

do $pases0152$
begin
  if to_regclass('public.programa_lealtad') is null then
    raise notice 'AVISO 0152: falta programa_lealtad (0060). No se agrega el mensaje promocional.';
    return;
  end if;

  alter table public.programa_lealtad
    add column if not exists mensaje_promocional text;

  alter table public.programa_lealtad
    add column if not exists mensaje_promocional_en timestamptz;

  execute $c$comment on column public.programa_lealtad.mensaje_promocional is
    'El aviso ACTIVO del pase (0152), ej. "MIERCOLES MATCHAS 2X1". Lo lee '
    'tarjetaDesdeFila/construirPassJson para el campo con changeMessage de '
    'Apple. null = sin aviso activo, el pase sale igual que siempre.'$c$;

  execute $c$comment on column public.programa_lealtad.mensaje_promocional_en is
    'Cuando se mando el ultimo aviso (0152) - solo para mostrarlo en el '
    'panel, ningun codigo lo lee para decidir nada.'$c$;
end
$pases0152$;

-- Sin RLS nueva: la columna vive dentro de `programa_lealtad`, que ya
-- tiene su política ("El dueño administra su programa", 0060/0148) —
-- el dueño la puede guardar como cualquier otro campo de su tarjeta. El
-- envío real (el push a Apple, la llamada a Google) lo hace el
-- servidor con la llave de servicio, igual que el resto del módulo de
-- wallet.
