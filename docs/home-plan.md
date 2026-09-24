# Rediseño del home de bookea.lat — Auditoría y plan

> **22 de septiembre de 2026.** Fase 1 (auditoría) y Fase 2 (plan).
> **Cero código modificado.** Esperando aprobación para la Fase 3.
>
> Fuentes: `arquitectura.md`, `bookea-lat-wireframe.md`, `CLAUDE.md` y el
> repositorio, que manda sobre los tres.

---

# FASE 1 — AUDITORÍA

## 1.1 Contradicciones entre documentación y código

Cuatro. Dos cambian el plan.

### ✅ RESUELTA — La migración 0239 **sí está aplicada** en producción

La memoria del proyecto y las notas la daban por **pendiente** desde el 8
de septiembre. Es falso. `supabase migration list --linked` devuelve
`{"local":"0239","remote":"0239"}`.

**Consecuencia**: la columna `solutions_negocios.host_marca` **existe en
producción**. La mudanza de dominio a `bookea.lat` no hay que
construirla: hay que encenderla.

### 🔴 IMPORTANTE — Celebrar **no existe en producción**

Las migraciones **0242 a 0249 tienen `remote` vacío**: no están
aplicadas. El código además está sin commit. En producción no hay tablas
`celebrar_*` ni ruta `/celebrar`.

**Consecuencia**: por la regla de §18 («verificar primero su estado de
despliegue») y por la regla de no prometer, **Celebrar no se enlaza desde
el home ni desde el footer todavía**. Un link a `/celebrar` en producción
sería un 404 o un error de base.

### 🟡 MENOR — `CLAUDE.md` apunta a un archivo que no existe

Señala `src/components/home/nav-categorias.tsx` como la excepción de la
cápsula estilo Airbnb. Ese archivo **no existe**. La cápsula vive hoy en
`src/components/home/buscador-hero.tsx` («una cápsula de cuatro tramos»).

**La decisión sigue vigente, el puntero no.** Por §28 no lo toco sin
confirmación. Propuesta: actualizar el puntero, conservando el texto de
la decisión tal cual.

### 🟡 MENOR — Los tipos de negocio del prompt no son los del repo

§15 propone «Gastronomía: Restaurantes · **Cafeterías**» y «Salud y
bienestar: Consultorios · **Gimnasios · Yoga · Pilates**».

En `modulos.ts` las familias reales son **belleza, fitness, salud,
academia, eventos, otro**; `cafeteria` **no existe** como tipo, y
gimnasio/yoga/pilates son `fitness`, no `salud`. El plan usa la
taxonomía real (§2.8).

---

## 1.2 El hallazgo que condiciona todo el diseño

**`/` no es solo una portada: es la página de resultados de búsqueda del
sitio.**

En `src/app/page.tsx` está escrito así:

> «El buscador grande ya no manda a /citas ni /eventos —esos directorios
> se borraron y sus redirects traen a la gente ACÁ con el query intacto—
> así que la portada es quien filtra. `?provincia=` se acepta como
> sinónimo de `?lugar=`: es el nombre que llevaban los enlaces de los
> directorios viejos, y esos siguen vivos en historiales y chats
> compartidos.»

La portada lee hoy cinco parámetros: `?q=`, `?lugar=`, `?provincia=`,
`?rubro=` y `?sub=`.

**Si el home pasa a ser una landing B2B a secas, se rompen**: los
redirects de `/citas` y `/eventos`, el buscador del propio sitio, los
links compartidos en chats e historiales, y las vistas filtradas que hoy
indexa Google.

### La solución: el home tiene dos modos

```
¿Llega con búsqueda (q · lugar · provincia · rubro · sub)?
        │
        ├── SÍ  → MODO DESCUBRIR  (lo de hoy, intacto)
        │          buscador + rieles filtrados
        │
        └── NO  → MODO PLATAFORMA (el nuevo)
                   héroe B2B + recorrido del producto
                   + Discover más abajo
```

