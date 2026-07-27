# BookeaCR (mobile)

App de Expo (React Native + TypeScript) para el directorio de proveedores
de eventos de Bookear CR. Usa el mismo proyecto de Supabase que `/web`
(raíz del repo) — mismo esquema (`ranchos`, `disponibilidad_rancho`,
`reservas`, etc.) y mismas funciones RPC — pero con su propio cliente y
variables de entorno.

## Qué hace

- Directorio: lista los proveedores aprobados (lugares, catering, DJs,
  photobooths, fotógrafos, etc.), con filtro por categoría.
- Detalle: fotos, descripción, amenidades y, si es un lugar con
  reservas en línea, disponibilidad de los próximos 60 días.
- Reserva: bloquea la fecha (hold temporal de 10 minutos, igual que
  `/web`), pide los datos del evento, muestra el método de pago
  configurado por el proveedor (SINPE o cuenta bancaria), sube el
  comprobante y confirma la reserva mediante la misma función
  `completar_reserva_temporal` que usa la web.

## Configuración

```bash
cd mobile
cp .env.example .env
```

Completá en `.env` la URL y anon key del **mismo** proyecto de Supabase
que usa `/web` (Project Settings → API). Son variables separadas de las
de `/web` porque Expo solo expone al bundle las que empiezan con
`EXPO_PUBLIC_`.

```bash
npm install
npx expo start
```

Desde ahí podés abrir la app en Expo Go, un emulador Android, el
simulador de iOS, o el navegador.

## Qué falta (no está en este alcance todavía)

- Códigos de descuento (sí soporta las promociones automáticas por día
  de la semana).
- Los límites contra bots que tiene `/web` (intentos por IP, etc.) son
  server-side vía Next.js; acá el hold temporal usa un id de
  dispositivo en vez de una IP real.
- Notificación push al confirmar/aprobar una reserva.
