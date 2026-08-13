# Cobrar los paquetes de Lealtad con tarjeta (Stripe)

Lo que hay que hacer **una sola vez** en el panel de Stripe y en Vercel
para que el botón «Pagar con tarjeta» exista. Mientras no se haga, no
pasa nada: el botón no aparece y todo se sigue comprando por SINPE con
comprobante, como hasta hoy.

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
- **Eventos a escuchar** (los cinco):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
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

1. Con las llaves de **test**, entrar a `/lealtad/panel/<negocio>`,
   sección **Plan y facturación**, y tocar «Pagar».
2. Pagar con la tarjeta de prueba `4242 4242 4242 4242`, cualquier
   fecha futura y cualquier CVC.
3. Volver al panel: el aviso dice que el pago entró y que el paquete se
   activa en unos segundos.
4. En **Developers → Webhooks → el endpoint**, los eventos tienen que
   figurar con respuesta **200**.
5. Recargar el panel: el paquete tiene que ser el nuevo.

Si el paso 4 muestra **400**, el signing secret no coincide. Si muestra
**500**, falta la migración o falla la base — el detalle está en los
logs de Vercel.

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

Archivos: `src/lib/pagos/` (precios, cliente, motor del webhook),
`src/app/api/stripe/webhook/route.ts` (el endpoint),
`src/app/lealtad/panel/[id]/suscripcion-actions.ts` (Checkout y Portal).