Un solo archivo, una rama. **Cero rutas nuevas, cero redirects nuevos,
cero links rotos.** Y el `<h1>` cambia con el modo, que es lo correcto
para SEO: la página de resultados no debe titularse igual que la
portada de producto.

---

## 1.3 Estado del home actual

`src/app/page.tsx` renderiza **cuatro cosas**: `AvisoSuperior`,
`HeaderSimple`, `HeroBusqueda` y `RielesCatalogo`. Más `SiteFooter` y
`RevealOnScroll`. **No hay ninguna sección narrativa**: hoy el home no
explica qué es Bookea.

Datos: una sola consulta, `leerCatalogoPortada()`. Ya se optimizó antes
(se quitó un pre-calentamiento de `leerCenso()` que costaba una ida a la
base por visita).

---

## 1.4 `como-funciona.tsx` — auditado

`src/components/home/como-funciona.tsx` **existe, está completo y no está
montado en ninguna parte**. Código muerto.

Contiene la jurisprudencia del proyecto sobre qué no prometer, en dos
comentarios que valen más que el componente:

- Se cayó «filtrá por zona y **fecha**» porque no existe consulta de disponibilidad transversal al directorio.
- Se cayó «opiniones **verificadas**» porque en la base hay **cero reseñas**.

**Recomendación: no se borra y no se monta tal cual.** Sus tres pasos son
del recorrido del *cliente* que busca («Buscá → Compará → Reservá»), y el
home nuevo cuenta el recorrido del *negocio*. Se conserva el archivo para
el **modo Descubrir**, donde sí encaja, y su cabecera de reglas se cita
en el nuevo componente de recorrido.

---

## 1.5 Piezas reutilizables verificadas

| Pieza | Verificado | Sirve para |
|---|---|---|
| `resolverModulos({tipo})` | **Función pura, sin base** | Renderizar el panel real de cada tipo |
| `itemsMenuNegocio({...})` | **Función pura, sin base** | El menú lateral real, por tipo |
| `identidadDe(tipo)` | Puro · vocabulario, ícono y acento por tipo | Que la demo hable como el rubro |
| `VistaPagina` | Tiene `inerte?: boolean` — «previa del panel, **mockup**» | Renderizar la página del negocio dentro del home |
| `Telefono` | `src/components/solutions/telefono.tsx` | El marco |
| `MockupsVivos` | Escena con piezas que brotan, coreografía en `globals.css` | El héroe |
| `BuscadorHero` | La cápsula de cuatro tramos | Modo Descubrir |
| `RielesCatalogo` | Con degradación A/B/C | Modo Descubrir |
| `HeaderSimple` | Cinco puertas + puerta B2B | Header |
| `SiteFooter` | Hoy: Reservá · Para negocios · Legal | Footer |

> **El hallazgo más útil de la auditoría**: `resolverModulos` e
> `itemsMenuNegocio` son **puras**. El home puede dibujar el menú lateral
> exacto que ve una barbería, y al lado el de un gimnasio, **sin una sola
> consulta a la base y sin inventar nada**. Es la demostración más
> honesta posible del producto y es prácticamente gratis.

---

## 1.6 Tokens de diseño

Dos familias conviven en `globals.css`:

| Familia | Valores | Dónde se usa |
|---|---|---|
| **Bookea** | `--navy #062653` · `--orange #f39200` · `--text #10203a` · `--muted` · `--grey` · `--line` · `--navy-profundo` · `--navy-elevado` · `--navy-suave` | El sitio |
| **Papel y tinta** | `--linksy-hueso` · `--linksy-arena` · `--linksy-carbon` · `--linksy-acento #A84A26` | El rediseño neutro de Linksy (22 sep) |

**El home usa la familia Bookea.** Y una regla que ya está escrita en el
token: `--orange` es **«el naranja REAL del logo; acento, no acción»**.
Los botones no son naranjas.

Clases utilitarias disponibles: `.bento`, `.bento-navy`, `.bento-naranja`,
`.bento-azul`, `.bento-blanco`, `.bento-orbe`.

---

## 1.7 Estado real de lo que el home va a mostrar

