# Plantillas de correo de autenticación (código de acceso)

Estas plantillas se pegan en **Supabase → Authentication → Emails
(Email Templates)**. Son los correos que llegan con el código de 6
dígitos para entrar sin contraseña (web y app móvil usan el mismo
flujo). La variable `{{ .Token }}` es el código — no la borres.

El envío sale por Resend vía SMTP (Supabase → Project Settings →
Authentication → SMTP Settings), así que el remitente debe ser una
dirección del dominio verificado en Resend, p. ej.
`Bookea <acceso@bookea.lat>`.

---

## Plantilla "Magic Link" (cuentas existentes)

**Subject:** `Tu código para entrar a Bookea`

```html
<div style="margin:0 auto;max-width:480px;padding:32px 24px;font-family:'Figtree',Helvetica,Arial,sans-serif;color:#161616;">
  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ee7420;">
    Bookea
  </p>
  <h1 style="margin:10px 0 0;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16295e;">
    Tu código para entrar
  </h1>
  <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#585858;">
    Escribí este código en la pantalla de acceso. Vence en 1 hora.
  </p>
  <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f6f6f6;text-align:center;">
    <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#16295e;">{{ .Token }}</span>
  </div>
  <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a;">
    Si no intentaste entrar a Bookea, ignorá este correo — nadie
    puede entrar sin este código.
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e2e2;" />
  <p style="margin:0;font-size:11.5px;color:#8a8a8a;">
    Bookea — bookea.lat
  </p>
</div>
```

---

## Plantilla "Confirm signup" (correos nuevos: la cuenta se crea con este mismo código)

**Subject:** `Bienvenido a Bookea — tu código de acceso`

```html
<div style="margin:0 auto;max-width:480px;padding:32px 24px;font-family:'Figtree',Helvetica,Arial,sans-serif;color:#161616;">
  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#ee7420;">
    Bookea
  </p>
  <h1 style="margin:10px 0 0;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#16295e;">
    ¡Bienvenido! Este es tu código
  </h1>
  <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#585858;">
    Escribí este código en la pantalla de acceso para activar tu cuenta.
    Vence en 1 hora.
  </p>
  <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f6f6f6;text-align:center;">
    <span style="font-size:34px;font-weight:800;letter-spacing:10px;color:#16295e;">{{ .Token }}</span>
  </div>
  <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a8a;">
    Si no creaste una cuenta en Bookea, ignorá este correo y no se
    creará nada.
  </p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e2e2e2;" />
  <p style="margin:0;font-size:11.5px;color:#8a8a8a;">
    Bookea — bookea.lat
  </p>
</div>
```
