# CELEBRAR · Fase 5 (v1): Stripe conectado a los créditos, admin, balance, partners y la invitación en escritorio

Fecha: 21 sep 2026 (tarde). Todo en local (`localhost:3100`), sin commit ni deploy.
Migraciones **0246** (Stripe + admin de créditos) y **0247** (partners) APLICADAS
en producción. El dueño autorizó explícitamente conectar la pasarela («asocia la
pasarela de pago de Stripe con los créditos para que todo quede funcionando»).

## 1. Stripe ↔ créditos

- **Compra** (`/app/creditos` → botón Comprar): `comprarCreditos` (server action)
  resuelve el paquete en el servidor —público, o mayorista si la cuenta es un
  partner aprobado— y abre **Stripe Checkout** (`mode: payment`, CRC, `price_data`
  inline) con metadata `bookea_producto=celebrar_creditos`, dueño, paquete,
  créditos y **precio esperado**. Sin `payment_method_types`: Apple/Google Pay
  salen solos. Archivo: `src/lib/celebrar/pagos/checkout-creditos.ts`.
- **Acreditación por dos caminos, sin duplicar**:
  1. El **webhook** compartido (`/api/stripe/webhook` → `procesarEventoStripe`):
     un pago suelto pregunta primero si es de CELEBRAR (`datosDePagoDeCreditos`)
     y si no, sigue siendo (o no) una invitación digital de Bookea. La `Puerta`
     ganó `acreditarCreditosCelebrar`; resultados nuevos `creditos_acreditados`
     / `creditos_sin_efecto`. Tests en `suscripciones.test.ts` (3 nuevos).
  2. **La vuelta del navegador** (`?pago=listo&sesion=cs_…`): NO le cree a la
     URL; pide la sesión a Stripe con la llave secreta, comprueba pagada y de
     esa cuenta, y acredita. Así la persona ve el saldo nuevo al instante, aun
     en local sin `stripe listen`.
  Ambos llaman a `acreditarCompraDeCreditos` → RPC `celebrar_acreditar_creditos`
  con la **sesión como referencia única**: el segundo recibe `false`.
- **Decisión pura y probada** (`creditos-pagados.ts` + test, 10 casos): los
  créditos salen del paquete del catálogo; si el monto no cuadra se acredita
  igual (la plata entró) y se avisa al equipo; `unpaid` espera al
  `async_payment_succeeded`.
- 0246: `monto_crc` en el libro; la RPC de acreditar se **DROPeó y recreó** con
  `p_monto_crc` (dos firmas conviviendo confunden a PostgREST) y maneja
  `unique_violation` como «ya estaba».
- **Local**: `.env.local` no tiene `STRIPE_SECRET_KEY` → los botones quedan
  deshabilitados con el aviso; en Vercel las llaves (live) ya existen y el
  endpoint del webhook ya recibe `checkout.session.completed` para Bookea. Para
  probar el checkout en local: pegar `STRIPE_SECRET_KEY=sk_test_…` en `.env.local`.

## 2. Balance y admin

- `BalanceCreditos` (Inicio y Mis créditos): entraron (comprados · regalo),
  usados (último uso), quedan, barra de % usado y ₡ invertidos.
- `/app/admin/creditos` (solo `perfiles.rol = admin`, la misma marca que el
  admin de Bookea): vendidos + ₡ ingresados, consumidos, regalados/ajustes, **en
  circulación** (el pasivo), tabla de todos los movimientos con correo/nombre/
  celebración, filtros por tipo y correo, y **acreditar a mano** (SINPE, cortesía,
  ajuste) con referencia anti-duplicado. Todo por RPC `security definer` con
  `is_admin()` adentro (`celebrar_admin_resumen_creditos`, `_movimientos`,
  `_buscar_cuenta`); el correo sale de `auth.users`, adonde PostgREST no llega.
- El rail muestra «Admin · Créditos / Partners» solo a admins (`esAdminCelebrar`).

## 3. Partners (0247)

Modelo **mayorista** (lo que describió el dueño): el partner compra créditos
más baratos y le cobra a su cliente por aparte; publica al mismo costo en
créditos que todo el mundo.

- `celebrar_partners` (id = cuenta): ficha pública (nombre comercial, tipo,
  ciudad, sitio, IG, WhatsApp, descripción, logo, eventos/año), `estado`
  (pendiente → aprobado / suspendido / rechazado), `descuento_pct` (20 por
  defecto), `marca_en_invitaciones`, `mostrar_en_directorio`. **Privilegios
  por columna**: la persona escribe solo lo suyo; estado/descuento/notas van
  por RPC de admin.
