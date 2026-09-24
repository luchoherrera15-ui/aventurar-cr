# CELEBRAR — Fase 1: shell, portada, acceso y panel

> Hecha el 20 de setiembre de 2026, en local (`localhost:3100`). **Sin commit,
> sin deploy, sin migraciones.** Decisiones del dueño que la habilitaron:
> D-1 (esquema propio `celebrar_*`), D-2 (`bookea.lat/celebrar`), D-3 (login
> completo en `celebrar.lat` con la misma identidad). Ver [audit.md](./audit.md).

## Qué existe ahora

| Ruta (en Bookea) | En `celebrar.lat` | Qué es |
|---|---|---|
| `/celebrar` | `/` | Portada: héroe marino con el teléfono, ocasiones, funciones en tarjetas, vitrina del producto, video con IA, cómo funciona, precios, preguntas, banda final |
| `/celebrar/plantillas` | `/plantillas` | Catálogo público por categorías (las once del brief) |
| `/celebrar/entrar` | `/entrar` | Login **y** registro: código por correo (principal), Google/Facebook (si las banderas están), contraseña |
| `/celebrar/entrar/recuperar` | `/entrar/recuperar` | Crear o recuperar contraseña (correo con link) |
| `/celebrar/entrar/nueva-contrasena` | `/entrar/nueva-contrasena` | Definir la contraseña (aterrizaje del link) |
| `/celebrar/auth/callback` | `/auth/callback` | Canje del `?code` de OAuth y de recuperación; toda caída queda dentro de CELEBRAR |
| `/celebrar/app` | `/app` | Panel: Inicio, Mis celebraciones, Crear, Plantillas, Mis créditos, Álbumes, Videos, Invitados, Confirmaciones, Configuración |
| `/celebrar/opengraph-image` | — | Previa para WhatsApp |
| cualquier otra | — | 404 propio de CELEBRAR |

El panel tiene **estructura y estados vacíos honestos**: no hay tablas todavía
(Fase 2), así que ninguna pantalla muestra números ni listas inventadas. «Crear
celebración» tiene el paso 1 funcional (el tipo, en la URL) y el botón
«Continuar» deshabilitado con la explicación.

## Dónde vive el código

```
src/lib/celebrar/
  rutas.ts        RUTA (todas las rutas SIN prefijo), SEGMENTOS_SISTEMA, validación de slug
  dominios.ts     esHostCelebrar, prefijoParaHost, conPrefijo, sinPrefijo, destinoEnCelebrar,
                  sitioCelebrar / urlPublicaCelebrar (NEXT_PUBLIC_CELEBRAR_URL), destinoDentroDeCelebrar
  dominios.test.ts  38 pruebas de lo anterior (+ que Bookea reserve «celebrar»)
  marca.ts        MARCA, PASOS, TIPOS_CELEBRACION, FUNCIONES, CATEGORIAS_PLANTILLA
  sesion.ts       sesionCelebrar() (getUser + perfiles.nombre), prefijoDeLaPeticion(), origenDeLaPeticion()

src/app/celebrar/
  layout.tsx      fuentes (Montserrat + Inter), tokens, metadata. NO lee cookies ni host
  celebrar.css    los tokens `.celebrar` y las clases c-boton / c-tarjeta / c-disco / c-pastilla / c-campo…
  not-found.tsx · opengraph-image.tsx
  (sitio)/        layout con nav + pie (lee host y sesión) · page.tsx (portada) · portada/*.tsx
                  plantillas/ · entrar/ (acceso-celebrar.tsx, recuperar/, nueva-contrasena/)
  auth/callback/route.ts
  app/            layout con el rail (exige sesión) · acciones-sesion.ts · una carpeta por sección

src/components/celebrar/
  rutas-cliente.tsx   ProveedorRutas, EnlaceCelebrar, useRuta, useRutaActual
  marca-celebrar.tsx · nav-celebrar.tsx · pie-celebrar.tsx · especimen-vivo.tsx (dentro de <Telefono>)
  iconos-celebrar.tsx · iconos-tipos.tsx · panel/menu-app.tsx · panel/piezas.tsx
  (portada/: hero, tipos, funciones, vitrina, video-ia, como-funciona, precios, faq, cierre)
```

## La arquitectura de dominio (lo que hace posible `celebrar.lat` sin reconstruir)

1. **Ninguna ruta interna lleva `/celebrar` escrito.** Todas salen de `RUTA`
   y se completan con el prefijo del host: `""` en `celebrar.lat`,
   `"/celebrar"` en Bookea. El layout lee el host (`prefijoDeLaPeticion`) y lo
   baja por contexto a `<EnlaceCelebrar a={RUTA.app}>`. Del lado del navegador
   (OAuth, recuperación) el prefijo se calcula con `prefijoParaHost(location.host)`.
