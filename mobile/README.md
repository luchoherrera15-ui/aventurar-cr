# BookeaCR (mobile)

App de Expo (React Native + TypeScript) para el directorio de proveedores
de eventos de Bookear CR. Usa el mismo proyecto de Supabase que `/web`
(raíz del repo) — mismo esquema (`ranchos`, `disponibilidad_rancho`,
`reservas`, etc.) y mismas funciones RPC — pero con su propio cliente y
variables de entorno.

## Diseño

Misma línea de marca que `/web` (Montserrat, navy sobre crema, títulos
en ExtraBold con tracking cerrado — ver `src/constants/theme.ts`), con
la estructura de exploración inspirada en apps de marketplace tipo
Airbnb: buscador, categorías como tabs con ícono, y filas horizontales
por categoría con un botón "ver todos". Navegación por una barra
inferior propia (`src/components/tab-bar.tsx`, no `NativeTabs` —
esa API de expo-router todavía es inestable y depende del tab bar
nativo de cada plataforma) con dos destinos: Explorar y Cuenta.

## Qué hace

- Directorio: lista los proveedores aprobados (lugares, catering, DJs,
  photobooths, fotógrafos, etc.). Buscador por nombre/provincia/cantón,
  tabs de categoría con ícono, y filas horizontales agrupadas por
  categoría cuando no hay búsqueda ni categoría activa.
- Detalle: fotos, descripción, amenidades y, si es un lugar con
  reservas en línea, disponibilidad de los próximos 60 días.
- Reserva: bloquea la fecha (hold temporal de 10 minutos, igual que
  `/web`), pide los datos del evento, muestra el método de pago
  configurado por el proveedor (SINPE o cuenta bancaria), sube el
  comprobante y confirma la reserva mediante la misma función
  `completar_reserva_temporal` que usa la web.
- Cuenta (opcional): registrarse **nunca** es obligatorio para
  reservar — solo sirve para tener un panel propio. Un registro desde
  la app siempre entra con el rol nuevo `cliente` (no "dueño de
  rancho"); si esa persona más adelante publica un negocio desde
  `/mi-rancho`, su cuenta pasa sola a "dueño de rancho" recién en ese
  momento. El dashboard del cliente muestra sus reservas activas y su
  historial (con datos reales, ligados a su cuenta vía
  `reservas.cliente_id`), y tiene un botón "Publicar tu negocio" que
  abre el alta de proveedores de `/web` en un navegador dentro de la
  app — construir ese alta en nativo es un paso aparte, no está en
  este alcance.

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

- **Login sin contraseña (código de 6 dígitos por correo).** Quedó
  pendiente a pedido: por ahora el login/registro usa correo +
  contraseña (`supabase.auth.signInWithPassword` / `signUp`). Cuando
  se retome, Supabase Auth ya trae "Email OTP" de fábrica (no hay que
  programar la generación/verificación del código) — solo falta
  decidir cómo lo manda Resend (SMTP relay en el dashboard de Supabase
  vs. un Auth Hook con plantilla propia) y confirmar el dominio
  `bookea.lat` verificado en Resend.
- Alta de proveedores nativa en la app (hoy el botón "Publicar tu
  negocio" abre `/publicar` de la web en un navegador embebido).
- Códigos de descuento (sí soporta las promociones automáticas por día
  de la semana).
- Los límites contra bots que tiene `/web` (intentos por IP, etc.) son
  server-side vía Next.js; acá el hold temporal usa un id de
  dispositivo en vez de una IP real.
- Notificación push al confirmar/aprobar una reserva.
