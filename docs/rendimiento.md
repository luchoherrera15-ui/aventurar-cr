# Rendimiento — plan por fases

> **Fase 1 = medir. No se toca código hasta tener la línea base.**
> Auditoría corrida el 2026-08-09 contra producción (`bookea.lat`) y contra el
> build local. Arnés y scripts: [scripts/rendimiento/](../scripts/rendimiento/README.md).
> Datos crudos: [linea-base-2026-08-09/](../scripts/rendimiento/linea-base-2026-08-09/).
> **En esta fase no se modificó una sola línea de código de la aplicación.**

Este documento tiene dos partes: la **Fase 1** (la auditoría, ya hecha, con sus
números) y el **plan de fases siguientes**, ordenado por lo que la evidencia dice
que duele — no por lo que uno supondría que duele.

---

## 0. Cómo se midió (y por qué así)

| | |
|---|---|
| **Herramientas** | Lighthouse 13.4.1 · traza de red por CDP (cada solicitud con bytes y tiempos) · TTFB a nivel de socket TLS · consultas a Supabase cronometradas una por una |
| **Móvil** | Moto G Power emulado · 4G lento (1.6 Mbps, 150 ms de RTT) · CPU 4× más lenta · 390×844 @3× |
| **Escritorio** | 1350×940 · 10 Mbps · CPU sin ralentizar |
| **Cifra que se reporta** | **la mediana de 3 corridas**, con el rango al lado |
| **Entornos** | producción (Vercel + Supabase reales) y build local (`next build` + `next start`) |

**Por qué la mediana de 3 y no una corrida.** La misma URL (`/eventos`, móvil)
dio **2185 ms** y **2915 ms** de LCP con minutos de diferencia. Una sola corrida
no distingue una mejora real del ruido del día. Toda comparación antes/después
de este documento usa medianas; **si una diferencia es menor que el rango
observado, no cuenta como mejora**.

**Qué NO prueba el build local.** `localhost` no tiene latencia de red real ni
caché de Vercel, así que sus tiempos absolutos no son comparables con
producción. El build local sirve para lo que sí mide bien: **bytes de bundle,
cantidad de solicitudes y qué entra en el JavaScript inicial**. Los tiempos
absolutos se leen de producción.

### Páginas medidas

| Etiqueta | URL | Por qué está |
|---|---|---|
| `entrada` | `https://bookea.lat/` | la que teclea la gente de verdad — arrastra las redirecciones |
| `eventos` | `/eventos` | la vitrina principal |
| `ficha-negocio` | `/rancholastorres` | ficha con galería (6 fotos) |
| `album` | `/a/fotos-ejemplo-…-star-wars` | álbum chico (7 fotos) |
| `album-grande` | `/a/fotos-revelacion-maria-jesus-y-luis` | **la galería de verdad: 164 fotos** |
| `invitacion` | `/i/demo-boda-premium` | invitación full-screen |
| `catalogo-invitaciones` | `/invitaciones` | catálogo |

---

## Fase 1 · Auditoría completa (antes de tocar código)

### 1.1 Línea base — producción, mediana de 3 corridas

| Página | Dispositivo | LCP | rango | FCP | TTFB | CLS | TBT | Speed Index | Puntaje |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| entrada (`bookea.lat`) | **móvil** | **3640 ms** | 2889–3743 | 1765 ms | 107 ms | 0 | 22 ms | 2874 ms | 89 |
| entrada | escritorio | 872 ms | 860–884 | 544 ms | 104 ms | 0 | 0 ms | 1141 ms | 99 |
| `/eventos` | **móvil** | **2931 ms** | 2852–2940 | 1131 ms | 110 ms | 0 | 20 ms | 4092 ms | 93 |
| `/eventos` | escritorio | 623 ms | 614–632 | 303 ms | 106 ms | 0 | 0 ms | 754 ms | 100 |
| ficha de negocio | **móvil** | **2828 ms** | 2578–3098 | 1013 ms | 104 ms | 0 | 45 ms | 2171 ms | 95 |
| ficha de negocio | escritorio | 622 ms | 564–645 | 327 ms | 106 ms | 0 | 0 ms | 750 ms | 100 |
| álbum 164 fotos | **móvil** | **2585 ms** | 2102–3251 | 1141 ms | 106 ms | 0 | 10 ms | 3057 ms | 97 |
| álbum 164 fotos | escritorio | 1143 ms | 850–1532 | 863 ms | 111 ms | 0 | 0 ms | 1587 ms | 95 |
| álbum 164 fotos, **caché fría** | **móvil** | **4888 ms** | 1 corrida | 1309 ms | 107 ms | 0.001 | 32 ms | 3136 ms | 81 |