2. **El proxy** (`src/proxy.ts`) reconoce `celebrar.lat` y reescribe:
   `/` → `/celebrar`, `/app` → `/celebrar/app`, `/maria-y-juan` →
   `/celebrar/maria-y-juan`, `/auth/callback` → `/celebrar/auth/callback`;
   redirige `/celebrar/…` a la ruta sin prefijo (canónica); deja pasar `/api`,
   `/_next` y archivos. Bookea **no se sirve** bajo ese host (cae en el 404 de
   CELEBRAR). Todo probado con `curl -H "Host: celebrar.lat"` (ver abajo).
3. **El interruptor** `NEXT_PUBLIC_CELEBRAR_URL`: vacío, la URL pública es
   `https://www.bookea.lat/celebrar`; con `https://celebrar.lat`, los links
   compartibles, el Open Graph y los canónicos pasan al dominio propio.
4. **La sesión** nace en el host donde la persona entra. En `celebrar.lat` el
   callback escribe la cookie para ese host; no hay salto a Bookea (D-3).

Comprobación hecha en local simulando el host:

```
Host: celebrar.lat   /            200  (portada)
                     /app         307 → /entrar?next=/app
                     /entrar      200
                     /celebrar/app 307 → /app
                     /auth/callback 307 → /entrar?aviso=sin-codigo
                     /mi-negocio  404  (Bookea no se sirve)
                     /maria-y-juan 404 (todavía no hay invitaciones públicas)
Links en el HTML servido bajo ese host: /entrar, /app/crear, /plantillas… (sin prefijo)
```

## Toques a Bookea (todos aditivos)

| Archivo | Cambio | Por qué |
|---|---|---|
| `src/proxy.ts` | bloque `esHostCelebrar` antes del de Linksy; un `import` | servir el dominio propio |
| `src/lib/solutions/dominios.ts` | `esHostPropio` reconoce `celebrar.lat` | que ningún negocio lo reclame como dominio suyo |
| `src/lib/slug.ts` | `RESERVED_SLUGS` += `celebrar` | que ningún negocio tenga la ficha `/celebrar` |
| `src/components/chat-flotante-lazy.tsx` | no monta la burbuja dentro de CELEBRAR (ruta o host) | la burbuja es de Bookea; `chat-flotante.tsx` no se tocó |

Verificado: la burbuja sigue apareciendo en las fichas de negocio
(`/rancholastorres`), y `/`, `/linksy`, `/invitaciones`, `/cuenta` responden
200 como antes.

**Lo que NO se tocó**: `src/app/invitaciones/*` (tiene un rediseño sin commit de
otra sesión), `src/lib/paquetes-invitaciones.ts`, `formulario-auth.tsx`,
`formulario-codigo-acceso.tsx`, `src/app/auth/callback`, ninguna tabla.

## Dependencias y conflictos encontrados (documentados, no resueltos a escondidas)

1. **Duplicación deliberada del flujo de acceso.** `acceso-celebrar.tsx`
   reimplementa el flujo código-por-correo que ya hace
   `src/components/formulario-codigo-acceso.tsx`. La regla del repo es «no
   duplicar componentes», pero el componente de Bookea lleva sus textos («tus
   reservas»), su paleta y un teléfono obligatorio, y el dueño pidió (D-3) que
   la persona sienta otra plataforma. Se comparte el **mecanismo** (Supabase
   Auth, RPC `existe_cuenta`, metadata `nombre`), no la pantalla. Si más
   adelante hay un tercer login, conviene extraer un hook común
   (`useAccesoPorCodigo`) y que los dos lo usen. Anotado como deuda consciente.
2. **Callback propio** (`/celebrar/auth/callback`) en vez del de Bookea: el
   de Bookea cae a `/cuenta` cuando algo falla y su `next` por defecto también.
   Mismo canje (`exchangeCodeForSession`), veinte líneas, dentro del producto.
3. **Contraseñas.** Bookea es 100 % sin contraseña. CELEBRAR ofrece
   contraseña como camino secundario sobre la misma identidad (Supabase lo
   permite en el mismo proveedor de email). Una persona que defina contraseña
   en CELEBRAR sigue entrando con código en Bookea; las dos formas conviven.
   No cambia nada del lado de Bookea.
4. **Lista blanca de Redirect URLs en Supabase Auth.** Para que OAuth y el
   correo de recuperación vuelvan a CELEBRAR hay que tener permitidos:
   `http://localhost:3100/**` (local), `https://www.bookea.lat/celebrar/auth/callback`
   y, el día del estreno, `https://celebrar.lat/auth/callback` (+ `www`).
   Hoy las banderas `NEXT_PUBLIC_AUTH_GOOGLE/FACEBOOK` no están en `.env.local`,
   así que en local solo se ve el código por correo — igual que en Bookea.
