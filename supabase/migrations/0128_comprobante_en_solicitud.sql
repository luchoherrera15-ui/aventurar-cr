
-- ─────────────────────────────────────────────────────────────────────
-- 0128: el depósito viaja con la solicitud del plan.
--
-- Nadie inicia el programa sin pagar primero: la página de paquetes
-- muestra el SINPE y la cuenta de Bookea, la persona hace el depósito,
-- adjunta la captura y RECIÉN AHÍ puede enviar la solicitud. El
-- comprobante llega en el correo y queda en la fila para el registro.
--
-- Columnas nullables (aditiva, como siempre): la obligatoriedad la
-- pone el servidor al recibir la solicitud, no un NOT NULL que
-- rompería las filas históricas.
-- ─────────────────────────────────────────────────────────────────────

alter table solicitudes_lealtad
  add column if not exists metodo_pago text
    check (metodo_pago is null or metodo_pago in ('sinpe', 'transferencia'));

alter table solicitudes_lealtad
  add column if not exists comprobante_url text
    check (comprobante_url is null or comprobante_url like 'https://%');

comment on column solicitudes_lealtad.metodo_pago is
  'Cómo pagó el depósito: sinpe o transferencia.';
comment on column solicitudes_lealtad.comprobante_url is
  'La captura del depósito (bucket comprobantes). Obligatoria desde la app; nullable por las filas previas.';
