@AGENTS.md
@AGENTS.md

# Bookear CR / Aventurar CR

Marketplace y directorio de proveedores de eventos en Costa Rica.
Reserva instantánea: espacio + fecha + pago = reservado.

## Comandos
- `npm run dev` — levantar el servidor de desarrollo
- `npm run build` — verificar que el build pasa antes de dar por terminado un cambio
- `npm run lint` — correr el linter después de editar código

## Stack y arquitectura
- Next.js con TypeScript en `src/`, deploy en Vercel
- Supabase para base de datos, auth y storage; las migraciones viven en `/supabase`
- La app móvil (carpeta `mobile/`) comparte la MISMA base de datos de Supabase:
  nunca cambiar tablas o columnas sin considerar el impacto en la app

## Base de datos
- Todo cambio de esquema se hace con una migración en `/supabase`, nunca
  editando la base directamente
- Toda tabla nueva debe tener políticas RLS (Row Level Security)
- No exponer la service_role key en código del cliente; solo usar la anon key

## Convenciones de código
- TypeScript estricto: no usar `any`
- Componentes reutilizables en `src/components`; no duplicar componentes
- No editar archivos generados (`.next`, `node_modules`, `package-lock.json`)
- Preferir modificar componentes existentes en vez de crear versiones nuevas

## Producto y contenido
- Todos los textos de UI en español (mercado costarricense)
- Precios en colones (₡) con formato local
- Categorías oficiales: Todos, Lugares, Alimentación, Animación,
  Organización, Decoración, Otros servicios — no inventar categorías nuevas
- El flujo de reserva es instantáneo (sin negociación previa); no agregar
  pasos de aprobación manual sin que se pida

## Diseño
- Estilo propio de la marca: no copiar la estética de Airbnb en general
- Excepción confirmada por el dueño (ago 2026): la barra de búsqueda del
  home (`src/components/home/nav-categorias.tsx`) SÍ es una cápsula
  estilo Airbnb — decisión explícita, no un descuido. El resto del
  sitio sigue sin píldoras salvo que se pida lo mismo puntualmente.
- El panel de anfitriones debe verse profesional, formal y elegante
- Mantener consistencia visual entre el sitio web y la app móvil

## Reglas generales
- Antes de cambios grandes (borrar archivos, cambiar esquema, tocar
  vercel.json o pagos), explicar el plan y esperar confirmación
- No hacer commit ni push sin que se pida explícitamente
- No subir llaves ni secretos; las variables van en `.env.local`