- Flujo probado: aplicar en `/app/partner` → «Solicitud en revisión» →
  `/app/admin/partners` aprueba con 25 % → panel de partner (precio por
  crédito, firma, celebraciones, plantillas de la casa, ficha) → paquetes
  mayoristas en `/app/creditos` (500 / 1 000 / 2 500, precio = créditos × ₡50 ×
  (1 − descuento), redondeado a la centena, calculado en el servidor y
  verificado en el webhook) → **firma «Diseñada por Eventos Luna»** con link al
  pie de `/celebrar/sofia-y-andres` (RPC anónima `celebrar_partner_de`).
- **Plantillas de la casa**: botón «Guardar como plantilla» en el editor (solo
  partners) → `celebrar_partner_plantillas`; en `/app/partner` se listan con
  miniatura real y «Usar en esa celebración» → copia el documento rellenado
  con los datos de la celebración y abre el editor.
- `celebrar_celebraciones.cliente jsonb` creado para «para quién es» (UI
  pendiente en la ficha de la celebración).
- Landing pública `/celebrar/partners` (en el nav) con la propuesta, la cuenta
  en corto, los 6 beneficios y el **directorio** de aprobados.
- Estado de prueba: la cuenta del dueño quedó como partner «Eventos Luna»
  aprobado al 25 % con una plantilla guardada. Se revierte desde el admin
  (estado → pendiente/rechazado) o borrando la fila.

### Beneficios propuestos (los que van en la landing)
1. Precio mayorista (descuento por partner, fijado por el equipo).
2. Firma en cada invitación con logo y link → publicidad ante cada invitado.
3. Plantillas de la casa (estilo propio reutilizable).
4. Panel multicliente (todas las celebraciones, confirmaciones y CSV en una cuenta).
5. Directorio público de partners.
6. Prioridad de soporte y acceso temprano a lo nuevo (álbumes, video, recuerdos).

Ideas que quedan para después (no construidas): link de aprobación del cliente
(vista previa compartible antes de publicar), transferir la celebración al
cliente tras el evento, colección de plantillas exclusiva para partners, IA sin
enfriamiento para partners, comisión por referidos.

## 4. La invitación en escritorio y los textos

- **Escenario** (`escenario` en `RenderInvitacion`, usado por la página pública
  y la vista previa): desde 900 px la invitación es una **pieza de 720 px
  centrada** (1cqi ≈ 7 px, proporciones de teléfono grande) sobre un fondo de
  ambiente —la paleta + la foto de portada desenfocada—, con sombra y esquinas
  redondeadas. En el teléfono no cambia nada. Antes, la composición pensada en
  `cqi` se estiraba a 1 900 px y quedaba «vacía».
- **Columnas** en la pieza ancha (`@container (min-width: 620px)`): galería a
  tres, lugar con el mapa al lado, regalos a dos.
- **Formulario de confirmación como tarjeta**: un borde que agrupa todo,
  espacios en px (no cqi), Sí/No como control segmentado, chevron del select
  dibujado con CSS, y **las opciones del desplegable siempre en tinta oscura
  sobre blanco** (heredaban el blanco de la escena → invisibles).
- Centrado: `.inv .inv-ancho` con la misma especificidad que `.inv .inv-p`
  (su `margin: 0` mataba el `auto`); la fecha monumental y la hora son bloques
  (eran `inline-flex` y en la pieza ancha quedaban lado a lado).
- QA: `scripts/celebrar-captura-invitacion.mjs <slug> [carpeta] [anchos]`
  captura cada escena por CDP (el screenshot normal de Playwright se queda
  esperando `document.fonts` con los <link> de Google Fonts).

## Verificación
eslint 0 · vitest **3 467** (178 archivos) · `npm run build` OK · flujos probados
en el navegador: aplicar/aprobar partner, guardar plantilla, firma pública,
admin de créditos con datos reales, balance en Inicio.

## Pendiente
- Probar el checkout real con una llave `sk_test_` (local) o en el deploy.
- «Cliente» en la ficha de la celebración (columna lista, UI pendiente).
- Correo al partner al aprobarlo; correo al equipo cuando alguien aplica.
- Directorio: página propia por partner (`/partners/<slug>`).