**La fila de "caché fría" no es un outlier que se pueda descartar.** En esa
corrida las 22 imágenes volvieron con `x-vercel-cache: MISS` y `age: 0`: el
optimizador de Vercel las estaba generando en ese momento. El TTFB de la foto de
portada pasó de ~150 ms a **831 ms** y su descarga completa tardó 6661 ms. Como
los álbumes reciben fotos nuevas todo el tiempo (las sube la gente del evento),
**para un álbum la caché fría es el caso normal, no la excepción**.

Otras páginas medidas (una corrida, móvil): `album` chico 2901 ms · `invitacion`
2828 ms · `catalogo-invitaciones` 1959 ms.

### 1.2 Solicitudes, bytes y JavaScript inicial

Traza CDP, móvil, 4G lento (bytes transferidos = comprimidos):

| Página | Solicitudes | Transferido | JS inicial | Imágenes | Fuentes | CSS | HTML |
|---|---:|---:|---:|---:|---:|---:|---:|
| entrada | 32 | 0.41 MB | **275 KB** (14 archivos) | 4 · 47 KB | 2 · 30 KB | 24 KB | 12.7 KB |
| `/eventos` | 32 | 0.41 MB | **275 KB** (14) | 4 · 47 KB | 2 · 30 KB | 24 KB | 12.7 KB |
| ficha de negocio | 28 | 0.59 MB | **277 KB** (14) | 5 · 230 KB | 2 · 30 KB | 24 KB | 16.4 KB |
| álbum 7 fotos | 29 | 0.50 MB | 254 KB (13) | 8 · 100 KB | 3 · **96 KB** | 26 KB | 7.2 KB |
| **álbum 164 fotos** | **43** | **1.30 MB** | 254 KB (13) | **22 · 920 KB** | 3 · **96 KB** | 26 KB | 15.2 KB |
| invitación | 23 | 0.61 MB | 258 KB (13) | 1 · 173 KB | 3 · 96 KB | 24 KB | 41.5 KB |
| catálogo | 26 | 0.39 MB | 248 KB (13) | 0 | 2 · 30 KB | 24 KB | — |

El JavaScript inicial es **prácticamente constante en todo el sitio: ~250–280 KB
comprimidos en 13–14 archivos**, incluso en páginas sin ninguna interacción
(el catálogo). Es el piso de todas las páginas.

### 1.3 Elemento LCP exacto y en qué se va

| Página / dispositivo | Elemento LCP | TTFB | Espera del recurso | Descarga | Espera de pintado |
|---|---|---:|---:|---:|---:|
| entrada · móvil | `article.h-full > a.group > div.relative > img.object-cover` — foto de la card "Rancho Don Luis" | **895** | 517 | 144 | 212 |
| `/eventos` · móvil | la misma card | 334 | 457 | 145 | **1642** |
| `/eventos` · escritorio | la misma card | 332 | 183 | 256 | 228 |
| ficha · móvil | `div.relative > div.flex > button.relative > img.object-cover` — "Rancho Las Torres — foto 1" | 425 | **623** | 659 | 40 |
| ficha · escritorio | `div.mx-auto > div.relative > button.group > img.object-cover` | 338 | **602** | 118 | 71 |
| álbum 164 · móvil | `body.min-h-full > main.flex > div.relative > img.object-cover` — la portada | 346 | 491 | **782** | 32 |
| invitación · móvil | (Lighthouse no identifica nodo: es un bloque de texto) | 342 | 0 | 0 | **903** |

