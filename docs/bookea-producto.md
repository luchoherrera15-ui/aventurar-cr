# BOOKEA — el producto, en un solo documento

> **24 de septiembre de 2026.** Este es el documento maestro: qué es
> Bookea, qué problema ataca, qué ofrece y cómo se cuenta. Cuando haya
> que explicarle Bookea a alguien —un cliente, un socio, un diseñador o
> una IA— se explica desde acá.
>
> Manda sobre cualquier texto comercial anterior. Donde choque con
> `docs/arquitectura.md`, ese decide la **arquitectura** y este decide
> el **producto y el relato**.
>
> **La regla que atraviesa todo: solo se promete lo que el repositorio
> puede entregar hoy.** Por eso cada bloque lleva su estado real.

| Marca | Significa |
|---|---|
| **VIVO** | Existe, está desplegado y un cliente lo puede usar hoy |
| **LISTO, SIN DESPLEGAR** | Construido y probado en local; falta subirlo |
| **PARCIAL** | El motor existe, falta pantalla o falta conectarlo |
| **POR HACER** | Decidido acá, todavía no construido |

---

## 1. La idea, en una frase

> **Bookea es donde un negocio pequeño se vuelve digital sin contratar a
> nadie: su página, sus pedidos, sus reservas, sus clientes y su plan de
> lealtad, en un solo panel.**

Si hay que decirlo en cinco palabras: **un registro, un panel, un
cliente**.

---

## 2. El problema que atacamos

El enemigo no es un competidor. **Es la dispersión.**

Un negocio pequeño hoy trabaja así:

| Lo que necesita | Dónde lo tiene hoy | Qué se pierde |
|---|---|---|
| Mostrar su menú | Una foto en el estado de WhatsApp | Nadie la encuentra mañana |
| Recibir pedidos | Chats sueltos, uno por cliente | Se pierden, se contestan tarde, se copian mal |
| Agendar | Un cuaderno o la memoria | Choques de horario, huecos, olvidos |
| Saber quién es buen cliente | La cabeza del dueño | Se va con el empleado que renuncia |
| Que vuelvan | Una tarjetita de cartón con sellos | Se moja, se pierde, no se mide |
| Que lo conozcan | Una historia de Instagram | Se borra a las 24 horas |

Cada herramienta que le venden resuelve **un pedazo** y no habla con las
otras. El link-in-bio no sabe quién compró. La hoja de Excel no sabe
quién volvió. La tarjeta de sellos no sabe cuánto gastó. **El dueño es el
cable que une todo, y por eso no puede crecer ni tomarse un día libre.**

### La frase que resume el problema, para usar en el home

> Tu menú está en una foto. Tu agenda, en un cuaderno. Tus clientes, en
> tu cabeza. **Nada de eso se habla entre sí.**

---

## 3. La promesa

**Bookea junta las cinco piezas y las sincroniza.** El mismo cliente que
escanea el QR de la mesa, pide, y suma un sello, es **una sola persona**
en el sistema — con su historial, su gasto y su tarjeta.

Eso no es un deseo: es la migración **0138**, que ya está en producción.
Una persona no es una cuenta; la llave son sus contactos reales. Quien
deja su WhatsApp para llevarse el pase a Wallet **es la misma persona**
que mañana abre cuenta, con el mismo saldo y el mismo pase.

**Esa es la ventaja competitiva de Bookea, y hay que decirla en el home.**
Linktree no la tiene. Un menú en PDF no la tiene. Una tarjeta de sellos
de cartón no la tiene.

---

## 4. A quién le hablamos

Tres perfiles, en este orden de prioridad comercial:

### 4.1 Gastronomía — restaurante, cafetería, soda, bar, panadería, food truck
**Su dolor**: el menú desactualizado y los pedidos perdidos en el chat.
**Lo que se lleva**: su página con menú y fotos, pedidos armados que caen
en su panel, QR por mesa, y plan de lealtad.

### 4.2 Tienda — física o en línea, boutique, floristería, farmacia, veterinaria
**Su dolor**: no tiene dónde mostrar el catálogo ni cómo cobrar un pedido.
**Lo que se lleva**: catálogo con precios, pedidos para recoger o enviar,
y plan de lealtad.