| Sección | Respaldo en el repo | Veredicto |
|---|---|---|
| Presencia digital | 13 tablas `solutions_*`, `VistaPagina` | ✅ mostrar |
| Reservas | `reservas`, `bloqueos_agenda`, `horarios_recurso`, `src/lib/agenda/` | ✅ mostrar |
| Pedidos | `solutions_menu_*`, `solutions_pedidos` (+0241) | ✅ mostrar, **sin decir «ventas»** |
| Clientes / CRM | `fichas_cliente`, `clientes_negocio`, `crm-citas` | ✅ mostrar |
| Lealtad | 12+ tablas, Apple y Google Wallet | ✅ protagonista |
| Marketing | `campanas_lealtad` (automáticas) ✅ · módulo general `disponible: false` | ⚠️ **solo desde Lealtad** |
| Métricas | `metricas.ts`, Estadísticas de Lealtad | ✅ con datos rotulados como demo |
| Tipos de negocio | 18 tipos, 6 familias | ✅ desde `modulos.ts` |
| Discover | `carriles-home.ts` con degradación A/B/C | ✅ sin rellenar nada |
| Prueba social | **Cero reseñas en la base** | ❌ **no va** |
| Mesas | No es recurso reservable | ❌ no prometer |
| Celebrar | **Migraciones sin aplicar** | ❌ no enlazar todavía |
| Foorkie | No existe · producto aparte | ❌ no va |

---

# FASE 2 — PLAN DE IMPLEMENTACIÓN

## 2.1 Estrategia

**Un solo archivo cambia de forma (`page.tsx`) y todo lo demás se
agrega.** Nada se borra. El modo Descubrir queda idéntico al de hoy.

## 2.2 Archivos que se MODIFICAN (3)

| Archivo | Cambio | Riesgo |
|---|---|---|
| `src/app/page.tsx` | Bifurca en dos modos; compone las secciones nuevas; metadata y `<h1>` por modo | **Medio** — es la página más sensible del sitio |
| `src/components/home/header-simple.tsx` | Nav de plataforma en el modo nuevo; se conservan las cinco puertas | Bajo |
| `src/components/site-footer.tsx` | Reordenar según §21, sin Celebrar ni Linksy | Bajo |

## 2.3 Archivos NUEVOS (9, todos en `src/components/home/`)

| Archivo | Qué hace | Base |
|---|---|---|
| `hero-plataforma.tsx` | Héroe B2B + demo del panel | Adapta `MockupsVivos` |
| `recorrido-bookea.tsx` | La narrativa: presencia → reservas → pedidos → clientes → lealtad → marketing → métricas | Nuevo |
| `seccion-pagina-negocio.tsx` | «Tu página de Bookea» | `VistaPagina` inerte + `Telefono` |
| `seccion-reservas.tsx` | Servicio → profesional → fecha → datos → confirmación | Nuevo |
| `seccion-pedidos.tsx` | Pedido desde la página | Nuevo |
| `seccion-clientes.tsx` | Ficha + CRM + reactivación | Nuevo |
| `seccion-lealtad.tsx` | Sellos, recompensas, Wallet | Reusa el pase |
| `seccion-metricas.tsx` | Tarjetas de métricas, rotuladas demo | `metricas.ts` |
| `seccion-tipos-negocio.tsx` | **El panel real cambiando de forma por tipo** | `resolverModulos` + `itemsMenuNegocio` + `identidadDe` |

**Nada se elimina.** `como-funciona.tsx` se conserva para el modo
Descubrir.

## 2.4 Orden incremental (cada paso compila y se ve)

1. Bifurcar `page.tsx` en dos modos. **El modo Descubrir queda igual que hoy.** Verificar que `?q=`, `?lugar=`, `?provincia=`, `?rubro=` y `?sub=` siguen funcionando.
2. Héroe + CTA.
3. Recorrido (la narrativa).
4. Tu página de Bookea.
5. Reservas · Pedidos.
6. Clientes · Lealtad · Marketing.
7. Métricas · Tipos de negocio.
8. Discover abajo + CTA final + footer.
9. Responsive y accesibilidad de punta a punta.
10. `npm run lint` · `npm run build` · tests.