5. **Términos, privacidad y ayuda del pie** apuntan a las páginas de Bookea con
   URL absoluta (`https://www.bookea.lat/terminos`…): bajo `celebrar.lat` esas
   rutas no existen. Cuando CELEBRAR quiera legales propios, van en
   `src/app/celebrar/(sitio)/terminos` y se reservan en `SEGMENTOS_SISTEMA`
   (ya están reservados los nombres).
6. **`robots.txt` y `sitemap.xml` bajo `celebrar.lat`** hoy pasan al de Bookea
   (`destinoEnCelebrar` los deja pasar). En la Fase 9 se reescriben a un
   sitemap propio; está anotado en el código.
7. **El layout `(sitio)` es dinámico** (lee host y sesión). La invitación
   pública (Fase 3) **no debe** colgar de él si quiere ser estática: irá en su
   propio grupo bajo `src/app/celebrar/` con un layout que no lea nada.
8. **`next lint` del proyecto entero falla desde antes de esta fase**: 248
   errores `prefer-const` en `supabase/.temp/start-secrets/supabase_edge_runtime_*`
   (un archivo generado por la CLI de Supabase que ESLint recoge) y avisos
   previos en archivos de Bookea. Ninguno viene de `celebrar`; ESLint sobre
   `src/app/celebrar`, `src/components/celebrar`, `src/lib/celebrar` y los
   cuatro archivos tocados da cero problemas.
9. **El servidor de desarrollo del puerto 3100** estaba colgado al empezar
   (no respondía ni `/robots.txt` en 45 s); se reinició. Si otra sesión lo
   estaba usando, hay que volver a levantarlo desde su terminal.

## Diseño (para quien siga) — v2, 20 sep 2026

La primera versión (crema + serif editorial, verde/oro) se descartó el mismo
día por pedido del dueño: «página sólida, azul marino, blanco, tarjetas
profesionales, Montserrat». Referencias miradas para la ESTRUCTURA (no el
estilo): Joy (grilla de funciones, vitrina de producto en filas alternadas),
Greenvelope (ocasiones con ícono, FAQ desplegable, precios en tarjetas).

- **Tokens** en `celebrar.css`, con su ratio WCAG anotado: marino `#0b1e45`
  (marca, héroe, banda final, pie, rail), hielo `#f4f7fb` (secciones
  alternas), azul `#1f4fd8` (enlaces/estados, 6,6:1), coral `#f26b5b`
  **solo decorativo** (2,99:1) — texto coral con `--c-coral-tinta` sobre
  `--c-coral-suave`. No hardcodear hex en JSX.
- **Tipografía**: Montserrat (800/700 títulos, 600 botones y rótulos, clase
  `.c-montserrat`) + Inter (texto). El layout carga las dos.
- **Piezas**: `.c-tarjeta` (blanca, borde, sombra plana, `elevar` en hover),
  `.c-disco` (ícono en celeste), `.c-pastilla`, `.c-boton-*`, `.c-campo`.
  Radio de tarjeta 16, controles 12 (escala del sitio).
- **Héroe**: marino a sangre con el `<Telefono>` de `components/solutions`
  (reutilizado, no copiado) mostrando la invitación viva. Confeti CSS
  estático solo en los márgenes y solo en `lg`.
- **Vitrina**: maquetas CSS con datos ilustrativos rotulados «Ejemplo».
- **Motion**: las tres duraciones y la curva del sitio; lo único autónomo
  es la invitación del teléfono (se pausa con hover/foco/pestaña oculta y
  con `prefers-reduced-motion`).
- **Panel**: rail marino con ítem activo en marino medio; contenido sobre
  hielo con tarjetas blancas; en el teléfono, selector `<details>` inline.
- QA en 390/768/1440 con capturas en `.playwright-mcp/v2-*.jpg` (carpeta de
  trabajo, no del repo). Sin scroll horizontal; foco visible azul.
- **Ojo (entorno)**: en este `next dev` local TODAS las rutas
  `opengraph-image` (Bookea, Linksy y CELEBRAR) responden 500 con «Input
  buffer contains unsupported image format» — es el binario de `sharp` en
  esta máquina, no el código: el `next build` las prerenderiza bien.

## Verificaciones

```
npx tsc --noEmit                              ✓
npx eslint (celebrar + archivos tocados)      ✓ 0 problemas
npm test                                      ✓ 174 archivos, 3427 pruebas (39 nuevas)
npm run build                                 ✓ 17 rutas /celebrar/* compiladas
Smoke: /, /linksy, /invitaciones, /cuenta     200 (sin cambios)
```

## Lo que sigue (Fase 2)

Migración **0242** (`celebrar_perfiles`, `celebrar_celebraciones`,
`celebrar_slugs` con la semilla de `SEGMENTOS_SISTEMA`, plantillas y
categorías), el wizard completo de «Crear», la lista de celebraciones y la
edición del perfil en Configuración. Antes: aplicar 0239 y 0240, que siguen
pendientes.
