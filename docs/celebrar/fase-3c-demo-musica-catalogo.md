# CELEBRAR — Fase 3c: la demo viva del héroe, música y el catálogo por estilos

> Hecha el 21 de setiembre de 2026, en local (`localhost:3100`). **Sin
> commit, sin deploy.** Migración **0244 APLICADA** (bucket
> `celebrar-media` para la música). Plantillas re-sembradas (categorías
> rebalanceadas, todo gratis).

Pedidos del dueño en esta vuelta:

1. `/celebrar/app/plantillas` mostraba solo once tarjetas de categoría:
   «deberían haber unas 35 plantillas por opción».
2. Invitaciones basadas en las de Bookea, animadas, **con música** y
   muchas opciones.
3. **Todo el procedimiento gratis; lo que cuesta es publicar.**
4. Confirmaciones: un panel de confirmados en la app, o por WhatsApp
   con control manual.
5. «Lucite» en el teléfono del héroe: que se scrollee solo, con fotos
   profesionales, y que al final salga el panel de confirmación.

## El teléfono del héroe (`components/celebrar/especimen-vivo.tsx`)

Ya no es una maqueta: es **la invitación de verdad** — el mismo
`RenderInvitacion` del editor y de la página pública — en `modo="demo"`.
Cuatro celebraciones completas en `lib/celebrar/demos.ts` (boda «Sofía &
Andrés» en marfil y vino con pétalos; XV «Camila Fernanda» noche de gala
con aurora; «Los 5 de Mateo» confeti; graduación «Daniela Rojas» marino
académico con filete), cada una con fotos de Unsplash verificadas,
programa, vestimenta con paleta de colores, galería en polaroids,
regalos con SINPE, cierre con firma — y **el formulario de confirmación
al final** (nombre, sí/no, cuántos, mensaje → «¡Gracias, Valeria!»).

El teléfono **baja solo** a 46 px/s (rAF con acumulador decimal:
`scrollTop` redondea y se clava con pasos de menos de 1 px — la misma
trampa del desfile de Lealtad), espera 2,4 s arriba y 3,8 s abajo, y pasa
a la siguiente celebración. Se detiene con el cursor encima, al tocarlo o
scrollearlo a mano (retoma a los 6 s), con la pestaña oculta y con
`prefers-reduced-motion`. En la demo la ubicación no incrusta el mapa
(cero iframes de Google en la portada).

## Música (`documento.musica`)

- Modelo: `{ url, titulo, autoplay }`, normalizado; sin música el
  documento sigue igual.
- **Bucket `celebrar-media`** (0244): público para leer; escribe solo la
  dueña en la carpeta `<celebracion_id>/` (política con
  `celebrar_carpeta_es_mia` → `celebrar_es_duena`); 12 MB y solo tipos de
  audio, en el bucket mismo. Nada de service role: la subida va con el
  cliente de la persona (`subirMusicaCelebrar`).
- Editor: tarjeta «Canción» en **Esencial** (subir mp3/m4a/aac/ogg/wav,
  título, «arranca sola al primer toque», cambiar, quitar) con aviso de
  derechos.
- Invitación: botón flotante **sticky** «Reproducir nuestra canción» con
  barras de sonido al sonar (`musica.tsx`). Los navegadores no dejan sonar
  sin un toque: «autoplay» = al primer toque/scroll, y solo en la página
  pública. Para que el sticky funcione el raíz pasó de `overflow: hidden`
  a `overflow: clip`.
- Probado: subida de un wav de prueba → URL en el bucket → botón en la
  previa → reproduce → quitada y borrada del bucket.

## El formulario de confirmación (`formulario-rsvp.tsx`)

Vive en el `modo="demo"`. En el editor y la pública el RSVP sigue siendo
el botón de **WhatsApp** (`wa.me` al número del anfitrión con «confirmo
mi asistencia») — que es exactamente la opción B del dueño, sin costo de
API: el invitado escribe desde SU WhatsApp y el anfitrión lleva el
control a mano. La opción A (formulario en la página + panel de
confirmados en la app) es la **Fase 6**: el componente ya existe y recibe
`alEnviar` para conectarlo a la lista de invitados.

> Sobre «la API de WhatsApp que le mande un mensaje al número que
> pongan»: para que el SISTEMA mande el mensaje hace falta WhatsApp
> Business API (Meta) — cuenta verificada, plantillas aprobadas y costo
> por conversación. `wa.me` logra el mismo resultado hoy sin nada de eso.
> Queda documentado para decidir en la Fase 6.

## El catálogo `/celebrar/app/plantillas` (`panel/galeria-plantillas.tsx`)