Tres perfiles distintos, y **ninguno se arregla con lo mismo**:

- **entrada**: casi 900 ms de TTFB contra 334 ms de la misma página sin
  redirecciones. Lo paga el redireccionamiento, no el contenido.
- **`/eventos` móvil**: 1642 ms de *espera de pintado* — el navegador ya tiene
  la imagen (la descarga fueron 145 ms) y aun así no la pinta. Eso es trabajo de
  hilo principal, no ancho de banda.
- **álbum**: 782 ms de descarga porque la portada compite con otras 21 imágenes.

En el álbum, además, Lighthouse marca explícitamente:
`✗ fetchpriority=high should be applied to the image preload request`.

### 1.4 Los 20 recursos más pesados

**Álbum de 164 fotos, móvil** (la peor página del sitio):

| # | Peso | Duración | Tipo | Archivo |
|---:|---:|---:|---|---|
| 1 | 236.3 KB | 6661 ms | Imagen | portada del álbum (`/_next/image`) |
| 2 | 76.8 KB | 4939 ms | Imagen | foto de la grilla |
| 3 | 70.8 KB | 2697 ms | Script | `3gzxhq9iq6efl.js` |
| 4 | 64.7 KB | 2509 ms | Script | `455pej-bs-q2f.js` |
| 5 | 54.4 KB | 4705 ms | Imagen | foto de la grilla |
| 6 | 49.1 KB | 4241 ms | Imagen | foto de la grilla |
| 7 | 49.1 KB | 3062 ms | Imagen | foto de la grilla |
| 8 | 38.6 KB | 1743 ms | Fuente | `8bd76523131fa0fc-s.p…woff2` |
| 9 | 37.2 KB | 1511 ms | Fuente | `01e4147cff8141ee-s.p…woff2` |
| 10 | 36.8 KB | 4750 ms | Imagen | foto de la grilla |
| 11 | 33.3 KB | 4641 ms | Imagen | foto de la grilla |
| 12 | 32.8 KB | 4625 ms | Imagen | foto de la grilla |
| 13 | 31.6 KB | 2457 ms | Imagen | foto de la grilla |
| 14 | 31.0 KB | 1222 ms | Imagen | foto de la grilla |
| 15 | 30.8 KB | 2241 ms | Imagen | foto de la grilla |
| 16 | 29.5 KB | 1668 ms | Script | `2up3w12ci8ja-.js` |
| 17 | 27.4 KB | 4425 ms | Imagen | foto de la grilla |
| 18 | 26.3 KB | 1178 ms | Imagen | foto de la grilla |
| 19 | 25.9 KB | 306 ms | Otro | **`favicon.ico`** |
| 20 | 25.7 KB | 1193 ms | Imagen | foto de la grilla |

**`/eventos`, móvil** (donde no hay fotos pesadas y el top lo copa el JS):

| # | Peso | Duración | Tipo | Archivo |
|---:|---:|---:|---|---|
| 1 | 70.8 KB | 1495 ms | Script | `3gzxhq9iq6efl.js` |
| 2 | 64.7 KB | 801 ms | Script | `455pej-bs-q2f.js` |
| 3 | 29.5 KB | 1308 ms | Script | `2up3w12ci8ja-.js` |
| 4 | **25.9 KB** | 352 ms | Otro | **`favicon.ico`** — pesa más que cualquier foto de esta página |
| 5 | 25.0 KB | 781 ms | Imagen | card del directorio |
| 6 | 23.7 KB | 1170 ms | CSS | `1av06c1vv3-3m.css` |
| 7 | 23.4 KB | 1201 ms | Script | `1ztteho4sxtzc.js` |
| 8 | 20.1 KB | 567 ms | Script | `0rp0xuurwvp-9.js` |
| 9 | 20.0 KB | 832 ms | Fuente | `f7aa21714c1c53f8-s.p…woff2` |
| 10 | 15.2 KB | 496 ms | Imagen | card del directorio |
| 11 | 13.2 KB | 965 ms | Script | `14mrh2-p_w84d.js` |
| 12 | 12.7 KB | 1163 ms | HTML | el documento |
| 13 | 10.3 KB | 406 ms | Fuente | `400bf8aa837fcb7e-s…woff2` |
| 14–20 | 9.7 → 4.3 KB | — | Script/Imagen | 6 chunks más + `logo-bookea-nav.png` |