## 2.5 Rutas

**No se crea ninguna ruta nueva.** Los CTA apuntan a lo que existe:
`/mi-negocio/nuevo`, `/mi-negocio/login`, `/negocios`, `/solutions/crear`,
`/lealtad`, `/ayuda`.

Los links a `/descubrir`, `/productos/*` y `/precios` **no se ponen**
hasta que esas páginas existan.

## 2.6 Dominio: nada en este trabajo

El cambio de `host_marca` **no entra en el rediseño del home**. Es una
migración de datos con impacto en QR impresos y merece su propio paso,
su propia verificación y su propio momento. Acá solo se respeta la
regla: **no se escribe «Linksy» en ninguna parte del home nuevo.**

## 2.7 Riesgos

| Riesgo | Mitigación |
|---|---|
| **Romper los redirects de `/citas` y `/eventos`** | El modo Descubrir es el de hoy, sin tocar. Es el paso 1 y se verifica antes de seguir |
| **Perder posicionamiento del directorio** | Los rieles se siguen renderizando en el servidor; el contenido rastreable no se va, baja de posición. El `<h1>` de la búsqueda no cambia |
| **Que el home se vuelva lento** | `leerCatalogoPortada()` ya está abajo del fold; las secciones nuevas son estáticas y sin consultas |
| **Prometer de más** | Tabla §1.7 como lista de control antes de escribir cada copy |
| **Datos de demo confundibles con reales** | Rotulados como demostración. Y nunca usar clientes reales: el banco es «Prueba de Café» / PruebaCafé Aroma, **nunca Pura Matcha ni Praia** |
| **Móvil** | Se diseña en paralelo desde el paso 2, no al final |

## 2.8 La taxonomía, como está en el repo

Cinco grupos a partir de las seis familias reales:

| Grupo en el home | Familia real | Tipos |
|---|---|---|
| Belleza | `belleza` | Barbería · Salón · Uñas · Spa · Masajes |
| Fitness | `fitness` | Gimnasio · CrossFit · Pilates · Yoga · Entrenador |
| Salud | `salud` | Consultorio · Profesional independiente |
| Academias | `academia` | Academia |
| Eventos y hospedaje | `eventos` | Salón para eventos · Proveedor · Hospedaje · Restaurante |

Se arma **leyendo `modulos.ts`**, no con una lista escrita a mano. Sin
`tienda` y sin `cafeteria`: no existen.

---

# FASE 3 Y 4 — IMPLEMENTADO Y VERIFICADO

*22 de septiembre de 2026, mismo día. Todo local, sin commits.*

## Lo que se construyó

| Archivo | Qué es |
|---|---|
| `src/lib/home-modo.ts` + test | La costura: 8 parámetros, «la presencia manda», demo → Descubrir |
| `src/components/home/modo-descubrir.tsx` | El árbol de siempre, movido sin cambiarle una línea |
| `src/components/home/modo-plataforma.tsx` | El armazón nuevo: héroe, recorrido, Discover, CTA |
| `plataforma/panel-de-tipo.tsx` | **El menú real** desde `resolverModulos` + `itemsMenuNegocio` |
| `plataforma/{recorrido,tu-pagina,reservas,pedidos,clientes,lealtad,marketing,metricas,tipos-de-negocio,piezas}.tsx` | Las secciones del recorrido |
| `scripts/verificar-home.mjs` | El arnés, de 14 a **20** comprobaciones |

Modificados: `src/app/page.tsx` (ahora decide, no dibuja),
`site-footer.tsx`, `vista-pagina.tsx` (prop `nivelTitulo`), `CLAUDE.md`.

## Los cuatro defectos que aparecieron al verificar