### 4.3 Citas — barbería, salón de belleza, uñas, spa, masajes
**Su dolor**: la agenda en papel y las cadenas de WhatsApp para cuadrar
una hora.
**Lo que se lleva**: agenda real, reserva instantánea, ficha de cliente,
y además **aparece en el marketplace de Bookea**, donde lo encuentran
clientes nuevos.

> Los 18 tipos de negocio reales viven en `src/lib/business/modulos.ts`.
> Esa es la taxonomía canónica (decisión congelada #5). Los tres perfiles
> de arriba son **agrupaciones comerciales** de esos 18 tipos, no una
> lista nueva.

---

## 5. Lo que ofrecemos — los cuatro productos

La lista viva está en `src/lib/productos.ts`. **Un archivo, no dos**: el
home y la pantalla de «elegí qué activar» leen el mismo.

### 5.1 Tu página · VIVO
**Promesa**: tu menú, tus links y tu QR en una sola página.

- Link hub propio en `bookea.lat/s/<tu-negocio>`, con dominio propio si lo querés
- Menú o catálogo por secciones, con fotos, precios y hasta seis idiomas
- 21 países y 19 monedas
- Temas, tipografías, efectos y encabezados: el negocio arma su cara
- QR propio, y QR por mesa
- Previa con su marca al compartir el link (Open Graph)

### 5.2 Pedidos · VIVO
**Promesa**: el cliente arma su pedido y a vos te entra listo.

- Carrito con personalización por plato: quitar ingredientes, agregar extras, nota
- El precio de los extras **lo pone el servidor**, nunca el navegador
- Tres modalidades: en la mesa (por QR), para recoger, y exprés a domicilio
- El pedido **queda guardado en el panel** (pantalla de comandas) **y además** le llega al negocio por WhatsApp, ya escrito y ordenado: qué pidió, cómo lo quiere, a nombre de quién, dónde y cuánto

> ⚠️ **REGLA DE LENGUAJE (dueño, 24 sep 2026).** WhatsApp es **nuestro
> canal de entrega al negocio**, no una función que el cliente elige.
> **El cliente nunca ve la palabra «WhatsApp» en el flujo de pedido.**
> Él pide en la plataforma y punto. El texto correcto de cara al cliente
> es el que ya usa el producto: *«El negocio recibe tu pedido al instante
> y te avisa al teléfono cuando esté listo.»*
>
> La única excepción legítima es el botón de **contacto** («Escribinos
> por WhatsApp») y el modo «consultar» de un negocio que todavía no
> vende en línea.

### 5.3 Pases de lealtad · VIVO — **y es el producto que nos diferencia**
**Promesa**: sellos y recompensas en Apple Wallet y Google Wallet.

- Tarjeta con el logo, los colores y la regalía del negocio
- El cliente se agrega con un QR — **sin instalar nada**
- Se actualiza sola en el teléfono cuando le sellan
- Correos en los hitos (primer sello, penúltimo, meta)
- Estadísticas de verdad: entregas, canjes, por cliente, por colaborador, por canal, con filtros y CSV
- Cuadro «Listos para su recompensa»
- Panel propio, API pública, agentes de venta y planes

**Es el producto más maduro del repositorio y el que tiene clientes
reales pagando.** Por decisión del dueño, es donde nos queremos
enfatizar: es la pieza que hace que el cliente **vuelva**, y volver es lo
que un negocio pequeño necesita más que un cliente nuevo.

### 5.4 Reservas y marketplace · VIVO
**Promesa**: tu negocio aparece en Bookea y te reservan desde ahí.

- Ficha con fotos, servicios y precios
- Agenda con horarios, equipo y recursos
- **Reserva instantánea**: espacio + fecha + pago = reservado. Sin negociación previa, sin aprobar nada a mano
- Ficha de cliente y CRM
- El directorio vive en `bookea.lat/all`

### 5.5 Automatizaciones de Instagram · LISTO, SIN DESPLEGAR
**Promesa**: comentan una palabra en tu publicación y les llega tu link.

- Respuesta pública debajo del comentario
- Mensaje directo con la página del negocio
- La palabra clave la elige el negocio
- API oficial de Meta: sin scraping, sin contraseñas, sin tokens en el navegador
- Token cifrado, idempotencia por índice único

> ⚠️ **No se puede prometer todavía.** El código está construido y
> probado, y la migración 0238 está aplicada — pero **la app de Meta
> todavía no existe**, así que hoy no se puede entregar a un cliente.
> Mientras siga así, el home lo muestra como «en obra» y no como
> disponible. Qué más ofrece la API de Meta está en §9.

---

## 6. Cómo se conecta todo — la tesis

Esto es lo que hay que dibujar en el home, porque es lo que ningún
competidor tiene:

```
   EL NEGOCIO                 SUS CLIENTES              BOOKEA
   ──────────                 ────────────              ──────
   crea su página    ───▶     entran por el QR
                              o por el link
                                    │
                                    ▼
                              piden · reservan   ───▶   entra al panel
                                    │                   (comandas, agenda)
                                    ▼
                              suman un sello     ───▶   queda en su ficha
                                    │                   (una sola persona)
                                    ▼
                              llegan a la meta   ───▶   el negocio sabe
                                    │                   quién vuelve y
                                    ▼                   cuánto gasta
                                 VUELVEN
```

**La frase**: el negocio crea su presencia → sus clientes interactúan →
Bookea registra esa interacción → el negocio gestiona y fideliza → el
cliente vuelve.

---

## 7. El panel único — la decisión del 24 de septiembre de 2026

> Pedido del dueño, textual: «al registrarse en Bookea la persona ingrese
> a un panel, que se registre y diga qué tipo de comercio tiene… que de
> ahí configure su perfil, su link app, todo eso… y que tengamos un menú
> tipo CRM, que a la izquierda tengamos las opciones: pedidos y ahí ver
> las comandas, métricas, los mejores clientes, que todo esté
> sincronizado, que esa es la parte de lealtad, que esté todo ahí metido.
> O sea, **es unificar el producto**».

### 7.1 El recorrido de alta que queremos

```
  1. Registro           correo + contraseña (o Google / Apple)
  2. ¿Qué tenés?        restaurante · cafetería · tienda física ·
                        tienda en línea · barbería · salón · spa ·
                        gimnasio · otro
  3. Aprobación         AUTOMÁTICA. No hay revisión manual.
  4. Panel              entra directo y configura desde adentro
```

**El paso 2 es el que decide todo lo demás**: qué módulos ve en el menú,
qué palabras usa la interfaz («menú» para un restaurante, «catálogo» para
una tienda, «servicios» para una barbería), y qué add-ons le ofrecemos.

**El paso 3 no se negocia**: aprobación automática. Poner un humano en el
medio del alta es la forma más segura de perder al 80 % de los que se
registran.

### 7.2 El menú lateral

| Sección | Qué muestra | Estado hoy |
|---|---|---|
| **Inicio** | Tablero, plan y add-ons | VIVO |
| **Pedidos** | Comandas en vivo, historial, ticket promedio | VIVO (pantalla «restaurante» del panel de la página) |
| **Agenda** | Reservas, horarios, equipo, bloqueos | VIVO (en el otro panel — ver §7.3) |
| **Clientes** | Ficha, historial, gasto, **mejores clientes** | PARCIAL — existe `fichas_cliente` y el CRM, falta la vista «mejores clientes» unificada |
| **Lealtad** | Tarjeta, escáner, canjes, estadísticas | VIVO |
| **Métricas** | Ventas, pedidos, clientes nuevos vs. que vuelven | PARCIAL — hay métricas en tres lugares distintos, no una sola pantalla |
| **Mi página** | Enlaces, diseño, menú/catálogo, QR de mesas | VIVO |
| **Automatizaciones** | Instagram auto-reply | LISTO, SIN DESPLEGAR |
| **Equipo** | Quién entra al panel y con qué permiso | VIVO |
| **Plan** | Gratis / Pro, add-ons, facturación | VIVO |
| **Ajustes** | Datos del negocio, contacto, publicación | VIVO |

### 7.3 El obstáculo real, dicho sin rodeos

**Hoy hay TRES paneles, no uno.** Esta es la deuda que hay que pagar para
que la frase «todo en un solo lugar» sea verdad y no marketing:

| Panel | Ruta | Qué administra |
|---|---|---|
| La página | `/solutions/panel/[id]` | Enlaces, diseño, menú, pedidos, mesas, Instagram, plan |
| El negocio | `/mi-negocio/[id]` | Agenda, clientes, servicios, finanzas, reportes |
| Lealtad | `/lealtad/panel/[id]` | Tarjeta, miembros, sellos, canjes, estadísticas |

Y debajo hay **tres entidades de negocio** que no son la misma fila:
`ranchos` (marketplace y operación), `solutions_negocios` (la página) y
`celebrar_perfiles`. La decisión congelada #6 dice que **no se unifican
todavía**: primero federación por identidad (`personas`), después
migración progresiva.

**Traducción práctica**: el panel único se construye como **una sola
cáscara con un solo menú** que enruta a las pantallas que ya existen,
antes de tocar una sola tabla. Primero que se vea y se sienta uno;
después, cuando esté probado, se funden los datos.

> El panel de la página (`/solutions/panel/[id]`) **ya tiene** el menú
> lateral con Inicio, Tablero de comandas, Lealtad, Enlaces, Diseño,
> Menú, QR de mesas, Instagram, Equipo, Ajustes y Plan. Es el candidato
> natural a ser la cáscara única. Lo que le falta es Agenda, Clientes y
> Métricas — las tres viven hoy en el otro panel.

---

## 8. Reglas de lenguaje — cómo se nombra cada cosa

Estas no son preferencias de estilo. Son contratos: si se rompen, el
producto dice dos cosas distintas en dos pantallas.

1. **«Tu página»**, nunca «link hub», «link in bio», «Linksy» ni
   «Bookea Link». Esos son nombres técnicos internos; fuera del código no
   aparecen. (Decisión congelada #2.)
2. **El cliente nunca lee «WhatsApp» en el flujo de pedido.** (§5.2.)
3. **«Menú» para gastronomía, «catálogo» para tienda, «servicios» para
   citas.** Lo resuelve `vocabDe(rubro)`; no se escribe a mano.
4. **Nunca «carta».** El dueño lo decidió el 4 de septiembre.
5. **Categorías oficiales del marketplace**: Todos, Lugares,
   Alimentación, Animación, Organización, Decoración, Otros servicios.
   No se inventan categorías.
6. **Precios en la moneda del negocio**, con `fmtMoneda`. En Costa Rica,
   colones con formato local.
7. **Ni estrellas, ni cifras inventadas, ni negocios de mentira.** Hay
   CERO reseñas en la base. Un «+500 negocios» en el home es mentira y se
   nota.
8. **La reserva es instantánea.** No se agregan pasos de aprobación
   manual sin que se pidan.
9. **Todos los textos de interfaz, en español.**

---

## 9. Instagram: qué más nos permite Meta

Hoy usamos tres permisos (`instagram_business_basic`,
`…manage_comments`, `…manage_messages`) y un solo evento: `comments`.
Con **los mismos permisos que ya pedimos**, Meta expone más eventos. Esto
es lo que se puede construir sin pedirle nada nuevo al negocio:

| Evento de Meta | Qué habilita | ¿Vale la pena? |
|---|---|---|
| `comments` | Lo que ya hacemos: comentario → DM | **Construido** |
| `live_comments` | Lo mismo, durante un vivo | Sí, y es un diferenciador: nadie atiende los comentarios de un vivo |
| `messages` | Alguien manda un DM → responder automático | **Sí. Es el más valioso.** Un menú automático de respuestas: «1 Ver el menú · 2 Reservar · 3 Mi tarjeta de sellos» |
| `mentions` | Lo mencionan o lo etiquetan en un comentario | Sí, para agradecer automático |
| `message_reactions` | Reaccionan a un mensaje | Poco valor |
| `messaging_seen` | Confirmación de lectura | Poco valor solo; útil para métricas |
| `messaging_postbacks` | Toques en botones del mensaje | Sí, si hacemos el menú de respuestas |

**Lo que se puede mandar por DM** (no solo texto): texto de hasta 1 000
bytes, enlaces, imágenes (PNG/JPEG hasta 8 MB), audio, video (hasta
25 MB), PDF, stickers y reacciones, y publicaciones propias del negocio.

**Las dos reglas que condicionan el diseño:**

1. **Ventana de 24 horas.** Solo se le puede escribir a alguien que
   escribió primero, y hay 24 horas para responder. La respuesta privada
   a un comentario es la excepción que nos deja abrir la conversación —
   por eso el auto-reply de comentarios funciona.
2. **Acceso avanzado.** Recibir `comments` y `live_comments` requiere
   *Advanced Access* en la app de Meta. Esto es parte de lo que falta
   para poder entregar el producto.

**Recomendación**: cuando se cree la app de Meta, pedir de una vez el
evento `messages` además de `comments`. El auto-responder de DM
(«escribí MENÚ y te mando el link») es el doble de valioso que el de
comentarios y usa el permiso que ya tenemos.

**Fuentes**: [Webhooks — Instagram Platform](https://developers.facebook.com/docs/instagram-platform/webhooks) ·
[Send Messages — Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/) ·
[Instagram API with Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/)

---

## 10. El home — estructura propuesta

El home de hoy (`modo-plataforma.tsx`) es un titular y cuatro teléfonos.
Explica **qué vendemos**, pero no **qué problema resolvemos**, y por eso
no convence a quien no sabe todavía que tiene el problema.

> ⚠️ **El home tiene dos modos y eso no se toca.** `/` sin parámetros es
> la plataforma; `/` con `?q=`, `?lugar=`, `?provincia=`, `?rubro=` o
> `?sub=` es el buscador del marketplace, y ahí caen los redirects de
> `/citas` y `/eventos` y los links compartidos por WhatsApp. Lo que se
> rediseña es **el modo plataforma**; el modo descubrir queda igual.

### La estructura, sección por sección

**1 · Encabezado**
Logo · Productos · Precios · Entrar · **Empezá gratis**

**2 · Héroe — el problema primero**

> **Rótulo**: La plataforma de tu negocio
> **Titular**: Tu menú está en una foto. Tu agenda, en un cuaderno. Tus
> clientes, en tu cabeza.
> **Bajada**: Bookea los junta. Tu página, tus pedidos, tus reservas y tu
> plan de lealtad, en un solo panel — y todos hablando entre sí.
> **Botones**: Empezá gratis · Ver cómo funciona

*Alternativa más conservadora, si el titular en negativo no convence:*
«Todo tu negocio, en un solo lugar.» con la misma bajada.

**3 · La cadena, en cuatro pasos**
Un renglón horizontal, con un ícono por paso. Es la §6 de este documento.

> Creás tu página → Tus clientes piden o reservan → Todo entra a tu panel
> → Vuelven por su tarjeta de sellos

**4 · Los cuatro productos**
Reusa `CuatroProductos`, que ya lee `productos.ts`. Cada tarjeta gana una
línea de **antes / con Bookea**:

| Producto | Antes | Con Bookea |
|---|---|---|
| Tu página | Un menú en PDF que nadie abre | Tu menú, tus links y tu QR en una página |
| Pedidos | Pedidos sueltos en chats | El pedido entra armado a tu panel |
| Lealtad | Una tarjeta de cartón que se pierde | Sellos en el teléfono, que se actualizan solos |
| Reservas | Cadenas de mensajes para cuadrar una hora | La reserva entra sola, sin aprobar nada |

**5 · ¿Qué negocio tenés?**
Tres tarjetas —Gastronomía · Tienda · Citas— y al tocarlas se muestra qué
se lleva cada una (§4). **Es la misma pregunta que le vamos a hacer al
registrarse**, y eso no es casualidad: el home empieza el onboarding.

**6 · Un solo panel**
La captura ancha del panel con su menú lateral. Titular: **«Un panel. Todo
sincronizado.»** Bajada: el mismo cliente que escanea el QR, pide y suma
un sello es una sola persona en tu sistema.

**7 · Lealtad, destacada**
Sección propia, más grande que las demás, con el pase real montado.
Titular: **«Conseguir un cliente cuesta. Que vuelva, no.»**

**8 · El marketplace**
«Y además, te encontramos clientes nuevos.» Link a `/all`.

**9 · Precio**
**«Gratis mientras arrancamos.»** Sin letra chica, sin tarjeta.
(`hayProductosPagos()` ya devuelve `false`; cuando cambie, esta sección
cambia sola.)

**10 · Cierre**
Repetir el botón. Una línea: «Creá tu página en cinco minutos.»

**11 · Pie**

### Lo que el home NO puede decir todavía

- Nada de reseñas, estrellas ni cantidad de negocios
- Nada de «vendé en línea con pagos» como capacidad general
- Automatizaciones de Instagram: se muestra, pero rotulada «en obra»
- Celebrar y Foorkie **no aparecen**: son productos aparte (decisiones
  congeladas #3 y #4), y Celebrar además no está desplegado

---

## 11. El prompt, para pegar

Cuando haya que pedirle a una IA que trabaje sobre Bookea, este es el
bloque que se le da. No reemplaza a `CLAUDE.md`, lo complementa.

```
Bookea es una plataforma costarricense que digitaliza negocios
pequeños para que vendan más. Un registro, un panel, un cliente.

EL PROBLEMA: el negocio pequeño tiene el menú en una foto, la agenda
en un cuaderno y los clientes en la cabeza. Cada herramienta que le
venden resuelve un pedazo y no habla con las otras.

QUÉ OFRECEMOS, cuatro productos que se venden juntos:
1. TU PÁGINA — link hub en bookea.lat/s/<negocio>: menú o catálogo con
   fotos y precios, enlaces, redes, QR propio y por mesa, dominio
   propio, 21 países y 19 monedas, seis idiomas.
2. PEDIDOS — carrito con personalización por plato, tres modalidades
   (mesa por QR, recoger, exprés). El pedido queda en el panel del
   negocio Y le llega por WhatsApp ya escrito y ordenado.
   ⚠️ El cliente NUNCA lee la palabra «WhatsApp» al pedir.
3. PASES DE LEALTAD — sellos y recompensas en Apple Wallet y Google
   Wallet, sin instalar nada. Es nuestro diferenciador y la prioridad.
4. RESERVAS Y MARKETPLACE — agenda, ficha de cliente y presencia en el
   directorio de Bookea. La reserva es instantánea: espacio + fecha +
   pago = reservado, sin aprobación manual.
   (+ Automatizaciones de Instagram: comentario con palabra clave → DM.
   Construido, pero sin app de Meta: no se promete todavía.)

A QUIÉN: gastronomía (restaurante, cafetería, soda, bar, panadería),
tienda (física o en línea) y citas (barbería, salón, uñas, spa,
masajes).

LA TESIS: el negocio crea su presencia → sus clientes interactúan →
Bookea registra esa interacción → el negocio gestiona y fideliza → el
cliente vuelve. El mismo cliente que escanea el QR, pide y suma un
sello es UNA SOLA PERSONA en el sistema (migración 0138, en
producción). Eso es lo que Linktree y una tarjeta de cartón no tienen.

EL PANEL: al registrarse, la persona dice qué tipo de comercio tiene,
se aprueba AUTOMÁTICAMENTE y entra a un panel con menú lateral:
Inicio · Pedidos · Agenda · Clientes · Lealtad · Métricas · Mi página ·
Automatizaciones · Equipo · Plan · Ajustes.

REGLAS DE LENGUAJE: se dice «tu página», nunca «link hub», «Linksy» ni
«Bookea Link». «Menú» para gastronomía, «catálogo» para tienda,
«servicios» para citas — nunca «carta». Todo en español. Precios en la
moneda del negocio. Ni estrellas, ni cifras inventadas, ni negocios de
mentira: hay CERO reseñas en la base.

LA REGLA QUE MANDA: solo se promete lo que el repositorio puede
entregar hoy.
```

---

## 12. Lo que falta para que todo esto sea verdad

En orden de impacto, no de esfuerzo:

| # | Qué falta | Por qué importa | Tamaño |
|---|---|---|---|
| 1 | **El alta pregunta el tipo de comercio** | Hoy `/solutions/crear` no lo pregunta, y sin ese dato el panel no se puede armar solo | Chico |
| 2 | **Una sola cáscara de panel con un menú** | Es la diferencia entre «todo en un lugar» y tres pestañas del navegador | Mediano |
| 3 | **Clientes y Métricas dentro de esa cáscara** | Los «mejores clientes» que pidió el dueño no tienen pantalla hoy | Mediano |
| 4 | **El home nuevo** (§10) | El actual no nombra el problema | Mediano |
| 5 | **La app de Meta** | Sin ella, las automatizaciones no se pueden entregar | Chico, pero es trámite |
| 6 | **Desplegar** | Todo está congelado en local desde el 7 de septiembre | Chico |

---

## 13. Qué NO es Bookea

Decirlo importa tanto como decir qué sí es:

- **No es un marketplace de comida** — eso era FOOD/Foorkie, y es un
  producto aparte que hoy no existe
- **No es un sitio web a medida** — es una página que el negocio arma solo
- **No es un POS** — no cobramos en el mostrador ni manejamos caja
- **No es una app que el cliente final instala** — todo pasa por el
  navegador y por Wallet
- **No es una agencia** — no hacemos el contenido del negocio

---

*Este documento se actualiza cuando cambia una decisión, no cuando
cambia una pantalla.*
