# Bookea Assist

Backend en ASP.NET Core Web API (VB.NET, .NET 8) de un asistente de WhatsApp con IA
(Claude) para negocios de Bookea (bookea.lat, marketplace de reservas de Costa Rica).
Conecta WhatsApp Cloud API (Meta) con Claude (Anthropic) usando tool use para que el
asistente pueda consultar disponibilidad, crear/reprogramar/cancelar turnos y listar
servicios de un negocio en Bookea, todo por chat de WhatsApp. Por ahora usa datos
simulados de un negocio ficticio ("Salón Aurora") vía `FakeBookeaClient` — todavía no
está conectado al backend real de bookea.lat.

## Requisitos

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Una cuenta de Anthropic con API key
- Acceso a la app de Meta ya configurada:
  - App ID: `1421853909854595`
  - WABA ID: `987577911019901`
  - Phone Number ID: `1265169416683985`
  - Número de prueba: `+1 555 673 0482`

## Cómo correr en local

```
cd bookea-assist/src/BookeaAssist.Api
dotnet restore
dotnet run
```

Configurá las variables de entorno (ver sección siguiente) o pegá los valores en
`appsettings.Development.json` (ese archivo está en `.gitignore`, es seguro poner
secretos ahí solo para desarrollo local).

Por defecto levanta en `http://localhost:5080` (definido en
`Properties/launchSettings.json`).

## Variables de entorno necesarias

Usando la convención de ASP.NET Core de doble guion bajo para secciones anidadas:

- `WhatsApp__AccessToken` → el access token permanente del sistema (NUNCA lo pongas
  en `appsettings.json`, solo por variable de entorno).
- `Anthropic__ApiKey` → tu API key de Anthropic.

`WhatsApp__PhoneNumberId` y `WhatsApp__VerifyToken` ya vienen con valores en
`appsettings.json`, no hace falta configurarlos, salvo que quieras cambiarlos.

## Endpoints disponibles

- `GET /webhook` → usado por Meta para verificar el webhook.
- `POST /webhook` → recibe mensajes entrantes de WhatsApp (lo usa Meta, no se llama
  a mano).
- `POST /test/simular-mensaje` → para probar el flujo completo (WhatsApp → Claude →
  Bookea) SIN depender de Meta ni de ngrok. Cuerpo JSON:
  ```json
  { "numeroTelefono": "50688887777", "texto": "Hola, ¿qué servicios tienen?" }
  ```
  Devuelve `{"respuesta": "..."}` con lo que respondería el asistente.

  Ejemplo con curl:
  ```
  curl -X POST http://localhost:5080/test/simular-mensaje -H "Content-Type: application/json" -d "{\"numeroTelefono\":\"50688887777\",\"texto\":\"Hola, quiero un corte de cabello\"}"
  ```

Probar primero con `/test/simular-mensaje` es lo más rápido, antes de meterse con
ngrok y Meta (ver siguiente sección).

## Cómo levantar ngrok y conectar el webhook real de Meta

1. Instalar [ngrok](https://ngrok.com/download) si no lo tenés.
2. Con el backend corriendo en el puerto 5080, en otra terminal: `ngrok http 5080`
3. Copiar la URL https que da ngrok (algo como `https://xxxx.ngrok-free.app`).
4. Ir a [developers.facebook.com/apps/1421853909854595](https://developers.facebook.com/apps/1421853909854595)
   → WhatsApp → Configuration → Webhook → "Edit" (o "Configurar webhooks" en
   Configuración de producción).
5. En "Callback URL" pegar: `[la URL de ngrok]/webhook`
6. En "Verify token" pegar EXACTAMENTE el valor que está en `appsettings.json` bajo
   `WhatsApp:VerifyToken` (a la fecha de este README es:
   `9d003f4f86144b43aed8871276fd7d012614303271ce4e68` — si lo cambiaste, usá tu valor
   actual).
7. Click en "Verify and save". Si todo está bien configurado, el backend debe estar
   corriendo en ese momento para responder la verificación (`GET /webhook`).
8. Suscribirse al campo "messages" del webhook.

Cada vez que se reinicia ngrok (versión gratuita) la URL cambia, así que hay que
repetir este paso y volver a pegar la URL nueva en Meta.

## Prerrequisitos manuales en Meta

Estos no son código, son pasos en el panel de Meta:

- El número de prueba (`+1 555 673 0482`) solo puede mandar/recibir mensajes con
  hasta 5 números de teléfono agregados a mano como "destinatarios de prueba" en el
  panel de Meta (sin verificación de empresa). Agregar ahí el número de WhatsApp con
  el que se va a probar antes de escribirle al bot.
- La verificación de empresa en Meta todavía no está hecha — no bloquea el
  desarrollo, pero sí el paso a producción real con clientes (mientras tanto hay
  límites de destinatarios).

## Estado actual / próximos pasos

- `FakeBookeaClient` tiene datos simulados de "Salón Aurora"; `IBookeaClient` está
  diseñado para poder reemplazarse por un `BookeaApiClient` real (contra la base de
  datos/API real de bookea.lat) sin tocar el resto del código.
- `InMemoryConversationStore` guarda el historial de conversación en memoria — se
  pierde si se reinicia el proceso; está pensado para cambiarse por Redis o una
  tabla de base de datos más adelante.

## Seguridad

Nunca subir tokens/API keys reales al repositorio.
`appsettings.Development.json` está en `.gitignore` justamente para poder pegar ahí
secretos de desarrollo local sin riesgo de commitearlos por accidente.
