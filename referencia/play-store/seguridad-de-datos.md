# Seguridad de los datos (Data Safety) — respuestas verificadas

Auditado contra el código de `mobile/` el 2 sep 2026. Cada respuesta
sale de una línea real, no de memoria. Play Console → **Contenido de la
aplicación → Seguridad de los datos**.

> Regla de oro del formulario: **"recopilado" = sale del teléfono hacia
> un servidor.** Lo que se accede y se queda en el dispositivo NO se
> declara como recopilado. Por eso ubicación y cámara van en "no".

---

## 1 · Prácticas de seguridad (la primera pantalla)

| Pregunta | Respuesta |
|---|---|
| ¿Se cifran los datos en tránsito? | **Sí** (todo va por HTTPS a Supabase) |
| ¿Hay forma de solicitar la eliminación de datos? | **Sí** |
| URL de eliminación de cuenta | `https://bookea.lat/privacidad` |

La app además borra la cuenta desde adentro: **Ajustes → Eliminar
cuenta** (RPC `eliminar_mi_cuenta`), y la política lo explica en la
sección «Borrar tu cuenta y tus datos».

---

## 2 · Qué SÍ se recopila

Para cada uno: **recopilado = sí**, **compartido con terceros = no**,
**obligatorio** salvo donde diga opcional.

### Información personal
| Tipo | Para qué | Nota |
|---|---|---|
| Nombre | Funciones de la app | Al crear cuenta y en cada reserva |
| Correo electrónico | Funciones de la app, gestión de la cuenta | Es el eje del login |
| Número de teléfono | Funciones de la app | WhatsApp, para que el negocio confirme |
| **Otros datos (documento de identidad)** | Funciones de la app, **prevención de fraude** | Cédula del cliente al reservar y **fotos de la cédula** del proveedor que se verifica |

### Fotos y videos
| Tipo | Para qué | Nota |
|---|---|---|
| Fotos | Funciones de la app | Comprobante de pago, fotos del negocio y del catálogo, fotos de cédula |

### Información financiera
| Tipo | Para qué | Nota |
|---|---|---|
| Historial de compras | Funciones de la app | Montos, depósitos y comprobantes de reserva |
| Otra información financiera | Funciones de la app | SINPE / cuenta bancaria **del comerciante**, para que le paguen |

> **NO marcar "Información de pago"** (tarjetas): la app no procesa
> pagos ni guarda tarjetas. El pago es por SINPE fuera de la app y la
> persona sube una captura del comprobante.

### Mensajes
| Tipo | Para qué |
|---|---|
| Otros mensajes en la app | Funciones de la app (chat cliente ↔ negocio) |

### ID del dispositivo o de otro tipo
| Tipo | Para qué | Nota |
|---|---|---|
| ID de dispositivo | Funciones de la app | Token de push + un id **aleatorio generado por la app**, no un identificador de hardware |

---

## 3 · Qué NO se recopila (y por qué la respuesta es "no")

- **Ubicación** — se pide permiso, pero solo en primer plano y las
  coordenadas **nunca salen del teléfono**: alimentan el centrado del
  mapa y un filtro en memoria. Verificado: la única llamada a Supabase
  de esa pantalla no recibe las coordenadas. Sin permiso de ubicación
  en segundo plano.
- **Cámara** — solo decodifica códigos QR. El frame nunca se guarda ni
  se sube; la propia pantalla lo dice: «No se guarda ninguna foto ni se
  graba nada». Sin permiso de micrófono.
- **Foto de perfil** — no existe: el avatar son iniciales dibujadas.
- **Contactos, calendario, SMS, salud, actividad física, archivos** —
  no se tocan.
- **Historial de navegación, apps instaladas, rendimiento** — no.

---

## 4 · Publicidad y rastreo — todo en "no"

**No hay ningún SDK de analítica ni de publicidad.** Se verificó dos
veces: la lista de dependencias y el lockfile. Sin Firebase, Sentry,
Amplitude, PostHog, Segment, Mixpanel, Facebook SDK, AdMob ni
Google Sign-In nativo.

Consecuencias directas para los formularios:
- **Anuncios**: la app **no contiene anuncios**.
- **Permiso `AD_ID`**: no está declarado — coherente, y si Play lo
  pregunta la respuesta es que **no se usa el ID de publicidad**.
- Los datos **no se comparten con terceros** ni se usan para
  publicidad o marketing.

Única conexión fuera de Supabase: **Expo Updates**, que entrega código
(actualizaciones OTA), no datos de personas.

---

## 5 · Los dos puntos que Google mira con lupa

1. **Fotos de documento de identidad** (verificación de proveedores) y
   **número de cédula** en las reservas. Están bien declarados arriba
   como «Otros datos → prevención de fraude» + «Fotos». Que el destino
   sea un bucket **privado** (`verificacion-proveedores`, se lee con
   URL firmada) es justamente lo que hay que poder sostener.
2. **La política de privacidad tiene que nombrarlos.** Antes de enviar
   a revisión, confirmá que `https://bookea.lat/privacidad` menciona la
   cédula y las fotos de verificación. Si no lo dice, se agrega — es
   una línea, y sin ella la ficha se rechaza por inconsistencia entre
   el formulario y la política.

---

## 6 · Acceso a la app (formulario aparte, también obligatorio)

La app **exige login**, así que Play pide credenciales de prueba. El
login normal manda un código de 6 dígitos al correo — un revisor no
puede recibirlo. **Las cuentas demo entran con contraseña**, y se
verificó que funcionan en producción el 2 sep 2026:

| Campo | Valor |
|---|---|
| Nombre de las instrucciones | Cuenta de prueba (cliente) |
| Usuario | `cliente.demo@bookea.lat` |
| Contraseña | `123456` |

**Instrucciones para pegar en el formulario:**

```
La app pide iniciar sesión. Para revisar, usen la cuenta de prueba:

1. Abrir la app y tocar "Perfil" en la barra inferior.
2. Escribir el correo: cliente.demo@bookea.lat
3. Tocar "Continuar".
4. Cuando pida el código de 6 dígitos, escribir: 123456
5. Toca "Entrar" y ya queda dentro de la cuenta.

Esta cuenta entra directo con ese código fijo, sin necesidad de
recibir ningún correo. Tiene datos de ejemplo para poder navegar
reservas, citas y el perfil.
```

> También funcionan `negocio.demo@bookea.lat` y `citas.demo@bookea.lat`
> con el mismo código, si quieren mostrar el lado del negocio.