### 1.5 Imágenes descargadas antes de aparecer en pantalla

| Página | `<img>` en el DOM | Visibles al cargar | **Descargadas sin verse** | Bytes en imágenes |
|---|---:|---:|---:|---:|
| `/eventos` · móvil | 5 | 3 | 1 | 47 KB |
| ficha de negocio · móvil | 13 | 2 | **4** | 230 KB |
| álbum 7 fotos · móvil | 8 | 5 | 3 | 100 KB |
| **álbum 164 fotos · móvil** | **165** | **3** | **19** | **920 KB** |
| invitación · móvil | 3 | 0 | 1 | 173 KB |

En la galería grande se piden **22 imágenes para mostrar 3**. Está dentro del
techo de 12–20 que fija el objetivo, pero por poco, y todas compiten con la
portada — que es el LCP.

**Imágenes servidas sin pasar por el optimizador** (o sea, el archivo original):

| Dónde | Qué |
|---|---|
| Todo el sitio | `logo-bookea-nav.png` — 4.3 KB, irrelevante |
| **Invitaciones `/i/{slug}`** | **todas las fotos**. Se revisaron las 7 invitaciones publicadas: **ninguna** referencia `/_next/image`. En `demo-boda-premium`: `santorini.jpg` 172 KB, `paris.jpg` 234 KB, `kioto.jpg` 334 KB, crudas desde Supabase Storage |

El resto del sitio (directorio, fichas, álbumes, visor a pantalla completa) **ya
va por el optimizador**: Lighthouse no encuentra nada que recortar en la ficha
de negocio (`image-delivery-insight`: ahorro estimado 0 KB) y en el álbum apenas
52.8 KB.

### 1.6 Redirecciones

```
https://bookea.lat/          →  308  →  https://www.bookea.lat/
https://www.bookea.lat/      →  307  →  /eventos
```

Dos saltos antes de que el servidor empiece a construir nada. Es la diferencia
entre las dos primeras filas de §1.1: **3640 ms contra 2931 ms de LCP** por la
misma página y el mismo contenido. En las fases del LCP se ve dónde cae: el TTFB
pasa de 334 ms a 895 ms.

El 308 de apex→www lo hace Vercel; el 307 de `/`→`/eventos` está declarado en
[next.config.ts](../next.config.ts).

### 1.7 Terceros, fuentes y video

- **Scripts de terceros: ninguno.** Las 43 solicitudes de la peor página salen
  todas de `www.bookea.lat`. No hay analítica externa, ni tag manager, ni
  widgets. (`third-parties-insight` vacío.)
- **Fuentes**: 2 archivos (30 KB) en el directorio y las fichas; **3 archivos
  (96 KB)** en álbumes e invitaciones. Se sirven desde el propio dominio, con
  `font-display` correcto (`font-display-insight` vacío). En `/eventos` la
  fuente es el **final de la cadena crítica más larga**: documento (791 ms) →
  CSS (620 ms) → `woff2` (1711 ms).
