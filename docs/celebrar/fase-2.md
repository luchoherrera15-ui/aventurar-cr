# CELEBRAR — Fase 2: base propia, asistente de creación y perfil

> Hecha el 20–21 de setiembre de 2026, en local. **Sin commit, sin deploy.**
> La migración **0242 quedó APLICADA el 21 sep** con el OK del dueño
> («aplicá las migraciones que necesités»), vía
> `node scripts/aplicar-migracion.mjs 0242` (solo ella; 0239 y 0240 siguen
> pendientes y son de otros productos). Verificado contra la base viva y con
> el flujo completo en el navegador — detalle en «Verificaciones».

## Qué hace ahora

| Dónde | Qué |
|---|---|
| `/celebrar/app/crear` | Asistente real: paso 1 (tipo, con ícono) y paso 2 (nombre, **dirección con sugerencia automática y comprobación en vivo**, fecha, hora, lugar, dirección, link de mapa). Crea la celebración como borrador y abre su ficha |
| `/celebrar/app/celebraciones` | La lista de la persona en tarjetas (tipo, nombre, fecha, estado, Editar / Ver / Compartir); las archivadas aparte |
| `/celebrar/app/celebraciones/[id]` | La ficha: datos básicos editables (incluida la dirección, con histórico), la URL pública para copiar, «lo que sigue» (pasos 3–7) y Archivar / Restaurar |
| `/celebrar/app` | Inicio con las celebraciones reales (o el estado vacío) y un aviso si la base no está aplicada en el entorno |
| `/celebrar/app/configuracion` | Perfil editable: nombre (identidad compartida), WhatsApp, país → moneda, novedades |

Sin base aplicada, el panel se recorre igual: las lecturas devuelven vacío
(`datos.ts` reconoce 42P01 / PGRST205), el asistente dice «no se pudo
comprobar la disponibilidad» y crear/guardar responden con el mensaje de
que falta la 0242. Nada revienta.

## La migración 0242 (`supabase/migrations/0242_celebrar_base.sql`)

Idempotente (`if not exists`, `drop policy if exists`, `create or replace`),
aditiva, no toca ninguna tabla existente salvo una FK opcional a
`media_assets(id)`.

| Objeto | Para qué |
|---|---|
| `celebrar_perfiles` | lo propio de la persona (WhatsApp, país, moneda, novedades); `id → auth.users` |
| `celebrar_plantilla_categorias` | las 11 categorías del brief (semilla incluida) |
| `celebrar_plantillas` + `_secciones` + `_variantes` | el catálogo; `esquema`/`estilos` jsonb para el editor; `html_legado` para plantillas viejas. Semilla: 3 plantillas gratis |
| `celebrar_slugs` | rutas del sistema (`app`, `admin`, `entrar`…), reservados y **históricos** (slugs viejos que siguen llevando a su celebración) |
| `celebrar_celebraciones` | el objeto central: tipo, nombre, slug único, fecha/hora/lugar, plantilla, tema/config jsonb, estado (`borrador → publicada → finalizada → recuerdos`, `archivada`) |
| `celebrar_vigilar_slug()` (trigger) | rechaza slugs de sistema/reservados/históricos ajenos; al renombrar guarda el viejo como histórico |
| `celebrar_es_duena(uuid)` | para las RLS de las tablas hijas de las fases siguientes |
| `celebrar_slug_disponible(text)` | sí/no para el asistente; no revela de quién es un slug ocupado |
| `celebrar_crear_celebracion(...)` | crea perfil si falta + celebración; mensajes en español para la persona |
| `celebrar_publica_por_slug(text)` | lo publicable de una celebración publicada (Fase 3); sigue históricos; nunca devuelve `owner_id` |

**RLS**: dueña = `owner_id = auth.uid()` (select/insert/update; sin delete —
se archiva); catálogo público solo lo activo; `celebrar_slugs` sin políticas
(solo funciones); admin (`is_admin()`) lee todo. **Cero `select` anónimo**
sobre celebraciones: el público entra por la RPC.

Revisada con `node scripts/revisar-sql.mjs` (sin problemas de estructura).

## Cómo se aplicó y qué se comprobó

`node scripts/aplicar-migracion.mjs 0242` (Management API, archivo tal cual;
201). Se corrió dos veces —la segunda tras agregar los `revoke`— sin daño:
es idempotente. Un `supabase db push` posterior la volverá a correr igual.

Contra la base viva (solo lectura por Management API):
- 7 tablas `celebrar_*`, todas con RLS; 3 políticas en perfiles y
  celebraciones, 1 en cada tabla del catálogo, 0 en `celebrar_slugs`.
- 11 categorías, 3 plantillas gratis, 24 slugs de sistema + 3 reservados.
- 6 funciones `celebrar_*` (las de negocio, security definer).
- `celebrar_slug_disponible('app')` = false, `('sofia-y-andres')` = true,
  `('Mal')` = false.
