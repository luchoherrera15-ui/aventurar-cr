# Cobrar con tarjeta (Stripe)

Lo que hay que hacer **una sola vez** en el panel de Stripe y en Vercel
para que el botón «Pagar con tarjeta» exista. Mientras no se haga, no
pasa nada: el botón no aparece y todo se sigue comprando por SINPE con
comprobante, como hasta hoy.

Con la misma cuenta y las mismas llaves se cobran **dos** productos: los
**paquetes de Lealtad** (suscripción que se renueva) y las
**invitaciones digitales** (pago suelto de un pedido). Los pasos 1 a 5
de abajo son para Lealtad; las invitaciones no necesitan ni productos ni
variables de precio y tienen su propia sección
[al final](#las-invitaciones-digitales).

Dos cosas que conviene tener claras antes de empezar:

- **El SINPE no se reemplaza.** Muchas tarjetas costarricenses vienen
  bloqueadas para compras internacionales y la LLC cobra desde Estados
  Unidos. Para buena parte de la clientela, el depósito con comprobante
  va a seguir siendo el único camino que funciona.
- **El plan Prueba ($0) no pasa por Stripe.** Se activa solo, como
  siempre.

---

## 1. Los productos y los precios

En **Product catalog → Add product**. Se crea **un producto por
paquete** y, dentro de cada uno, **dos precios recurrentes**: uno
mensual y uno anual.

| Producto    | Precio mensual | Precio anual | Moneda |
| ----------- | -------------- | ------------ | ------ |
| Arranque    | 12             | 120          | USD    |
| Impulso     | 42             | 420          | USD    |
| Ilimitado   | 89             | 890          | USD    |

El anual regala dos meses (12 × 12 = 144, y el anual sale 120): eso ya
está escrito en el catálogo del código, no hay que configurar ningún
descuento en Stripe.

Al crear cada precio, Stripe da un id que empieza con `price_`. **Hay
que copiar los seis.** No sirve el id del producto (`prod_…`) — es el
del precio.

> Los ids del modo **prueba** (test) y los de **producción** (live) son
> distintos. Si se prueba primero en test, después hay que rehacer los
> seis productos en live y cambiar las seis variables.

## 2. Las llaves

En **Developers → API keys**:

- Copiar la **Secret key** (`sk_test_…` en prueba, `sk_live_…` en
  producción). La publishable key no hace falta: Bookea usa Checkout
  alojado y no dibuja ningún formulario de tarjeta.

## 3. El webhook

En **Developers → Webhooks → Add endpoint**:

- **URL**: `https://www.bookea.lat/api/stripe/webhook`
  (con `www` — es el dominio que usa el resto del sitio).
- **Eventos a escuchar** (los seis):
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

  El segundo es solo para las invitaciones digitales, y solo hace falta
  el día que se active en Stripe un medio de pago que acredita tarde
  (con tarjeta y billeteras el cobro es inmediato y llega en el
  `completed`). Cuesta nada dejarlo puesto desde ahora y evita que un
  cobro quede sin registrar si algún día se agrega uno.
- Guardar, entrar al endpoint recién creado y copiar el **Signing
  secret** (`whsec_…`).

**Esto es lo más importante de toda la configuración.** El plan se
activa únicamente cuando llega un evento firmado por Stripe: si el
signing secret está mal, los cobros entran y ningún paquete se activa.
El único rastro es la línea `[stripe] Evento rechazado por firma
inválida` en los logs de Vercel.

## 4. El Customer Portal

En **Settings → Billing → Customer portal**, activarlo y dejar
habilitado:

- actualizar el método de pago;
- cancelar la suscripción (al final del período, no al instante);
- cambiar de plan, con los tres productos del paso 1 en la lista;
- ver el historial de facturas.

Sin esto activado, el botón «Administrar mi suscripción» del panel
devuelve un error de Stripe.

## 5. Las variables en Vercel

En **Project → Settings → Environment Variables**, ocho en total:

```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_ARRANQUE_MENSUAL=price_…
STRIPE_PRICE_ARRANQUE_ANUAL=price_…
STRIPE_PRICE_IMPULSO_MENSUAL=price_…
STRIPE_PRICE_IMPULSO_ANUAL=price_…
STRIPE_PRICE_ILIMITADO_MENSUAL=price_…
STRIPE_PRICE_ILIMITADO_ANUAL=price_…
```

Después hay que **volver a desplegar**: las variables se leen al
arrancar el servidor.

Un paquete al que le falte su variable simplemente no muestra botón de
tarjeta — no muestra un botón roto.

## 6. La migración

Pegar `supabase/migrations/0143_suscripciones_stripe.sql` en el SQL
Editor de Supabase. Crea `suscripciones` y `eventos_stripe`.

Recordar la regla de siempre: **dejar una línea en blanco antes del
bloque pegado**, porque el editor se come el primer carácter.

Sin la migración, el webhook contesta 500 a propósito y Stripe
reintenta: los eventos no se pierden, quedan esperando a que la tabla
exista.

## 7. La prueba de punta a punta

Hay **dos** lugares donde se cobra con tarjeta, y conviene probar los
dos: el panel de un negocio que ya tiene el módulo, y la página de
paquetes, que es donde compra el cliente nuevo.

### 7.1 El que YA tiene el módulo (upgrade)

1. Con las llaves de **test**, entrar a `/lealtad/panel/<negocio>`,
   sección **Plan y facturación**, y tocar «Pagar».
2. Pagar con la tarjeta de prueba `4242 4242 4242 4242`, cualquier
   fecha futura y cualquier CVC.
3. Volver al panel: el aviso dice que el pago entró y que el paquete se
   activa en unos segundos.
4. En **Developers → Webhooks → el endpoint**, los eventos tienen que
   figurar con respuesta **200**.
5. Recargar el panel: el paquete tiene que ser el nuevo.

### 7.2 El que TODAVÍA NO TIENE NADA (el caso que más importa)

1. Con una cuenta sin ningún negocio, entrar a `/lealtad/planes`,
   elegir un paquete de pago y tocar «Llevar este plan».
2. Escribir el nombre del negocio en «¿Cómo se llama tu negocio?» y
   tocar «Pagar … por mes».
3. Pagar con `4242 4242 4242 4242`.
4. Al volver, la página dice que el pago entró y que el programa queda
   listo en unos segundos.
5. Entrar a `/lealtad/panel`: el negocio tiene que estar ahí, con su
   paquete y con el módulo encendido.

**Y la prueba que de verdad importa**: cerrar el Checkout SIN pagar (paso
3) y comprobar que en `/lealtad/panel` **no aparece ningún negocio**. El
negocio se crea con el cobro confirmado, nunca antes.

Si el paso 4 de 7.1 muestra **400**, el signing secret no coincide. Si
muestra **500**, falta la migración o falla la base — el detalle está en
los logs de Vercel.

---

## Cómo funciona por dentro (para quien toque el código)

- **Nada se activa desde el navegador.** La página de éxito de Checkout
  solo dice «gracias»: esa URL se escribe a mano, y si activara algo,
  cualquiera se regalaría el paquete de $89.
  Quien activa es `src/app/api/stripe/webhook/route.ts`, y solo con la
  firma verificada.
- **Idempotencia.** Cada evento se anota en `eventos_stripe` con
  `stripe_event_id` como llave primaria antes de hacer nada. El
  reintento normal de Stripe choca con la llave y no vuelve a activar.
- **El plan sale del precio.** El `price_id` que Stripe dice que se está
  cobrando se traduce con las variables `STRIPE_PRICE_…`. Nunca de la
  metadata que viajó por el navegador. Un precio no mapeado deja la
  suscripción registrada, sin activar nada, y manda un correo al equipo.
- **Nadie se degrada solo.** Una cancelación o una mora guardan el
  estado nuevo y avisan por correo, pero **no** le bajan el plan al
  negocio: pasar de `ilimitado` a `prueba` recortaría el cupo de 1.150
  clientes a 25 en el mismo segundo, y el primero en enterarse sería un
  cliente en el mostrador. La baja la decide una persona desde
  `/admin/complementos`.

### El cobro de alguien que todavía no tiene negocio

Es el caso de `/lealtad/planes`, y el orden es **cobrar primero, crear
después**:

1. La persona elige paquete y escribe el nombre de su negocio.
2. El servidor deja una **solicitud de alta** (`solicitudes_lealtad`
   sin rancho — la forma de la 0130), firmada con su id de usuario, y
   manda su id a Stripe en `metadata.solicitud_id`.
3. **El negocio no existe todavía.** Si el pago se abandona, no queda
   ningún rancho: solo una solicitud pendiente, que es exactamente lo
   que ya pasa con el SINPE.
4. Cuando llega el evento firmado y la suscripción está al día, el
   webhook crea el negocio con la misma función que usa el botón
   «Aceptar» de `/admin/complementos`
   (`src/lib/lealtad/alta-desde-solicitud.ts`), le escribe el paquete y
   enciende el complemento.

La solicitud se **reserva con un UPDATE condicional** antes de crear
nada, porque `checkout.session.completed` y
`customer.subscription.created` llegan casi juntos con el mismo
`solicitud_id`: sin esa reserva, la persona terminaría con dos negocios.

> Mientras el cobro está en curso, la solicitud aparece en
> `/admin/complementos` con el texto **«PAGO CON TARJETA EN CURSO — no
> aprobar a mano»**. Aprobarla desde ahí regalaría el paquete que la
> persona está justo pagando.

Archivos: `src/lib/pagos/` (precios, cliente, Checkout, motor del
webhook), `src/app/api/stripe/webhook/route.ts` (el endpoint),
`src/app/lealtad/panel/[id]/suscripcion-actions.ts` (upgrade y Portal),
`src/app/lealtad/planes/pago-actions.ts` (la compra del cliente nuevo),
`src/lib/lealtad/alta-desde-solicitud.ts` (la solicitud se vuelve
negocio).

---

## Las invitaciones digitales

El mismo Stripe, la misma llave y el mismo webhook cobran también los
paquetes de **invitaciones digitales** (`/invitaciones`). Es el otro
producto que se paga con tarjeta, y funciona distinto en un punto que
conviene tener claro.

**No es una suscripción.** Lealtad se cobra en `mode: "subscription"`:
hay renovación, mora y corte. Una invitación es un **pago suelto**
(`mode: "payment"`): se cobra una vez, no se renueva, no cae en mora y
no hay nada que apagar después. Por eso no pasa por el mapeo de
`price_id`, ni por el interruptor de `corte.ts`.

**No hay variables de precio que llenar.** El monto sale de
`pedidos_invitacion.monto_crc` —lo que la base calculó al crear el
pedido, con el álbum ya sumado si lo lleva— y viaja como `price_data`
en la sesión. Un paquete nuevo, un pack o un cambio de promo se venden
sin tocar una variable de Vercel.

**Se cobra en colones.** Es el mismo número que la pantalla muestra y
que el SINPE pide depositar, así que los dos caminos cobran literalmente
lo mismo. El colón lleva dos decimales, o sea que el monto va en
céntimos (₡44 900 → 4 490 000): la conversión es
`centavosDeColones()` y tiene su prueba, porque equivocarse ahí es
cobrar cien veces de más.

**Apple Pay y Google Pay salen solos.** No hay código nuestro detrás:
la sesión **no declara `payment_method_types`**, y por eso Checkout
resuelve los métodos según el dispositivo. En el momento en que esa
lista se escriba a mano (`["card"]`), las billeteras desaparecen.

### Qué pasa cuando entra el cobro

El webhook busca la marca `bookea_producto: "invitacion"` en la metadata
de la sesión y, si está, mueve el pedido a **`pagado`**, le pone
`metodo_pago = 'stripe'`, guarda la sesión (`cs_…`) en `referencia_pago`
—hace de comprobante— y sella `pagado_en`. Después salen los dos
correos: el de «pago confirmado» al cliente y el aviso al equipo.

Dos casos que no terminan en `pagado`:

- **Lo cobrado no coincide con lo que vale el pedido** (o la moneda no
  es la del pedido, o es un pedido viejo sin `monto_crc`): la plata
  entró y queda registrada igual, pero el pedido va a **`en_revision`**
  en vez de `pagado`, con un correo al equipo. Nadie pasa a diseño con
  un monto que no cuadra, y nadie que pagó se queda sin constancia.
- **El pedido no existe, o está cancelado**: no se toca nada y llega un
  aviso de que hay que atenderlo a mano. El evento entero queda en
  `eventos_stripe`.

La idempotencia acá **no** es la tabla de eventos: es el reclamo del
pedido. `eventos_stripe` frena el reintento del *mismo* evento, pero el
`completed` y el `async_payment_succeeded` de un mismo cobro son eventos
distintos. Lo que garantiza que se cobre y se avise una sola vez es el
UPDATE condicional de `cobrarPedidoInvitacion`, que solo toca el pedido
si venía esperando plata y **no lo había cobrado ya una tarjeta**.

### La prueba de punta a punta

1. Con las llaves de prueba, pedir una invitación en `/invitaciones` y
   llegar a la pantalla de pago.
2. Comprobar que el total en pantalla es el mismo que dice
   `pedidos_invitacion.monto_crc` (si se marcó el álbum, tiene que
   incluirlo).
3. Pagar con `4242 4242 4242 4242` y confirmar que el monto de Stripe
   es ese mismo número en colones — **no cien veces más ni cien veces
   menos**. Es lo único que hay que mirar con lupa la primera vez.
4. Volver al sitio y ver «Pago confirmado»; en `/admin/invitaciones?tab=pedidos`
   el pedido tiene que estar en **Pagado**, con «Pagó por Tarjeta» y la
   referencia `cs_…`.
5. Reenviar el mismo evento desde el panel de Stripe: el pedido no
   cambia y **no** sale un segundo correo.

> Si la cuenta de Stripe no admite cobrar en colones, la sesión no se
> crea: el botón muestra el error y el SINPE sigue funcionando igual. Es
> lo primero a descartar si el botón de tarjeta falla siempre.

Archivos: `src/lib/pagos/invitaciones-pagadas.ts` (qué se cobra y
cuándo), `src/lib/pagos/checkout-invitaciones.ts` (la sesión),
`src/app/invitaciones/pago/[pedidoId]/pago-actions.ts` (el botón),
`src/lib/pagos/puerta-supabase.ts` (el reclamo del pedido).
