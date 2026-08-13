# Arquitectura del módulo de Lealtad

Mapa de qué es cada cosa y de qué cuelga. Si vas a tocar Lealtad, leé esto
primero.

---

## La decisión de fondo

**Lealtad no cuelga de `ranchos`.** Cuelga de `cuentas`, una raíz propia.

Un negocio puede tener Lealtad sin existir en el marketplace, y un rancho del
marketplace puede tener Lealtad sin que las dos cosas sean la misma fila.

```
cuentas                    ← la raíz del negocio
 ├─ owner_id  → auth.users      identidad reutilizada, nunca duplicada
 ├─ plan, estado, slug, logo    el plan del módulo de Lealtad
 ├─ rancho_id → ranchos  NULL   ← LA COSTURA (opcional)
 │
 ├─ cuentas_equipo              asientos, que el plan limita
 └─ programa_lealtad            los programas (varios por cuenta)
      ├─ recompensas
      └─ miembros
           ├─ pases_wallet          Apple + Google
           ├─ transacciones_puntos  el ledger
           └─ canjes

ranchos                    ← INTACTO. El marketplace sigue igual.
 ├─ vertical: eventos | citas | hospedajes
 ├─ modulos_negocio, addons_negocio
 └─ reservas, mensajes, gastos, media… (~40 tablas)
```

### La costura con el resto de Bookea

`cuentas.rancho_id` es **nullable**:

| Valor | Significa |
|---|---|
| `null` | El negocio existe **solo** en Lealtad. |
| un id | Es la **misma empresa** que ese rancho del marketplace. |

Cuando un rancho que ya existe activa Lealtad, la cuenta **se crea y se enlaza
sola**: el dueño no ve dos negocios ni carga su nombre y su logo otra vez.

Es `on delete set null` a propósito: borrar la ficha de marketplace **no puede**
llevarse por delante el programa de lealtad y los pases de sus clientes. La
cuenta sobrevive, desenlazada.

Y es `unique`: dos cuentas apuntando al mismo rancho serían dos programas para el
mismo local, con el cliente sin saber cuál es el suyo.

---

## La regla que no se negocia

> **Los pases ya emitidos no se tocan.**

`miembros`, `pases_wallet`, `transacciones_puntos`, `recompensas` y `canjes`
cuelgan de `programa_lealtad.id`, y **ese id nunca cambia**.

El `serial_number` de un pase es su identidad dentro del teléfono. Si cambiara,
el iPhone agregaría una tarjeta **nueva** en vez de refrescar la que el cliente
ya tiene, y el saldo viejo quedaría huérfano en una tarjeta que nadie vuelve a
mirar.

Por eso la 0134 **solo agrega un padre**; no reemplaza identidades.

---

## Expandir ahora, contraer después

`programa_lealtad.rancho_id` **se conserva y sigue poblado**.

El código que hoy filtra por `rancho_id` sigue funcionando sin cambios mientras
se migra pantalla por pantalla. Recién cuando nada lo lea se podrá quitar, en
otra migración.

**Mientras dure la transición**: escribí lo nuevo contra `cuenta_id`. No agregues
código nuevo que dependa de `programa_lealtad.rancho_id`.

---

## Permisos

Dos funciones `SECURITY DEFINER`, y hay que usarlas — no reescribir la
subconsulta en cada política:

| Función | Quién pasa |
|---|---|
| `pertenece_a_cuenta(id)` | Cualquiera del equipo, incluido el colaborador de mostrador. **Lectura.** |
| `gestiona_cuenta(id)` | Dueño, administrador, o admin de plataforma. **Escritura.** |

Van como función y no como subconsulta por una razón concreta: la política de
`cuentas_equipo` necesita consultar `cuentas_equipo`, y eso dispara **recursión
infinita** de RLS. `security definer` corre con los permisos del dueño de la
función y salta la RLS, cortando el ciclo.

Borrar la cuenta es aparte: **solo el dueño real o un admin de plataforma**. Un
administrador invitado no puede borrar la cuenta que lo invitó.

---

## Planes

El catálogo vive en [`src/lib/lealtad/planes.ts`](../src/lib/lealtad/planes.ts),
**no en la base**: son producto, iguales para todos los clientes. Una tabla
editable sugeriría que cada cuenta puede tener su propia definición de «Crece».

| Plan | Mes | Año | Clientes | Programas | Notif. | Admins | Sedes | Autom. |
|---|---|---|---|---|---|---|---|---|
| Prueba (14 d) | $0 | — | 25 | 1 | 200 | 1 | 1 | 1 |
| Esencial | $9 | $90 | 75 | 2 | 1.000 | 3 | 1 | 2 |
| **Crece** ★ | $27 | $270 | 225 | 6 | 3.500 | 6 | 3 | 10 |
| Pro | $69 | $690 | 750 | 15 | 12.000 | 15 | 10 | ∞ |
| Empresa | a convenir | — | ∞ | ∞ | ∞ | ∞ | ∞ | ∞ |

**Los ocho tipos de tarjeta vienen desde el primer plan.** Lo que se cobra es la
escala, no desbloquear código ya escrito.

**Los topes se hacen cumplir en el servidor**, no solo se pintan:
[`generar.ts`](../src/lib/wallet/generar.ts) (Apple) y
[`google.ts`](../src/lib/wallet/google.ts) (Google) frenan la afiliación nueva
cuando el programa está lleno. Un tope que solo se dibuja es decoración.

Los planes retirados (`basico`, `estandar`, `gratis`, `enterprise`) **siguen
resolviendo y sin topes**: bajarle capacidad a quien ya pagó, por un cambio de
catálogo, sería cobrarle lo mismo por menos.

### Cliente activo

Persona con **al menos un pase vigente** en el periodo:

- Varias tarjetas de la misma persona = **un** cliente.
- Apple Wallet y Google Wallet del mismo pase **no** duplican.
- Los pases vencidos o archivados **no** cuentan.
- Los contactos del CRM son ilimitados — esto cuenta **pases**, no agenda.

---

## Identidad visual

Vive scopeada en `.lealtad` — ver [fundacion-visual.md](fundacion-visual.md).
El resto de Bookea conserva su paleta y su tipografía sin cambios.

---

## Estado y qué falta

| Pieza | Estado |
|---|---|
| `cuentas` + equipo + RLS | 0134 escrita, **pendiente de pegar** |
| Oferta de bienvenida, diseño del pase, config del póster | 0132 escrita, **pendiente de pegar** |
| Catálogo de planes | ✅ en código, 0133 pendiente de pegar |
| Apple Wallet | ✅ en producción |
| Google Wallet | ✅ en producción |
| Ledger de puntos, canjes, auditoría | ✅ en producción |
| Panel con menú lateral | ✅ |
| Código leyendo `cuenta_id` | ❌ sigue leyendo `rancho_id` |
| Los 8 tipos de tarjeta | ❌ hoy solo sellos / puntos / cashback |
| Sedes, campañas, automatizaciones, invitaciones | ❌ |

> Las migraciones las pega el dueño a mano en el SQL Editor. Dejar **una línea en
> blanco antes** del bloque: el pegado se ha comido el primer carácter.