- **Video: cero** en todas las páginas medidas.
- **Audio**: la invitación demo trae
  `<audio src="…/cancion-sax.mp3" loop preload="auto">` apuntando a un MP3 de
  **8.1 MB**. Se probó a propósito con la política de autoplay abierta: el
  navegador **sí pide el archivo solo, sin que nadie toque nada** (`206 Partial
  Content`), pero lo trae por rangos — a los 22 segundos la página llevaba
  0.49 MB en total, no 8. O sea que **no son 8 MB de golpe al abrir**, pero sí
  son 8 MB que se van pagando mientras la canción suena, en el celular de cada
  invitado. Un MP3 de 8.1 MB para música de fondo está unas 5–8 veces por
  encima de lo razonable. El generador con IA inyecta ese mismo
  `preload="auto"` en cada invitación con música
  ([route.ts:403](../src/app/api/invitaciones/generar-con-ia/route.ts#L403)).

### 1.8 Consultas de datos y tiempo de respuesta de Supabase

Las 4 consultas del server component de `/eventos`, cronometradas por separado
(5 corridas, mediana; medidas desde una conexión doméstica en CR, así que el
absoluto incluye latencia de casa — lo que importa es la comparación):

| Consulta | Mediana | Filas | Payload |
|---|---:|---:|---:|
| `ranchos` (columnas de card, aprobados) | 169 ms | 6 | 4.5 KB |
| `disponibilidad_rancho` (confirmadas) | 158 ms | 38 | 2.4 KB |
| `calificaciones_rancho` | 156 ms | 0 | 0 KB |
| `resenas` (límite 300) | 160 ms | 0 | 0 KB |

Las cuatro ya corren **en paralelo** dentro de un `Promise.all`, así que cuestan
lo que la más lenta, no la suma.

Para saber cuánto de eso llega al TTFB real se midió el TTFB de socket contra
producción, comparando rutas con y sin base (7 corridas, mediana):

| Ruta | Qué hace | TTFB | Caché de Vercel |
|---|---|---:|---|
| `/terminos` | estática, sin base | 175 ms | MISS |
| `/politicas` | estática, sin base | 165 ms | MISS |
| `/eventos` | 4 consultas + auth | **168 ms** | MISS |
| `/citas` | directorio de citas | 165 ms | MISS |
| `/rancholastorres` | ficha de negocio | 204 ms | MISS |

**Las consultas a la base no se notan en el TTFB.** Una página estática y una
que hace cuatro consultas responden igual (165–175 ms); la ficha de negocio
suma ~35 ms. La base de datos **no** es el cuello de botella.

Ese +35 ms de la ficha tiene nombre: es el **único waterfall del lado del
servidor** que queda. La página busca primero el negocio por slug
([\[slug\]/page.tsx:26](../src/app/[slug]/page.tsx#L26)) y recién con el `id` en
mano dispara el `Promise.all` con el resto
([rancho-portal.tsx:210](../src/app/eventos/rancho-portal.tsx#L210)). Lo mismo
en el álbum: primero el álbum por slug, después las fotos
([a/\[slug\]/page.tsx:50 y 99](../src/app/a/[slug]/page.tsx#L50)). Son dos idas
y vueltas encadenadas, no cuatro — y la dependencia es real (sin el `id` no se
puede pedir lo demás). Cuesta ~35 ms; se anota, no se persigue.

Sí aparece otra cosa: **`x-vercel-cache: MISS` en todas las rutas**, incluidas
`/terminos` y `/politicas`, que son texto fijo. El HTML nunca se sirve desde la
caché del CDN.

La causa está en el matcher del proxy
([src/proxy.ts:90](../src/proxy.ts#L90)), que agarra **todo** menos los assets:

```
/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|webp)$).*)
```

Con el proxy en el camino, cada petición de HTML pasa por una función en el
edge y el CDN no la puede devolver cacheada. En el build eso se ve: `/terminos`
y `/politicas` salen marcadas `ƒ (Dynamic) server-rendered on demand` aunque no
consulten nada.

### 1.9 Waterfall y consultas secuenciales

Traza real de `/eventos` en móvil (cada `#` es tiempo; el eje llega a ~3 s):

```
####################                                     0→ 1163  documento /eventos
       ##############                                  440→ 1272  fuente woff2
        ###########                                    463→ 1101  logo-bookea-nav.png
        ####################                           464→ 1634  CSS principal
        #########################                      465→ 1960  chunk 3gzxhq9iq6efl.js
        ######################                         465→ 1773  chunk 2up3w12ci8ja-.js
                 #############                        1008→ 1789  imagen de card
                                     ######           2108→ 2460  favicon.ico
                                        #############  2258→ 3059  chunk 455pej-bs-q2f.js
                                         ####          2297→ 2519  fetch /citas
                                          ######       2401→ 2766  chunk 3a1066xnoi4qh.js
                                            ###        2512→ 2719  fetch /rancholastorres
```

Dos cadenas encadenadas de verdad (el hijo no puede empezar hasta que el padre
termina):

- `turbopack-…js` → `455pej-bs-q2f.js` — arranca **1405 ms después** y termina
  en 3059 ms. Es el chunk más pesado del sitio después del principal, y no se
  descubre hasta que corre otro script.
- `2up3w12ci8ja-.js` → prefetch de `/rancholastorres` — +955 ms, termina en 3090 ms.

La cadena crítica que mide Lighthouse: **documento → CSS → fuente, 1711 ms.**

Los 8 `fetch` del final son **prefetch de rutas vecinas** (`/citas`,
`/eventos`, `/rancholastorres`, `/puramatchabar`…) que Next dispara al hidratar.
No bloquean el LCP, pero compiten por el ancho de banda justo en la ventana en
que la página todavía se está pintando.

### 1.10 INP (laboratorio)

INP de campo necesita usuarios reales; esto es el proxy honesto en laboratorio:
se cargan las páginas con CPU 4× más lenta, se hacen clics reales sobre los
controles visibles y 12 scrolls de pantalla, y se mide cada interacción con
`PerformanceObserver('event')`.

| Página | Interacciones medidas | Peor interacción | CLS acumulado |
|---|---:|---:|---:|
| `/eventos` | 14 | **56 ms** | 0 |
| ficha de negocio | 81 | **24 ms** | 0 |
| álbum 164 fotos | 18 | **80 ms** | 0 |

Todas muy por debajo de los 200 ms. En las tres, el grueso del tiempo es
*pintado*, no ejecución de handlers (ej. álbum: 80 ms totales = 1 ms de espera +
26 ms de handler + 54 ms de pintado).

### 1.11 Build local (`next build` + `next start`)

El build pasa. **Eso no dice nada sobre el rendimiento** — se mide igual.

Bundles generados: **67 chunks de JavaScript, 2.42 MB sin comprimir** en
`.next/static/chunks`, más 185 KB de CSS. De esos 67, cada página carga 13–14.
Los cinco más grandes sin comprimir: 242 KB, 222 KB, 205 KB, 110 KB, 107 KB.

**Lo que el build local confirma** (misma traza, móvil, 4G lento):

| Página | Solicitudes prod → local | Transferido prod → local | JS prod → local | Imágenes prod → local |
|---|---|---|---|---|
| `/eventos` | 32 → **32** | 0.41 → 0.44 MB | 275 → **269 KB** (14) | 47 → 76 KB |
| ficha de negocio | 28 → **28** | 0.59 → 0.79 MB | 277 → **271 KB** (14) | 230 → 422 KB |
| álbum 7 fotos | 29 → **29** | 0.50 → 0.56 MB | 254 → **249 KB** (13) | 100 → 163 KB |

Misma cantidad de solicitudes y el mismo JavaScript (±2 %): **el build local es
el que está en producción**, no hay sorpresas entre uno y otro.

**Lo que el build local NO sirve para medir: las imágenes.** El optimizador
local devuelve AVIF igual que Vercel, pero **casi el doble de pesado** (171 KB
contra 92 KB la misma foto). Cualquier comparación de bytes de imagen tiene que
hacerse contra producción.

**Tiempos locales, mediana de 3** — peores que producción a pesar de no tener
latencia de red, porque cada `/_next/image` se genera al vuelo en esta máquina
sin caché caliente:

| Página | Dispositivo | LCP local | rango | LCP producción |
|---|---|---:|---|---:|
| entrada | móvil | 3975 ms | 3898–4216 | 3640 ms |
| entrada | escritorio | 970 ms | 969–989 | 872 ms |
| `/eventos` | móvil | 4198 ms | 3965–4214 | 2931 ms |
| `/eventos` | escritorio | 985 ms | 985–988 | 623 ms |
| ficha de negocio | móvil | 3827 ms | 3822–3854 | 2828 ms |
| ficha de negocio | escritorio | 887 ms | 784–946 | 622 ms |
| álbum 164 fotos | móvil | 3687 ms | **3686–7602** | 2585 ms |
| álbum 164 fotos | escritorio | 793 ms | **792–2925** | 1143 ms |

Ese hueco de ~1300 ms en móvil entre local y producción **es exactamente el
costo del optimizador de imágenes en frío**, la misma pieza que hace que un
álbum recién subido tarde 4888 ms en vez de 2585 ms.

Y el rango del álbum lo deja a la vista sin lugar a dudas: **7602 ms la primera
corrida, 3686 ms las dos siguientes** en móvil; **2925 → 792 ms** en escritorio.
La única diferencia entre esas corridas es que la primera generó las 22 imágenes
y las otras las encontraron hechas. Es el hallazgo más reproducible de toda la
auditoría.

---

## 2. Reparto del tiempo: dónde se va, por cubo

Los cinco cubos, con el número de cada uno y la página donde más pesa.
Base: LCP móvil, mediana de producción.

| # | Cubo | Cuánto | Dónde se ve |
|---|---|---|---|
| **1** | **Servidor y TTFB** | 165–204 ms de TTFB puro. **+560 ms extra** si se entra por `bookea.lat` (dos redirecciones). Todo el HTML sale con `x-vercel-cache: MISS` porque el matcher del proxy agarra todas las rutas. | `entrada`: el TTFB del LCP pasa de 334 a 895 ms |
| **2** | **Imágenes y archivos** | 47 KB (`/eventos`) → **920 KB en 22 imágenes** (álbum). Fuentes: 30 KB normalmente, **96 KB en álbumes e invitaciones**. `favicon.ico` de 25.9 KB en todas las páginas. | álbum: 782 ms solo de descarga del LCP; 19 imágenes bajadas sin verse |
| **3** | **JavaScript e hidratación** | **250–280 KB comprimidos en 13–14 archivos, en todas las páginas**, incluso las que no interactúan. En disco: 67 chunks, 2.42 MB sin comprimir. TBT bajo (10–45 ms), pero **1642 ms de espera de pintado** en `/eventos` móvil. **13.6 KB en todas las páginas son polyfills** que ningún navegador actual necesita (`Array.prototype.at`, `.flat`, `.flatMap`, `Object.fromEntries`, `Object.hasOwn`, `String.prototype.trim*`). | `/eventos` móvil: la imagen está descargada a los 145 ms y se pinta 1642 ms después |
| **4** | **Consultas de datos** | **~0 ms medibles.** Estática 165–175 ms vs. `/eventos` con 4 consultas 168 ms. Ficha de negocio +35 ms. Ya van en `Promise.all`. | — (no es el problema) |
| **5** | **Recursos externos** | **0 KB. No hay terceros.** Ni analítica, ni tag manager, ni fuentes de Google. | — (no es el problema) |

---

## 3. Lo que la evidencia dice — y lo que no

**Lo que NO es el problema** (medido, no supuesto):

- **No son las consultas a la base.** Una página estática y una con cuatro
  consultas responden en el mismo TTFB.
- **No son los terceros.** No hay ninguno.
- **No es el CLS.** Es 0.000 en todas las páginas, con y sin interacción.
- **No es el INP.** Peor caso 80 ms, con el objetivo en 200 ms.
- **No es "las imágenes" en general.** En la ficha de negocio Lighthouse estima
  **0 KB** de ahorro posible en imágenes; en el álbum, 52.8 KB sobre 920 KB. El
  trabajo de optimización que ya se hizo (AVIF/WebP, `deviceSizes` acotado,
  `qualities`, `minimumCacheTTL` de 31 días, visor por optimizador) funciona.

**Lo que sí es el problema, por orden de tamaño del daño:**

1. **Las dos redirecciones de la entrada** — +709 ms de LCP móvil (3640 vs
   2931), sin cambiar un byte de contenido. Es el arreglo más barato del
   documento.
2. **El JavaScript inicial constante de ~275 KB** — es el piso de todas las
   páginas y es lo que explica los 1642 ms de espera de pintado en `/eventos`.
3. **La caché fría del optimizador de imágenes en álbumes** — 4888 ms de LCP la
   primera vez que alguien abre un álbum con fotos nuevas, contra 2585 ms
   después. Y en álbumes las fotos nuevas son la norma.
4. **Las invitaciones sirven originales** — ninguna de las 7 publicadas usa el
   optimizador, más un MP3 de 8.1 MB que el navegador empieza a pedir solo.
5. **Detalles que suman**: `favicon.ico` de 25.9 KB, 96 KB de fuentes en álbumes
   e invitaciones, 14 KB de polyfills viejos, prefetch de rutas vecinas
   compitiendo durante el pintado, HTML sin caché de CDN.

---

## 4. Objetivos mínimos y estado actual

| Objetivo | Meta | Hoy | Estado |
|---|---|---|---|
| LCP móvil | ≤ 2500 ms | 2585–3640 ms según la página | ❌ **ninguna página lo cumple** |
| CLS | ≤ 0.1 | 0.000 | ✅ |
| INP real | ≤ 200 ms | 24–80 ms (laboratorio) | ✅ en laboratorio; falta confirmarlo con datos de campo |
| Ninguna imagen original en la interfaz | 0 | el sitio sí; **las 7 invitaciones publicadas, no** (ninguna pasa por `/_next/image`) | ❌ |
| Imágenes en la carga inicial de una galería | 12–20 | 22 (para mostrar 3) | ⚠️ apenas por encima |
| Bytes y solicitudes iniciales | reducción demostrable | línea base fijada en §1.2 | — punto de partida |

---

## 5. Protocolo de re-medición (obligatorio al cerrar cada fase)

1. Renombrar `resultados/` a `resultados-fase-N/` para no pisar la línea base.
2. Correr **exactamente los mismos comandos** con las **mismas URLs**:
   `bateria.mjs prod` · `extras.mjs prod` · `repetir.mjs prod 3` ·
   `ttfb-servidor.mjs` · `supabase-tiempos.mjs`.
3. Publicar la tabla antes/después con `resumen.mjs prod-antes prod-despues`.
4. Reglas para poder decir que una fase funcionó:
   - **Que el build pase no es un resultado.** Un `next build` verde no dice
     nada sobre el LCP.
   - Una diferencia menor que el rango de la mediana **no es una mejora**.
   - Toda afirmación va con el número que la respalda y la página donde se midió.
   - Si una métrica empeora, se reporta igual.

---

## 6. Fases siguientes (propuesta, ordenadas por la evidencia)

| # | Fase | Qué ataca | Ganancia esperada |
|---|---|---|---|
| **2** | **La entrada** | que `bookea.lat` llegue al contenido sin dos saltos | ~700 ms de LCP móvil en la entrada |
| **3** | **JavaScript inicial** | los ~275 KB constantes: qué se puede cargar tarde, polyfills viejos, prefetch de rutas vecinas | la espera de pintado de `/eventos` (1642 ms) |
| **4** | **Galerías** | portada con `fetchpriority=high`, menos imágenes en la primera pantalla, y el problema de la caché fría del optimizador | los 4888 ms del álbum en frío |
| **5** | **Invitaciones** | fotos por el optimizador, MP3 sin `preload="auto"` y re-encodeado | 8.1 MB de un solo archivo |
| **6** | **Restos** | favicon de 25.9 KB, 96 KB de fuentes en álbumes, caché de CDN para el HTML | bytes y solicitudes iniciales |

Cada fase: se mide antes, se cambia, se vuelve a medir con el mismo arnés, y se
publica la comparación acá. **Paridad con la app móvil**: la app Expo comparte
la base pero no el frontend, así que estas mediciones no la cubren — necesita su
propia instrumentación, y se agenda aparte.