1. **Dos `<h1>` en el home.** `VistaPagina` emite `<h1>` con el nombre del negocio — correcto en `/s/<slug>`, un error de SEO incrustado en el home. Se agregó `nivelTitulo?: "h1" | "p"` con default `h1`: `/s/` no cambia.
2. **Texto del héroe cortado en el teléfono.** La grilla se dimensionaba por el `max-w-[380px]` del panel y se pasaba del ancho; el `overflow-x-clip` del envoltorio lo escondía en vez de delatarlo. `[&>*]:min-w-0` en todas las grillas de dos columnas.
3. **Celdas grises vacías** al final del recorrido (7 pasos en grillas de 2 y 3). El último paso ocupa lo que sobra.
4. **La inicial del panel decía «C»** — salía de «Cliente», y se leía como si el negocio se llamara así.

## Verificación

| | |
|---|---|
| Arnés del home | **20/20** |
| Tests | **180 archivos · 3 487** (eran 179 · 3 473; +14 del módulo nuevo) |
| TypeScript | limpio |
| Lint | 0 errores · 7 avisos, **todos preexistentes** |
| Build | compila · 168 páginas |
| Desbordamiento a 375 / 768 / 1440 px | **0 elementos** |

El 500 local en `/citas/:slug` y `/s/:slug` es un artefacto del dev
server (*Jest worker*), no del producto: **se reprodujo con el cambio
revertido**, y producción responde 404 y 200 correctamente.

## Zonas protegidas: intactas

- **Lealtad**: no se importó ni una función suya. La sección del home es presentación pura y enlaza a `/lealtad`. Cero cambios en puntos, miembros, transacciones, pases, Wallet, rutas o APIs.
- **Rancho Las Torres**: no se tocó reservas, disponibilidad, agenda, recursos ni pagos. Aparece en los rieles de Discover porque ya aparecía: es el mismo `RielesCatalogo` de antes, sin modificar.

---

# FASE 5 — EL CONCEPTO VISUAL (23 sep 2026)

Pedido del dueño con take.app en pantalla: «poco TEXTO, TÍTULOS GRANDES
Y MOCKUPS EXPLICATIVOS. Quiero que bookea.lat se vea así».

## Lo que se midió en take.app (no se estimó a ojo)

| | |
|---|---|
| `h1` y TODOS los `h2` | **48 px**, peso 650, interlínea 1.1, interletrado −1.2px (= −0.025em) |
| Bajada | 20 px, gris, **una sola frase**, máx. **576 px** de ancho |
| Aire por sección | **96 px** arriba y abajo |
| Fondos | alternados blanco / `#f6f8fa` |
| Alineación | **todo centrado**, una columna |
| Texto por sección | **24–91 palabras** · alto 1400–1600 px → manda el mockup |

El dato que ordenó todo: **el `h1` no es más grande que los `h2`**. No
hay jerarquía por tamaño; cada sección grita igual de fuerte.

Y una coincidencia útil: `.titulo` del repo ya trae −0.025em. El
interletrado de la marca y el de take.app son el mismo.

## Cómo quedó Bookea, medido igual

| | Antes | Ahora |
|---|---|---|
| Títulos | 26–40 px, a la izquierda | **32–48 px, centrados** |
| Layout | dos columnas, texto al lado | **una columna, mockup grande** |
| Palabras por sección | 120–180 | **22–76** |
| Título | hasta 12 palabras | **4–6** |
| Bajada | 2 párrafos + recuadro + lista | **una frase, ≤20 palabras** |

## La honestidad dejó de ser un recuadro

Era el riesgo real de recortar texto. Los recuadros de «hasta acá llega»
y las listas de alcance desaparecieron, pero **el límite no**: se mudó
adentro de la única frase.

- Pedidos → «Te llegan por **WhatsApp**, armados y listos para preparar.»
- Marketing → «…le manda tu promoción. **Desde Lealtad**.»
- Clientes → «**Sin que nadie tenga que crear una cuenta.**»

Dicen la verdad y venden en el mismo renglón. Con una sola frase, el
límite **es** el mensaje. Siguen sin aparecer: prueba social, «ventas»,
«tienda en línea» y «reservá tu mesa».

## Dos defectos que aparecieron al verificar