- `anon` sobre `celebrar_celebraciones`: **permission denied (42501)**;
  `anon` sobre el catálogo: lee las 3 plantillas.
- Privilegios finales: authenticated = INSERT/SELECT/UPDATE en perfiles y
  celebraciones; anon/authenticated = SELECT en el catálogo; nada en slugs.

**Hallazgo del proyecto (no de CELEBRAR):** los privilegios por defecto de
la base dejan `TRUNCATE, TRIGGER, REFERENCES` a `anon` y `authenticated`
en TODAS las tablas nuevas (se ve en `invitaciones`, `ranchos`,
`solutions_negocios`). PostgREST no expone TRUNCATE, así que no hay
exposición práctica hoy, pero RLS no lo frenaría. En las tablas de CELEBRAR
se revocaron dentro de la 0242; para el resto del sitio queda anotado como
pendiente de higiene (un `alter default privileges` + `revoke` masivo, a
decidir por el dueño).

Flujo completo probado en el navegador con la sesión del dueño (21 sep):
crear «Prueba CELEBRAR Sofía & Andrés» (boda, 12/12/2026 16:00, Hacienda
Los Sueños) → ficha con URL → intentar slug `app` (rechazado: «reservada») →
renombrar a otro slug (guardado; el viejo quedó como histórico apuntando a
la celebración) → archivar → restaurar → lista con la card → guardar
WhatsApp en Configuración (perfil creado solo por la RPC, CR/CRC). La RPC
pública no devuelve el borrador. La celebración de prueba se borró después
(y su histórico); el perfil del dueño quedó.

## Código nuevo

```
src/lib/celebrar/
  slug.ts               sugerirSlug, limpiarSlugEscrito, veredictoSlug
  validar-celebracion.ts validarCelebracion (pura; misma en cliente y servidor)
  slug.test.ts          9 pruebas de lo anterior
  tipos.ts              filas Celebracion / PerfilCelebrar / Plantilla, ESTADO_TEXTO
  datos.ts              misCelebraciones, celebracionPorId, miPerfilCelebrar, plantillasActivas,
                        baseListaCelebrar — con el cliente de la persona (RLS), tolerantes a tabla ausente

src/app/celebrar/app/
  crear/acciones.ts             crearCelebracion (server action → RPC → redirect a la ficha)
  crear/asistente-crear.tsx     el asistente (cliente); slug en vivo con useActionState
  celebraciones/page.tsx        la lista
  celebraciones/[id]/page.tsx   la ficha
  celebraciones/[id]/acciones.ts actualizarCelebracion, cambiarEstadoCelebracion
  celebraciones/[id]/editar-basicos.tsx
  configuracion/acciones.ts     guardarPerfil (nombre por actualizar_mi_nombre; resto en celebrar_perfiles)
  configuracion/perfil-form.tsx

src/components/celebrar/panel/tarjeta-celebracion.tsx   la card + PastillaEstado
```

Reutilizado de Bookea sin tocarlo: `actualizar_mi_nombre` (RPC),
`@/lib/monedas` (países y monedas), `@/lib/fechas` (`fechaLargaCR`),
`@/components/boton-copiar`.

## Dependencias y notas

1. **Aplicar la migración fue un cambio de esquema en producción** (la base
   que usa `localhost:3100` es la de producción). Se hizo con el OK
   explícito del dueño, solo la 0242.
2. `next build` mientras corre `next dev` dejó el caché de desarrollo
   (`.next/dev`) inconsistente: todas las rutas anidadas de `/celebrar`
   daban 404 hasta borrar `.next/dev` y reiniciar. Regla práctica: parar
   `dev` antes de `build`, o limpiar `.next/dev` después.
3. La regla `react-hooks/set-state-in-effect` del linter prohíbe `setState`
   sincrónico dentro de `useEffect`: el asistente deriva el estado del slug
   en el render y solo escribe desde la respuesta asíncrona de la RPC.
4. Publicar (paso 7) no existe todavía a propósito: necesita plantilla
   elegida y editor (Fase 3). La URL se muestra desde ya, con la nota «se
   activa al publicar».

## Verificaciones

```
npx tsc --noEmit                              ✓
npx eslint (celebrar)                          ✓ 0 problemas
npm test                                       ✓ 174 archivos, 3436 pruebas (+9)
npm run build                                  ✓ (/celebrar/app/celebraciones/[id] incluido)
Sin sesión: /celebrar/app/* → 307 al login de CELEBRAR
Con sesión: crear → ficha → editar → archivar → restaurar → perfil, contra la base real
```

## Lo que sigue (Fase 3)

Con la 0242 aplicada: paso 3 (elegir plantilla del catálogo), 4 (editor con
previa en vivo desde `esquema`/`estilos`), 6 (vista previa), 7 (publicar →
`estado = publicada`) y la página pública `/celebrar/[slug]` estática que
lee por `celebrar_publica_por_slug`, con Open Graph propio.