Las once categorías como pestañas con su conteo, filtro por tipo, cada
diseño con su **portada real** (miniatura escalada), «Ver más» de 24 en
24. **«Usar esta»** pregunta en cuál celebración (si la persona tiene
alguna de ese tipo; avisa si reemplaza un diseño) o manda al asistente
con `?tipo=…&plantilla=…`: al crear, `crearCelebracion` aplica la
plantilla y abre el editor directo.

Categorías rebalanceadas en el generador (`categorias` por familia, no
`i % 5`): 40 por categoría salvo floral 45 y moderna 35 — test: ≥ 35
cada una. **`costo_creditos = 0` en todo el catálogo**; «premium» queda
como rótulo. Las miniaturas ya no muestran la pista «tu foto acá».

## Otros ajustes de esta vuelta

- **Acento por escena**: si el acento no contrasta con el fondo de esa
  escena (coral sobre rojo, ratio < 2,3), rótulos, ornamentos, bordes y
  botones usan la tinta de la escena. El oro sobre marfil (2,47) se
  mantiene a propósito.
- Ondas del fondo vivo más bajas y la intensidad «media» al 0,6; el
  motivo decorativo al 0,32.
- Con filete, las escenas dejan 10cqi a los lados.
- **Cero `color-mix()` en `invitacion.css`**: el test de `globals.test.ts`
  exige respaldo + `@supports`; las mezclas se calculan en
  `lib/celebrar/invitacion/colores.ts` (`mezclar`, `alfa`) y viajan como
  variables planas por escena.

## Verificaciones

`tsc` limpio · eslint 0 · vitest **3449** en verde (incluida la prueba
del CSS construido) · `npm run build` pasa. En el navegador: la demo
baja sola (scrollTop 294 → 1220 en 20 s), pausa al hover, formulario
enviado → «¡Gracias, Valeria! Quedaste anotada con 2 lugares…», las 4
demos con fotos; galería con pestañas (Luxury 40) y portadas reales;
música subida, sonando y quitada.

## Pendiente

- Fase 4: cobrar **al publicar** (el candado va en `cambiarPublicacion`),
  no por plantilla ni por IA.
- Fase 6: RSVP en la página + panel de confirmados; decidir si además se
  paga WhatsApp Business API para avisar al anfitrión.
- La demo del héroe usa fotos de Unsplash: si el dueño quiere fotos
  propias/clientes reales, se cambian en `demos.ts`.

## Anexo (misma noche): motivos decorativos profesionales

Pedido: «la parte de los motivos decorativos hay que mejorarla, agregar
más cosas, que se vea más profesional».

- **23 motivos** nuevos en `components/celebrar/invitacion/decoracion.ts`,
  dibujados con helpers (una hoja, una rama, una flor, un abanico) y no
  con clip art: ramitas, eucalipto, olivo, helechos, monstera, laurel;
  florecitas, peonías, mariposas, corazones; art déco, damasco, celosía,
  geometría, rayas finas, cuadrícula, olas japonesas (seigaiha con
  escamas que se tapan de verdad); cielo, confeti, puntos, terrazo,
  globos, anillos. Agrupados en el selector (Botánicos / Florales /
  Geométricos / Fiesta y cielo) con **muestra real** en la paleta actual.
- El motivo se pinta por escena **en el color de esa escena** (antes iba
  en `currentColor` dentro de un data: URI, que es negro: por eso se veía
  sucio). Controles nuevos: **tamaño** (fino / medio / grande),
  **intensidad** (sutil / media / fuerte) y **dónde va** (todas las
  escenas / solo arriba y abajo como guirnalda / solo la portada).
- **Adornos de esquina** (`esquinas.tsx`): ramo floral, ramas de
  eucalipto, art déco, filigrana, destellos — ilustraciones de línea en
  las cuatro esquinas de la portada y del cierre, en el acento; blancas
  sobre foto. La portada deja más aire arriba cuando los lleva.
- Las 32 familias del generador traen motivo, disposición y esquinas
  dirigidos a mano (Carta = peonías en guirnalda + ramo floral; Gala =
  abanicos solo en la portada + esquinas déco; Jardín = eucalipto +
  ramas…). Re-sembradas. Las demos del héroe también.
- Trampa aprendida: un atributo repetido en el SVG (`stroke-width` dos
  veces) rompe el XML entero y la loseta sale en blanco sin error.

Verificación: eslint 0 · vitest 3449 · build OK · hoja de contacto de los
23 motivos revisada a ojo; esquinas probadas sobre marino con filete,
sobre marfil y sobre foto.