1. **Las barras de Métricas medían 0.** Les puse `height` en `%` dentro de una columna de alto automático: no hay contra qué resolver el porcentaje. Pasaron a píxeles, con el porqué anotado al lado.
2. **Los mockups heredaban el centrado** y el menú del panel salía centrado en vez de alineado a la izquierda. `text-left` en `Marco` y en `PanelDeTipo`.

## Fase 5b — la paleta, en dos pasadas

La primera pasada se fue al otro extremo: dejó la página entera en
blanco y negro, mockups incluidos. El dueño lo frenó en el acto —«lo
estás haciendo pésimo, mirá take.app: vamos a utilizar negros, AZULES,
colores en los gráficos, no todo blanco y negro»— y tenía razón.

Volví a medir take.app, esta vez con los mockups cargados (hay que
recorrer la página para que la carga perezosa los traiga; sin eso las
capturas salen en blanco y uno concluye cualquier cosa). Lo que hay:

| | |
|---|---|
| Títulos de sección | 48 px · **negros** |
| Subtítulos internos | 36 px · negros · peso 650 |
| Cuerpo | 18 px gris · **~28 palabras**, no una frase |
| Links | **azul `rgb(0,130,230)`** |
| Mockups | **llenos de color**: burbujas verdes de WhatsApp, badge rojo de alerta, estados azules y verdes en la lista de pedidos |

De ahí sale la regla que quedó escrita en `globals.css`:

> **La tipografía es negra. El color es de los mockups.**

Y el color entra **con significado**, nunca de adorno: azul para lo
que acaba de entrar, verde para lo confirmado o pagado, ámbar para el
sello de Lealtad, y el acento real del rubro para el panel de cada
tipo de negocio (`identidadDe()`, que es el mismo color que ve el
dueño en su panel).

**La lección**: «fondo blanco y títulos negros» no era «sacale el color
a todo». El fondo y la letra son el papel; el producto que se enseña
encima sigue siendo de colores.

## Cómo se repintó sin romper el resto

Las variables de marca de Tailwind están declaradas como
`--color-aventurea-navy: var(--navy)`, y una custom property se
resuelve **en el elemento que la usa**. Así que redefinir `--navy`
dentro de `.home-plataforma` alcanza para repintar todo lo que cuelgue
de ahí —header, franja superior, tarjetas del catálogo, pie— sin tocar
un pixel del modo Descubrir ni de las otras 158 rutas.

Seis líneas de CSS en vez de una cacería por veinte archivos.

## Verificación

Arnés **20/20** · tests **180 / 3 487** · TypeScript limpio · lint 0
errores · build 168 páginas · **0 desbordes** a 375 / 768 / 1440 · **un
solo `<h1>`**.

---

# LO QUE QUEDÓ PENDIENTE DE DECISIÓN

Las cuatro preguntas de la Fase 2 quedaron resueltas por el dueño:
dos modos **aprobado**; `/precios` **fuera** (sin redirigir a
`/lealtad/planes`, que es el precio de un producto y no el de la
plataforma); Celebrar **fuera** del pie hasta que tenga ruta pública;
puntero de `CLAUDE.md` **actualizado**.

Lo que sigue abierto, y que el home NO promete mientras tanto:

1. **Cómo se cobra el paquete completo.** Sin eso no hay `/precios` ni columna de precios en el pie.
2. **Cuándo se despliega Celebrar.** Sus migraciones (0242–0249) siguen sin aplicar; hasta entonces no se enlaza.
3. **Si `marketing` deja de ser `disponible: false`.** Hoy la sección dice explícitamente que las campañas viven dentro de Lealtad.
4. **Si entra un tipo `tienda`.** Mientras no exista en `modulos.ts`, la sección de rubros no lo nombra — se arma leyendo el archivo.
5. **`host_marca` a `'bookea'`.** La columna existe en producción (0239 aplicada), pero la mudanza de dominio es una migración de datos con QR impresos de por medio: merece su propio paso.

---

*Todo local en `localhost:3100`. Sin commits, sin despliegues.*
*Arnés: `node scripts/verificar-home.mjs`.*
